import { fetchDom, makeItem, takeFirst, toAbsoluteUrl, cleanText } from '../utils.mjs';

export default async function anthropic() {
  const $ = await fetchDom('https://www.anthropic.com/news');
  const items = [];
  const seen = new Set();

  $('a[href^="/news/"]').each((_, element) => {
    const card = $(element);
    const href = card.attr('href');
    const title = cleanText(card.find('h1, h2, h3, h4, h5, h6').first().text());
    if (!href || !title || seen.has(href)) return;
    seen.add(href);

    const label = cleanText(card.find('span').first().text());
    items.push(
      makeItem({
        source: 'Anthropic Newsroom',
        title,
        url: toAbsoluteUrl('https://www.anthropic.com', href),
        time: card.find('time').first().text(),
        category: 'AI',
        topic: /claude code/i.test(title) ? 'CLAUDE_CODE' : /claude/i.test(title) ? 'CLAUDE' : 'ANTHROPIC',
        tags: ['AI', /claude/i.test(title) ? 'CLAUDE' : 'ANTHROPIC', label || 'NEWS'],
        sourceType: /product/i.test(label) ? 'product' : 'news',
        official: true,
      }),
    );
  });

  return takeFirst(items, 12).filter(Boolean);
}
