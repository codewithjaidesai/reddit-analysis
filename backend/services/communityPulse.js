const { analyzeWithGemini } = require('./gemini');
const { extractRedditData } = require('./reddit');

/**
 * Community Pulse Analysis Service
 *
 * Analyzes a subreddit community to understand:
 * - Top themes and topics
 * - Emerging vs declining trends
 * - Community language patterns
 * - Persona-specific insights
 */

/**
 * Get persona label for display
 */
function getPersonaLabel(role) {
  const labels = {
    'product_manager': 'Product Manager',
    'marketer': 'Marketer / Copywriter',
    'content_creator': 'Content Creator',
    'custom': 'General Explorer'
  };
  return labels[role] || 'Researcher';
}

/**
 * Build the Community Pulse analysis prompt
 * @param {object} data - Bucketed posts data
 * @param {string} role - User's persona role
 * @param {object} subredditInfo - Subreddit metadata
 * @param {string} customFocus - Optional custom analysis focus
 * @returns {string} Analysis prompt
 */
function buildCommunityPulsePrompt(data, role, subredditInfo, customFocus = null) {
  const { buckets, subreddit, depth } = data;
  const isFullAnalysis = depth === 'full';

  // Format posts from each bucket
  let postsContent = '';
  for (const bucket of buckets) {
    if (bucket.posts.length > 0) {
      postsContent += `\n### ${bucket.label} (${bucket.postCount} posts)\n`;
      for (const post of bucket.posts.slice(0, 20)) {
        postsContent += `- [${post.score} pts, ${post.num_comments} comments] "${post.title}"\n`;
        if (post.selftext) {
          postsContent += `  Preview: ${post.selftext.substring(0, 150)}...\n`;
        }
      }
    }
  }

  const totalPosts = buckets.reduce((sum, b) => sum + b.postCount, 0);
  const personaLabel = getPersonaLabel(role);

  // Build persona-specific instructions
  let personaInstructions = '';
  switch (role) {
    case 'product_manager':
      personaInstructions = `
PERSONA FOCUS (Product Manager):
- Identify pain points and frustrations mentioned
- Spot feature requests and unmet needs
- Note competitor mentions and comparisons
- Find product/service gaps in the community`;
      break;
    case 'marketer':
      personaInstructions = `
PERSONA FOCUS (Marketer / Copywriter):
- Extract community-specific language and phrases
- Identify emotional triggers and motivations
- Find common objections and concerns
- Note how members describe their problems/solutions`;
      break;
    case 'content_creator':
      personaInstructions = `
PERSONA FOCUS (Content Creator):
- Identify questions that generate high engagement
- Spot debate-worthy or controversial topics
- Find content formats that resonate
- Note what makes posts go viral in this community`;
      break;
    default:
      personaInstructions = `
PERSONA FOCUS (General Explorer):
- Understand the community's core purpose
- Identify what binds members together
- Note community norms and culture
- Find what makes this community unique`;
  }

  // Build trend analysis instructions if full analysis
  const trendInstructions = isFullAnalysis ? `
TREND ANALYSIS:
Compare themes across time periods to identify:
- EMERGING: Topics appearing more in recent posts vs older
- CONSISTENT: Topics that appear across all time periods
- DECLINING: Topics that were discussed more in older posts

For each major theme, indicate if it's: ↗ Rising | → Ongoing | ↘ Declining` : '';

  // Build custom focus instructions
  const customFocusInstructions = customFocus ? `
CUSTOM ANALYSIS FOCUS:
The user wants you to focus the analysis specifically on: "${customFocus}"
- Prioritize insights related to this focus area
- In topThemes, highlight themes that relate to this focus
- In forYourPersona section, provide insights specific to this focus
- Still provide general community overview, but weight the analysis toward this focus topic` : '';

  const prompt = `You are analyzing the r/${subreddit} community to understand what members care about.

SUBREDDIT: r/${subreddit}
${subredditInfo?.title ? `TITLE: ${subredditInfo.title}` : ''}
${subredditInfo?.subscribers ? `SUBSCRIBERS: ${subredditInfo.subscribers.toLocaleString()}` : ''}
${subredditInfo?.description ? `DESCRIPTION: ${subredditInfo.description.substring(0, 200)}` : ''}

ANALYSIS PERIOD: ${isFullAnalysis ? '1 year (with trend analysis)' : 'Last 30 days'}
TOTAL POSTS ANALYZED: ${totalPosts}
${personaInstructions}
${trendInstructions}
${customFocusInstructions}

=== POST DATA BY TIME PERIOD ===
${postsContent}

=== OUTPUT INSTRUCTIONS ===

Return a JSON object with this EXACT structure (no markdown, just valid JSON):

{
  "communitySnapshot": "2-3 sentence overview of what this community is about and who its members are",

  "topThemes": [
    {
      "name": "Theme Name",
      "percentage": 25,
      "description": "Brief description of this theme",
      "trend": "rising" | "stable" | "declining",
      "trendNote": "Why this trend is happening (optional)"
    }
  ],

  "trendAnalysis": {
    "emerging": [
      {
        "topic": "Topic name",
        "evidence": "Why this is emerging",
        "opportunityNote": "What this means for the persona"
      }
    ],
    "consistent": [
      {
        "topic": "Topic name",
        "note": "Why this is a core theme"
      }
    ],
    "declining": [
      {
        "topic": "Topic name",
        "evidence": "Why this is declining"
      }
    ]
  },

  "languagePatterns": {
    "commonPhrases": ["phrase 1", "phrase 2", "phrase 3"],
    "emotionalTriggers": ["trigger 1", "trigger 2"],
    "communitySlang": ["term 1", "term 2"]
  },

  "sentimentOverview": {
    "overall": "positive" | "mixed" | "negative" | "supportive" | "frustrated",
    "note": "Brief explanation of community mood"
  },

  "forYourPersona": {
    "personaType": "${personaLabel}",
    "keyInsights": [
      "Insight 1 specific to this persona",
      "Insight 2 specific to this persona",
      "Insight 3 specific to this persona"
    ],
    "actionableOpportunities": [
      "Opportunity 1",
      "Opportunity 2"
    ]
  },

  "topEngagingTopics": [
    {
      "topic": "Topic that gets high engagement",
      "whyItWorks": "What makes this resonate"
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks
- Keep descriptions concise (1-2 sentences max)
- Include 4-6 top themes with percentages that roughly sum to 100
- If this is a quick analysis (not full), skip detailed trend analysis
- Be specific to THIS community, not generic observations`;

  return prompt;
}

