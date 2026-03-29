import { fetchDom, makeItem, parseInteger, keywordTopicFromText, takeFirst, cleanText } from '../utils.mjs';

const REDLIB_BASES = [
  'https://redlib.perennialte.ch',
  'https://redlib.tiekoetter.com',
  'https://redlib.kylrth.com',
];
const SUBREDDITS = [
  { name: 'apple', category: 'APPLE', topic: 'APPLE' },
  { name: 'OpenAI', category: 'AI', topic: 'OPENAI' },
  { name: 'ClaudeAI', category: 'AI', topic: 'CLAUDE' },
  { name: 'Anthropic', category: 'AI', topic: 'ANTHROPIC' },
  { name: 'nintendo', category: 'GAME', topic: 'NINTENDO' },
  { name: 'Switch', category: 'GAME', topic: 'SWITCH' },
  { name: 'leagueoflegends', category: 'GAME', topic: 'LEAGUE_OF_LEGENDS' },
  { name: 'PS5', category: 'GAME', topic: 'PLAYSTATION' },
  { name: 'teslamotors', category: 'TESLA', topic: 'TESLA' },
  { name: 'movies', category: 'MOVIE', topic: 'MOVIE' },
  { name: 'television', category: 'TV', topic: 'TV' },
  { name: 'books', category: 'BOOK', topic: 'BOOK' },
  { name: 'singularity', category: 'AI', topic: 'AI' },
  { name: 'gadgets', category: 'TECH', topic: 'TECH' },
  { name: 'technology', category: 'TECH', topic: 'TECH' },
  { name: 'games', category: 'GAME', topic: 'GAME' },
];

function normalizeCategoryFromTopic(topic, fallbackCategory) {
  if (topic === 'APPLE') return 'APPLE';
  if (['OPENAI', 'ANTHROPIC', 'CLAUDE', 'CLAUDE_CODE'].includes(topic)) return 'AI';
  if (['NINTENDO', 'SWITCH', 'LEAGUE_OF_LEGENDS', 'PLAYSTATION'].includes(topic)) return 'GAME';
  if (topic === 'TESLA') return 'TESLA';
  if (topic === 'MOVIE') return 'MOVIE';
  if (topic === 'TV') return 'TV';
  if (topic === 'BOOK') return 'BOOK';
  return fallbackCategory;
}

function redditPriorityHint(score, rank) {
  if (score >= 3000) return 20;
  if (score >= 1500) return 18;
  if (score >= 700) return 16;
  if (score >= 300) return 14;
  return Math.max(10, 13 - Math.min(rank, 3));
}

async function fetchSubreddit(base, config) {
  const $ = await fetchDom(`${base}/r/${config.name}/hot`);
  return takeFirst(
    $('div.post')
      .toArray()
      .filter((element) => !$(element).hasClass('stickied')),
    3,
  )
    .map((element, index) => {
      const post = $(element);
      const titleLink = post.find('h2.post_title a:not(.post_flair)').first();
      const permalink = titleLink.attr('href');
      const title = cleanText(titleLink.text());
      const score = parseInteger(post.find('.post_score').first().attr('title') || post.find('.post_score').first().text());
      const comments = parseInteger(post.find('.post_comments').first().attr('title') || post.find('.post_comments').first().text());
      const time = post.find('.created').first().attr('title') || post.find('.created').first().text();
      const subreddit = cleanText(post.find('.post_subreddit').first().text()) || `r/${config.name}`;
      const topic = keywordTopicFromText(title, config.topic);
      const category = normalizeCategoryFromTopic(topic, config.category);

      return makeItem({
        source: 'Reddit',
        title,
        summary: `${subreddit} • ${score} points • ${comments} comments`,
        url: `https://www.reddit.com${permalink}`,
        time,
        category,
        topic,
        tags: [category, 'REDDIT', topic],
        sourceType: 'reddit',
        official: false,
        score,
        comments,
        hot: score >= 700 || index === 0,
        priorityHint: redditPriorityHint(score, index + 1),
      });
    })
    .filter(Boolean);
}

export default async function reddit() {
  for (const base of REDLIB_BASES) {
    try {
      const nested = await Promise.allSettled(SUBREDDITS.map((config) => fetchSubreddit(base, config)));
      const items = [];
      let successCount = 0;

      for (const result of nested) {
        if (result.status === 'fulfilled') {
          items.push(...result.value);
          successCount += 1;
        }
      }

      if (successCount >= 3) {
        return items;
      }
    } catch {
      // try next mirror
    }
  }

  throw new Error('reddit mirror unavailable');
}
