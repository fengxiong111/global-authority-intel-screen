import { cleanText, stableId, uniqueStrings } from './utils.mjs';

const TOPIC_BOOST = new Set([
  'APPLE',
  'OPENAI',
  'ANTHROPIC',
  'TESLA',
  'NINTENDO',
  'SONY',
  'OPENCLAW',
  'CLAUDE',
  'CLAUDE_CODE',
  'ONEKEY',
  'PLAYSTATION',
  'SWITCH',
  'LEAGUE_OF_LEGENDS',
]);

const OFFICIAL_SOURCES = new Set([
  'Apple Newsroom',
  'OpenAI News',
  'Anthropic Newsroom',
  'Nintendo News',
  'Riot Games',
  'Sony Interactive',
  'PlayStation Blog',
  'Tesla IR',
  'OpenClaw GitHub',
  'OpenClaw Blog',
  'OneKey Blog',
]);

const CHART_SOURCES = new Set([
  'JustWatch Movies',
  'JustWatch TV',
  'Douban Movie Chart',
  'IMDb Movies',
  'IMDb TV',
]);

const TOPIC_ZH = {
  APPLE: '苹果',
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic',
  CLAUDE: 'Claude',
  CLAUDE_CODE: 'Claude Code',
  NINTENDO: '任天堂',
  SWITCH: 'Switch',
  LEAGUE_OF_LEGENDS: '英雄联盟',
  PLAYSTATION: 'PlayStation',
  SONY: '索尼',
  TESLA: '特斯拉',
  OPENCLAW: 'OpenClaw',
  ONEKEY: 'OneKey',
  TECH: '科技',
  MOVIE: '电影',
  TV: '剧集',
  BOOK: '图书',
  NYT: '纽约时报',
};

const TOPIC_BASE_WORDS = {
  APPLE: ['apple', 'iphone'],
  OPENAI: ['openai'],
  ANTHROPIC: ['anthropic'],
  CLAUDE: ['claude'],
  CLAUDE_CODE: ['claude code'],
  NINTENDO: ['nintendo'],
  SWITCH: ['switch'],
  LEAGUE_OF_LEGENDS: ['league of legends', 'lec', 'lck'],
  PLAYSTATION: ['playstation', 'ps5', 'saros'],
  SONY: ['sony'],
  TESLA: ['tesla'],
  OPENCLAW: ['openclaw'],
  ONEKEY: ['onekey'],
};

function canonicalTitleKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasCjk(value) {
  return /[\u4e00-\u9fff]/.test(String(value ?? ''));
}

function cjkRatio(value) {
  const text = String(value ?? '');
  const visible = text.replace(/\s/g, '');
  if (!visible) return 0;
  const cjk = (visible.match(/[\u4e00-\u9fff]/g) || []).length;
  return cjk / visible.length;
}

const TITLE_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'for',
  'in',
  'on',
  'at',
  'with',
  'from',
  'by',
  'is',
  'are',
  'was',
  'were',
  'be',
  'as',
  'it',
  'its',
  'after',
  'before',
  'this',
  'that',
  'new',
  'now',
  'how',
  'why',
  'what',
]);

function dedupeKey(item) {
  return `${item.topic}::${canonicalTitleKey(item.title)}`;
}

function titleTokens(value) {
  return canonicalTitleKey(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !TITLE_STOPWORDS.has(token));
}

function sharedTokenCount(tokensA, tokensB) {
  const pool = new Set(tokensA);
  let count = 0;
  for (const token of tokensB) {
    if (pool.has(token)) count += 1;
  }
  return count;
}

function isMergedEvent(primary, candidate) {
  if (primary.topic !== candidate.topic) return false;

  const keyA = canonicalTitleKey(primary.title);
  const keyB = canonicalTitleKey(candidate.title);

  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  if (Math.min(keyA.length, keyB.length) >= 36 && (keyA.includes(keyB) || keyB.includes(keyA))) {
    return true;
  }

  const tokensA = titleTokens(primary.title);
  const tokensB = titleTokens(candidate.title);
  const common = sharedTokenCount(tokensA, tokensB);
  const baseline = Math.min(tokensA.length, tokensB.length);

  return baseline >= 4 && common >= 4 && common / baseline >= 0.8;
}

