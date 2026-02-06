/**
 * Content Radar Digest Generation Service
 *
 * Generates magazine-style digests from Reddit community data.
 * Builds on Community Pulse but formats for email/digest delivery.
 */

const { analyzeWithGemini } = require('./gemini');
const { fetchTimeBucketedPosts, getSubredditInfo, samplePostsForComments } = require('./search');
const { extractRedditData, fetchCommentsForPosts, getRedditAccessToken } = require('./reddit');
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

  // Fetch comments for sampled posts
  const postsWithComments = await fetchCommentsForPosts(sampledPosts, 10);

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
    quickHits: ['No significant activity this period'],
    coverStory: null,
    voicesOfTheWeek: [],
    threadOfTheWeek: null,
    contentIdeas: [],
    emergingTopics: [],
    metrics: {
      totalPosts: 0,
      totalComments: 0
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
  const analysis = await analyzeWithGemini(prompt);

  // Parse the AI response
  const parsed = parseDigestResponse(analysis, posts, postsWithComments);

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

  let prompt = `You are generating a Content Radar digest for r/${subreddit}.
This is a ${frequency} digest for content creators who want to stay on top of trending topics and find content ideas.

SUBREDDIT: r/${subreddit}
${subredditInfo?.title ? `Title: ${subredditInfo.title}` : ''}
${subredditInfo?.subscribers ? `Subscribers: ${subredditInfo.subscribers.toLocaleString()}` : ''}
Period: ${formatDateRange(periodStart, periodEnd)}
${focusTopic ? `User's focus topic: ${focusTopic}` : ''}

=== TOP POSTS ${periodLabel.toUpperCase()} ===
`;

  // Add top posts
  for (const post of posts.slice(0, 30)) {
    prompt += `\n[${post.score} pts, ${post.num_comments || post.numComments || 0} comments] "${post.title}"`;
    if (post.selftext) {
      prompt += `\n  ${post.selftext.substring(0, 200)}...`;
    }
  }

  // Add posts with comments for voice analysis
  if (postsWithComments.length > 0) {
    prompt += `\n\n=== COMMUNITY DISCUSSIONS (with comments) ===\n`;
    for (const post of postsWithComments.slice(0, 10)) {
      prompt += `\n**"${post.title}"** [${post.score} pts]\n`;
      if (post.comments && post.comments.length > 0) {
        prompt += `Top comments:\n`;
        for (const comment of post.comments.slice(0, 5)) {
          const text = comment.body.substring(0, 200);
          prompt += `  - [${comment.score} pts] "${text}${comment.body.length > 200 ? '...' : ''}"\n`;
        }
      }
    }
  }

  // Add comparison context if available
  if (previousDigest && previousDigest.top_themes) {
    prompt += `\n\n=== LAST DIGEST'S TOP THEMES (for comparison) ===\n`;
    prompt += JSON.stringify(previousDigest.top_themes, null, 2);
  }

  prompt += `

=== YOUR TASK ===

Generate a magazine-style digest with these sections. Return as JSON:

{
  "quickHits": [
    // 3-4 bullet points summarizing the week/day
    // Include specific numbers and trends
    // Example: "AI coding tools dominated discussion (+45% mentions)"
  ],

  "coverStory": {
    "title": "The headline from the most engaging discussion",
    "postIndex": 0,  // Index of the post in the TOP POSTS list (0-based)
    "summary": "2-3 sentences explaining why this resonated and what it reveals"
  },

  "voicesOfTheWeek": [
    // 2-3 memorable quotes from comments
    {
      "quote": "The exact quote (keep the human voice, including casual language)",
      "author": "u/username",
      "score": 123,
      "context": "Brief context about what post this was from"
    }
  ],

  "threadOfTheWeek": {
    "title": "Thread title",
    "postIndex": 0,  // Index of the post
    "topReplies": [
      // 3-4 actual replies showing the conversation flow
      {"text": "Reply text", "author": "u/username", "score": 45}
    ]
  },

  "contentIdeas": [
    // 3 specific content ideas for creators
    {
      "title": "Specific content title/angle",
      "rationale": "Why this would work (data from the community)"
      ${focusTopic ? `, "relevanceToFocus": 0.0-1.0 // How relevant to user's focus: "${focusTopic}"` : ''}
    }
  ],

  "emergingTopics": [
    // Topics that are new or growing
    {
      "topic": "Topic name",
      "mentions": 12,
      "isNew": true,  // true if not mentioned in previous digest
      "isControversial": false  // true if there's debate
    }
  ],

  "theDebate": {
    // Optional: if there's a significant disagreement this week
    "topic": "What people are debating",
    "forSide": {"summary": "...", "quotes": ["..."]},
    "againstSide": {"summary": "...", "quotes": ["..."]}
  },

  "metrics": {
    "totalPosts": ${posts.length},
    "totalComments": ${posts.reduce((sum, p) => sum + (p.num_comments || p.numComments || 0), 0)},
    "topMentionedTerms": ["term1", "term2", "term3"]  // Most frequently mentioned products/tools/topics
  }
}

