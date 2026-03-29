import { BOOKS_PATH, readJson, makeItem } from '../utils.mjs';

export default async function booksManual() {
  const items = await readJson(BOOKS_PATH, []);
  return items
    .map((item) =>
      makeItem({
        source: item.source || 'Books Manual',
        title: item.title,
        url: item.url,
        time: item.time,
        category: 'BOOK',
        topic: item.topic || 'BOOKS',
        tags: item.tags || ['BOOK'],
        sourceType: 'chart',
        official: false,
        rank: item.rank ?? null,
        hot: Boolean(item.hot),
        priorityHint: item.priorityHint || 0,
      }),
    )
    .filter(Boolean);
}
