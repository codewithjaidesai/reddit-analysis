/**
 * Lead Radar Service
 *
 * Watches Reddit for fresh purchase-intent posts around a product/service
 * category ("what tool should I use for X?", "alternatives to Y?") and turns
 * them into a lead digest. Unlike content digests, LOW engagement is good here:
 * a fresh question with few answers is an open door.
 */

const axios = require('axios');
const { getRedditAccessToken } = require('./reddit');
const { analyzeWithGemini } = require('./gemini');
const config = require('../config');

// Intent phrasings appended to the category query. Kept small — each variant
// costs one Reddit search call.
const INTENT_VARIANTS = [
  (q) => `best ${q}`,
  (q) => `${q} recommendation`,
  (q) => `looking for ${q}`,
  (q) => `${q} alternative`
];

/**
 * Search Reddit for fresh intent-bearing posts. Uses sort=new so low-score
 * fresh asks (the best leads) are not filtered out.
 */
async function fetchIntentPosts(query, days = 7) {
  const accessToken = await getRedditAccessToken();
  const cutoff = Date.now() / 1000 - days * 24 * 60 * 60;
  const seen = new Set();
  const posts = [];

  for (const variant of INTENT_VARIANTS) {
    const q = variant(query);
    try {
      const response = await axios.get('https://oauth.reddit.com/search', {
        params: { q, sort: 'new', t: days <= 7 ? 'week' : 'month', limit: 50, raw_json: 1 },
        headers: {
          'Authorization': `bearer ${accessToken}`,
          'User-Agent': config.reddit.userAgent
        }
      });

      const children = response.data?.data?.children || [];
      for (const child of children) {
        const p = child.data;
        if (!p || seen.has(p.id)) continue;
        if (p.created_utc < cutoff) continue;
        if (p.stickied || p.over_18) continue;
        seen.add(p.id);
        posts.push({
          id: p.id,
          title: p.title,
          subreddit: p.subreddit,
          author: p.author,
          score: p.score,
          num_comments: p.num_comments,
          created_utc: p.created_utc,
          url: 'https://www.reddit.com' + p.permalink,
          selftext: (p.selftext || '').substring(0, 600)
        });
      }
    } catch (err) {
      console.error(`[LeadRadar] Search failed for "${q}":`, err.message);
    }
  }

  // Freshest first — recency is the lead's value
  posts.sort((a, b) => b.created_utc - a.created_utc);
  console.log(`[LeadRadar] ${posts.length} candidate posts for "${query}"`);
  return posts;
}

/**
 * AI-classify candidates for genuine purchase intent.
 * Returns only leads scoring >= 4 of 5.
 */
async function classifyLeads(posts, query) {
  if (posts.length === 0) return [];

  const candidates = posts.slice(0, 40);
  const list = candidates.map((p, i) =>
    `${i + 1}. [r/${p.subreddit}] "${p.title}"${p.selftext ? `\n   Body: ${p.selftext.substring(0, 300)}` : ''}`
  ).join('\n');

  const prompt = `You are qualifying sales leads for a business in this category: "${query}".

Below are fresh Reddit posts. Score each 1-5 for PURCHASE INTENT — how likely the author is actively looking to choose/buy a product or service in this category right now:
- 5: Explicitly asking for recommendations / actively comparing options / ready to switch
- 4: Describing a problem this category solves and open to suggestions
- 3: Discussing the category but no buying signal
- 2: Tangentially related
- 1: Not related or is itself promotional/spam

For posts scoring 4-5, also extract:
- "want": one sentence — what exactly they're looking for
- "constraints": stated budget, team size, platform, or requirements (empty string if none)
- "angle": one sentence — how a vendor could genuinely help in a reply (be useful, not salesy)

Return ONLY valid JSON:
{"leads": [{"index": 1, "score": 5, "want": "...", "constraints": "...", "angle": "..."}]}

Score ALL ${candidates.length} posts (include low scores too so I can verify coverage).

POSTS:
${list}`;

  const result = await analyzeWithGemini(prompt);
  if (!result.success) {
    console.error('[LeadRadar] Classification failed:', result.error);
    return [];
  }

  try {
    let cleaned = result.analysis.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
    const parsed = JSON.parse(cleaned);

    const leads = [];
    for (const entry of parsed.leads || []) {
      if ((entry.score || 0) < 4) continue;
      const post = candidates[entry.index - 1];
      if (!post) continue;
      leads.push({
        ...post,
        intentScore: entry.score,
        want: entry.want || '',
        constraints: entry.constraints || '',
        angle: entry.angle || ''
      });
    }
    return leads;
  } catch (err) {
    console.error('[LeadRadar] Failed to parse classification:', err.message);
    return [];
  }
}

/**
 * Generate a lead digest for a category query.
 * @returns {Promise<Object>} { query, leads, scanned, quiet, periodStart, periodEnd }
 */
async function generateLeadDigest({ query, frequency = 'weekly', isPreview = false }) {
  const periodEnd = new Date();
  const periodStart = new Date();
  const lookbackDays = (frequency === 'daily' && !isPreview) ? 1 : 7;
  periodStart.setDate(periodStart.getDate() - lookbackDays);

  const candidates = await fetchIntentPosts(query, lookbackDays);
  const leads = await classifyLeads(candidates, query);

  console.log(`[LeadRadar] ${leads.length} qualified leads for "${query}" (scanned ${candidates.length})`);

  return {
    query,
    radarType: 'leads',
    frequency,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    scanned: candidates.length,
    leads,
    quiet: leads.length === 0
  };
}

module.exports = { generateLeadDigest };
