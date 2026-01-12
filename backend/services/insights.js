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

  const prompt = `You are an expert qualitative researcher and content strategist for a ${role || 'General Analyst'}.

**GOAL:** ${goal || 'Extract key insights and patterns'}

══════════════════════════════════════
CRITICAL INSTRUCTION
══════════════════════════════════════

You do TWO things:
1. **Analyze** — Extract insights, patterns, and signals from the data
2. **Produce** — If the goal asks for a deliverable (titles, copy, ideas, scripts, etc.), actually create it—don't just explain how

For the "Direct Answer" section: If the goal implies output, INCLUDE the actual output.

══════════════════════════════════════
FORMATTING RULES
══════════════════════════════════════

✦ BE CONCISE: Max 1-2 sentences per bullet. No filler.
✦ USE VISUAL HIERARCHY:
  - ## for main sections
  - **Bold** for key terms
  - → for implications/actions
  - ✓ / ✗ for do/don't lists
✦ SKIP sections that don't add value
✦ NO generic insights—every point must be specific to THIS thread

══════════════════════════════════════
OUTPUT STRUCTURE
══════════════════════════════════════

## ⚡ Key Insights for ${role || 'You'}
5-7 bullets. Each insight = pattern + implication. No fluff.

## 🎯 Direct Answer: ${goal ? goal.substring(0, 50) : 'Your Goal'}
Answer + deliverable if the goal asks for one.

## 📊 Themes & Signals
For each theme (3-5 max):
**Theme Name**
- What triggers reaction
- Underlying belief/value
- → Action or implication

## 💬 Language That Works
✓ Phrases that resonate
✗ Phrases that backfire

## ⚠️ Watch Out
Risks, blind spots, or what NOT to conclude.

══════════════════════════════════════
CONSTRAINTS
══════════════════════════════════════
- Ground every insight in the data
- No moralizing or judging
- No hallucinated stats
- Adapt sections to what the data actually reveals

══════════════════════════════════════
THREAD DATA
══════════════════════════════════════

**r/${post.subreddit || 'unknown'}** | ${post.score} pts | ${post.num_comments} comments

**${post.title}**

${post.selftext || '[Link/image post]'}

---

**COMMENTS (${comments.length})**

${comments.map((c, i) => c.body).join('\n\n---\n\n')}

══════════════════════════════════════
BEGIN ANALYSIS
══════════════════════════════════════`;

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
