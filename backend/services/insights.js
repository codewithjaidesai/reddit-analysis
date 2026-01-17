const { analyzeWithGemini } = require('./gemini');

/**
 * Format extracted Reddit data for AI analysis
 * @param {object} extractedData - Extracted Reddit post and comments
 * @param {string} role - User's role (e.g. Product Manager, Marketer, Founder)
 * @param {string} goal - User's goal (e.g. find pain points, validate idea)
 * @returns {string} Formatted prompt
 */
function formatAnalysisPrompt(extractedData, role = null, goal = null) {
  const post = extractedData.post;
  const comments = extractedData.valuableComments;
  const commentCount = comments.length;

  const prompt = `ROLE: ${role || 'Analyst'}
GOAL: ${goal || 'Extract insights'}
DATA: ${commentCount} comments from r/${post.subreddit || 'unknown'}

THREAD: "${post.title}"
${post.selftext ? post.selftext.substring(0, 300) + '...' : ''}

COMMENTS:
${comments.slice(0, 25).map((c) => `[${c.score} pts] ${c.body.substring(0, 300)}`).join('\n---\n')}

===

INSTRUCTIONS:
1. Answer their GOAL directly. If they want recommendations, give recommendations. If they want content ideas, give content ideas. If they want insights, give insights.
2. Be SHORT. Max 2 sentences per bullet.
3. NO TABLES. Use bullet points only.
4. If ${commentCount} < 15 comments, warn that data is limited and suggest specific follow-up searches.
5. Include mention counts only if pattern appears 3+ times.

OUTPUT FORMAT:

## 🎯 ${goal || 'Key Findings'}
[3-7 bullets directly answering their goal]

## 📊 Confidence
[1 sentence: is this enough data?]

## ⚡ Patterns
[3-5 bullets if useful, skip if redundant]

## 🔍 Go Deeper
[Only if data is thin: specific subreddits/searches to try]

Keep it tight. No fluff.`;

  return prompt;
}

/**
 * Generate AI insights from extracted Reddit data
 * @param {object} contentData - Extracted Reddit data
 * @param {string} role - User's role (e.g. Product Manager, Marketer)
 * @param {string} goal - User's goal (e.g. find pain points, validate idea)
 * @returns {Promise<object>} AI analysis result
 */
