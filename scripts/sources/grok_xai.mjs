import { cleanText, readJson } from '../utils.mjs';

const XAI_API_URL = 'https://api.x.ai/v1/responses';
const TOPICS = [
  '科技 / AI',
  '日本新闻',
  '财经 / 时事 / 投资',
  '游戏',
  '电影',
  '书籍',
];

const DIGEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      maxItems: 18,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          topic: { type: 'string' },
          title_zh: { type: 'string' },
          summary_zh: { type: 'string' },
          source_types: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 4,
          },
          original_urls: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 4,
          },
          freshness_hours: { type: 'number' },
          confidence: { type: 'number' },
        },
        required: [
          'topic',
          'title_zh',
          'summary_zh',
          'source_types',
          'original_urls',
          'freshness_hours',
          'confidence',
        ],
      },
    },
  },
  required: ['items'],
};

const BANNED_PATTERNS = [
  '年度回顾',
  '回顾',
  '盘点',
  '趋势',
  '展望',
  '分析',
  '讨论',
  'thread',
  'megathread',
  'roundup',
  'future of',
];

const TOPIC_WEIGHT = new Map([
  ['财经 / 时事 / 投资', 100],
  ['科技 / AI', 94],
  ['日本新闻', 68],
  ['游戏', 52],
  ['电影', 40],
  ['书籍', 36],
]);

function cleanChineseLine(value, limit = 40) {
  let text = cleanText(value)
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  if (text.length > limit) text = `${text.slice(0, limit).trim()}…`;
  return text;
}

function uniqueList(values, limit = 4) {
  const seen = new Set();
  const result = [];
  for (const raw of values || []) {
    const value = cleanText(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeDigestItem(item) {
  const topic = TOPICS.includes(cleanText(item.topic)) ? cleanText(item.topic) : '';
  const title = cleanChineseLine(item.title_zh, 34);
  const summary = cleanChineseLine(item.summary_zh, 48);
  const sourceTypes = uniqueList(item.source_types, 4);
  const originalUrls = uniqueList(item.original_urls, 4).filter((url) => /^https?:\/\//i.test(url));
  const freshness = Number(item.freshness_hours || 0);
  const confidence = Number(item.confidence || 0);

  if (!topic || !title || !summary) return null;
  if (/https?:\/\//i.test(title) || /https?:\/\//i.test(summary)) return null;
  if (BANNED_PATTERNS.some((pattern) => `${title} ${summary}`.toLowerCase().includes(pattern.toLowerCase()))) return null;

  return {
    topic,
    title_zh: title,
    summary_zh: summary,
    source_types: sourceTypes,
    original_urls: originalUrls,
    freshness_hours: Number.isFinite(freshness) ? Math.max(0, Math.min(24, freshness)) : 24,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
  };
}

function boostByKeywords(item) {
  const text = `${item.title_zh} ${item.summary_zh}`.toLowerCase();
  let score = TOPIC_WEIGHT.get(item.topic) || 0;
  if (/(btc|比特币|etf|监管|油价|战争|关税|宏观|美元|市场结构)/i.test(text)) score += 28;
  if (/(openai|anthropic|claude|grok|agent|工具|苹果|apple|芯片)/i.test(text)) score += 22;
  if (/(prediction|预测市场|polymarket|kalshi)/i.test(text)) score += 18;
  if (item.source_types.some((value) => /official|blog|x|news/i.test(value))) score += 8;
  score += Math.round(item.confidence * 20);
  score -= Math.round(item.freshness_hours * 4);
  return score;
}

function buildWhyNow(item) {
  if (item.freshness_hours <= 2) return '刚冒头，值得先看一眼';
  if (item.source_types.some((value) => /official|blog/i.test(value))) return '官方源已给出明确信号';
  if (item.source_types.some((value) => /x/i.test(value))) return 'X 上热度抬头，适合先判断';
  return '短时间内热度抬头，值得先跟';
}

export function buildGrokNow(digestItems) {
  const cleaned = digestItems
    .filter((item) => item && item.freshness_hours <= 6)
    .filter((item) => !BANNED_PATTERNS.some((pattern) => `${item.title_zh} ${item.summary_zh}`.toLowerCase().includes(pattern.toLowerCase())))
    .map((item) => ({
      ...item,
      _rank: boostByKeywords(item),
    }))
    .sort((a, b) => b._rank - a._rank || a.freshness_hours - b.freshness_hours || b.confidence - a.confidence);

  const picked = [];
  const topicCount = new Map();

  for (const item of cleaned) {
    const currentTopicCount = topicCount.get(item.topic) || 0;
    if (currentTopicCount >= 1 && !['科技 / AI', '财经 / 时事 / 投资'].includes(item.topic)) continue;
    if (picked.length >= 4) break;
    picked.push({
      title_zh: item.title_zh,
      topic: item.topic,
      freshness_hours: item.freshness_hours,
      why_now: buildWhyNow(item),
      source_types: item.source_types,
    });
    topicCount.set(item.topic, currentTopicCount + 1);
  }

  return picked;
}

async function callXaiDigest() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('missing XAI_API_KEY');
  }

  const prompt = [
    '你是一个只输出 JSON 的中文高热候选池生成器。',
    '只使用 x_search 搜索过去 24 小时内的高热内容。',
    `固定主题：${TOPICS.join('、')}。`,
    '每个主题最多返回 3 条真正值得关注的内容。',
    '所有 title_zh 和 summary_zh 必须：纯中文、一句话、像挂屏标题，不要 URL，不要长英文，不要日报腔。',
    '排除：年度回顾、趋势分析、泛讨论、空洞观点、营销内容。',
    'summary_zh 不是复述标题，而是再补半步信息，但仍然极短。',
  ].join('\n');

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL || 'grok-4-fast-non-reasoning',
      tools: [{ type: 'x_search' }],
      input: [
        {
          role: 'system',
          content: 'Return strict JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'grok_digest',
          schema: DIGEST_SCHEMA,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`xAI API -> ${response.status}`);
  }

  const payload = await response.json();
  const outputText =
    payload?.output_text
    || payload?.output?.flatMap((entry) => entry.content || []).find((entry) => entry.type === 'output_text')?.text
    || '';
  const parsed = JSON.parse(outputText);
  return Array.isArray(parsed?.items) ? parsed.items.map(normalizeDigestItem).filter(Boolean) : [];
}

export default async function grokXai(existingDigest = [], existingNow = []) {
  try {
    const digest = await callXaiDigest();
    const now = buildGrokNow(digest);
    return { digest, now };
  } catch (error) {
    console.warn(`grokXai: failed -> ${error?.message || error}`);
    return {
      digest: Array.isArray(existingDigest) ? existingDigest : [],
      now: Array.isArray(existingNow) ? existingNow : [],
    };
  }
}

export async function readExistingGrokFiles(digestPath, nowPath) {
  const [digest, now] = await Promise.all([
    readJson(digestPath, []),
    readJson(nowPath, []),
  ]);
  return {
    digest: Array.isArray(digest) ? digest : [],
    now: Array.isArray(now) ? now : [],
  };
}
