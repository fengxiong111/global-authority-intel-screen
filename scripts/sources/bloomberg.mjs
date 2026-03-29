import { fetchFeed, makeItem, keywordTopicFromText, takeFirst } from '../utils.mjs';

const FEEDS = [
  { url: 'https://feeds.bloomberg.com/technology/news.rss', category: 'TECH', topic: 'TECH', sourceType: 'bloomberg-tech', priorityHint: 16 },
  { url: 'https://feeds.bloomberg.com/markets/news.rss', category: 'TECH', topic: 'TECH', sourceType: 'bloomberg-markets', priorityHint: 18 },
  { url: 'https://feeds.bloomberg.com/politics/news.rss', category: 'TECH', topic: 'TECH', sourceType: 'bloomberg-politics', priorityHint: 18 },
  { url: 'https://feeds.bloomberg.com/crypto/news.rss', category: 'CRYPTO_TOOLS', topic: 'BTC', sourceType: 'bloomberg-crypto', priorityHint: 20 },
];

function mapCategory(topic, fallbackCategory) {
  if (topic === 'APPLE') return 'APPLE';
  if (['OPENAI', 'ANTHROPIC', 'CLAUDE', 'CLAUDE_CODE'].includes(topic)) return 'AI';
  if (topic === 'TESLA') return 'TESLA';
  if (['BTC', 'ETF', 'ONEKEY'].includes(topic)) return 'CRYPTO_TOOLS';
  return fallbackCategory;
}

export default async function bloomberg() {
  const feeds = await Promise.all(FEEDS.map((config) => fetchFeed(config.url).then((feed) => ({ feed, config }))));

  return feeds.flatMap(({ feed, config }) =>
    takeFirst(feed.items || [], 4)
      .map((entry, index) => {
        const topic = keywordTopicFromText(`${entry.title} ${entry.contentSnippet || ''}`, config.topic);
        const category = mapCategory(topic, config.category);
        return makeItem({
          source: 'Bloomberg',
          title: entry.title,
          summary: entry.contentSnippet || entry.content || '',
          url: entry.link,
          time: entry.isoDate || entry.pubDate,
          category,
          topic,
          tags: ['BLOOMBERG', category, topic],
          sourceType: config.sourceType,
          official: false,
          hot: index < 2,
          rank: index + 1,
          priorityHint: config.priorityHint - index,
        });
      })
      .filter(Boolean),
  );
}
