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

const TRUSTED_SOURCES = new Set([
  'Bloomberg',
  'GitHub Trending',
  'SemiAnalysis',
  'Stratechery',
  'Simon Willison',
  'Karpathy',
  'The Block',
  'The Defiant',
  'Polymarket Blog',
]);

const EARLY_SIGNAL_GENERIC = new Set([
  'ai',
  'apple',
  'btc',
  'crypto',
  'prediction markets',
  'prediction market',
  'market',
  'macro',
  'war',
  'book',
  'books',
  'movie',
  'movies',
  'tv',
  'game',
  'games',
  'tool',
  'tools',
  'update',
  'updates',
  'release',
  'review',
  'reviews',
  'book review',
  'what',
  'when',
  'why',
  'how',
  'breaking',
  'official',
  'latest',
  'news',
  '发布',
  '更新',
  '图书',
  '电影',
  '剧集',
  '热榜',
  '热门工具',
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
    ['\\bagent[s]?\\b', '智能体'],
    ['\\bcoding agent[s]?\\b', '编程智能体'],
    ['\\bprediction market[s]?\\b', '预测市场'],
    ['\\bstablecoin[s]?\\b', '稳定币'],
    ['\\btokenized stock[s]?\\b', '代币化股票'],
    ['\\blaunches?\\b', '发布'],
    ['\\blaunch\\b', '发布'],
    ['\\bvulnerabilit(y|ies)\\b', '漏洞'],
    ['\\bsecurity\\b', '安全'],
    ['\\bbitcoin\\b', '比特币'],
    ['\\boption[s]?\\b', '期权'],
    ['\\bfee\\b', '费率'],
    ['\\bfund flow\\b', '资金流'],
    ['\\bmarket structure\\b', '市场结构'],
    ['\\binsider betting\\b', '内幕交易'],
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
    [/^Introducing the OpenAI Safety Bug Bounty program$/i, () => 'OpenAI 开放 AI 漏洞赏金'],
    [/^OpenAI to acquire Astral$/i, () => 'OpenAI 将收购 Astral'],
    [/^Introducing GPT-5\.4 mini and nano$/i, () => 'OpenAI 发布 GPT-5.4 mini 和 nano'],
    [/^Introducing Claude Sonnet 4\.6$/i, () => 'Claude Sonnet 4.6 发布'],
    [/^Introducing Claude Opus 4\.6$/i, () => 'Claude Opus 4.6 发布'],
    [/^Apple introduces the new MacBook Air with M5$/i, () => '苹果发布搭载 M5 的新 MacBook Air'],
    [/^Introducing OpenClaw$/i, () => 'OpenClaw 正式发布'],
    [/^OpenClaw Partners with VirusTotal for Skill Security$/i, () => 'OpenClaw 联手 VirusTotal 强化技能安全'],
    [/^Amazon’s AI Resurgence: AWS & Anthropic’s Multi-Gigawatt Trainium Expansion$/i, () => '亚马逊加码 AI：AWS 与 Anthropic 扩建多吉瓦 Trainium'],
    [/^GPT-5 Set the Stage for Ad Monetization and the SuperApp$/i, () => 'GPT-5 为广告变现与超级应用铺路'],
    [/^2025 LLM Year in Review$/i, () => '2025 LLM 年度回顾'],
    [/^Find, validate, and fix vulnerabilities with Codex Security.*$/i, () => 'Codex Security 上线：自动查漏补洞'],
    [/^Morgan Stanley sets spot bitcoin ETF fee at 0\.14%, undercutting every rival on the market$/i, () => 'BTC ETF 价格战打起来了：大摩压到 0.14%'],
    [/^Bitcoin Hits Two-Week Low as \$443M in Longs Get Wiped Out$/i, () => 'BTC 两周新低，4.43 亿美元多头爆仓'],
    [/^California bars officials from prediction market insider betting as federal ban takes shape$/i, () => '加州禁止官员参与预测市场内幕交易，联邦禁令成形'],
    [/^Felix Launches Tokenized Stocks and ETFs on Hyperliquid Via Ondo Finance$/i, () => 'Felix 借助 Ondo 在 Hyperliquid 推出代币化股票与 ETF'],
    [/^Arm Launches Own CPU, Arm’s Motivation, Constraints and Systems$/i, () => 'Arm 推出自研 CPU，动机与约束浮出水面'],
    [/^We['’]re rolling out plugins in Codex\..*$/i, () => 'Codex 开始推送插件能力'],
    [/^GitHub 热门：(.+)$/i, (_, repo) => `${repo} 在 GitHub Trending 爆了`],
    [/^(.+) 在 GitHub Trending 爆了$/i, (_, repo) => `${repo} 在 GitHub Trending 爆了`],
    [/^GitHub 热门工具：(.+)$/i, (_, repo) => `${repo} 冲上 GitHub 热榜`],
    [/^Further human \+ AI \+ proof assistant work on Knuth's "Claude Cycles" problem$/i, () => 'Claude Cycles 难题出现人类+AI+证明器新进展'],
    [/^Andrew Curran: Anthropic May Have Had An Architectural Breakthrough!$/i, () => 'Anthropic 或出现架构级突破'],
    [/^Iran-Backed Houthis Join War as More US Troops Reach Region$/i, () => '中东升级：胡塞下场，美军增兵'],
    [/^Bitcoin Extends Slide as Options Point Toward Deeper Decline$/i, () => 'BTC 期权开始押更深回撤'],
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
  if (TRUSTED_SOURCES.has(item.source) && ['AI', 'TECH', 'APPLE', 'CRYPTO_TOOLS', 'TESLA'].includes(item.category)) return 'A';

  if (item.source === 'Reddit') return 'B';
  if (item.source === 'NYT') return 'B';
  if (item.source === 'X') return 'B';
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
  score -= agePenalty(item.effective_at, now);

  return Math.max(0, Math.min(100, Math.round(score)));
}

function toValidTimestamp(value, now = new Date()) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const ms = numeric > 1e12 ? numeric : numeric * 1000;
    const futureLimit = now.getTime() + 5 * 60 * 1000;
    const pastLimit = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    if (ms > futureLimit || ms < pastLimit) return null;
    return Math.floor(ms / 1000);
  }
  const date = new Date(value);
  const ms = date.getTime();
  if (!Number.isFinite(ms)) return null;
  const futureLimit = now.getTime() + 5 * 60 * 1000;
  const pastLimit = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  if (ms > futureLimit || ms < pastLimit) return null;
  return Math.floor(ms / 1000);
}

function toValidIso(value, now = new Date()) {
  const ts = toValidTimestamp(value, now);
  return ts ? new Date(ts * 1000).toISOString() : '';
}

function normalizeItemTimes(item, now = new Date()) {
  const publishedAt = toValidIso(item.published_at || item.time || item.timestamp, now);
  const fetchedAt = toValidIso(item.fetched_at || now.toISOString(), now) || now.toISOString();
  const effectiveAt = publishedAt || fetchedAt;
  return {
    ...item,
    published_at: publishedAt,
    fetched_at: fetchedAt,
    time_source: publishedAt ? 'published_at' : 'fetched_at',
    effective_at: effectiveAt,
    effective_timestamp: toValidTimestamp(effectiveAt, now),
  };
}

function stripInternal(item) {
  return {
    id: item.id,
    source: item.source,
    title: item.title,
    displayTitle: item.displayTitle || '',
    summary: item.summary || '',
    published_at: item.published_at || '',
    fetched_at: item.fetched_at || '',
    time_source: item.time_source || 'fetched_at',
    category: item.category,
    topic: item.topic,
    priority: item.priority,
    url: item.url,
    hot: item.hot,
    tags: item.tags,
    sourceType: item.sourceType || 'news',
    sources: item.sources || [item.source],
    mergedCount: item.mergedCount || 1,
    sourceLayer: item.sourceLayer || 'B',
    defaultVisible: Boolean(item.defaultVisible),
    author: item.author || '',
    trustedAuthor: Boolean(item.trustedAuthor),
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

    const existingTime = new Date(existing.effective_at).getTime();
    const nextTime = new Date(item.effective_at).getTime();
    const shouldReplace =
      (item.official && !existing.official)
      || (item.priorityHint || 0) > (existing.priorityHint || 0)
      || nextTime > existingTime;

    if (shouldReplace) {
      existing.source = item.source;
      existing.title = item.title;
      existing.summary = item.summary;
      existing.url = item.url;
      existing.published_at = item.published_at;
      existing.fetched_at = item.fetched_at;
      existing.time_source = item.time_source;
      existing.effective_at = item.effective_at;
      existing.effective_timestamp = item.effective_timestamp;
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
    .map((item) => normalizeItemTimes(item, now))
    .filter((item) => item.effective_at);

  for (const item of canonicalItems) {
    const key = dedupeKey(item);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }

    const existingTime = new Date(existing.effective_at).getTime();
    const nextTime = new Date(item.effective_at).getTime();
    if ((item.priorityHint || 0) > (existing.priorityHint || 0) || nextTime > existingTime) {
      seen.set(key, item);
    }
  }

  const deduped = mergeNearDuplicates(
    Array.from(seen.values()).sort((a, b) => new Date(b.effective_at) - new Date(a.effective_at)),
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
    topicCounts.set(item.topic, topicIndex + 1);
  }

  return deduped
    .filter((item) => item.effective_timestamp)
    .sort((a, b) => b.priority - a.priority || b.effective_timestamp - a.effective_timestamp)
    .map(stripInternal);
}

function earlySignalType(item) {
  const text = cleanText(`${item.title} ${item.displayTitle} ${item.summary}`).toLowerCase();
  if (['OPENCLAW', 'OPENAI', 'ANTHROPIC', 'CLAUDE', 'CLAUDE_CODE', 'AI'].includes(item.topic) || item.category === 'AI') return 'AI';
  if (item.topic === 'APPLE' || item.category === 'APPLE') return 'APPLE';
  if (
    item.sourceType === 'github_trending'
    || ['BTC', 'ETF', 'ONEKEY', 'CRYPTO_TOOLS'].includes(item.topic)
    || item.category === 'CRYPTO_TOOLS'
    || ['bitcoin', 'btc', 'crypto', 'prediction market', 'polymarket', 'kalshi', 'etf'].some((term) => text.includes(term))
  ) return 'CRYPTO';
  if (['war', 'iran', 'middle east', 'macro', 'troops', 'houthi', 'regulation', 'regulator'].some((term) => text.includes(term))) return 'MACRO';
  if (item.category === 'GAME' || ['GAME', 'NINTENDO', 'SWITCH', 'LEAGUE_OF_LEGENDS', 'PLAYSTATION', 'SONY'].includes(item.topic)) return 'GAME';
  if (['MOVIE', 'TV'].includes(item.category) || ['MOVIE', 'TV'].includes(item.topic)) return 'SCREEN';
  if (item.category === 'BOOK' || item.topic === 'BOOK') return 'BOOK';
  return 'OTHER';
}

function earlySignalTopic(item) {
  const display = cleanText(item.displayTitle || '');
  const title = cleanText(item.title || '');
  const merged = display || title;
  const repoMatch = merged.match(/(?:GitHub 热门工具：|GitHub 热门：)(.+)$/) || merged.match(/^(.*?)\s*(?:在 GitHub Trending 爆了|冲上 GitHub 热榜)$/);
  if (repoMatch?.[1]) {
    return cleanText(repoMatch[1]).replace(/^[:：\s-]+/, '');
  }

  const quotedCn = merged.match(/《([^》]{2,24})》/);
  if (quotedCn?.[1]) return quotedCn[1];

  const knownPattern = [
    /OpenClaw/i,
    /Codex Security/i,
    /Codex/i,
    /GPT-?\d+(?:\.\d+)?/i,
    /Claude(?:\s(?:Code|Opus|Sonnet))?/i,
    /Anthropic/i,
    /OpenAI/i,
    /Apple|iPhone|MacBook Air|M\d/i,
    /Bitcoin|BTC|Polymarket|Kalshi|ETF/i,
    /Faker/i,
  ];
  for (const pattern of knownPattern) {
    const match = `${title} ${display}`.match(pattern);
    if (match?.[0]) return cleanText(match[0]);
  }

  if (merged.includes('：')) {
    const [head, ...rest] = merged.split('：');
    const candidate = cleanText(head);
    const tail = cleanText(rest.join('：'));
    if (['电影', '剧集', '图书', '苹果', 'OpenAI', 'Anthropic', 'Claude', 'OpenClaw', 'BTC', '比特币'].includes(candidate) && tail.length >= 2 && tail.length <= 24) {
      return tail;
    }
    if (candidate.length >= 2 && candidate.length <= 24 && !EARLY_SIGNAL_GENERIC.has(candidate.toLowerCase())) return candidate;
  }

  const capitalized = title.match(/\b([A-Z][A-Za-z0-9.+-]{2,}(?:\s+[A-Z][A-Za-z0-9.+-]{2,}){0,2})\b/);
  if (capitalized?.[1] && !EARLY_SIGNAL_GENERIC.has(capitalized[1].toLowerCase())) return capitalized[1];

  const compact = merged.replace(/^(电影|剧集|图书|苹果|OpenAI|Anthropic|Claude|OpenClaw|BTC|比特币)[：:]\s*/i, '').trim();
  if (compact && compact.length <= 24) return compact;

  return cleanText(TOPIC_ZH[item.topic] || TOPIC_ZH[item.category] || '');
}

function earlySignalCanonical(topic, type) {
  return `${type}::${canonicalTitleKey(topic).replace(/\b(?:the|a|an|new)\b/g, '').replace(/\s+/g, ' ').trim()}`;
}

function earlySignalItemTime(item) {
  return toValidTimestamp(item.published_at || item.fetched_at || item.time || item.timestamp);
}

function earlySignalRecencyHours(item, nowTs) {
  const ts = earlySignalItemTime(item);
  if (!ts) return Number.POSITIVE_INFINITY;
  return (nowTs - ts) / 3600;
}

function isTrustedMention(item) {
  return Boolean(
    item.trustedAuthor
    || OFFICIAL_SOURCES.has(item.source)
    || TRUSTED_SOURCES.has(item.source)
    || item.source === 'X'
    || ['product', 'release', 'blog', 'press'].includes(item.sourceType)
    || String(item.sourceType || '').startsWith('bloomberg')
    || String(item.sourceType || '').startsWith('nyt-')
  );
}

function isCommunityMention(item) {
  return item.source === 'Reddit'
    || item.source === 'Hacker News'
    || item.sourceType === 'community_hot'
    || item.sourceType === 'reddit';
}

function rankingChanged(item, previousRank) {
  const rank = Number(item.rank || 0);
  if (!rank) return false;
  if (!previousRank) return rank <= 5;
  return previousRank - rank >= 2;
}

function growthContribution(item, nowTs) {
  const hours = earlySignalRecencyHours(item, nowTs);
  let score = 0;
  if (hours <= 6) score += 0.24;
  else if (hours <= 24) score += 0.18;
  else if (hours <= 72) score += 0.08;

  if (item.sourceType === 'x_hot') score += 0.18;
  if (item.sourceType === 'github_trending') score += 0.16;
  if (item.sourceType === 'community_hot') score += 0.14;
  if (isTrustedMention(item)) score += 0.10;
  if (isCommunityMention(item)) score += 0.10;
  if (item.hot) score += 0.06;
  if ((item.score || 0) >= 800 || (item.comments || 0) >= 120) score += 0.08;
  if (Number(item.rank || 0) > 0 && Number(item.rank || 0) <= 5) score += 0.10;

  return score;
}

function previousBestRank(previousItems) {
  const best = new Map();
  for (const item of previousItems || []) {
    const type = earlySignalType(item);
    const topic = earlySignalTopic(item);
    const key = earlySignalCanonical(topic, type);
    if (!type || !topic || !key) continue;
    const rank = Number(item.rank || 0);
    if (!rank) continue;
    const existing = best.get(key);
    if (!existing || rank < existing) best.set(key, rank);
  }
  return best;
}

function previousFirstSeen(previousSignals) {
  const seen = new Map();
  for (const item of previousSignals || []) {
    const key = earlySignalCanonical(item.topic, item.type);
    if (!key || !item.first_seen_at) continue;
    seen.set(key, item.first_seen_at);
  }
  return seen;
}

export function buildEarlySignalPool(currentItems, previousItems = [], previousSignals = []) {
  const nowTs = Math.floor(Date.now() / 1000);
  const previousRanks = previousBestRank(previousItems);
  const previousSeen = previousFirstSeen(previousSignals);
  const pool = new Map();

  for (const item of currentItems || []) {
    const hours = earlySignalRecencyHours(item, nowTs);
    if (!Number.isFinite(hours) || hours > 72) continue;

    const type = earlySignalType(item);
    const topic = earlySignalTopic(item);
    const key = earlySignalCanonical(topic, type);
    if (!type || !topic || !key) continue;
    if (topic.length < 2 || EARLY_SIGNAL_GENERIC.has(topic.toLowerCase())) continue;
    if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(topic) && !['AI', 'APPLE', 'CRYPTO', 'MACRO'].includes(type)) continue;

    const itemTs = earlySignalItemTime(item);
    const entry = pool.get(key) || {
      topic,
      type,
      mentions: 0,
      ranking_change: false,
      _trusted: new Set(),
      _community: new Set(),
      _sources: new Set(),
      _growthRaw: 0,
      _firstSeenTs: itemTs || nowTs,
      _latestTs: itemTs || 0,
    };

    entry.mentions += 1;
    entry._growthRaw += growthContribution(item, nowTs);
    if (isTrustedMention(item)) entry._trusted.add(item.author || item.source);
    if (isCommunityMention(item)) entry._community.add(item.id || `${item.source}:${item.title}`);
    entry._sources.add(item.source);
    entry._firstSeenTs = Math.min(entry._firstSeenTs, itemTs || nowTs);
    entry._latestTs = Math.max(entry._latestTs, itemTs || 0);
    if (rankingChanged(item, previousRanks.get(key))) entry.ranking_change = true;

    const rememberedFirstSeen = previousSeen.get(key);
    if (rememberedFirstSeen) {
      const rememberedTs = toValidTimestamp(rememberedFirstSeen);
      if (rememberedTs) entry._firstSeenTs = Math.min(entry._firstSeenTs, rememberedTs);
    }

    pool.set(key, entry);
  }

  return Array.from(pool.values())
    .map((entry) => {
      const trusted_mentions = entry._trusted.size;
      const community_hits = entry._community.size;
      const sourceCount = entry._sources.size;
      const freshness = entry._latestTs >= nowTs - 24 * 3600 ? 0.08 : 0;
      const diversity = Math.min(0.12, sourceCount * 0.04);
      const mentionLift = Math.min(0.22, Math.max(0, entry.mentions - 1) * 0.06);
      const trustedLift = Math.min(0.18, trusted_mentions * 0.08);
      const communityLift = Math.min(0.16, community_hits * 0.08);
      const rankingLift = entry.ranking_change ? 0.14 : 0;
      const growth_score = Math.min(1, Number((entry._growthRaw + freshness + diversity + mentionLift + trustedLift + communityLift + rankingLift).toFixed(2)));

      const conditions = [
        entry.mentions >= 3 && community_hits >= 1,
        trusted_mentions >= 2,
        entry.ranking_change && entry.mentions >= 2,
        growth_score >= 0.7,
      ].filter(Boolean).length;

      return {
        topic: entry.topic,
        type: entry.type,
        mentions: entry.mentions,
        trusted_mentions,
        community_hits,
        ranking_change: entry.ranking_change,
        growth_score,
        first_seen_at: new Date(entry._firstSeenTs * 1000).toISOString(),
        sources: Array.from(entry._sources).sort(),
        _conditions: conditions,
        _latestTs: entry._latestTs,
      };
    })
    .filter((entry) => entry._conditions >= 2)
    .sort((a, b) => b.growth_score - a.growth_score || b.mentions - a.mentions || b._latestTs - a._latestTs)
    .slice(0, 24)
    .map(({ _conditions, _latestTs, ...entry }) => entry);
}
