/**
 * Content Radar Digest Generation Service
 *
 * Generates magazine-style digests from Reddit community data.
 * Builds on Community Pulse but formats for email/digest delivery.
 */

const { analyzeWithGemini } = require('./gemini');
const { fetchTimeBucketedPosts, getSubredditInfo, samplePostsForComments, fetchCommentsForPosts } = require('./search');
const { extractRedditData, getRedditAccessToken } = require('./reddit');
const db = require('./supabase');
const axios = require('axios');
const config = require('../config');

/**
 * Fetch recent posts for digest (uses /hot and /new endpoints, not /top)
 * This ensures we get posts from the actual time period, not just top posts of all time
 */
async function fetchRecentPostsForDigest(subreddit, days = 7) {
  console.log(`[Digest] Fetching recent posts for r/${subreddit} (last ${days} days)`);

  try {
    const accessToken = await getRedditAccessToken();
    const allPosts = [];
    const cutoffTime = Date.now() / 1000 - (days * 24 * 60 * 60); // X days ago in seconds

    // Fetch from /hot endpoint (most engaging recent posts)
    const hotUrl = `https://oauth.reddit.com/r/${subreddit}/hot`;
    const hotResponse = await axios.get(hotUrl, {
      params: { limit: 100, raw_json: 1 },
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': config.reddit.userAgent
      }
    });

    if (hotResponse.data?.data?.children) {
      const hotPosts = hotResponse.data.data.children
        .map(child => child.data)
        .filter(post => post.created_utc >= cutoffTime);
      console.log(`[Digest] Found ${hotPosts.length} hot posts in time range`);
      allPosts.push(...hotPosts);
    }

    // Also fetch from /new endpoint to catch recent posts that aren't "hot" yet
    const newUrl = `https://oauth.reddit.com/r/${subreddit}/new`;
    const newResponse = await axios.get(newUrl, {
      params: { limit: 100, raw_json: 1 },
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': config.reddit.userAgent
      }
    });

    if (newResponse.data?.data?.children) {
      const newPosts = newResponse.data.data.children
        .map(child => child.data)
        .filter(post => post.created_utc >= cutoffTime && post.score >= 5); // Min engagement
      console.log(`[Digest] Found ${newPosts.length} new posts with engagement in time range`);

      // Add new posts that aren't already in hot
      const existingIds = new Set(allPosts.map(p => p.id));
      for (const post of newPosts) {
        if (!existingIds.has(post.id)) {
          allPosts.push(post);
        }
      }
    }

    // Sort by score descending
    allPosts.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`[Digest] Total unique posts for digest: ${allPosts.length}`);
    return allPosts;

  } catch (error) {
    console.error(`[Digest] Error fetching recent posts:`, error.message);
    return [];
  }
}

/**
 * Generate a digest for a subreddit
 * @param {Object} params - Generation parameters
 * @param {string} params.subreddit - Subreddit name
 * @param {string} params.subscriptionId - Optional subscription ID for personalization
 * @param {string} params.focusTopic - Optional focus topic
 * @param {string} params.frequency - 'daily' or 'weekly'
 * @returns {Promise<Object>} Generated digest
 */
