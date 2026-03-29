import { fetchText, makeItem } from '../utils.mjs';

export default async function imdbTv() {
  const html = await fetchText('https://www.imdb.com/chart/tvmeter/').catch(() => '');
  if (!html) return [];

  const items = [];
  const now = new Date().toISOString();
  let rank = 0;
  for (const match of html.matchAll(/href="(\/title\/tt\d+\/.*?)"[^>]*>(.*?)<\/a>/g)) {
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    if (!title) continue;
    rank += 1;
    items.push(
      makeItem({
        source: 'IMDb TV',
        title,
        url: `https://www.imdb.com${match[1]}`,
        time: now,
        category: 'TV',
        topic: 'IMDB',
        tags: ['TV', 'IMDB'],
        sourceType: 'chart',
        official: false,
        rank,
      }),
    );
    if (rank >= 10) break;
  }
  return items.filter(Boolean);
}
