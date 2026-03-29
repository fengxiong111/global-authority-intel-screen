import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import Parser from 'rss-parser';
import { load } from 'cheerio';

export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const FEED_PATH = path.join(DATA_DIR, 'feed.json');
export const EARLY_SIGNAL_PATH = path.join(DATA_DIR, 'early_signal.json');
export const BOOKS_PATH = path.join(DATA_DIR, 'books.json');
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 AuthorityIntelScreen/1.0';
export const DEFAULT_HEADERS = {
  'user-agent': USER_AGENT,
  'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const parser = new Parser({
  customFields: {
    item: ['dc:creator', 'content:encoded', 'media:content'],
  },
});
const execFileAsync = promisify(execFile);

export function cleanText(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clipText(value, limit = 220) {
  const cleaned = cleanText(value);
  if (!cleaned) return '';
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1).trim()}…` : cleaned;
}

export function normalizeUrl(value, base = '') {
  const cleaned = cleanText(value);
  if (!cleaned) return '';

  try {
    const url = new URL(cleaned, base || undefined);
    const paramsToDrop = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'smcid',
      'ref',
      'ref_src',
      'fbclid',
      'gclid',
    ];
    for (const key of paramsToDrop) {
      url.searchParams.delete(key);
    }
    if (!url.searchParams.toString()) {
      url.search = '';
    }
    return url.toString();
  } catch {
    return '';
  }
}

export function toAbsoluteUrl(base, value) {
  return normalizeUrl(value, base);
}

export function toIso(value, fallback = new Date().toISOString()) {
  if (!value) return fallback;
  const normalized = cleanText(value);
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toISOString();
}

export function uniqueStrings(values, limit = 3) {
  const seen = new Set();
  const list = [];
  for (const raw of values.flat()) {
    const value = cleanText(raw).toUpperCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    list.push(value);
    if (list.length >= limit) break;
  }
  return list;
}

export function keywordTopicFromText(value, fallback = '') {
  const text = cleanText(value).toLowerCase();
  if (!text) return cleanText(fallback).toUpperCase();

  const checks = [
    ['bitcoin', 'BTC'],
    ['btc', 'BTC'],
    ['etf', 'ETF'],
    ['openclaw', 'OPENCLAW'],
    ['onekey', 'ONEKEY'],
    ['openai', 'OPENAI'],
    ['anthropic', 'ANTHROPIC'],
    ['claude code', 'CLAUDE_CODE'],
    ['claude', 'CLAUDE'],
    ['apple', 'APPLE'],
    ['nintendo', 'NINTENDO'],
    ['switch', 'SWITCH'],
    ['league of legends', 'LEAGUE_OF_LEGENDS'],
    ['playstation', 'PLAYSTATION'],
    ['sony', 'SONY'],
    ['tesla', 'TESLA'],
  ];

  for (const [keyword, topic] of checks) {
    if (text.includes(keyword)) return topic;
  }

  return cleanText(fallback).toUpperCase();
}

export function parseInteger(value, fallback = 0) {
  const normalized = String(value ?? '').toLowerCase().replace(/,/g, '').trim();
  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*([km]?)/);
  if (!match) return fallback;
  const number = Number.parseFloat(match[1]);
  const multiplier = match[2] === 'm' ? 1000000 : match[2] === 'k' ? 1000 : 1;
  const parsed = Math.round(number * multiplier);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function hashString(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
}

export function stableId(parts) {
  return hashString(parts.filter(Boolean).join('||'));
}

export async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers ?? {}),
    },
  });

  if (response.ok) {
    return response.text();
  }

  if ([403, 429].includes(response.status)) {
    try {
      const { stdout } = await execFileAsync('curl', [
        '-fsSL',
        '--compressed',
        '-A',
        USER_AGENT,
        '-H',
        `Accept-Language: ${DEFAULT_HEADERS['accept-language']}`,
        url,
      ]);
      if (stdout) return stdout;
    } catch {
      // fall through to original error
    }
  }

  throw new Error(`${url} -> ${response.status}`);
}

export async function fetchDom(url, options = {}) {
  const html = await fetchText(url, options);
  return load(html);
}

export async function fetchFeed(url) {
  const xml = await fetchText(url, {
    headers: {
      accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8',
    },
  });
  return parser.parseString(xml);
}

export async function readJson(filePath, fallback = []) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function takeFirst(items, limit = 12) {
  return items.filter(Boolean).slice(0, limit);
}

export function makeItem({
  source,
  title,
  summary = '',
  url,
  time,
  category,
  topic,
  tags = [],
  official = true,
  sourceType = 'news',
  rank = null,
  score = null,
  comments = null,
  hot = false,
  priorityHint = 0,
  fetchedAt = new Date().toISOString(),
  author = '',
  trustedAuthor = false,
}) {
  const cleanTitle = cleanText(title);
  const cleanUrl = normalizeUrl(url);
  if (!source || !cleanTitle || !cleanUrl) {
    return null;
  }

  return {
    source: cleanText(source),
    title: cleanTitle,
    summary: clipText(summary, 260),
    url: cleanUrl,
    time: toIso(time, fetchedAt),
    category: cleanText(category).toUpperCase(),
    topic: cleanText(topic).toUpperCase(),
    tags: uniqueStrings(tags, 3),
    official,
    sourceType,
    rank,
    score,
    comments,
    hot,
    priorityHint,
    author: cleanText(author),
    trustedAuthor: Boolean(trustedAuthor),
  };
}

export function extractJsonFromNextData($) {
  const raw = $('#__NEXT_DATA__').first().html() ?? '';
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
