import { fetchDom, makeItem, keywordTopicFromText, takeFirst, cleanText } from '../utils.mjs';

const GENERIC_MEDIA_TITLE = /^(?:[a-z]+(?:\s+[a-z]+){0,2})\s+\d{1,2}:\d{2}$/i;

function inferCategory(topic, href) {
  if (topic === 'APPLE') return 'APPLE';
  if (['OPENAI', 'ANTHROPIC', 'CLAUDE', 'CLAUDE_CODE'].includes(topic)) return 'AI';
  if (topic === 'TESLA') return 'TESLA';
  if (href.includes('/movies/')) return 'MOVIE';
  if (href.includes('/television/')) return 'TV';
  if (href.includes('/books/')) return 'BOOK';
  return 'TECH';
}

export default async function nytMostpopular() {
  const $ = await fetchDom('https://www.nytimes.com/trending/');

  return takeFirst($('article').toArray(), 10)
    .map((element, index) => {
      const card = $(element);
      const title = cleanText(card.find('h2, h3').first().text());
      const href = card.find('a[href^="https://www.nytimes.com/"]').filter((_, node) => cleanText($(node).text()).includes(title)).first().attr('href')
        || card.find('a[href^="https://www.nytimes.com/"]').first().attr('href');
      const summary = cleanText(card.find('span.css-351fmf, p').first().text());
      if (!title) return null;
      if (GENERIC_MEDIA_TITLE.test(title) && /(\/video\/|\/podcasts\/)/.test(href || '')) return null;
      const topic = keywordTopicFromText(`${title} ${summary}`, 'NYT');
      const category = inferCategory(topic, href || '');

      return makeItem({
        source: 'NYT',
        title,
        summary,
        url: href,
        time: new Date().toISOString(),
        category,
        topic,
        tags: ['NYT', category, topic],
        sourceType: 'nyt-mostpopular',
        official: false,
        hot: index < 5,
        priorityHint: index < 5 ? 5 : 0,
      });
    })
    .filter(Boolean);
}
