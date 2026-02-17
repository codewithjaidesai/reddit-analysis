const { analyzeWithGemini } = require('./gemini');

/**
 * Build the AI prompt for analyzing a Reddit user's complete activity
 * Groups topics, tracks changes over time, provides deep analysis
 * @param {object} userData - Complete user data from scrapeUserData()
 * @returns {string} Formatted prompt
 */
function buildUserAnalysisPrompt(userData) {
  const { profile, comments, posts, subredditActivity, stats } = userData;

  // Build a compact representation of comments grouped by subreddit
  const commentsBySubreddit = {};
  comments.forEach(c => {
    if (!commentsBySubreddit[c.subreddit]) {
      commentsBySubreddit[c.subreddit] = [];
    }
    commentsBySubreddit[c.subreddit].push(c);
  });

  // Format top subreddits with sample comments (cap to avoid token overflow)
  const topSubreddits = subredditActivity.slice(0, 25);
  let commentsSection = '';
  let totalIncluded = 0;
  const maxComments = 150;

  for (const sub of topSubreddits) {
    if (totalIncluded >= maxComments) break;
    const subComments = (commentsBySubreddit[sub.subreddit] || []).slice(0, 15);
    if (subComments.length === 0) continue;

    commentsSection += `\n--- r/${sub.subreddit} (${sub.commentCount} comments, ${sub.postCount} posts) ---\n`;
    for (const c of subComments) {
      if (totalIncluded >= maxComments) break;
      const date = new Date(c.created_utc * 1000).toISOString().split('T')[0];
      const body = c.body.length > 400 ? c.body.substring(0, 400) + '...' : c.body;
      commentsSection += `[${date}, ${c.score}pts, re: "${c.link_title?.substring(0, 80) || 'unknown'}"] ${body}\n`;
      totalIncluded++;
    }
  }

  // Format posts
  let postsSection = '';
  const topPosts = posts.slice(0, 40);
  for (const p of topPosts) {
    const date = new Date(p.created_utc * 1000).toISOString().split('T')[0];
    const body = p.selftext ? (p.selftext.length > 300 ? p.selftext.substring(0, 300) + '...' : p.selftext) : '';
    postsSection += `[${date}, r/${p.subreddit}, ${p.score}pts, ${p.num_comments} replies] "${p.title}"${body ? '\n' + body : ''}\n`;
  }

  const prompt = `You are an expert analyst performing a comprehensive profile analysis of Reddit user u/${profile.username}.

USER PROFILE:
- Username: u/${profile.username}
- Account age: ~${profile.accountAge} years
- Link karma: ${profile.link_karma} | Comment karma: ${profile.comment_karma}
- Data range: ${stats.oldestActivity ? stats.oldestActivity.split('T')[0] : 'N/A'} to ${stats.newestActivity ? stats.newestActivity.split('T')[0] : 'N/A'}
- Total comments analyzed: ${stats.totalComments}
- Total posts analyzed: ${stats.totalPosts}
- Active in ${stats.uniqueSubreddits} subreddits

TOP SUBREDDIT ACTIVITY:
${topSubreddits.map(s => `r/${s.subreddit}: ${s.commentCount} comments, ${s.postCount} posts (avg comment score: ${s.avgCommentScore})`).join('\n')}

POSTS BY USER:
${postsSection || 'No posts found'}

COMMENTS BY SUBREDDIT:
${commentsSection || 'No comments found'}

===

ANALYSIS INSTRUCTIONS:
Perform a thorough, intelligent analysis. Return ONLY valid JSON (no markdown, no backticks).

{
  "profileSummary": "2-4 sentence overview of who this user appears to be based on their activity. Infer likely demographics, profession, interests.",

  "topicGroups": [
    {
      "topic": "Clear, descriptive topic name",
      "description": "What this user discusses/cares about regarding this topic",
      "subreddits": ["list of related subreddits"],
      "commentCount": 0,
      "sentiment": "positive or negative or mixed or neutral",
      "keyPoints": ["Main things the user has said about this topic"],
      "sampleQuotes": [
        {"text": "Exact or near-exact quote (max 200 chars)", "subreddit": "SubredditName", "date": "YYYY-MM-DD", "score": 0}
      ],
      "evolution": "How their views or engagement on this topic changed over time (if applicable). Note if their stance shifted, if they stopped discussing it, or if new aspects emerged. Say 'No significant change observed' if static."
    }
  ],

  "topicTimeline": [
    {
      "topic": "Topic name (matches topicGroups)",
      "entries": [
        {
          "date": "YYYY-MM-DD",
          "summary": "What they said/did regarding this topic at this point",
          "notableChange": "If laws, regulations, best practices, or their personal stance changed - describe the old vs new information. null if no change."
        }
      ]
    }
  ],

  "interestProfile": {
    "primaryInterests": ["Top 3-5 core interests"],
    "secondaryInterests": ["3-5 less frequent but notable interests"],
    "expertise": ["Topics where the user shows deep knowledge based on comment quality and reception"],
    "communityRole": "What role does this user typically play? (helper, debater, lurker-who-comments-occasionally, expert-contributor, etc.)"
  },

  "behaviorPatterns": {
    "engagementStyle": "How does this user typically engage? (long detailed comments, short opinions, questions, advice-giving, etc.)",
    "activityPattern": "When are they most active? Any patterns in posting frequency?",
    "controversialTopics": ["Topics where the user takes strong or unpopular stances"],
    "highPerformingContent": "What type of content from this user gets the most upvotes?"
  },

  "regulatoryAndFactualUpdates": [
    {
      "topic": "Topic where information may have changed",
      "userLastMentioned": "YYYY-MM-DD",
      "whatUserSaid": "What the user stated at the time",
      "currentStatus": "What the current reality is (if different from what user stated). Include any law changes, regulation updates, market shifts, technology changes, etc.",
      "significance": "high or medium or low"
    }
  ],

  "statistics": {
    "mostActiveSubreddit": "SubredditName",
    "highestScoredComment": {"text": "Comment text (max 200 chars)", "score": 0, "subreddit": "SubredditName"},
    "highestScoredPost": {"title": "Post title", "score": 0, "subreddit": "SubredditName"},
    "averageCommentLength": 0,
    "topSubredditsByKarma": [{"subreddit": "Name", "totalKarma": 0}],
    "activityTrend": "increasing or decreasing or stable"
  }
}

ANALYSIS RULES:
1. topicGroups: Identify 5-15 distinct topics. Group related discussions together. Don't just list subreddits - identify actual TOPICS (e.g., "Personal Finance & Investing" not just "r/personalfinance").
2. topicTimeline: For topics that appeared multiple times, show how the discussion evolved. Focus on topics where information or stance changed.
3. regulatoryAndFactualUpdates: This is CRITICAL. If the user discussed laws, regulations, medical advice, financial rules, technology specs, or any factual claims - check if those may be outdated. Provide the latest known information. If you're unsure, note the uncertainty.
4. Be objective and factual. Don't make moral judgments about the user.
5. sampleQuotes must be actual text from the comments provided, not paraphrased.
6. Return ONLY the JSON object, nothing else.`;

  return prompt;
}