async function generateDigest({ subreddit, subscriptionId = null, focusTopic = null, frequency = 'weekly', isPreview = false }) {
  console.log(`Generating ${frequency} digest for r/${subreddit}... (preview: ${isPreview})`);

  // Calculate time period
  // For previews and first digests, always use 7 days to ensure we have content
  const periodEnd = new Date();
  const periodStart = new Date();
  const lookbackDays = (frequency === 'daily' && !isPreview) ? 1 : 7;
  periodStart.setDate(periodStart.getDate() - lookbackDays);

  console.log(`[Digest] Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

  // Fetch subreddit info
  const subredditInfo = await getSubredditInfo(subreddit);

  // Fetch RECENT posts using hot/new endpoints (not top posts of all time!)
  // This is the critical fix - fetchTimeBucketedPosts fetches /top which has old posts
  const periodPosts = await fetchRecentPostsForDigest(subreddit, lookbackDays);

  console.log(`[Digest] Posts fetched for digest: ${periodPosts.length}`);

  if (periodPosts.length === 0) {
    console.log(`[Digest] No posts found for r/${subreddit}, returning empty digest`);
    return createEmptyDigest(subreddit, periodStart, periodEnd, frequency);
  }

  // Sample top posts for comment analysis
  // samplePostsForComments expects bucketed data, so wrap our flat array
  const bucketedData = {
    buckets: [{
      name: 'recent',
      label: 'Recent Posts',
      posts: periodPosts
    }]
  };
  const sampledPosts = samplePostsForComments(bucketedData, 15);

  // Fetch comments for sampled posts (no progress callback needed)
  const postsWithComments = await fetchCommentsForPosts(sampledPosts);

  // Get previous digest for comparison (if subscription exists)
  let previousDigest = null;
  if (subscriptionId) {
    try {
      previousDigest = await db.getLastDigest(subscriptionId);
    } catch (err) {
      console.log('No previous digest found for comparison');
    }
  }

  // Get seen posts to avoid repetition
  let seenPostIds = new Set();
  if (subscriptionId) {
    try {
      seenPostIds = await db.getSeenPostIds(subscriptionId);
    } catch (err) {
      console.log('Could not fetch seen posts');
    }
  }

  // Generate digest content using AI
  const digestContent = await generateDigestContent({
    subreddit,
    subredditInfo,
    posts: periodPosts,
    postsWithComments,
    focusTopic,
    frequency,
    periodStart,
    periodEnd,
    previousDigest,
    seenPostIds
  });

  // Determine issue number
  let issueNumber = 1;
  if (subscriptionId) {
    try {
      const history = await db.getDigestHistoryBySubreddit(subreddit, 1);
      if (history.length > 0) {
        issueNumber = (history[0].digest_content?.issueNumber || 0) + 1;
      }
    } catch (err) {
      // Keep default
    }
  }

  return {
    subreddit,
    issueNumber,
    frequency,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    ...digestContent
  };
}

/**
 * Filter posts to only include those from the specified period
 */
function filterPostsByPeriod(buckets, periodStart, periodEnd) {
  const startTime = periodStart.getTime() / 1000;
  const endTime = periodEnd.getTime() / 1000;

  const allPosts = [];
  for (const bucket of buckets) {
    for (const post of bucket.posts) {
      const postTime = post.created_utc || post.created;
      if (postTime >= startTime && postTime <= endTime) {
        allPosts.push({
          ...post,
          bucketLabel: bucket.label
        });
      }
    }
  }

  // Sort by score descending
  return allPosts.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Create an empty digest when no posts found
 */
function createEmptyDigest(subreddit, periodStart, periodEnd, frequency) {
  return {
    subreddit,
    issueNumber: 1,
    frequency,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    quickHits: [{ hook: 'No significant activity this period', post: null }],
    coverStory: null,
    theDebate: null,
    voicesOfTheWeek: [],
    threadOfTheWeek: null,
    sleeperHit: null,
    fromTheTrenches: [],
    soWhat: null,
    contentIdeas: [],
    emergingTopics: [],
    metrics: {
      totalPosts: 0,
      totalComments: 0,
      avgScore: 0
    }
  };
}

/**
 * Generate digest content using AI
 */
async function generateDigestContent({
  subreddit,
  subredditInfo,
  posts,
  postsWithComments,
  focusTopic,
  frequency,
  periodStart,
  periodEnd,
  previousDigest,
  seenPostIds
}) {
  // Build the prompt for AI analysis
  const prompt = buildDigestPrompt({
    subreddit,
    subredditInfo,
    posts,
    postsWithComments,
    focusTopic,
    frequency,
    periodStart,
    periodEnd,
    previousDigest
  });

  // Call Gemini for analysis
  const geminiResult = await analyzeWithGemini(prompt);

  // Check if AI call succeeded
  if (!geminiResult.success) {
    console.error('[Digest] Gemini API failed:', geminiResult.error);
    // Return fallback digest with real post data
    const fallbackPost = posts[0] ? {
      id: posts[0].id,
      title: posts[0].title,
      url: `https://reddit.com${posts[0].permalink}`,
      author: posts[0].author,
      score: posts[0].score,
      numComments: posts[0].num_comments || posts[0].numComments || 0,
      selftext: posts[0].selftext || '',
      createdUtc: posts[0].created_utc
    } : null;
    return {
      quickHits: [{ hook: `Top discussion: "${posts[0]?.title || 'Community active this period'}"`, post: fallbackPost }],
      coverStory: fallbackPost ? { whyItMatters: 'Most engaging post this period.', post: fallbackPost } : null,
      theDebate: null,
      voicesOfTheWeek: [],
      threadOfTheWeek: null,
      sleeperHit: null,
      fromTheTrenches: [],
      soWhat: null,
      contentIdeas: [],
      emergingTopics: [],
      metrics: {
        totalPosts: posts.length,
        totalComments: posts.reduce((sum, p) => sum + (p.num_comments || p.numComments || 0), 0),
        avgScore: posts.length > 0 ? Math.round(posts.reduce((sum, p) => sum + (p.score || 0), 0) / posts.length) : 0
      }
    };
  }

  // Parse the AI response - extract the analysis text from the result object
  const parsed = parseDigestResponse(geminiResult.analysis, posts, postsWithComments);

  return parsed;
}

