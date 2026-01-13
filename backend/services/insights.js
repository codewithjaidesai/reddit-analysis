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

  const prompt = `You are a senior research consultant working for a ${role || 'decision-maker'}.

**THEIR GOAL:** ${goal || 'Extract actionable insights'}

══════════════════════════════════════
YOUR APPROACH
══════════════════════════════════════

1. **Goal drives output** — Structure your response around what they asked for
   - If goal = recommendations → Lead with ranked recommendations
   - If goal = insights/opportunities → Lead with opportunities table
   - If goal = create something → Lead with the actual deliverable
   - If goal = understand something → Lead with the key findings

2. **Quantitative only when justified**
   - Count mentions, calculate %, show tables ONLY if ${commentCount}+ comments give statistical meaning
   - If data is thin (few comments, narrow perspectives), SAY SO
   - Don't manufacture confidence from insufficient data

3. **Be a consultant, not a summarizer**
   - If you can't answer their goal well with this data, tell them
   - Suggest specific follow-up research (exact subreddits, search terms, questions)
   - A good "I don't have enough data, here's what to search next" is more valuable than fake confidence

══════════════════════════════════════
OUTPUT RULES
══════════════════════════════════════

**Structure (adapt based on goal):**

## 🎯 [Goal-specific header]
The main deliverable. What they asked for. Put it FIRST.
- If recommendations: ranked list with validation (mentions, sentiment)
- If insights: opportunity/pattern breakdown
- If content: the actual content
- If analysis: the key findings

## 📊 Data Confidence
Be honest:
- "Based on ${commentCount} comments, [X pattern] appears [N] times (N%)" — if data supports it
- "Limited data: only ${commentCount} comments. Treat as directional, not conclusive." — if thin
- "Not enough signal to answer this confidently. Recommend searching: [specific terms]" — if inadequate

## ⚡ Supporting Insights
Only include if genuinely useful for their role. Skip if redundant.

## 💬 Language/Framing (if relevant to goal)
✓ What resonates
✗ What backfires

## 🔍 Research Gaps (if applicable)
What you couldn't answer + specific next steps:
- "Search [X] in r/[subreddit] for more data on [topic]"
- "This thread skews [demographic/perspective], consider also checking [alternative]"

══════════════════════════════════════
FORMATTING
══════════════════════════════════════
- Max 1-2 sentences per bullet
- Use tables for comparisons/rankings
- **Bold** key terms
- → for implications
- No filler, no hedging, no generic statements
- Skip sections that add no value

══════════════════════════════════════
THREAD DATA
══════════════════════════════════════

**r/${post.subreddit || 'unknown'}** | ${post.score} pts | ${post.num_comments} total comments

**${post.title}**

${post.selftext || '[Link/image post]'}

---

**HIGH-VALUE COMMENTS (${commentCount} analyzed)**

${comments.map((c, i) => `[${c.score} pts] ${c.body}`).join('\n\n---\n\n')}

══════════════════════════════════════
BEGIN
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
