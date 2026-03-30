# Authority Intel Screen

A minimal GitHub Pages intel screen for public high-signal sources.

## Stack

- GitHub Pages
- GitHub Actions
- Node.js
- Plain HTML / CSS / JS
- `rss-parser`
- `cheerio`

## Display spec

Final default display contract is documented in:

- `/Users/qiang/Downloads/全球热门动向/DISPLAY_SPEC_V1.md`

v1 default is **Flow Mode only**:

- black background
- single column
- left aligned
- large titles
- tiny time / source / category
- no summary
- no images
- no portal-style card wall

## Local preview

Recommended:

```bash
npm install
npm run fetch
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

Raw `index.html` also renders because `app.js` falls back to embedded sample data when `file://` blocks `fetch('./data/feed.json')`.

## GitHub Pages publish

1. Push this repo to GitHub.
2. In **Settings → Pages**, choose **Deploy from a branch**.
3. Select your main branch and the **root (`/`)** folder.
4. Keep `.github/workflows/update-feed.yml` enabled.
5. Keep `/.nojekyll` in the repo root so GitHub Pages serves the static files as-is.

The page is static. The workflow only refreshes `data/feed.json` every 30 minutes and on manual trigger.

Current ship-it defaults:

- homepage shows only the highest-priority cleaned Chinese items by default
- long-tail English items stay in the full data feed, but do not enter the default home screen
- UI is frozen to the minimal single-column terminal view

## Refresh flow

```bash
npm run fetch
```

This runs every source adapter, normalizes the items, deduplicates, scores priority, then writes:

- `/Users/qiang/Downloads/全球热门动向/data/feed.json`
- `/Users/qiang/Downloads/全球热门动向/data/early_signal.json`
- `/Users/qiang/Downloads/全球热门动向/data/builders_observe.json`
- `/Users/qiang/Downloads/全球热门动向/data/grok_digest.json`
- `/Users/qiang/Downloads/全球热门动向/data/grok_now.json`

The pipeline fails soft:

- one adapter failing does not stop the run
- Reddit or NYT fully failing keeps the last successful items from that source in `data/feed.json`
- Actions logs print short source-level errors only

## xAI / Grok candidate pool

This repo now supports a second data lane:

- **Grok candidate pool** via the **xAI API**
- xAI does the search + Chinese compression
- local rules decide what enters `/Users/qiang/Downloads/全球热门动向/data/grok_now.json`

Files:

- `/Users/qiang/Downloads/全球热门动向/data/grok_digest.json`
  - topic
  - title_zh
  - summary_zh
  - source_types
  - original_urls
  - freshness_hours
  - confidence
- `/Users/qiang/Downloads/全球热门动向/data/grok_now.json`
  - title_zh
  - topic
  - freshness_hours
  - why_now
  - source_types

Rules:

- xAI uses `x_search`
- output must be Chinese, one sentence, no URL, no long English line
- `grok_now.json` keeps at most 4 items
- items older than 6 hours do not enter `grok_now.json`
- trend analysis / recap / generic discussion are dropped locally

To enable it locally:

```bash
export XAI_API_KEY=your_key_here
npm run fetch
```

To enable it in GitHub Actions:

- add repository secret: `XAI_API_KEY`

## Add a new source adapter

1. Create a new file in `/scripts/sources`, for example `/scripts/sources/example.mjs`.
2. Export one async default function that returns normalized raw items with `makeItem(...)`.
3. Import it in `/scripts/fetch.mjs` and append it to the `sources` array.

Adapter rule: only do three things:

1. fetch
2. parse
3. map to normalized item[]

Do not couple adapters to each other.

## Add a subreddit

Edit `/scripts/sources/reddit.mjs` and append one entry to `SUBREDDITS`:

```js
{ name: 'gadgets', category: 'TECH', topic: 'TECH' }
```

Rules:

- Reddit v1 only keeps title, post link, time, subreddit, score, and comment count
- no body fetch
- no comment fetch
- no login

The adapter reads anonymous public Redlib mirrors and always maps output back to the original Reddit post URL.

## Add a NYT endpoint

Use the smallest public metadata source that works:

- RSS first
- then public HTML list pages

Current files:

- `/scripts/sources/nyt_topstories.mjs` → section RSS feeds
- `/scripts/sources/nyt_mostpopular.mjs` → NYT trending page metadata
- `/scripts/sources/nyt_books.mjs` → Books RSS + bestseller metadata page

To add one more RSS section, append it inside `FEEDS` in `/scripts/sources/nyt_topstories.mjs`.

## Change categories

Categories are used in two places:

- source adapters set `category`
- `/app.js` defines the visible filter order in `CATEGORY_ORDER`

If you add a new category, update both.

Minimal built-in mapping for the new sources:

- Reddit:
  - `apple -> APPLE`
  - `OpenAI / ClaudeAI / Anthropic / singularity -> AI`
  - `nintendo / Switch / leagueoflegends / games / PS5 -> GAME`
  - `teslamotors -> TESLA`
  - `movies -> MOVIE`
  - `television -> TV`
  - `books -> BOOK`
  - `gadgets / technology -> TECH`
- NYT:
  - `Technology -> TECH`
  - `Movies -> MOVIE`
  - `Television -> TV`
  - `Books -> BOOK`
  - `Business + Apple/OpenAI/Anthropic/Claude/Tesla keyword hit -> topic-first remap`

## Change priority rules

Edit `/scripts/normalize.mjs`:

- `TOPIC_BOOST` controls topic bumping
- `computePriority(...)` controls official-source bonus, chart bonus, duplicate-topic penalty, and age decay

Current defaults are intentionally simple:

- official release / changelog / product / press: `+30`
- other official source: `+20`
- NYT Top Stories / Most Popular metadata entries: `+20`
- Reddit hot posts: `+10~20` via score / rank hint
- chart top 10: `+15`
- key topics: `+10`
- repeated topic penalty
- 24h+ age decay

## Data shape

`/data/feed.json` is an array of items like:

```json
[
  {
    "id": "stable-unique-id",
    "time": "2026-03-28T12:30:00Z",
    "source": "OpenAI News",
    "title": "Powering Product Discovery in ChatGPT",
    "summary": "",
    "category": "AI",
    "topic": "OPENAI",
    "priority": 90,
    "url": "https://...",
    "hot": true,
    "tags": ["AI", "OPENAI", "PRODUCT"]
  }
]
```

## Notes

- `books_manual.mjs` reads `/data/books.json` as a non-blocking fallback.
- IMDb is best-effort because it may challenge headless traffic.
- Reddit is title-only. No post body, no comments, no user profiles.
- NYT is metadata-only. No full article scraping, no paywall bypass.
- Region-blocked or anti-bot sources fail soft: the pipeline keeps running and writes whatever succeeded.
