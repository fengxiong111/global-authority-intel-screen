import { fetchDom, fetchFeed, makeItem, keywordTopicFromText, takeFirst, cleanText } from '../utils.mjs';

async function fetchBooksFeed() {
  const feed = await fetchFeed('https://rss.nytimes.com/services/xml/rss/nyt/Books.xml');
  return takeFirst(feed.items || [], 6)
    .map((entry) => {
      const topic = keywordTopicFromText(`${entry.title} ${entry.contentSnippet || ''}`, 'BOOK');
      return makeItem({
        source: 'NYT',
        title: entry.title,
        summary: entry.contentSnippet || entry.content || '',
        url: entry.link,
        time: entry.isoDate || entry.pubDate,
        category: 'BOOK',
        topic,
        tags: ['NYT', 'BOOK', topic],
        sourceType: 'nyt-books',
        official: false,
      });
    })
    .filter(Boolean);
}

async function fetchBestSellers() {
  const $ = await fetchDom('https://www.nytimes.com/books/best-sellers/');
  const items = [];

  $('[data-testid^="section-"]').slice(0, 4).each((_, sectionNode) => {
    const section = $(sectionNode);
    const sectionTitle = cleanText(section.find('h2').first().text());
    const sectionUrl = section.find('h2 a').first().attr('href');

    section.find('li[itemtype="https://schema.org/Book"]').slice(0, 2).each((index, bookNode) => {
      const book = $(bookNode);
      const title = cleanText(book.find('h3[itemprop="name"]').first().text());
      const author = cleanText(book.find('[itemprop="author"]').first().text());
      const description = cleanText(book.find('[itemprop="description"]').first().text());
      const weeks = cleanText(book.find('p').first().text());
      const href = book.find('a[href^="https://www.nytimes.com/"]').last().attr('href')
        || (sectionUrl ? `https://www.nytimes.com${sectionUrl}` : '');

      items.push(
        makeItem({
          source: 'NYT',
          title,
          summary: `${sectionTitle} • ${weeks}${author ? ` • ${author}` : ''}${description ? ` • ${description}` : ''}`,
          url: href,
          time: new Date().toISOString(),
          category: 'BOOK',
          topic: keywordTopicFromText(`${title} ${description}`, 'BOOK'),
          tags: ['NYT', 'BOOK', 'BESTSELLER'],
          sourceType: 'chart',
          official: false,
          rank: index + 1,
          hot: index === 0,
          priorityHint: 5,
        }),
      );
    });
  });

  return items.filter(Boolean);
}

export default async function nytBooks() {
  const [feedItems, bestSellerItems] = await Promise.all([fetchBooksFeed(), fetchBestSellers()]);
  return [...feedItems, ...bestSellerItems];
}
