import { fetchText, makeItem } from '../utils.mjs';

export default async function imdbMovies() {
  const html = await fetchText('https://www.imdb.com/chart/moviemeter/').catch(() => '');
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
        source: 'IMDb Movies',
        title,
        url: `https://www.imdb.com${match[1]}`,
        time: now,
        category: 'MOVIE',
        topic: 'IMDB',
        tags: ['MOVIE', 'IMDB'],
        sourceType: 'chart',
        official: false,
        rank,
      }),
    );
    if (rank >= 10) break;
  }
  return items.filter(Boolean);
}