IMPORTANT:
- Preserve the HUMAN VOICE. Use actual quotes, not paraphrased versions.
- Be specific with numbers and percentages where possible.
- The "postIndex" fields should reference posts from the TOP POSTS list (0-indexed).
- Content ideas should be actionable for creators (not generic).
${focusTopic ? `- Prioritize content matching the user's focus: "${focusTopic}"` : ''}

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
 */
function parseDigestResponse(response, posts, postsWithComments) {
  try {
    // Clean up response if needed
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }

    const parsed = JSON.parse(cleaned);

    // Build a set of all real comments for validation
    const realComments = extractAllComments(postsWithComments);

    // Validate and filter voicesOfTheWeek - only keep verified quotes
    if (parsed.voicesOfTheWeek && Array.isArray(parsed.voicesOfTheWeek)) {
      parsed.voicesOfTheWeek = parsed.voicesOfTheWeek
        .map(voice => validateQuote(voice, realComments))
        .filter(voice => voice !== null);

      console.log(`[Quote Validation] Kept ${parsed.voicesOfTheWeek.length} verified voices`);
    }

    // Validate threadOfTheWeek replies
    if (parsed.threadOfTheWeek && parsed.threadOfTheWeek.topReplies) {
      parsed.threadOfTheWeek.topReplies = parsed.threadOfTheWeek.topReplies
        .map(reply => validateReply(reply, realComments))
        .filter(reply => reply !== null);
    }

    // Enhance with actual post data
    if (parsed.coverStory && typeof parsed.coverStory.postIndex === 'number') {
      const post = posts[parsed.coverStory.postIndex];
      if (post) {
        parsed.coverStory.post = {
          id: post.id,
          url: post.url || `https://reddit.com${post.permalink}`,
          author: post.author,
          score: post.score,
          numComments: post.num_comments || post.numComments
        };
      }
    }

    if (parsed.threadOfTheWeek && typeof parsed.threadOfTheWeek.postIndex === 'number') {
      const post = posts[parsed.threadOfTheWeek.postIndex];
      if (post) {
        parsed.threadOfTheWeek.post = {
          id: post.id,
          url: post.url || `https://reddit.com${post.permalink}`,
          author: post.author,
          score: post.score,
          numComments: post.num_comments || post.numComments
        };
      }
    }

    return parsed;

  } catch (error) {
    console.error('Failed to parse digest response:', error);
    console.log('Raw response:', response.substring(0, 500));

    // Return a basic structure on parse failure
    return {
      quickHits: ['Analysis in progress - check back soon'],
      coverStory: posts[0] ? {
        title: posts[0].title,
        post: {
          id: posts[0].id,
          url: posts[0].url || `https://reddit.com${posts[0].permalink}`,
          score: posts[0].score,
          numComments: posts[0].num_comments || posts[0].numComments
        },
        summary: 'Top post this period.'
      } : null,
      voicesOfTheWeek: [],
      threadOfTheWeek: null,
      contentIdeas: [],
      emergingTopics: [],
      metrics: {
        totalPosts: posts.length,
        totalComments: posts.reduce((sum, p) => sum + (p.num_comments || p.numComments || 0), 0)
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
