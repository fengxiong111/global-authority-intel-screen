import { fetchFeed, makeItem, takeFirst } from '../utils.mjs';

export default async function tesla() {
  const feed = await fetchFeed('https://ir.tesla.com/rss.xml');
  return takeFirst(feed.items || [], 12)
    .map((entry) =>
      makeItem({
        source: 'Tesla IR',
        title: entry.title,
        url: entry.link,
        time: entry.isoDate || entry.pubDate,
        category: 'TESLA',
        topic: 'TESLA',
        tags: ['TESLA', 'TECH'],
        sourceType: 'press',
        official: true,
      }),
    )
    .filter(Boolean);
}
