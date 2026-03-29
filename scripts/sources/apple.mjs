import { fetchFeed, makeItem, takeFirst } from '../utils.mjs';

export default async function apple() {
  const feed = await fetchFeed('https://www.apple.com/newsroom/rss-feed.rss');
  return takeFirst(feed.items || [], 12)
    .map((entry) =>
      makeItem({
        source: 'Apple Newsroom',
        title: entry.title,
        url: entry.link,
        time: entry.isoDate || entry.pubDate,
        category: 'APPLE',
        topic: 'APPLE',
        tags: ['APPLE', 'TECH'],
        sourceType: 'press',
        official: true,
      }),
    )
    .filter(Boolean);
}