function uniqueSources(...groups) {
  const seen = new Set();
  const result = [];
  for (const group of groups.flat()) {
    const value = cleanText(group);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function agePenalty(itemTime, now) {
  const ageHours = (now.getTime() - new Date(itemTime).getTime()) / (1000 * 60 * 60);
  if (!Number.isFinite(ageHours) || ageHours <= 24) return 0;
  const extraDays = Math.max(0, Math.floor((ageHours - 24) / 24));
  return Math.min(30, 8 + extraDays * 6);
}

function trimTitleNoise(value) {
  return cleanText(value)
    .replace(/\s*\/\s*Post-Match Discussion.*$/i, '')
    .replace(/\s*[-—|:]\s*(discussion|thread|megathread|live|live updates|update)\s*$/i, '')
    .replace(/^(discussion|thread|megathread|live updates?):\s*/i, '')
    .replace(/\s*[-—|]\s*(Reuters|Bloomberg|IGN|GameSpot|Variety)\s*$/i, '')
    .replace(/^Live Updates:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleLooksLowSignal(value) {
  const text = cleanText(value);
  return (
    /^[A-Z][A-Za-z. ]+\s\d{1,2}:\d{2}$/.test(text)
    || /^[A-Z0-9 '&.-]{6,}$/.test(text)
  );
}

function clipTitle(value, limit = 48) {
  const text = cleanText(value);
  if (!text) return '';
  if (text.length <= limit) return text;
  const sliced = text.slice(0, limit);
  const cut = Math.max(sliced.lastIndexOf(' '), sliced.lastIndexOf('：'), sliced.lastIndexOf('，'));
  return `${(cut > 18 ? sliced.slice(0, cut) : sliced).trim()}…`;
}

function looksLikeLowSignalChartTitle(value) {
  const text = cleanText(value);
  return (
    /combined print/i.test(text)
    || /hardcover/i.test(text)
    || /paperback/i.test(text)
    || /best seller/i.test(text)
    || /top 10/i.test(text)
  );
}

function replaceCi(value, pattern, replacement) {
  return value.replace(new RegExp(pattern, 'gi'), replacement);
}

function topicPrefixNeeded(item, text) {
  const prefix = TOPIC_ZH[item.topic] || TOPIC_ZH[item.category] || '';
  if (!prefix) return '';

  const lower = cleanText(text).toLowerCase();
  const baseWords = TOPIC_BASE_WORDS[item.topic] || [];
  const alreadyContainsTopic = baseWords.some((word) => lower.startsWith(word) || lower.includes(word));
  const alreadyChineseTopic = lower.includes(prefix.toLowerCase());

  return alreadyContainsTopic || alreadyChineseTopic ? '' : prefix;
}

function finalizeDisplayTitle(item, value) {
  let text = cleanText(value)
    .replace(/\bdiscussion\b/gi, '')
    .replace(/\bthread\b/gi, '')
    .replace(/\blive updates?\b/gi, '最新')
    .replace(/\bupdate\b/gi, '')
    .replace(/\bmegathread\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .replace(/：\s*：/g, '：')
    .replace(/\s*：\s*/g, '：')
    .trim();

  const prefix = topicPrefixNeeded(item, text);
  if (cjkRatio(text) < 0.18 && prefix) {
    text = `${prefix}：${text}`;
  }

  if (prefix && text.toLowerCase().startsWith(`${prefix.toLowerCase()}：${prefix.toLowerCase()}`)) {
    text = `${prefix}：${text.slice(prefix.length + 1 + prefix.length + 1)}`;
  }

  return clipTitle(text, 40);
}

function genericChineseTitle(item, rawTitle) {
  let text = trimTitleNoise(rawTitle);
  if (titleLooksLowSignal(text) && item.summary) {
    text = trimTitleNoise(item.summary);
  }

  const replacements = [
    ['\\bLive Updates\\b', '最新进展'],
    ['\\bDelivery Consensus\\b', '交付预期'],
    ['\\bPost-Match Discussion\\b', '赛后讨论'],
    ['\\bOfficial\\b', '官方'],
    ['\\bPodcast\\b', '播客'],
    ['\\bRumors?\\b', '传闻'],
    ['\\bReleasing\\b', '将发布'],
    ['\\bRecalled\\b', '被召回'],
    ['\\bshutting down\\b', '将停止运营'],
    ['\\bupdate on\\b', '关于'],
    ['\\bnew\\b', '新'],
    ['\\btwo\\b', '两款'],
    ['\\bthree\\b', '三项'],
    ['\\bthis year\\b', '今年'],
    ['\\bapps\\b', '应用'],
    ['\\bapp\\b', '应用'],
    ['\\bmovie\\b', '电影'],
    ['\\bmovies\\b', '电影'],
    ['\\bTV\\b', '剧集'],
    ['\\bwar\\b', '战事'],
    ['\\blive\\b', '最新'],
    ['\\barrive\\b', '抵达'],
    ['\\bMiddle East\\b', '中东'],
    ['\\bMarines\\b', '海军陆战队'],
    ['\\bpeople\\b', '用户'],
    ['\\bteam\\b', '队伍'],
    ['\\bfired\\b', '被解雇'],
    ['\\breplaced with AI\\b', '被 AI 取代'],
    ['\\bbetrayed\\b', '背刺'],
    ['\\bmanagement\\b', '管理层'],
    ['\\bdegraded\\b', '性能下降'],
    ['\\bno notice\\b', '且没有通知'],
    ['\\bprompt injection\\b', '提示注入'],
    ['\\bwatching me write code manually\\b', '看我手写代码'],
    ['\\bdaily limit\\b', '日额度'],
    ['\\bfull lp refund\\b', '全额返还 LP'],
    ['\\bdriver[\'’]s license\\b', '数字驾照'],
    ['\\bfeature\\b', '功能'],
    ['\\bshutting down\\b', '停止运营'],
    ['\\bstate[s]?\\b', '州'],
    ['\\bplan to offer\\b', '计划支持'],
  ];

  for (const [pattern, replacement] of replacements) {
    text = replaceCi(text, pattern, replacement);
  }

  text = text
    .replace(/\bApple\b/g, '苹果')
    .replace(/\bNintendo\b/g, '任天堂')
    .replace(/\bTesla\b/g, '特斯拉')
    .replace(/\bSony\b/g, '索尼')
    .replace(/\bPlayStation\b/g, 'PlayStation')
    .replace(/\bOpenAI\b/g, 'OpenAI')
    .replace(/\bAnthropic\b/g, 'Anthropic')
    .replace(/\bClaude\b/g, 'Claude')
    .replace(/\bSwitch\b/g, 'Switch')
    .replace(/\bLeague of Legends\b/gi, '英雄联盟')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim();

  return finalizeDisplayTitle(item, text);
}

function displayTitleForItem(item) {
  const rawTitle = trimTitleNoise(item.title);
  if (!rawTitle) return '';

  if (hasCjk(rawTitle)) {
    return clipTitle(rawTitle, 40);
  }

  const exactPatterns = [
    [/^Q([1-4]) (\d{4})$/i, (_, quarter, year) => `特斯拉 ${year} 年 Q${quarter} 季度更新`],
    [/^Q([1-4]) (\d{4}) Delivery Consensus$/i, (_, quarter, year) => `特斯拉 ${year} 年 Q${quarter} 交付预期`],
    [/^OpenClaw ([\d.]+)-beta\.(\d+)$/i, (_, version, beta) => `OpenClaw 测试版更新 ${version} Beta ${beta}`],
    [/^OpenClaw ([\d.]+(?:-beta\.\d+)?)$/i, (_, version) => `OpenClaw 正式版更新 ${version.replace('-beta.', ' Beta ')}`],
    [/^Judge Stays Pentagon[’']s Labeling of Anthropic as [‘']Supply Chain Risk[’']$/i, () => '法官叫停五角大楼将 Anthropic 列为“供应链风险”'],
    [/^Apple adds new partners to its American Manufacturing Program$/i, () => '苹果为美国制造计划新增合作伙伴'],
    [/^Introducing the OpenAI Safety Bug Bounty program$/i, () => 'OpenAI 启动安全漏洞赏金计划'],
    [/^OpenAI to acquire Astral$/i, () => 'OpenAI 将收购 Astral'],
    [/^Introducing GPT-5\.4 mini and nano$/i, () => 'OpenAI 发布 GPT-5.4 mini 和 nano'],
    [/^Introducing Claude Sonnet 4\.6$/i, () => 'Claude Sonnet 4.6 发布'],
    [/^Introducing Claude Opus 4\.6$/i, () => 'Claude Opus 4.6 发布'],
    [/^Apple introduces the new MacBook Air with M5$/i, () => '苹果发布搭载 M5 的新 MacBook Air'],
    [/^Iran-Backed Houthis Join War as More US Troops Reach Region$/i, () => '胡塞武装卷入战事：更多美军抵达中东'],
    [/^Bitcoin Extends Slide as Options Point Toward Deeper Decline$/i, () => '比特币继续下跌：期权市场预示更深回撤'],
    [/^Kalshi Secures License to Offer Margin Trading to Pros$/i, () => 'Kalshi 获批向专业用户提供保证金交易'],
    [/^\(For Southeast Asia\) New Price Changes for PS5, PS5 Pro, and PlayStation Portal remote player$/i, () => '东南亚地区：PS5、PS5 Pro 与 Portal 调价'],
    [/^Official PlayStation Podcast Episode (\d+): Speaking Saros$/i, (_, episode) => `PlayStation 播客第 ${episode} 期：聊聊《Saros》`],
    [/^Official PlayStation Podcast Episode (\d+): (.+)$/i, (_, episode, rest) => `PlayStation 播客第 ${episode} 期：${clipTitle(trimTitleNoise(rest), 18)}`],
    [/^Apple Releasing Two New iPhone Apps This Year$/i, () => '苹果今年将发布两款新的 iPhone 应用'],
    [/^Switch 2 Rumors: Zelda Remake and Star Fox Lead a Different 2026$/i, () => 'Switch 2 传闻：《塞尔达》重制版与 Star Fox 或领衔 2026'],
    [/^Switch 2 Rumors:\s*(.+)$/i, (_, rest) => `Switch 2 传闻：${genericChineseTitle(item, rest)}`],
    [/^Iran War Live Updates: U\.S\. Marines Arrive in Middle East, as Houthis Enter War$/i, () => '伊朗战事最新进展：美军抵达中东，胡塞武装卷入'],
    [/^U\.S\. Marines Arrive in Middle East, as Houthis Enter War$/i, () => '伊朗战事最新进展：美军抵达中东，胡塞武装卷入'],
    [/^Iran War Live Updates:\s*(.+)$/i, (_, rest) => `伊朗战事最新进展：${genericChineseTitle(item, rest)}`],
    [/^(.+?) vs\. (.+?) \//i, (_, teamA, teamB) => `${teamA} 对 ${teamB} 赛后讨论`],
    [/^Same \$100\/month\..+No notice\.$/i, () => '同样 100 美元月费：整个工作日性能下降且没有通知'],
    [/^People are really trying anything to get access to Claude\.?$/i, () => '为了拿到 Claude 访问权限，用户开始无所不用其极'],
    [/^Full LP refund for having AFKs on your team!?$/i, () => '队友挂机时将全额返还 LP'],
    [/^I['’]ve been .*prompt injection$/i, () => '简单提示注入反而让 AI 模型结果更好'],
    [/^Claude watching me write code manually after I hit the daily limit$/i, () => 'Claude 日额度触顶后，用户开始手写代码'],
    [/^Elder Scrolls .*shutting down.*$/i, () => '《上古卷轴：刀锋》将在今夏停止运营'],
    [/^Before Mario and the NES, Nintendo was founded in 1889.*$/i, () => '任天堂在做游戏前，其实是一家做花札纸牌的公司'],
    [/^The real danger of AGI isn['’]t a robot uprising.*$/i, () => 'AGI 的真正风险，不是机器人起义，而是公众失去议价能力'],
    [/^These U\.S\. States Plan to Offer iPhone['’]s Driver['’]s License Feature$/i, () => '更多美国州计划支持 iPhone 数字驾照功能'],
    [/^Skyrim Still Looks Awesome on Switch 2!?$/i, () => '《上古卷轴 5》在 Switch 2 上依旧很能打'],
    [/^Claude can control your computer now, openclaw and zenmux updated same day$/i, () => 'Claude 已能直接控制电脑，OpenClaw 和 Zenmux 同日更新'],
    [/^Kingdom Come: Deliverance 2 dev says he was .*replaced with AI.*$/i, () => '《天国：拯救 2》开发者称自己被 AI 取代'],
    [/^Dario Amodei: OpenAI President Brockman.*25 Million.*$/i, () => 'Dario Amodei 痛批 Brockman 向亲特朗普 PAC 捐出 2500 万美元'],
    [/^Saros['’] world-altering eclipse .*$/i, () => '《Saros》的“灭世日食”同时服务玩法与叙事'],
    [/^Security Blind Spots of Hardware Wallets: Analyzing the Covert Threat of Supply Chain Attacks$/i, () => '硬件钱包的安全盲区：供应链攻击的隐蔽风险'],
    [/^10 Million Grill Brushes Recalled After Some People Ingested Loose Bristles$/i, () => '1000 万把烧烤刷被召回：已有用户误吞脱落刷毛'],
  ];

  for (const [pattern, formatter] of exactPatterns) {
    const match = rawTitle.match(pattern);
    if (match) {
      return finalizeDisplayTitle(item, formatter(...match));
    }
  }

  return finalizeDisplayTitle(item, genericChineseTitle(item, rawTitle));
}

function isQualifiedChineseTitle(value) {
  const text = cleanText(value);
  if (!text) return false;
  if (text.length < 6) return false;
  if (!hasCjk(text)) return false;
  const tail = text.includes('：') ? text.split('：').slice(1).join('：').trim() : text;
  if (titleLooksLowSignal(tail)) return false;
  if (cjkRatio(text) < 0.18 && text.length > 18) return false;
  if (/[A-Za-z]{18,}/.test(text.replace(/\s+/g, ''))) return false;
  if (/^[A-Z][A-Za-z. ]+\s\d{1,2}:\d{2}$/.test(text)) return false;
  return true;
}

function isMajorEvent(item) {
  const text = cleanText(`${item.title} ${item.summary}`).toLowerCase();
  return ['war', 'iran', 'middle east', 'marines', 'trump', 'economy'].some((keyword) => text.includes(keyword));
}

function classifySourceLayer(item) {
  if (CHART_SOURCES.has(item.source)) return 'C';
  if (item.source === 'NYT' && ['BOOK', 'MOVIE', 'TV'].includes(item.category)) return 'C';
  if (item.source === 'NYT' && looksLikeLowSignalChartTitle(item.displayTitle || item.title)) return 'C';
  if (item.source === 'Reddit' && !isQualifiedChineseTitle(item.displayTitle || '')) return 'C';

  if (OFFICIAL_SOURCES.has(item.source)) return 'A';
  if (item.source === 'NYT' && (isMajorEvent(item) || ['AI', 'TECH', 'APPLE', 'TESLA'].includes(item.category))) return 'A';
  if (item.source === 'Bloomberg' && (isMajorEvent(item) || ['AI', 'TECH', 'APPLE', 'TESLA', 'CRYPTO_TOOLS'].includes(item.category))) return 'A';

  if (item.source === 'Reddit') return 'B';
  if (item.source === 'NYT') return 'B';
  return 'B';
}

function computePriority(item, topicIndex, now) {
  let score = 50 + (item.priorityHint || 0);

  if (item.official && ['release', 'changelog', 'product', 'press'].includes(item.sourceType)) {
    score += 30;
  } else if (item.official) {
    score += 20;
  }

  if (String(item.sourceType).startsWith('nyt-')) {
    score += 20;
  }

  if (String(item.sourceType).startsWith('bloomberg-')) {
    score += 20;
  }

  if (item.sourceType === 'github-trending') {
    score += 18;
  }

  if (item.rank && item.rank <= 10) {
    score += 15;
  }

  if (TOPIC_BOOST.has(item.topic)) {
    score += 10;
  }

  if (item.sourceType === 'release' || item.sourceType === 'changelog') {
    score += 5;
  }

  score -= Math.min(16, topicIndex * 4);
  score -= agePenalty(item.time, now);

  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeItemTime(item) {
  if (item.time) return item.time;
  const numeric = Number(item.timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return new Date(numeric * 1000).toISOString();
}

function toValidTimestamp(value, now = new Date()) {
  const date = new Date(value);
  const ms = date.getTime();
  if (!Number.isFinite(ms)) return null;
  const futureLimit = now.getTime() + 5 * 60 * 1000;
  const pastLimit = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  if (ms > futureLimit || ms < pastLimit) return null;
  return Math.floor(ms / 1000);
}

function stripInternal(item) {
  return {
    id: item.id,
    timestamp: item.timestamp,
    source: item.source,
    title: item.title,
    displayTitle: item.displayTitle || '',
    summary: item.summary || '',
    category: item.category,
    topic: item.topic,
    priority: item.priority,
    url: item.url,
    hot: item.hot,
    tags: item.tags,
    sources: item.sources || [item.source],
    mergedCount: item.mergedCount || 1,
    sourceLayer: item.sourceLayer || 'B',
    defaultVisible: Boolean(item.defaultVisible),
  };
}

function mergeNearDuplicates(items) {
  const merged = [];

  for (const item of items) {
    const existing = merged.find((current) => isMergedEvent(current, item));
    if (!existing) {
      merged.push({
        ...item,
        sources: [item.source],
        mergedCount: 1,
      });
      continue;
    }

    existing.mergedCount += 1;
    existing.sources = uniqueSources(existing.sources, item.sources || [item.source]);
    existing.hot = existing.hot || item.hot;
    existing.priorityHint = Math.max(existing.priorityHint || 0, item.priorityHint || 0);

    const existingTime = new Date(existing.time).getTime();
    const nextTime = new Date(item.time).getTime();
    const shouldReplace =
      (item.official && !existing.official)
      || (item.priorityHint || 0) > (existing.priorityHint || 0)
      || nextTime > existingTime;

    if (shouldReplace) {
      existing.source = item.source;
      existing.title = item.title;
      existing.summary = item.summary;
      existing.url = item.url;
      existing.time = item.time;
      existing.category = item.category;
      existing.topic = item.topic;
      existing.official = item.official;
      existing.sourceType = item.sourceType;
      existing.rank = item.rank;
      existing.score = item.score;
      existing.comments = item.comments;
      existing.tags = uniqueStrings([existing.tags || [], item.tags || []], 3);
    }
  }

  return merged;
}

export function normalizeFeed(items) {
  const now = new Date();
  const seen = new Map();
  const canonicalItems = items
    .filter(Boolean)
    .map((item) => ({
      ...item,
      time: normalizeItemTime(item),
    }))
    .filter((item) => item.time);

  for (const item of canonicalItems) {
    const key = dedupeKey(item);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }

    const existingTime = new Date(existing.time).getTime();
    const nextTime = new Date(item.time).getTime();
    if ((item.priorityHint || 0) > (existing.priorityHint || 0) || nextTime > existingTime) {
      seen.set(key, item);
    }
  }

  const deduped = mergeNearDuplicates(
    Array.from(seen.values()).sort((a, b) => new Date(b.time) - new Date(a.time)),
  );
  const topicCounts = new Map();

  for (const item of deduped) {
    const topicIndex = topicCounts.get(item.topic) || 0;
    item.priority = computePriority(item, topicIndex, now);
    const nextDisplayTitle = displayTitleForItem(item);
    item.displayTitle = isQualifiedChineseTitle(nextDisplayTitle) ? nextDisplayTitle : '';
    item.hot = Boolean(item.hot || item.priority >= 75 || (item.rank && item.rank <= 5));
    item.sourceLayer = classifySourceLayer({ ...item, displayTitle: nextDisplayTitle });
    item.defaultVisible = item.sourceLayer === 'A' && item.priority >= 60 && isQualifiedChineseTitle(item.displayTitle);
    item.tags = uniqueStrings([item.category, item.topic, ...(item.tags || [])], 3);
    item.id = stableId([item.source, item.topic, item.title, item.url, item.mergedCount || 1]);
    item.timestamp = toValidTimestamp(item.time, now);
    topicCounts.set(item.topic, topicIndex + 1);
  }

  return deduped
    .filter((item) => item.timestamp)
    .sort((a, b) => b.priority - a.priority || b.timestamp - a.timestamp)
    .map(stripInternal);
}