async function generateAIInsights(contentData, role = null, goal = null) {
  console.log('Generating AI-powered insights with Gemini');
  console.log('Content data received:', {
    hasPost: !!contentData.post,
    commentsCount: contentData.valuableComments?.length || 0,
    hasStats: !!contentData.extractionStats,
    role: role || 'not specified',
    goal: goal || 'not specified'
  });

  try {
    // Build analysis prompt with role/goal context
    console.log('Building analysis prompt...');
    const prompt = formatAnalysisPrompt(contentData, role, goal);
    console.log('Prompt length:', prompt.length, 'characters');

    // Call Gemini API
    console.log('Calling Gemini API...');
    const aiResult = await analyzeWithGemini(prompt);

    console.log('Gemini API result:', {
      success: aiResult.success,
      hasAnalysis: !!aiResult.analysis,
      analysisLength: aiResult.analysis?.length || 0,
      error: aiResult.error || 'none'
    });

    if (!aiResult.success) {
      const errorMsg = `Gemini API failed: ${aiResult.error || aiResult.message || 'Unknown error'}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Return AI analysis in compatible format
    console.log('Returning AI analysis successfully');
    return {
      mode: 'ai_analysis',
      model: aiResult.model,
      totalInsights: 1,
      aiAnalysis: aiResult.analysis,
      insights: [{
        type: 'ai_comprehensive',
        insight: 'AI-powered comprehensive analysis',
        fullAnalysis: aiResult.analysis
      }]
    };

  } catch (error) {
    console.error('AI insights generation error:', error.message);
    console.error('Error stack:', error.stack);
    throw new Error('AI analysis failed: ' + error.message);
  }
}

/**
 * Format combined analysis prompt for multiple posts - returns structured JSON
 * @param {array} postsData - Array of extracted data from multiple posts
 * @param {string} role - User's role
 * @param {string} goal - User's goal
 * @returns {string} Formatted prompt
 */
function formatCombinedAnalysisPrompt(postsData, role = null, goal = null) {
  const totalComments = postsData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0);
  const subreddits = [...new Set(postsData.map(p => p.post?.subreddit).filter(Boolean))];
  const postCount = postsData.length;

  // Build posts summary with subreddit attribution for quotes
  const postsContent = postsData.map((data, idx) => {
    const post = data.post;
    const comments = data.valuableComments || [];
    return `
POST ${idx + 1}: "${post.title}"
r/${post.subreddit} • ${post.score} upvotes • ${comments.length} comments
${comments.slice(0, 12).map(c => `[r/${post.subreddit}, ${c.score} pts] ${c.body.substring(0, 300)}`).join('\n')}`;
  }).join('\n---\n');

  const prompt = `You are analyzing Reddit comments for a ${role || 'researcher'}.
Their GOAL: "${goal || 'Extract insights'}"

DATA: ${postCount} posts, ${totalComments} comments from: ${subreddits.map(s => 'r/' + s).join(', ')}

${postsContent}

===

Return ONLY valid JSON (no markdown, no backticks). Structure:

{
  "executiveSummary": "2-3 sentence summary tailored to their goal as a ${role || 'researcher'}. What should they know?",
  "topQuotes": [
    {
      "type": "INSIGHT or WARNING or TIP or COMPLAINT",
      "quote": "Exact quote from comments (max 200 chars)",
      "subreddit": "SubredditName"
    }
  ],
  "keyInsights": [
    {
      "title": "Short title (3-5 words)",
      "description": "1-2 sentence insight directly relevant to their goal",
      "sentiment": "positive or negative or neutral"
    }
  ],
  "forYourGoal": [
    "Bullet point directly answering: ${goal || 'key findings'}"
  ],
  "confidence": {
    "level": "high or medium or low",
    "reason": "Brief explanation based on data volume/quality"
  },
  "quantitativeInsights": {
    "topicsDiscussed": [
      {
        "topic": "Topic/theme name",
        "mentions": 5,
        "sentiment": "positive or negative or mixed",
        "example": "Brief example phrase from comments"
      }
    ],
    "sentimentBreakdown": {
      "positive": 40,
      "negative": 35,
      "neutral": 25
    },
    "commonPhrases": [
      {
        "phrase": "Common phrase or term",
        "count": 8,
        "context": "How it's typically used"
      }
    ],
    "dataPatterns": [
      "Pattern 1: observation about the data",
      "Pattern 2: another trend noticed"
    ],
    "engagementCorrelation": "What types of comments get more upvotes in this dataset"
  }
}

RULES:
1. topQuotes: Pick 4-6 most impactful REAL quotes from the comments. Include subreddit name.
2. keyInsights: 3-5 insights. Title should be catchy. Focus on what matters for their GOAL.
3. forYourGoal: 3-5 bullets that DIRECTLY answer what the ${role || 'user'} asked for: "${goal || 'insights'}"
4. quantitativeInsights: Analyze the data quantitatively:
   - topicsDiscussed: 4-7 distinct topics/themes with actual mention counts from the data
   - sentimentBreakdown: Estimate % breakdown based on comment tone
   - commonPhrases: 3-5 frequently mentioned terms/phrases with counts
   - dataPatterns: 2-4 patterns you notice in the data
   - engagementCorrelation: What content gets upvoted
5. Keep it concise. No fluff.
6. Return ONLY the JSON object, nothing else.`;

  return prompt;
}

/**
 * Generate combined AI insights from multiple posts
 * @param {array} postsData - Array of extracted data from multiple posts
 * @param {string} role - User's role
 * @param {string} goal - User's goal
 * @returns {Promise<object>} AI analysis result
 */
async function generateCombinedInsights(postsData, role = null, goal = null) {
  console.log('Generating combined AI insights for multiple posts');
  console.log('Posts data:', {
    postCount: postsData.length,
    totalComments: postsData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0),
    role: role || 'not specified',
    goal: goal || 'not specified'
  });

  try {
    const prompt = formatCombinedAnalysisPrompt(postsData, role, goal);
    console.log('Combined prompt length:', prompt.length, 'characters');

    const aiResult = await analyzeWithGemini(prompt);

    if (!aiResult.success) {
      throw new Error(`Gemini API failed: ${aiResult.error || 'Unknown error'}`);
    }

    // Try to parse JSON response
    let structuredAnalysis = null;
    try {
      // Clean up response - remove any markdown code blocks if present
      let cleanedResponse = aiResult.analysis.trim();

      // Remove markdown code block wrappers
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7);
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();

      // Try to extract JSON if there's extra text around it
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      structuredAnalysis = JSON.parse(cleanedResponse);
      console.log('Successfully parsed structured JSON response');
    } catch (parseError) {
      console.log('Failed to parse JSON, falling back to markdown:', parseError.message);
      console.log('Raw response preview:', aiResult.analysis.substring(0, 200));
      // Keep structuredAnalysis as null, frontend will use markdown fallback
    }

    return {
      mode: 'combined_analysis',
      model: aiResult.model,
      postCount: postsData.length,
      totalComments: postsData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0),
      subreddits: [...new Set(postsData.map(p => p.post?.subreddit).filter(Boolean))],
      structured: structuredAnalysis,
      aiAnalysis: aiResult.analysis // Keep raw response as fallback
    };

  } catch (error) {
    console.error('Combined insights generation error:', error.message);
    throw new Error('Combined AI analysis failed: ' + error.message);
  }
}

module.exports = {
  formatAnalysisPrompt,
  generateAIInsights,
  formatCombinedAnalysisPrompt,
  generateCombinedInsights
};
