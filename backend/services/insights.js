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

  const prompt = `You are an expert qualitative researcher and decision-intelligence analyst.

Your task is to analyze a Reddit thread and transform raw discussion into
clear, actionable insights tailored to the user's ROLE and GOAL.

This is NOT a summary task.
This is NOT sentiment analysis.
This is NOT a list of opinions.

Your job is to extract:
- underlying pain points
- emotional drivers
- behavioral patterns
- cultural signals
- language patterns
and translate them into decisions and actions relevant to the user's ROLE.

────────────────────────
INPUTS
────────────────────────
USER_ROLE: ${role || 'General Analyst'}
USER_GOAL: ${goal || 'Extract key insights and patterns'}

────────────────────────
ANALYSIS INSTRUCTIONS
────────────────────────

Step 1 — Identify Core Themes
- Cluster the comments into 3–6 dominant themes
- Focus on repeated behaviors, frustrations, values, or judgments
- Ignore one-off anecdotes unless they reinforce a broader pattern

Step 2 — Extract Underlying Signals
For each theme, identify:
- The emotional trigger (what people react strongly to)
- The implicit belief or value being expressed
- What people reward vs punish socially

Step 3 — Translate for the USER_ROLE
Reframe the themes as insights *useful for the user's role*.
Ask yourself:
- What decisions does this role need to make?
- What risks does this data warn them about?
- What opportunities does it reveal?

Step 4 — Answer the USER_GOAL directly
Explicitly answer the user's goal using evidence from the thread.
Do NOT generalize beyond what the data supports.

Step 5 — Language & Framing Insights
Extract:
- Words, phrases, or frames that resonate positively
- Words, symbols, or frames that trigger rejection or mockery

────────────────────────
DYNAMIC OUTPUT RULES
────────────────────────

You are NOT required to rigidly follow predefined sections.

Your responsibility is to:
- Adapt each section to the USER_ROLE and USER_GOAL
- Omit any section that does not add clear value
- Modify section titles and content as needed
- Add new sections if the data strongly supports additional insights

The goal is usefulness, not completeness.

────────────────────────
DEFAULT SECTIONS (USE AS STARTING POINT)
────────────────────────

1. Executive Insight (5–7 bullets for the USER_ROLE)
2. Core Themes & Signals
3. Role-Specific Implications
4. Direct Answer to USER_GOAL
5. Language & Framing Guidance (if relevant to role)
6. Risks & Blind Spots

You may merge, split, rename, or omit sections as needed.

────────────────────────
WHEN TO ADD NEW SECTIONS
────────────────────────

Add new sections when data clearly supports:
- Market opportunities or gaps
- Cultural fault lines or polarization
- Strong emotional drivers
- Unexpected contradictions
- Clear behavioral archetypes

────────────────────────
CONSTRAINTS
────────────────────────
- Do not moralize or judge commenters
- Do not explain Reddit mechanics
- Do not repeat comments verbatim
- Do not hallucinate statistics
- Stay grounded in the provided data only

────────────────────────
THREAD DATA
────────────────────────

r/${post.subreddit || 'unknown'} | ${post.score} upvotes | ${post.num_comments} comments

**${post.title}**

${post.selftext || '[Link/image post]'}

────────────────────────
HIGH-VALUE COMMENTS (${comments.length} total)
────────────────────────

${comments.map((c, i) => c.body).join('\n\n---\n\n')}

────────────────────────
BEGIN ANALYSIS
────────────────────────`;

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
