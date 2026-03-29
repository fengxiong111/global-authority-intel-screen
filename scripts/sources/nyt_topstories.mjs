import { fetchFeed, makeItem, keywordTopicFromText, takeFirst } from '../utils.mjs';

const FEEDS = [
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', category: 'TECH', topic: 'TECH' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', category: 'TECH', topic: 'TECH' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml', category: 'MOVIE', topic: 'MOVIE' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Television.xml', category: 'TV', topic: 'TV' },
];

function mapCategory(topic, fallbackCategory) {
  if (topic === 'APPLE') return 'APPLE';
  if (['OPENAI', 'ANTHROPIC', 'CLAUDE', 'CLAUDE_CODE'].includes(topic)) return 'AI';
  if (topic === 'TESLA') return 'TESLA';
  return fallbackCategory;
}

export default async function nytTopstories() {
  const feeds = await Promise.all(FEEDS.map((config) => fetchFeed(config.url).then((feed) => ({ feed, config }))));

  return feeds.flatMap(({ feed, config }) =>
    takeFirst(feed.items || [], 4)
      .map((entry) => {
        const topic = keywordTopicFromText(`${entry.title} ${entry.contentSnippet || ''}`, config.topic);
        const category = mapCategory(topic, config.category);
        return makeItem({
          source: 'NYT',
          title: entry.title,
          summary: entry.contentSnippet || entry.content || '',
          url: entry.link,
          time: entry.isoDate || entry.pubDate,
          category,
          topic,
          tags: ['NYT', category, topic],
          sourceType: 'nyt-topstories',
          official: false,
          hot: false,
        });
      })
      .filter(Boolean),
  );
}
