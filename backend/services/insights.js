const { analyzeWithGemini } = require('./gemini');

/**
 * Format extracted Reddit data for AI analysis
 * @param {object} extractedData - Extracted Reddit post and comments
 * @param {string} researchQuestion - Optional research question for context
 * @param {string} template - Optional analysis template
 * @returns {string} Formatted prompt
 */
function formatAnalysisPrompt(extractedData, researchQuestion = null, template = 'all') {
  const post = extractedData.post;
  const comments = extractedData.valuableComments;
  const stats = extractedData.extractionStats;

  // Build research context section if provided
  let researchContext = '';
  if (researchQuestion) {
    researchContext = `
═══════════════════════════════════════════════════════════════════════════
RESEARCH CONTEXT (IMPORTANT - READ FIRST)
═══════════════════════════════════════════════════════════════════════════

The user is researching: "${researchQuestion}"

${template && template !== 'all' ? `Analysis Focus: ${template.replace('_', ' ').toUpperCase()}

` : ''}Your analysis should directly answer this research question and provide insights specifically relevant to what the user is trying to understand.

`;
  } else if (template && template !== 'all') {
    researchContext = `
═══════════════════════════════════════════════════════════════════════════
ANALYSIS FOCUS
═══════════════════════════════════════════════════════════════════════════

Analysis Template: ${template.replace('_', ' ').toUpperCase()}

Focus your analysis on patterns and insights relevant to this specific area.

`;
  }

  const prompt = `Analyze this Reddit thread. Find what's genuinely interesting and say it clearly.
${researchContext ? `\n**RESEARCH FOCUS:** ${researchQuestion}\nPrioritize insights that answer this question.\n` : ''}
NO FIXED FORMAT. The content dictates the output. Some threads reveal product preferences. Some expose tensions. Some are people venting. Report what's actually there.

RULES:
- One sentence beats three. Short and sharp wins.
- Only include what the data earns—skip empty sections
- Cite evidence: quotes, vote counts, patterns
- Skip anything obvious or generic

ANGLES TO CONSIDER (use what fits, skip what doesn't):
- What the thread is really about (often not the literal question)
- Concrete recommendations with vote validation
- Agreement vs. genuine disagreement
- What's NOT being said
- Surprising voting patterns
- Who would find this useful and why

FORMAT:
• Start with 1-2 sentence summary of the thread's core value
• Middle: whatever the data reveals (bullets, tables, lists—your call)
• End with the single most actionable takeaway

---

**r/${post.subreddit || 'unknown'}** | ${post.score} upvotes | ${post.num_comments} comments

**${post.title}**

${post.selftext || '[Link/image post]'}

---

**TOP COMMENTS** (${comments.length} high-value, sorted by score)

${comments.map((c, i) => `**#${i + 1}** (${c.score} pts) u/${c.author}
${c.body}
`).join('\n')}

---

Analyze:`;

  return prompt;
}

/**
 * Generate AI insights from extracted Reddit data
 * @param {object} contentData - Extracted Reddit data
 * @param {string} researchQuestion - Optional research question for context
 * @param {string} template - Optional analysis template
 * @returns {Promise<object>} AI analysis result
 */
async function generateAIInsights(contentData, researchQuestion = null, template = 'all') {
  console.log('Generating AI-powered insights with Gemini');
  console.log('Content data received:', {
    hasPost: !!contentData.post,
    commentsCount: contentData.valuableComments?.length || 0,
    hasStats: !!contentData.extractionStats,
    hasResearchQuestion: !!researchQuestion,
    template: template || 'all'
  });

  try {
    // Build analysis prompt with research context
    console.log('Building analysis prompt...');
    const prompt = formatAnalysisPrompt(contentData, researchQuestion, template);
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
