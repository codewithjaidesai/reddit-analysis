/**
 * Radar target encoding — lets one subscription engine serve four radar types
 * without a database migration. The existing `subreddit` column stores an
 * encoded target: plain value = subreddit radar (backward compatible), or a
 * `type:query` prefix for query-based radars.
 *
 *   "webdev"                    → { type: 'subreddit', target: 'webdev' }
 *   "topic:ai video editing"    → { type: 'topic',     target: 'ai video editing' }
 *   "leads:social media tool"   → { type: 'leads',     target: 'social media tool' }
 *   "learn:roman history"       → { type: 'learning',  target: 'roman history' }
 */

const PREFIXES = {
  'topic:': 'topic',
  'leads:': 'leads',
  'learn:': 'learning'
};

const TYPE_TO_PREFIX = {
  subreddit: '',
  topic: 'topic:',
  leads: 'leads:',
  learning: 'learn:'
};

function parseRadarTarget(raw) {
  if (!raw) return { type: 'subreddit', target: '' };
  for (const [prefix, type] of Object.entries(PREFIXES)) {
    if (raw.startsWith(prefix)) {
      return { type, target: raw.slice(prefix.length).trim() };
    }
  }
  return { type: 'subreddit', target: raw };
}

function encodeRadarTarget(type, target) {
  const prefix = TYPE_TO_PREFIX[type];
  if (prefix === undefined) throw new Error(`Unknown radar type: ${type}`);
  return prefix + target.trim();
}

/**
 * Human-readable label for emails and UI, e.g. "r/webdev" or `Topic: ai video editing`
 */
function radarDisplayLabel(raw) {
  const { type, target } = parseRadarTarget(raw);
  switch (type) {
    case 'topic': return `Topic: ${target}`;
    case 'leads': return `Leads: ${target}`;
    case 'learning': return `Learning: ${target}`;
    default: return `r/${target}`;
  }
}

const VALID_TYPES = Object.keys(TYPE_TO_PREFIX);

module.exports = { parseRadarTarget, encodeRadarTarget, radarDisplayLabel, VALID_TYPES };
