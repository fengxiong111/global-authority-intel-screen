import { fetchDom, makeItem, takeFirst, toAbsoluteUrl, cleanText } from '../utils.mjs';

export default async function claudeCode() {
  const $ = await fetchDom('https://www.anthropic.com/news');
  const items = [];
  const seen = new Set();

  $('a[href^="/news/"]').each((_, element) => {
    const card = $(element);
    const href = card.attr('href');
    const title = cleanText(card.find('h1, h2, h3, h4, h5, h6').first().text());
    if (!href || !title || seen.has(href) || !/claude/i.test(title)) return;
    seen.add(href);

    items.push(
      makeItem({
        source: 'Claude Notes',
        title,
        url: toAbsoluteUrl('https://www.anthropic.com', href),
        time: card.find('time').first().text(),
        category: 'AI',
        topic: /claude code/i.test(title) ? 'CLAUDE_CODE' : 'CLAUDE',
        tags: ['AI', /claude code/i.test(title) ? 'CLAUDE_CODE' : 'CLAUDE'],
        sourceType: 'product',
        official: true,
      }),
    );
  });

  return takeFirst(items, 8).filter(Boolean);
}