/**
 * Run AI analysis on scraped user data
 * @param {object} userData - Complete user data from scrapeUserData()
 * @returns {Promise<object>} Structured analysis results
 */
async function analyzeUserData(userData) {
  console.log('Building user analysis prompt...');
  const prompt = buildUserAnalysisPrompt(userData);
  console.log(`User analysis prompt length: ${prompt.length} characters`);

  console.log('Calling Gemini API for user analysis...');
  const aiResult = await analyzeWithGemini(prompt);

  if (!aiResult.success) {
    throw new Error(`AI analysis failed: ${aiResult.error || 'Unknown error'}`);
  }

  // Parse JSON response
  let analysis = null;
  try {
    let cleaned = aiResult.analysis.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    analysis = JSON.parse(cleaned);
    console.log('Successfully parsed user analysis JSON');
  } catch (parseError) {
    console.error('Failed to parse user analysis JSON:', parseError.message);
    // Return raw text as fallback
    return {
      success: true,
      structured: null,
      rawAnalysis: aiResult.analysis,
      model: aiResult.model
    };
  }

  return {
    success: true,
    structured: analysis,
    rawAnalysis: aiResult.analysis,
    model: aiResult.model
  };
}

module.exports = {
  buildUserAnalysisPrompt,
  analyzeUserData
};
