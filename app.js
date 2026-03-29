const CATEGORY_ORDER = ['ALL', 'TECH', 'AI', 'GAME', 'APPLE', 'SONY', 'TESLA', 'MOVIE', 'TV', 'BOOK', 'CRYPTO_TOOLS', 'REDDIT', 'NYT'];

const state = {
  items: [],
  earlySignals: [],
  fetchTime: null,
  category: 'ALL',
  source: 'ALL',
  hotOnly: true,
};

const categoryFilterEl = document.getElementById('category-filter');
const sourceFilterEl = document.getElementById('source-filter');
const hotOnlyEl = document.getElementById('hot-only');
const feedEl = document.getElementById('feed');
const emptyStateEl = document.getElementById('empty-state');
const pageUpdatedEl = document.getElementById('page-updated');
const lastUpdatedEl = document.getElementById('last-updated');
const feedStatusEl = document.getElementById('feed-status');
const topbarEl = document.getElementById('topbar');
const controlsEl = document.getElementById('controls');
const earlySignalSectionEl = document.getElementById('early-signal-section');
const earlySignalListEl = document.getElementById('early-signal-list');
const params = new URLSearchParams(window.location.search);
const debugMode = ['1', 'true', 'yes'].includes((params.get('debug') || params.get('controls') || '').toLowerCase());
const pageName = window.location.pathname.split('/').pop() || 'index.html';
const isBuildersPage = pageName === 'builders.html';
const CATEGORY_ZH = {
  TECH: '科技',
  AI: 'AI',
  GAME: '游戏',
  APPLE: '苹果',
  SONY: '索尼',
  TESLA: '特斯拉',
  MOVIE: '电影',
  TV: '剧集',
  BOOK: '图书',
  CRYPTO_TOOLS: '工具',
  REDDIT: 'Reddit',
  NYT: 'NYT',
};
const BUILDER_TOPICS = new Set([
  'OPENAI',
  'ANTHROPIC',
  'CLAUDE',
  'CLAUDE_CODE',
  'OPENCLAW',
  'APPLE',
  'NINTENDO',
  'SONY',
  'PLAYSTATION',
  'TESLA',
  'ONEKEY',
]);
const BUILDER_SOURCES = new Set([
  'OpenAI News',
  'Anthropic Newsroom',
  'Apple Newsroom',
  'Nintendo News',
  'Sony Interactive',
  'PlayStation Blog',
  'Tesla IR',
  'OpenClaw GitHub',
  'OpenClaw Blog',
  'OneKey Blog',
]);

function toDate(value) {
  if (value == null) return null;
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function itemTimeValue(item) {
  return item?.published_at || item?.fetched_at || null;
}

function formatTime(value) {
  const date = toDate(value);
  if (!date) return String(value ?? '');
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
}

function formatPageTime(value) {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function renderCategoryChips() {
  categoryFilterEl.innerHTML = CATEGORY_ORDER.map((category) => `
    <button class="filter-chip ${state.category === category ? 'active' : ''}" data-category="${category}">${CATEGORY_ZH[category] || category}</button>
  `).join('');

  categoryFilterEl.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      state.category = button.dataset.category;
      renderCategoryChips();
      renderFeed();
    });
  });
}

function renderSourceOptions() {
  const sources = ['ALL', ...new Set(state.items.flatMap((item) => item.sources || [item.source]))].sort();
  sourceFilterEl.innerHTML = sources
    .map((source) => `<option value="${source}">${source === 'ALL' ? '全部来源' : source}</option>`)
    .join('');
  sourceFilterEl.value = state.source;
}

function matchesCategory(item, category) {
  if (category === 'ALL') return true;
  if (category === 'REDDIT') return item.source === 'Reddit';
  if (category === 'NYT') return item.source === 'NYT';
  return item.category === category;
}

function matchesBuildersView(item) {
  return BUILDER_TOPICS.has(item.topic) || BUILDER_SOURCES.has(item.source);
}

