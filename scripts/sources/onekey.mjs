import { fetchDom, fetchText, makeItem, takeFirst, toAbsoluteUrl, cleanText } from '../utils.mjs';

async function loadLastmodMap() {
  const xml = await fetchText('https://onekey.so/blog/sitemap.xml');
  const map = new Map();
  for (const match of xml.matchAll(/<loc>(.*?)<\/loc>[\s\S]*?<lastmod>(.*?)<\/lastmod>/g)) {
    map.set(match[1], match[2]);
  }
  return map;
}

export default async function onekey() {
  const [lastmodMap, $] = await Promise.all([loadLastmodMap(), fetchDom('https://blog.onekey.so')]);
  const items = [];
  const seen = new Set();

  $('article').each((_, element) => {
    const card = $(element);
    const href = toAbsoluteUrl('https://onekey.so', card.find('a[href*="/blog/"]').first().attr('href'));
    const title = cleanText(card.find('h2, h3').first().text() || card.find('img').first().attr('alt'));
    if (href.endsWith('/blog/learn/article/')) return;
    if (!href || !title || seen.has(href)) return;
    seen.add(href);

    items.push(
      makeItem({
        source: 'OneKey Blog',
        title,
        url: href,
        time: lastmodMap.get(href) || lastmodMap.get(href.replace(/\/$/, '')),
        category: 'CRYPTO_TOOLS',
        topic: 'ONEKEY',
        tags: ['CRYPTO_TOOLS', 'ONEKEY'],
        sourceType: 'news',
        official: true,
      }),
    );
  });

  return takeFirst(items, 10).filter(Boolean);
}
