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

module.exports = {
  formatAnalysisPrompt,
  generateAIInsights
};
