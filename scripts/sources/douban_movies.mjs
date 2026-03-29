import { fetchDom, makeItem } from '../utils.mjs';

export default async function doubanMovies() {
  const $ = await fetchDom('https://movie.douban.com/chart');
  const fetchedAt = new Date().toISOString();
  const items = [];

  $('tr.item').each((index, element) => {
    const row = $(element);
    items.push(
      makeItem({
        source: 'Douban Movie Chart',
        title: row.find('a.nbg').attr('title') || row.find('td div.pl2 a').first().text(),
        url: row.find('a.nbg').attr('href'),
        time: fetchedAt,
        category: 'MOVIE',
        topic: 'DOUBAN',
        tags: ['MOVIE', 'DOUBAN'],
        sourceType: 'chart',
        official: false,
        rank: index + 1,
        hot: index < 5,
      }),
    );
  });

  return items.filter(Boolean).slice(0, 10);
}