/**
 * Build the prompt for digest generation
 */
function buildDigestPrompt({
  subreddit,
  subredditInfo,
  posts,
  postsWithComments,
  focusTopic,
  frequency,
  periodStart,
  periodEnd,
  previousDigest
}) {
  const periodLabel = frequency === 'daily' ? 'today' : 'this week';
  const now = Date.now() / 1000;

  let prompt = `You are curating a Content Radar digest for r/${subreddit}.

Your readers are content creators and business researchers who follow this community to spot trends, find content angles, and understand what real people care about. They want to feel like they browsed Reddit without opening Reddit.

RULES FOR TONE:
- Write like a sharp friend forwarding interesting threads, NOT a corporate newsletter
- Keep the raw Reddit energy — messy takes, casual language, real opinions
- DO NOT sanitize, paraphrase, or "clean up" quotes. Use them exactly as written.
- When something is funny, controversial, or surprising — lean into it

SUBREDDIT: r/${subreddit}
${subredditInfo?.title ? `Title: ${subredditInfo.title}` : ''}
${subredditInfo?.subscribers ? `Subscribers: ${subredditInfo.subscribers.toLocaleString()}` : ''}
Period: ${formatDateRange(periodStart, periodEnd)}
${focusTopic ? `Reader's focus: ${focusTopic}` : ''}

=== POSTS FROM ${periodLabel.toUpperCase()} ===
`;

  // Add posts with richer data — more selftext, age, comment ratio
  for (let i = 0; i < Math.min(posts.length, 30); i++) {
    const post = posts[i];
    const numComments = post.num_comments || post.numComments || 0;
    const commentRatio = post.score > 0 ? (numComments / post.score).toFixed(2) : 'N/A';
    const ageHours = post.created_utc ? ((now - post.created_utc) / 3600).toFixed(0) : '?';

    prompt += `\n[#${i}] "${post.title}"`;
    prompt += `\n  Score: ${post.score} | Comments: ${numComments} | Comment/Vote ratio: ${commentRatio} | Posted: ${ageHours}h ago | By: u/${post.author}`;

    if (post.selftext) {
      const maxLen = i < 15 ? 500 : 200;
      const text = post.selftext.substring(0, maxLen);
      prompt += `\n  Post body: "${text}${post.selftext.length > maxLen ? '...' : ''}"`;
    }
    prompt += '\n';
  }

  // Add community discussions with more comments and author data
  if (postsWithComments.length > 0) {
    prompt += `\n=== COMMUNITY DISCUSSIONS (with comments) ===\n`;
    for (const post of postsWithComments.slice(0, 12)) {
      const postIdx = posts.findIndex(p => p.id === post.id);
      prompt += `\n**[#${postIdx >= 0 ? postIdx : '?'}] "${post.title}"** [${post.score} pts, ${post.num_comments || post.numComments || 0} comments]\n`;

      if (post.comments && post.comments.length > 0) {
        for (const comment of post.comments.slice(0, 8)) {
          const text = comment.body.substring(0, 300);
          prompt += `  - u/${comment.author} [${comment.score} pts]: "${text}${comment.body.length > 300 ? '...' : ''}"\n`;
        }
      }
    }
  }

  // Previous digest for comparison
  if (previousDigest && previousDigest.top_themes) {
    prompt += `\n\n=== LAST DIGEST'S THEMES (for comparison) ===\n`;
    prompt += JSON.stringify(previousDigest.top_themes, null, 2);
  }

  prompt += `

=== YOUR TASK ===

Curate this into a digest. Return as JSON with these sections:

{
  "quickHits": [
    // 3-4 one-line story hooks that make people want to click through
    // Each must reference a specific post. Write them like headlines, not statistics.
    // BAD: "AI tools saw 45% increase in mentions"
    // GOOD: "A dev's rant about Copilot breaking prod got 2.3K upvotes — plot twist: the bug was theirs"
    {
      "hook": "The story hook sentence",
      "postIndex": 0
    }
  ],

  "coverStory": {
    // The single most interesting/engaging post this period
    // DO NOT write a summary. We will show the actual post content directly.
    "postIndex": 0,
    "whyItMatters": "1 sentence — why this blew up or why it matters (be real, not corporate)"
  },

  "theDebate": {
    // The most polarizing topic where the community is genuinely split
    // Set to null if there's no real disagreement worth highlighting
    "topic": "The question people disagree on",
    "postIndex": 0,
    "sideA": {
      "position": "What this camp believes (1 sentence)",
      "quotes": [
        {"text": "Exact quote from comments", "author": "u/username", "score": 123}
      ]
    },
    "sideB": {
      "position": "What the other camp believes (1 sentence)",
      "quotes": [
        {"text": "Exact quote from comments", "author": "u/username", "score": 123}
      ]
    }
  },

  "voicesOfTheWeek": [
    // 3-4 comments worth reading — insightful, funny, or brutally honest
    // These should make the reader think "I need to read this thread"
    {
      "quote": "The exact comment text — keep the human voice, typos and all",
      "author": "u/username",
      "score": 123,
      "postIndex": 0
    }
  ],

  "threadOfTheWeek": {
    // The best conversation — where replies build on each other
    "postIndex": 0,
    "topReplies": [
      {"text": "Exact reply text", "author": "u/username", "score": 45}
    ]
  },

  "sleeperHit": {
    // A post with HIGH comment-to-vote ratio (>0.5) — lots of discussion but not many upvotes
    // The hidden gem most people scrolled past. Set to null if nothing qualifies.
    "postIndex": 0,
    "whyItMatters": "Why this deserves attention despite low upvotes"
  },

  "fromTheTrenches": [
    // 3-5 real data points, numbers, tools, or actionable advice people shared in comments
    // These are the gold nuggets — real practitioner knowledge
    // BAD: "Users discussed various pricing strategies"
    // GOOD: "We switched from Vercel to Railway and our bill dropped from $340/mo to $45/mo"
    {
      "insight": "The actual data point, number, tool, or recommendation someone shared",
      "author": "u/username",
      "postIndex": 0
    }
  ],

  "soWhat": {
    // Second-order thinking — connect the dots across this period's discussions
    // State what's happening now, then project the non-obvious consequence
    "signal": "The pattern or trend across this period's discussions (be specific)",
    "implications": [
      "First order: What this means right now",
      "Second order: Where this leads — the non-obvious consequence most people miss",
      "For creators: What to do about it — the specific content or positioning play"
    ]
  },

  "contentIdeas": [
    // 3 specific content ideas backed by demand signals from actual threads
    {
      "title": "Specific content title or angle",
      "format": "blog post / video / thread / comparison / tutorial",
      "demandSignal": "What in the data proves people want this — cite the specific thread or comment pattern",
      "sourcePostIndex": 0
    }
  ],

  "emergingTopics": [
    {
      "topic": "Topic name",
      "mentions": 12,
      "isNew": true,
      "context": "Why it's emerging now (1 sentence)"
    }
  ],

  "metrics": {
    "totalPosts": ${posts.length},
    "totalComments": ${posts.reduce((sum, p) => sum + (p.num_comments || p.numComments || 0), 0)},
    "avgScore": ${posts.length > 0 ? Math.round(posts.reduce((sum, p) => sum + (p.score || 0), 0) / posts.length) : 0}
  }
}

CRITICAL RULES:
1. USE EXACT QUOTES from the comment data above. Do NOT paraphrase, clean up, or rewrite them.
2. postIndex values MUST be valid indices from the POSTS list (0 to ${Math.min(posts.length, 30) - 1}).
3. "fromTheTrenches" items must contain REAL data/numbers/tools from actual comments — not AI-generated advice.
4. Write like a person, not a marketing team. No corporate-speak.
5. If a section has no good content for this period, set it to null — don't fabricate.
6. For "soWhat", think like the show Connections: state the present, then trace the non-obvious consequence.
${focusTopic ? `7. Prioritize content relevant to: "${focusTopic}"` : ''}

Return ONLY valid JSON, no markdown code blocks.`;

  return prompt;
}

