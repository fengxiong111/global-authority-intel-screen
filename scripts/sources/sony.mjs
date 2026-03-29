import { fetchDom, fetchFeed, makeItem, takeFirst, cleanText } from '../utils.mjs';

async function fetchSonyInteractive() {
  const $ = await fetchDom('https://sonyinteractive.com/en/news/blog/');
  const items = [];
  const seen = new Set();

  $('[data-post-slug]').each((_, element) => {
    const card = $(element);
    const href = card.find('a[href*="/news/blog/"]').first().attr('href');
    const title = cleanText(card.find('a[href*="/news/blog/"]').first().text());
    if (!href || !title || seen.has(href)) return;
    seen.add(href);
    const dateText = cleanText(card.text()).match(
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}/i,
    )?.[0];

    items.push(
      makeItem({
        source: 'Sony Interactive',
        title,
        url: href,
        time: dateText,
        category: 'SONY',
        topic: 'SONY',
        tags: ['SONY', 'GAME'],
        sourceType: 'news',
        official: true,
      }),
    );
  });

  return takeFirst(items, 8).filter(Boolean);
}

async function fetchPlayStationBlog() {
  const feed = await fetchFeed('https://blog.playstation.com/feed/');
  return takeFirst(feed.items || [], 8)
    .map((entry) =>
      makeItem({
        source: 'PlayStation Blog',
        title: entry.title,
        url: entry.link,
        time: entry.isoDate || entry.pubDate,
        category: 'SONY',
        topic: 'SONY',
        tags: ['SONY', 'GAME'],
        sourceType: 'news',
        official: true,
      }),
    )
    .filter(Boolean);
}

export default async function sony() {
  const [sie, psBlog] = await Promise.all([fetchSonyInteractive(), fetchPlayStationBlog()]);
  return [...sie, ...psBlog];
}
