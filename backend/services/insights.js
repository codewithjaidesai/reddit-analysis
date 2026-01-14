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
 * Format combined analysis prompt for multiple posts
 * @param {array} postsData - Array of extracted data from multiple posts
 * @param {string} role - User's role
 * @param {string} goal - User's goal
 * @returns {string} Formatted prompt
 */
function formatCombinedAnalysisPrompt(postsData, role = null, goal = null) {
  const totalComments = postsData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0);
  const subreddits = [...new Set(postsData.map(p => p.post?.subreddit).filter(Boolean))];
  const postCount = postsData.length;

  // Build posts summary with truncated comments
  const postsContent = postsData.map((data, idx) => {
    const post = data.post;
    const comments = data.valuableComments || [];
    return `
POST ${idx + 1}: "${post.title}"
r/${post.subreddit} • ${post.score} upvotes • ${comments.length} comments
${comments.slice(0, 15).map(c => `[${c.score}] ${c.body.substring(0, 250)}`).join('\n')}`;
  }).join('\n---\n');

  const prompt = `ROLE: ${role || 'Analyst'}
GOAL: ${goal || 'Extract insights'}
DATA: ${postCount} posts, ${totalComments} total comments from ${subreddits.join(', ')}

${postsContent}

===

INSTRUCTIONS:
1. Synthesize insights ACROSS all ${postCount} posts. Look for patterns that appear in multiple posts.
2. Answer their GOAL directly.
3. Be SHORT. Max 2 sentences per bullet.
4. NO TABLES. Use bullet points only.
5. Show cross-post validation (e.g., "mentioned in 3/5 posts").

OUTPUT FORMAT:

## 🎯 ${goal || 'Key Findings'}
[3-7 bullets directly answering their goal, with cross-post counts where relevant]

## 📊 Patterns Across Posts
[3-5 bullets showing what appeared in multiple posts]

## ⚡ What Each Post Contributed
${postsData.map((d, i) => `- Post ${i + 1}: [one unique insight from this post]`).join('\n')}

## 🔍 Confidence
[1-2 sentences: ${totalComments} comments across ${postCount} posts - is this enough?]

Keep it tight. No fluff.`;

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

    return {
      mode: 'combined_analysis',
      model: aiResult.model,
      postCount: postsData.length,
      totalComments: postsData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0),
      subreddits: [...new Set(postsData.map(p => p.post?.subreddit).filter(Boolean))],
      aiAnalysis: aiResult.analysis
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