/**
 * Extract all comments from posts for validation
 * @param {Array} postsWithComments - Posts with their comments
 * @returns {Map} Map of normalized text -> original comment
 */
function extractAllComments(postsWithComments) {
  const comments = new Map();

  for (const post of postsWithComments) {
    if (!post.comments) continue;

    for (const comment of post.comments) {
      if (!comment.body) continue;

      // Store with normalized key for fuzzy matching
      const normalized = normalizeText(comment.body);
      comments.set(normalized, {
        body: comment.body,
        author: comment.author,
        score: comment.score,
        postTitle: post.title
      });

      // Also store first 100 chars for partial matches
      if (normalized.length > 100) {
        comments.set(normalized.substring(0, 100), {
          body: comment.body,
          author: comment.author,
          score: comment.score,
          postTitle: post.title
        });
      }
    }
  }

  return comments;
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

/**
 * Validate a quote against real comments
 * Returns the quote with verified data, or null if not found
 */
function validateQuote(voice, realComments) {
  if (!voice || !voice.quote) return null;

  const normalizedQuote = normalizeText(voice.quote);

  // Try exact match first
  if (realComments.has(normalizedQuote)) {
    const real = realComments.get(normalizedQuote);
    return {
      quote: real.body.substring(0, 300), // Use actual text, cap length
      author: real.author,
      score: real.score,
      context: voice.context || `From: "${real.postTitle}"`
    };
  }

  // Try partial match (quote might be truncated)
  for (const [key, real] of realComments.entries()) {
    // Check if the AI quote is a substring of a real comment
    if (key.includes(normalizedQuote) || normalizedQuote.includes(key.substring(0, 50))) {
      return {
        quote: real.body.substring(0, 300),
        author: real.author,
        score: real.score,
        context: voice.context || `From: "${real.postTitle}"`
      };
    }
  }

  // Quote not found in source data - reject it
  console.log(`[Quote Validation] REJECTED - Quote not found in source: "${voice.quote.substring(0, 50)}..."`);
  return null;
}

/**
 * Validate a thread reply against real comments
 */
function validateReply(reply, realComments) {
  if (!reply || !reply.text) return null;

  const normalizedText = normalizeText(reply.text);

  // Try to find matching comment
  for (const [key, real] of realComments.entries()) {
    if (key.includes(normalizedText) || normalizedText.includes(key.substring(0, 50))) {
      return {
        text: real.body.substring(0, 200),
        author: real.author,
        score: real.score
      };
    }
  }

  // Reply not found - reject it
  console.log(`[Quote Validation] REJECTED reply: "${reply.text.substring(0, 50)}..."`);
  return null;
}

/**
 * Parse the AI response into digest format
 * Validates quotes against actual source data to prevent hallucinations
 * Enriches all sections with real post data (URLs, selftext, etc.)
 */
function parseDigestResponse(response, posts, postsWithComments) {
  // Helper to get enriched post data by index
  function getPostData(postIndex) {
    if (typeof postIndex !== 'number' || postIndex < 0 || postIndex >= posts.length) return null;
    const post = posts[postIndex];
    if (!post) return null;
    return {
      id: post.id,
      title: post.title,
      url: `https://reddit.com${post.permalink}`,
      author: post.author,
      score: post.score,
      numComments: post.num_comments || post.numComments || 0,
      selftext: post.selftext || '',
      createdUtc: post.created_utc
    };
  }

  try {
    // Clean up response
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);

    const parsed = JSON.parse(cleaned);

    // Build real comments map for quote validation
    const realComments = extractAllComments(postsWithComments);

    // --- Enrich quickHits with post data ---
    if (parsed.quickHits && Array.isArray(parsed.quickHits)) {
      parsed.quickHits = parsed.quickHits.map(hit => {
        if (typeof hit === 'string') return { hook: hit, post: null };
        return {
          hook: hit.hook || String(hit),
          post: getPostData(hit.postIndex)
        };
      });
    }

    // --- Enrich coverStory with full post data (including selftext) ---
    if (parsed.coverStory && typeof parsed.coverStory.postIndex === 'number') {
      parsed.coverStory.post = getPostData(parsed.coverStory.postIndex);
    }

    // --- Enrich theDebate with post data and validate quotes ---
    if (parsed.theDebate && parsed.theDebate.topic) {
      parsed.theDebate.post = getPostData(parsed.theDebate.postIndex);
      // Validate debate quotes (they use 'text' field like replies)
      if (parsed.theDebate.sideA?.quotes) {
        parsed.theDebate.sideA.quotes = parsed.theDebate.sideA.quotes
          .map(q => {
            // Try to validate against real comments
            const asReply = validateReply({ text: q.text, author: q.author, score: q.score }, realComments);
            return asReply || q; // Keep AI version if not found (debate quotes are harder to match)
          })
          .slice(0, 2);
      }
      if (parsed.theDebate.sideB?.quotes) {
        parsed.theDebate.sideB.quotes = parsed.theDebate.sideB.quotes
          .map(q => {
            const asReply = validateReply({ text: q.text, author: q.author, score: q.score }, realComments);
            return asReply || q;
          })
          .slice(0, 2);
      }
    }

    // --- Validate and enrich voicesOfTheWeek ---
    if (parsed.voicesOfTheWeek && Array.isArray(parsed.voicesOfTheWeek)) {
      parsed.voicesOfTheWeek = parsed.voicesOfTheWeek
        .map(voice => {
          const validated = validateQuote(voice, realComments);
          if (validated) {
            validated.post = getPostData(voice.postIndex);
            return validated;
          }
          return null;
        })
        .filter(voice => voice !== null);

      console.log(`[Quote Validation] Kept ${parsed.voicesOfTheWeek.length} verified voices`);
    }

    // --- Validate and enrich threadOfTheWeek ---
    if (parsed.threadOfTheWeek) {
      parsed.threadOfTheWeek.post = getPostData(parsed.threadOfTheWeek.postIndex);
      if (parsed.threadOfTheWeek.topReplies) {
        parsed.threadOfTheWeek.topReplies = parsed.threadOfTheWeek.topReplies
          .map(reply => validateReply(reply, realComments))
          .filter(reply => reply !== null);
      }
    }

    // --- Enrich sleeperHit ---
    if (parsed.sleeperHit && typeof parsed.sleeperHit.postIndex === 'number') {
      parsed.sleeperHit.post = getPostData(parsed.sleeperHit.postIndex);
    }

    // --- Enrich fromTheTrenches with post data ---
    if (parsed.fromTheTrenches && Array.isArray(parsed.fromTheTrenches)) {
      parsed.fromTheTrenches = parsed.fromTheTrenches.map(item => ({
        ...item,
        post: getPostData(item.postIndex)
      }));
    }

    // --- Enrich contentIdeas with source post data ---
    if (parsed.contentIdeas && Array.isArray(parsed.contentIdeas)) {
      parsed.contentIdeas = parsed.contentIdeas.map(idea => ({
        ...idea,
        post: getPostData(idea.sourcePostIndex)
      }));
    }

    return parsed;

  } catch (error) {
    console.error('Failed to parse digest response:', error);
    console.log('Raw response:', response.substring(0, 500));

    // Return a basic structure on parse failure
    return {
      quickHits: [{ hook: `Top discussion: "${posts[0]?.title || 'Community active this period'}"`, post: getPostData(0) }],
      coverStory: posts[0] ? {
        whyItMatters: 'Most engaging post this period.',
        post: getPostData(0)
      } : null,
      theDebate: null,
      voicesOfTheWeek: [],
      threadOfTheWeek: null,
      sleeperHit: null,
      fromTheTrenches: [],
      soWhat: null,
      contentIdeas: [],
      emergingTopics: [],
      metrics: {
        totalPosts: posts.length,
        totalComments: posts.reduce((sum, p) => sum + (p.num_comments || p.numComments || 0), 0),
        avgScore: posts.length > 0 ? Math.round(posts.reduce((sum, p) => sum + (p.score || 0), 0) / posts.length) : 0
      }
    };
  }
}

