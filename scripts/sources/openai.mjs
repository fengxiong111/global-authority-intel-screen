import { fetchFeed, makeItem, takeFirst } from '../utils.mjs';

function inferType(title) {
  return /introducing|launch|release|available|rollout/i.test(title) ? 'product' : 'news';
}

export default async function openai() {
  const feed = await fetchFeed('https://openai.com/news/rss.xml');
  return takeFirst(feed.items || [], 12)
    .map((entry) =>
      makeItem({
        source: 'OpenAI News',
        title: entry.title,
        url: entry.link,
        time: entry.isoDate || entry.pubDate,
        category: 'AI',
        topic: 'OPENAI',
        tags: ['AI', 'OPENAI'],
        sourceType: inferType(entry.title),
        official: true,
      }),
    )
    .filter(Boolean);
}
