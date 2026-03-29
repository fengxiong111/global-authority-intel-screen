import { fetchFeed, makeItem, keywordTopicFromText, takeFirst, cleanText } from '../utils.mjs';

const ACCOUNTS = [
  { handle: 'OpenAI', topic: 'OPENAI', priorityHint: 26, tier: 'core' },
  { handle: 'OpenAIDevs', topic: 'OPENAI', priorityHint: 32, tier: 'core' },
  { handle: 'sama', topic: 'OPENAI', priorityHint: 22, tier: 'core' },
  { handle: 'AnthropicAI', topic: 'ANTHROPIC', priorityHint: 26, tier: 'core' },
  { handle: 'karpathy', topic: 'CLAUDE', priorityHint: 22, tier: 'core' },
  { handle: 'Polymarket', topic: 'BTC', priorityHint: 24, tier: 'market' },
  { handle: 'Kalshi', topic: 'BTC', priorityHint: 24, tier: 'market' },
  { handle: 'DefiantNews', topic: 'BTC', priorityHint: 20, tier: 'market' },
];

const KEYWORDS = [
  'openai',
  'anthropic',
  'claude',
  'codex',
  'agent',
  'agents',
  'plugin',
  'model',
  'release',
  'launch',
  'shipping',
  'bitcoin',
  'btc',
  'etf',
  'options',
  'fund flow',
  'market structure',
  'prediction market',
  'polymarket',
  'kalshi',
  'regulator',
  'regulation',
  'war',
  'iran',
];

function normalizeTweetTitle(title) {
  return cleanText(title)
    .replace(/^RT by @[^:]+:\s*/i, '')
    .replace(/^Replying to @[^:]+:\s*/i, '')
    .replace(/^R to @[^:]+:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesSignal(text) {
  return KEYWORDS.some((keyword) => text.includes(keyword));
}

function looksHot(text) {
  return [
    'breaking',
    'rollout',
    'rolling out',
    'launch',
    'shipping',
    'now available',
    'introduced',
    'plugins',
    'security',
    'bug bounty',
    'market',
    'etf',
    'prediction market',
    'shutdown',
    'war',
    'iran',
    'troops',
    'btc',
    'bitcoin',
    'codex',
  ].some((keyword) => text.includes(keyword));
}

function inferTopic(text, fallback) {
  if (text.includes('polymarket') || text.includes('kalshi') || text.includes('prediction market')) return 'BTC';
  return keywordTopicFromText(text, fallback);
}

function mapCategory(topic) {
  if (topic === 'APPLE') return 'APPLE';
  if (['OPENAI', 'ANTHROPIC', 'CLAUDE', 'CLAUDE_CODE', 'OPENCLAW'].includes(topic)) return 'AI';
  if (['BTC', 'ETF', 'ONEKEY'].includes(topic)) return 'CRYPTO_TOOLS';
  return 'TECH';
}

function toXUrl(link, handle) {
  const match = String(link || '').match(/\/status\/(\d+)/);
  return match ? `https://x.com/${handle}/status/${match[1]}` : link;
}

export default async function xScan() {
  const results = await Promise.allSettled(ACCOUNTS.map(async (account) => {
    const feed = await fetchFeed(`https://nitter.net/${account.handle}/rss`);
    return { account, feed };
  }));

  return results.flatMap((result) => {
    if (result.status !== 'fulfilled') return [];
    const { account, feed } = result.value;
    return takeFirst(feed.items || [], 3)
      .map((entry, index) => {
        const title = normalizeTweetTitle(entry.title);
        const summary = cleanText(entry.contentSnippet || entry.content || '');
        const text = `${title} ${summary}`.toLowerCase();
        if (!title || title.startsWith('@') || /^x\.com\//i.test(title) || title.length < 18 || !includesSignal(text) || !looksHot(text)) return null;
        const topic = inferTopic(text, account.topic);
        const category = mapCategory(topic);
        return makeItem({
          source: 'X',
          title,
          summary,
          url: toXUrl(entry.link, account.handle),
          time: entry.isoDate || entry.pubDate,
          category,
          topic,
          tags: ['X', category, topic],
          sourceType: 'x_hot',
          official: false,
          hot: index === 0,
          rank: index + 1,
          priorityHint: Math.max(18, account.priorityHint - index * 2),
          author: account.handle,
          trustedAuthor: true,
        });
      })
      .filter(Boolean);
  });
}