/**
 * Format date range for display
 */
function formatDateRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
}

/**
 * Classify subreddit activity and recommend frequency
 */
async function classifyActivity(subreddit) {
  try {
    const { buckets } = await fetchTimeBucketedPosts(subreddit, 'quick');

    // Calculate metrics
    const totalPosts = buckets.reduce((sum, b) => sum + (b.posts?.length || 0), 0);
    const postsPerDay = totalPosts / 30; // Assuming 30 days of data

    const allPosts = buckets.flatMap(b => b.posts || []);
    const avgComments = allPosts.length > 0
      ? allPosts.reduce((sum, p) => sum + (p.num_comments || p.numComments || 0), 0) / allPosts.length
      : 0;

    // Activity score
    const activityScore = postsPerDay * (1 + avgComments / 50);

    let level, recommended, reason;
    if (activityScore > 200) {
      level = 'high';
      recommended = 'daily';
      reason = 'High-activity community. Daily keeps you ahead of trends.';
    } else if (activityScore > 50) {
      level = 'medium';
      recommended = 'weekly';
      reason = 'Moderate activity. Weekly captures the best without noise.';
    } else {
      level = 'low';
      recommended = 'weekly';
      reason = 'Thoughtful community. Weekly digest is ideal.';
    }

    return {
      level,
      postsPerDay,
      avgCommentsPerPost: avgComments,
      recommendedFrequency: recommended,
      reason
    };

  } catch (error) {
    console.error('Activity classification failed:', error);
    return {
      level: 'unknown',
      recommendedFrequency: 'weekly',
      reason: 'Weekly digest recommended.'
    };
  }
}

module.exports = {
  generateDigest,
  classifyActivity
};
