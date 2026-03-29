import { fetchFeed, fetchDom, makeItem, keywordTopicFromText, takeFirst, cleanText, toAbsoluteUrl } from '../utils.mjs';

const KEYWORDS = [
  'bitcoin',
  'btc',
  'etf',
  'crypto',
  'stablecoin',
  'prediction market',
  'polymarket',
  'kalshi',
  'regulation',
  'regulator',
  'cftc',
  'sec',
  'options',
  'fund flow',
  'market structure',
];

const FEEDS = [
  {
    source: 'The Block',
    url: 'https://www.theblock.co/rss.xml',
    priorityHint: 20,
    sourceType: 'crypto-media',
  },
  {
    source: 'The Defiant',
    url: 'https://thedefiant.io/feed',
    priorityHint: 20,
    sourceType: 'crypto-media',
  },
];

function includesSignal(text) {
  return KEYWORDS.some((keyword) => text.includes(keyword));
}

function inferTopic(text) {
  if (text.includes('kalshi') || text.includes('polymarket') || text.includes('prediction market')) return 'BTC';
  return keywordTopicFromText(text, 'CRYPTO_TOOLS');
}

function mapCategory(topic) {
  if (['BTC', 'ETF', 'ONEKEY'].includes(topic)) return 'CRYPTO_TOOLS';
  if (['OPENAI', 'ANTHROPIC', 'CLAUDE', 'CLAUDE_CODE'].includes(topic)) return 'AI';
  return 'TECH';
}

async function fetchPolymarketBlog() {
  const urls = [
    'https://www.polymarket.com/blog',
    'https://polymarket.com/blog',
  ];

  for (const url of urls) {
    try {
      const $ = await fetchDom(url);
      const items = [];
      const seen = new Set();

      $('a[href*="/blog/"]').each((index, element) => {
        if (index >= 8) return false;
        const link = $(element).attr('href');
        const title = cleanText($(element).text());
        if (!link || !title || seen.has(link)) return;
        seen.add(link);
        const text = title.toLowerCase();
        if (!includesSignal(text)) return;

        items.push(makeItem({
          source: 'Polymarket Blog',
          title,
          url: toAbsoluteUrl(url, link),
          time: new Date().toISOString(),
          category: 'CRYPTO_TOOLS',
          topic: inferTopic(text),
          tags: ['POLYMARKET', 'CRYPTO_TOOLS', inferTopic(text)],
          sourceType: 'crypto-blog',
          official: true,
          hot: index < 2,
          rank: index + 1,
          priorityHint: 20 - index,
        }));
      });

      if (items.length > 0) return items.filter(Boolean);
    } catch {
      // try next endpoint
    }
  }

  return [];
}

export default async function cryptoNative() {
  const feeds = await Promise.all(FEEDS.map(async (config) => ({ config, feed: await fetchFeed(config.url) })));

  const mediaItems = feeds.flatMap(({ config, feed }) =>
    takeFirst(feed.items || [], 8)
      .map((entry, index) => {
        const title = cleanText(entry.title);
        const summary = cleanText(entry.contentSnippet || entry.content || '');
        const text = `${title} ${summary}`.toLowerCase();
        if (!title || !includesSignal(text)) return null;
        const topic = inferTopic(text);
        const category = mapCategory(topic);
        return makeItem({
          source: config.source,
          title,
          summary,
          url: entry.link,
          time: entry.isoDate || entry.pubDate,
          category,
          topic,
          tags: [config.source, category, topic],
          sourceType: config.sourceType,
          official: false,
          hot: index < 2,
          rank: index + 1,
          priorityHint: Math.max(12, config.priorityHint - index),
        });
      })
      .filter(Boolean),
  );

  const polymarketItems = await fetchPolymarketBlog();
  return [...mediaItems, ...polymarketItems];
}
