/**
 * YouTube API Quota Tracker + Search Cache
 *
 * Lightweight in-memory solution for managing YouTube API quota.
 * YouTube Data API v3 quota: 10,000 units/day (resets midnight Pacific).
 * search.list = 100 units, videos.list = 1 unit per call.
 *
 * No Redis, no database — just a counter and a Map with TTL.
 */

const DAILY_QUOTA_LIMIT = parseInt(process.env.YOUTUBE_DAILY_QUOTA_LIMIT) || 10000;
const SEARCH_COST = 101; // search.list(100) + videos.list(1)
const EXTRACT_COST = 8;  // videos.list(1) + commentThreads.list(~5-7 pages)
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

let quotaUsed = 0;
let quotaResetDate = getTodayPacific();
const searchCache = new Map();

function getTodayPacific() {
  return new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
}

function resetIfNewDay() {
  const today = getTodayPacific();
  if (today !== quotaResetDate) {
    quotaUsed = 0;
    quotaResetDate = today;
    searchCache.clear();
    console.log('[YouTubeQuota] Counter reset for new day');
  }
}

/**
 * Record quota units consumed
 * @param {number} units - Quota units used
 */
function recordUsage(units) {
  resetIfNewDay();
  quotaUsed += units;
  const remaining = DAILY_QUOTA_LIMIT - quotaUsed;
  if (remaining < 2000) {
    console.warn(`[YouTubeQuota] Warning: ~${remaining} units remaining today (used: ${quotaUsed}/${DAILY_QUOTA_LIMIT})`);
  }
}

/**
 * Check if there's enough quota for a search operation
 * @returns {boolean}
 */
function canAffordSearch() {
  resetIfNewDay();
  return (quotaUsed + SEARCH_COST) <= DAILY_QUOTA_LIMIT;
}

/**
 * Get current quota status
 * @returns {{ used: number, limit: number, remaining: number }}
 */
function getQuotaStatus() {
  resetIfNewDay();
  return {
    used: quotaUsed,
    limit: DAILY_QUOTA_LIMIT,
    remaining: DAILY_QUOTA_LIMIT - quotaUsed
  };
}

/**
 * Get cached search result
 * @param {string} key - Cache key
 * @returns {object|null} Cached result or null
 */
function getCachedSearch(key) {
  const entry = searchCache.get(key);
  if (entry && entry.expiry > Date.now()) {
    return entry.result;
  }
  if (entry) {
    searchCache.delete(key);
  }
  return null;
}

/**
 * Cache a search result
 * @param {string} key - Cache key
 * @param {object} result - Search result to cache
 */
function setCachedSearch(key, result) {
  // Evict expired entries if cache grows large
  if (searchCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of searchCache) {
      if (v.expiry <= now) searchCache.delete(k);
    }
  }
  searchCache.set(key, { result, expiry: Date.now() + CACHE_TTL_MS });
}

module.exports = {
  recordUsage,
  canAffordSearch,
  getQuotaStatus,
  getCachedSearch,
  setCachedSearch,
  SEARCH_COST,
  EXTRACT_COST,
  DAILY_QUOTA_LIMIT
};
