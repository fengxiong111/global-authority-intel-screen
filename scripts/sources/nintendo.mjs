import { fetchFeed, makeItem, takeFirst } from '../utils.mjs';

export default async function nintendo() {
  const feed = await fetchFeed('https://www.nintendo.co.jp/news/whatsnew.xml');
  return takeFirst(feed.items || [], 12)
    .map((entry) =>
      makeItem({
        source: 'Nintendo News',
        title: entry.title,
        url: entry.link,
        time: entry.isoDate || entry.pubDate,
        category: 'GAME',
        topic: 'NINTENDO',
        tags: ['GAME', 'NINTENDO'],
        sourceType: 'news',
        official: true,
      }),
    )
    .filter(Boolean);
}
