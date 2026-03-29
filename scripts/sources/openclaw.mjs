import { fetchFeed, fetchDom, makeItem, takeFirst, toAbsoluteUrl, cleanText } from '../utils.mjs';

function releaseDateFromTitle(title) {
  const match = cleanText(title).match(/openclaw\s+(\d{4})\.(\d{1,2})\.(\d{1,2})(?:-beta\.\d+)?/i);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`;
}

async function fetchGithubReleases() {
  const feed = await fetchFeed('https://github.com/openclaw/openclaw/releases.atom');
  return takeFirst(feed.items || [], 8)
    .map((entry) =>
      makeItem({
        source: 'OpenClaw GitHub',
        title: entry.title,
        url: entry.link,
        time: releaseDateFromTitle(entry.title) || entry.isoDate || entry.pubDate,
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
