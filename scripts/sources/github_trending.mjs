import { fetchDom, makeItem, keywordTopicFromText, takeFirst, cleanText } from '../utils.mjs';

const KEYWORDS = ['openclaw', 'openai', 'anthropic', 'claude', 'agent', 'coding', 'apple', 'bitcoin', 'btc', 'etf', 'prediction'];

function matchesSignal(repo, description) {
  const text = `${repo} ${description}`.toLowerCase();
  return KEYWORDS.some((keyword) => text.includes(keyword));
}

function mapCategory(topic) {
  if (topic === 'APPLE') return 'APPLE';
  if (['OPENAI', 'ANTHROPIC', 'CLAUDE', 'CLAUDE_CODE', 'OPENCLAW'].includes(topic)) return 'AI';
  if (['BTC', 'ETF', 'ONEKEY'].includes(topic)) return 'CRYPTO_TOOLS';
  return 'TECH';
}

export default async function githubTrending() {
  const $ = await fetchDom('https://github.com/trending');
  const items = [];

  $('article.Box-row').each((index, element) => {
    const entry = $(element);
    const repo = cleanText(entry.find('h2 a').first().text()).replace(/\s+/g, '');
    const description = cleanText(entry.find('p').first().text());
    if (!repo || !matchesSignal(repo, description)) return;

    const topic = keywordTopicFromText(`${repo} ${description}`, 'TECH');
    const category = mapCategory(topic);

    items.push(
      makeItem({
        source: 'GitHub Trending',
        title: `GitHub 热门工具：${repo.split('/').pop() || repo}`,
        summary: description,
        url: `https://github.com/${repo}`,
        time: new Date().toISOString(),
        category,
        topic,
        tags: ['GITHUB', category, topic],
        sourceType: 'github_trending',
        official: false,
        hot: index < 3,
        rank: index + 1,
        priorityHint: Math.max(18, 34 - index * 3),
      }),
    );
  });

  return takeFirst(items, 5).filter(Boolean);
}