function filteredItems() {
  const items = state.items.filter((item) => {
    if (isBuildersPage && !matchesBuildersView(item)) return false;
    if (!matchesCategory(item, state.category)) return false;
    if (state.source !== 'ALL' && !(item.sources || [item.source]).includes(state.source)) return false;
    if (state.hotOnly && !item.defaultVisible) return false;
    return true;
  });

  return state.hotOnly ? items.slice(0, 12) : items;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function entryTier(index) {
  if (index === 0) return 'tier-hero';
  if (index === 1) return 'tier-second';
  if (index >= 2 && index <= 5) return 'tier-body';
  return 'tier-flow';
}

function earlySignalMeta(entry) {
  const parts = [];
  if (entry.trusted_mentions) parts.push(`可信×${entry.trusted_mentions}`);
  if (entry.community_hits) parts.push(`社区×${entry.community_hits}`);
  if (entry.ranking_change) parts.push('榜单上升');
  if (Array.isArray(entry.sources) && entry.sources.length) parts.push(entry.sources.slice(0, 2).join(' / '));
  return parts.join(' / ');
}

function renderEarlySignals() {
  if (!earlySignalSectionEl || !earlySignalListEl || isBuildersPage) return;
  const items = (state.earlySignals || []).slice(0, 4);
  earlySignalSectionEl.hidden = items.length === 0;
  earlySignalListEl.innerHTML = items
    .map((entry) => `
      <article class="early-signal-item">
        <h3 class="early-signal-title">${escapeHtml(entry.topic)}</h3>
        <p class="early-signal-meta">${escapeHtml(earlySignalMeta(entry))}</p>
      </article>
    `)
    .join('');
}

function renderFeed() {
  const items = filteredItems();
  emptyStateEl.hidden = items.length > 0;
  feedEl.innerHTML = items
    .map((item, index) => `
      <a class="entry ${entryTier(index)}" href="${item.url}" target="_blank" rel="noopener noreferrer">
        <h2 class="entry-title">${escapeHtml(item.displayTitle || item.title)}</h2>
      </a>
    `)
    .join('');
}

async function loadFeed() {
  try {
    const response = await fetch('./data/feed.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.items = Array.isArray(payload) ? payload : (payload.items || []);
    state.earlySignals = Array.isArray(payload) ? [] : (payload.early_signals || []);
    state.fetchTime = Array.isArray(payload) ? null : payload.fetch_time || null;
    const lastModified = response.headers.get('last-modified');
    lastUpdatedEl.textContent = `更新于 ${formatTime(state.fetchTime || lastModified || itemTimeValue(state.items[0]) || Math.floor(Date.now() / 1000))}`;
    if (pageUpdatedEl) {
      pageUpdatedEl.textContent = `本页更新于 ${formatPageTime(state.fetchTime || lastModified || Math.floor(Date.now() / 1000))}`;
    }
  } catch {
    state.items = window.AUTHORITY_INTEL_FALLBACK || [];
    state.earlySignals = [];
    state.fetchTime = null;
    lastUpdatedEl.textContent = '更新于 本地示例数据';
    if (pageUpdatedEl) {
      pageUpdatedEl.textContent = '本页更新于 本地示例';
    }
    feedStatusEl.hidden = false;
    feedStatusEl.textContent = '当前使用内嵌示例数据，通常是因为 file:// 打开时浏览器拦截了 JSON 请求。';
  }

  renderSourceOptions();
  renderEarlySignals();
  renderFeed();
}

sourceFilterEl.addEventListener('change', (event) => {
  state.source = event.target.value;
  renderFeed();
});

hotOnlyEl.addEventListener('change', (event) => {
  state.hotOnly = event.target.checked;
  renderFeed();
});

hotOnlyEl.checked = true;
topbarEl.hidden = !debugMode;
controlsEl.hidden = !debugMode;
renderCategoryChips();
loadFeed();
