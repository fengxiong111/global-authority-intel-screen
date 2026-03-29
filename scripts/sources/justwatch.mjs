import { fetchDom, makeItem } from '../utils.mjs';

function parseTitles($, selector, source, category) {
  const items = [];
  const fetchedAt = new Date().toISOString();

  $(selector).each((index, element) => {
    const card = $(element);
    items.push(
      makeItem({
        source,
        title: card.attr('data-title'),
        url: `https://www.justwatch.com${card.find('a.title-list-grid__item--link').attr('href')}`,
        time: fetchedAt,
        category,
        topic: 'JUSTWATCH',
        tags: [category, 'JUSTWATCH'],
        sourceType: 'chart',
        official: false,
        rank: index + 1,
        hot: index < 5,
      }),
    );
  });

  return items.filter(Boolean).slice(0, 10);
}

export default async function justwatch() {
  const [moviesDom, tvDom] = await Promise.all([
    fetchDom('https://www.justwatch.com/us/movies'),
    fetchDom('https://www.justwatch.com/us/tv-shows'),
  ]);

  return [
    ...parseTitles(moviesDom, '[data-testid="titleItem"]', 'JustWatch Movies', 'MOVIE'),
    ...parseTitles(tvDom, '[data-testid="titleItem"]', 'JustWatch TV', 'TV'),
  ];
}
