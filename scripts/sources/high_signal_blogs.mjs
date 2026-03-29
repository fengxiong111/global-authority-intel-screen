import { fetchFeed, makeItem, keywordTopicFromText, takeFirst, cleanText } from '../utils.mjs';

const FEEDS = [
  {
    source: 'SemiAnalysis',
    url: 'https://semianalysis.com/feed/',
    priorityHint: 22,
    sourceType: 'analysis',
    keywords: ['ai', 'gpu', 'chip', 'chips', 'semiconductor', 'inference', 'training', 'openai', 'anthropic', 'claude', 'apple', 'tesla'],
  },
  {
    source: 'Stratechery',
    url: 'https://stratechery.com/feed/',
    priorityHint: 20,
    sourceType: 'analysis',
    keywords: ['apple', 'openai', 'anthropic', 'claude', 'ai', 'agent', 'agents', 'bitcoin', 'btc', 'etf', 'prediction market', 'kalshi', 'polymarket'],
  },
  {
    source: 'Simon Willison',
    url: 'https://simonwillison.net/atom/everything/',
    priorityHint: 20,
    sourceType: 'blog',
    keywords: ['llm', 'ai', 'openai', 'anthropic', 'claude', 'gpt', 'agent', 'agents', 'coding', 'code', 'model'],
  },
  {
    source: 'Karpathy',
    url: 'https://karpathy.bearblog.dev/feed/',
    priorityHint: 22,
    sourceType: 'blog',
    keywords: ['ai', 'llm', 'gpt', 'openai', 'anthropic', 'claude', 'agent', 'agents', 'model', 'reasoning', 'coding'],
  },
];

function includesSignal(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferTopic(text, fallback = 'TECH') {
  if (text.includes('kalshi') || text.includes('polymarket') || text.includes('prediction market')) return 'BTC';
  return keywordTopicFromText(text, fallback);
}

function mapCategory(topic, text) {
  if (topic === 'APPLE') return 'APPLE';
  if (['OPENAI', 'ANTHROPIC', 'CLAUDE', 'CLAUDE_CODE', 'OPENCLAW'].includes(topic)) return 'AI';
  if (['BTC', 'ETF', 'ONEKEY'].includes(topic) || text.includes('prediction market')) return 'CRYPTO_TOOLS';
  if (topic === 'TESLA') return 'TESLA';
  return 'TECH';
}

export default async function highSignalBlogs() {
  const feeds = await Promise.all(FEEDS.map(async (config) => ({ config, feed: await fetchFeed(config.url) })));

  return feeds.flatMap(({ config, feed }) =>
    takeFirst(feed.items || [], 8)
      .map((entry, index) => {
        const title = cleanText(entry.title);
        const summary = cleanText(entry.contentSnippet || entry.content || '');
        const text = `${title} ${summary}`.toLowerCase();
        if (!title || !includesSignal(text, config.keywords)) return null;

        const topic = inferTopic(text, 'TECH');
        const category = mapCategory(topic, text);

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
}
