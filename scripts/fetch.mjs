import { normalizeFeed } from './normalize.mjs';
import { FEED_PATH, readJson, writeJson } from './utils.mjs';
import apple from './sources/apple.mjs';
import openai from './sources/openai.mjs';
import anthropic from './sources/anthropic.mjs';
import claudeCode from './sources/claude_code.mjs';
import nintendo from './sources/nintendo.mjs';
import riot from './sources/riot.mjs';
import sony from './sources/sony.mjs';
import tesla from './sources/tesla.mjs';
import openclaw from './sources/openclaw.mjs';
import onekey from './sources/onekey.mjs';
import imdbMovies from './sources/imdb_movies.mjs';
import imdbTv from './sources/imdb_tv.mjs';
import justwatch from './sources/justwatch.mjs';
import doubanMovies from './sources/douban_movies.mjs';
import booksManual from './sources/books_manual.mjs';
import reddit from './sources/reddit.mjs';
import nytTopstories from './sources/nyt_topstories.mjs';
import nytMostpopular from './sources/nyt_mostpopular.mjs';
import nytBooks from './sources/nyt_books.mjs';

const sources = [
  apple,
  openai,
  anthropic,
  claudeCode,
  nintendo,
  riot,
  sony,
  tesla,
  openclaw,
  onekey,
  imdbMovies,
  imdbTv,
  justwatch,
  doubanMovies,
  booksManual,
  reddit,
  nytTopstories,
  nytMostpopular,
  nytBooks,
];

const results = await Promise.allSettled(sources.map((source) => source()));
const merged = [];

for (let index = 0; index < sources.length; index += 1) {
  const result = results[index];
  const name = sources[index].name || `source-${index + 1}`;

  if (result.status === 'fulfilled') {
    const items = result.value.filter(Boolean);
    merged.push(...items);
    console.log(`${name}: ${items.length}`);
  } else {
    console.warn(`${name}: failed -> ${result.reason?.message || result.reason}`);
  }
}

const existingFeed = await readJson(FEED_PATH, []);
let feed = normalizeFeed(merged);

for (const sourceName of ['Reddit', 'NYT']) {
  if (feed.some((item) => item.source === sourceName)) continue;
  const fallbackItems = existingFeed.filter((item) => item.source === sourceName);
  if (fallbackItems.length > 0) {
    console.warn(`preserving previous ${sourceName} items: ${fallbackItems.length}`);
    feed = normalizeFeed([...feed, ...fallbackItems]);
  }
}

const finalFeed = feed.length > 0 ? feed : existingFeed;

if (feed.length === 0 && existingFeed.length > 0) {
  console.warn(`new fetch is empty; keeping previous feed with ${existingFeed.length} items`);
}

await writeJson(FEED_PATH, finalFeed);
console.log(`wrote ${finalFeed.length} items -> ${FEED_PATH}`);
