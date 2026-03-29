import { makeItem, keywordTopicFromText, takeFirst, cleanText } from '../utils.mjs';

const BASE = 'https://hacker-news.firebaseio.com/v0';
const KEYWORDS = [
  'openai',
  'anthropic',
  'claude',
  'codex',
  'agent',
  'agents',
  'developer tool',
  'devtool',
  'inference',
  'model',
  'apple',
  'bitcoin',
  'btc',
  'etf',
  'prediction market',
  'polymarket',
  'kalshi',
  'war',
  'iran',
];

function includesSignal(text) {
  return KEYWORDS.some((keyword) => text.includes(keyword));
}

function mapCategory(topic) {
  if (topic === 'APPLE') return 'APPLE';
  if (['OPENAI', 'ANTHROPIC', 'CLAUDE', 'CLAUDE_CODE', 'OPENCLAW'].includes(topic)) return 'AI';
  if (['BTC', 'ETF', 'ONEKEY'].includes(topic)) return 'CRYPTO_TOOLS';
  return 'TECH';
}

function isHot(item, text) {
  return includesSignal(text) && ((item.score || 0) >= 120 || (item.descendants || 0) >= 80);
}

export default async function hnTop() {
  const idsRes = await fetch(`${BASE}/topstories.json`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!idsRes.ok) throw new Error(`hn topstories -> ${idsRes.status}`);
  const ids = (await idsRes.json()).slice(0, 40);

  const items = await Promise.all(ids.map(async (id) => {
    const res = await fetch(`${BASE}/item/${id}.json`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const item = await res.json();
    if (!item || item.type !== 'story' || !item.url || !item.title) return null;
    const text = cleanText(`${item.title} ${item.text || ''}`).toLowerCase();
    if (!isHot(item, text)) return null;
    const topic = keywordTopicFromText(text, 'TECH');
    const category = mapCategory(topic);
    return makeItem({
      source: 'Hacker News',
      title: item.title,
      summary: `HN • ${item.score || 0} points • ${item.descendants || 0} comments`,
      url: item.url,
      time: item.time,
      category,
      topic,
      tags: ['HN', category, topic],
      sourceType: 'community_hot',
      official: false,
      score: item.score || 0,
      comments: item.descendants || 0,
      hot: true,
      rank: null,
      priorityHint: Math.max(18, 26 - Math.floor(((item.score || 0) - 120) / 80)),
    });
  }));

  return takeFirst(items.filter(Boolean), 6);
}