/**
 * Analyze community pulse from time-bucketed posts
 * @param {object} bucketedData - Posts organized by time buckets
 * @param {string} role - User's persona role
 * @param {object} subredditInfo - Subreddit metadata
 * @param {string} customFocus - Optional custom analysis focus
 * @returns {Promise<object>} Community pulse analysis
 */
async function analyzeCommunityPulse(bucketedData, role, subredditInfo, customFocus = null) {
  console.log('=== COMMUNITY PULSE ANALYSIS ===');
  console.log('Subreddit:', bucketedData.subreddit);
  console.log('Depth:', bucketedData.depth);
  console.log('Total posts:', bucketedData.totalPosts);
  console.log('Role:', role);
  console.log('Custom Focus:', customFocus || 'none');

  try {
    // Build the analysis prompt
    const prompt = buildCommunityPulsePrompt(bucketedData, role, subredditInfo, customFocus);
    console.log('Prompt length:', prompt.length, 'characters');

    // Call Gemini API
    const result = await analyzeWithGemini(prompt);

    if (!result.success) {
      throw new Error(result.error || 'AI analysis failed');
    }

    // Parse the JSON response
    let analysis;
    try {
      // Clean up the response - remove any markdown code blocks
      let cleanedResponse = result.analysis
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      analysis = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError.message);
      console.log('Raw response:', result.analysis.substring(0, 500));

      // Return a structured error response
      return {
        success: false,
        error: 'Failed to parse analysis results',
        rawResponse: result.analysis
      };
    }

    return {
      success: true,
      subreddit: bucketedData.subreddit,
      depth: bucketedData.depth,
      totalPostsAnalyzed: bucketedData.totalPosts,
      bucketSummary: bucketedData.buckets.map(b => ({
        name: b.name,
        label: b.label,
        postCount: b.postCount
      })),
      analysis,
      meta: {
        model: result.model,
        analyzedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Community pulse analysis error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to analyze community: ' + error.message
    };
  }
}

/**
 * Extract comments from top posts for deeper analysis
 * @param {Array} posts - Array of post objects with URLs
 * @param {number} limit - Max posts to extract comments from
 * @returns {Promise<Array>} Extracted post data with comments
 */
async function extractPostComments(posts, limit = 10) {
  console.log(`Extracting comments from ${Math.min(posts.length, limit)} posts...`);

  const postsToExtract = posts.slice(0, limit);
  const results = [];
  const failures = [];

  // Extract in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < postsToExtract.length; i += batchSize) {
    const batch = postsToExtract.slice(i, i + batchSize);

    const batchPromises = batch.map(async (post) => {
      try {
        const result = await extractRedditData(post.url);
        if (result.success) {
          return { success: true, data: result.data, url: post.url };
        } else {
          return { success: false, error: result.error, url: post.url };
        }
      } catch (error) {
        return { success: false, error: error.message, url: post.url };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      if (result.success) {
        results.push(result.data);
      } else {
        failures.push({ url: result.url, error: result.error });
      }
    }

    // Small delay between batches
    if (i + batchSize < postsToExtract.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`Extracted ${results.length} posts, ${failures.length} failures`);
  return { postsData: results, failures };
}

module.exports = {
  analyzeCommunityPulse,
  extractPostComments,
  buildCommunityPulsePrompt
};
