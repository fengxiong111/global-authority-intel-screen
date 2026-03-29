import { fetchDom, makeItem, takeFirst, toAbsoluteUrl, cleanText, extractJsonFromNextData } from '../utils.mjs';

async function fetchRiotGames() {
  const $ = await fetchDom('https://www.riotgames.com/en/news');
  const items = [];
  const seen = new Set();

  $('.summary').each((_, element) => {
    const card = $(element);
    const href = card.find('a.summary__overlay-link').attr('href');
    const title = cleanText(card.find('.summary__title, h3').first().text());
    if (!href || !title || seen.has(href)) return;
    seen.add(href);

    const category = cleanText(card.find('.summary__category, .summary__type').first().text()) || 'News';
    items.push(
      makeItem({
        source: 'Riot Games',
        title,
        url: toAbsoluteUrl('https://www.riotgames.com', href),
        time: card.find('time').first().attr('datetime') || card.find('time').first().text(),
        category: 'GAME',
        topic: 'RIOT',
        tags: ['GAME', 'RIOT', category],
        sourceType: /tech|dev/i.test(category) ? 'product' : 'news',
        official: true,
      }),
    );
  });

  return takeFirst(items, 8).filter(Boolean);
}

async function fetchLeagueOfLegends() {
  const $ = await fetchDom('https://www.leagueoflegends.com/en-us/news/');
  const data = extractJsonFromNextData($);
  const cards = data?.props?.pageProps?.async?.items || [];

  return takeFirst(cards, 8)
    .map((card) => {
      const payload = card?.action?.payload || {};
      const href = payload.url || card?.url;
      return makeItem({
        source: 'League of Legends',
        title: card.title,
        url: toAbsoluteUrl('https://www.leagueoflegends.com', href),
        time: card.publishedAt || card?.analytics?.publishDate,
        category: 'GAME',
        topic: 'RIOT',
        tags: ['GAME', 'RIOT', card?.category?.title || 'LOL'],
        sourceType: /patch|update|dev/i.test(card?.category?.title || '') ? 'product' : 'news',
        official: true,
      });
    })
    .filter(Boolean);
}

export default async function riot() {
  const [riotGames, leagueOfLegends] = await Promise.all([fetchRiotGames(), fetchLeagueOfLegends()]);
  return [...riotGames, ...leagueOfLegends];
}
