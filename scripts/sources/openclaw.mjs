import { fetchFeed, fetchDom, makeItem, takeFirst, toAbsoluteUrl, cleanText } from '../utils.mjs';

async function fetchGithubReleases() {
  const feed = await fetchFeed('https://github.com/openclaw/openclaw/releases.atom');
  return takeFirst(feed.items || [], 8)
    .map((entry) =>
      makeItem({
        source: 'OpenClaw GitHub',
        title: entry.title,
        url: entry.link,
        time: entry.isoDate || entry.pubDate,
        category: 'TECH',
        topic: 'OPENCLAW',
        tags: ['TECH', 'OPENCLAW', 'RELEASE'],
        sourceType: 'release',
        official: true,
      }),
    )
    .filter(Boolean);
}

async function fetchBlog() {
  const $ = await fetchDom('https://www.openclaw.ai/blog');
  const items = [];

  $('.post-card').each((_, element) => {
    const card = $(element);
    items.push(
      makeItem({
        source: 'OpenClaw Blog',
        title: cleanText(card.find('.post-title').first().text()),
        url: toAbsoluteUrl('https://www.openclaw.ai', card.attr('href')),
        time: cleanText(card.find('.post-date').first().text()),
        category: 'TECH',
        topic: 'OPENCLAW',
        tags: ['TECH', 'OPENCLAW', 'BLOG'],
        sourceType: 'news',
        official: true,
      }),
    );
  });

  return takeFirst(items, 8).filter(Boolean);
}

export default async function openclaw() {
  const [releases, blog] = await Promise.all([fetchGithubReleases(), fetchBlog()]);
  return [...releases, ...blog];
}
