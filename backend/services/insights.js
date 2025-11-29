const { analyzeWithGemini } = require('./gemini');

/**
 * Format extracted Reddit data for AI analysis
 * @param {object} extractedData - Extracted Reddit post and comments
 * @returns {string} Formatted prompt
 */
function formatAnalysisPrompt(extractedData) {
  const post = extractedData.post;
  const comments = extractedData.valuableComments;
  const stats = extractedData.extractionStats;

  const prompt = `═══════════════════════════════════════════════════════════════════════════
REDDIT INSIGHT EXTRACTION
═══════════════════════════════════════════════════════════════════════════

You are analyzing Reddit data to extract valuable, evidence-based insights. Your output will be read by busy professionals—every sentence must earn its place.

## INPUT
- Post: title, body, subreddit, score, comment count
- High-value comments with scores

## OUTPUT STRUCTURE

### 1. SNAPSHOT
One paragraph. What is this thread really about? (Often different from the literal question.) What emotional need is the community addressing?

### 2. QUANTITATIVE EXTRACTION

**Engagement Metrics**
| Metric | Value |
|--------|-------|
| Post score | X |
| Comments | X total → X high-value |
| Top comment score | X (X% of post score) |
| Score dropoff pattern | describe |

**Topic/Category Mentions**
Count every distinct topic, item, or theme mentioned across comments. Format:
- [Category]: X mentions

**Platform/Brand/Tool Mentions**
List every product, platform, app, book, or brand mentioned (unprompted endorsements signal community trust):
- [Name]: X mentions

**People/Experts Referenced**
Authors, influencers, or figures cited as authorities.

### 3. INSIGHTS (Tiered)

**Level 1 — Direct Observations**
What the comments explicitly say. Patterns visible on first read.
- [Insight] → Evidence: "[quote or paraphrase]" (Comment #X)

**Level 2 — Cross-Comment Patterns**
Connections across multiple L1 insights. What emerges when you combine observations?
- [Insight] → Based on: [which L1 insights combine to reveal this]

**Level 3 — Behavioral/Psychological Depth**
Non-obvious insights about motivation, identity, hidden tensions, or unspoken needs. What would a behavioral economist or qualitative researcher notice?
- [Insight] → Evidence: [pattern or quotes that reveal this]

### 4. TENSIONS & PARADOXES
What contradictions exist between:
- The subreddit's stated identity vs. actual discussion?
- What people say they want vs. how they behave?
- What's defended/justified vs. what's stated freely?

Note what's conspicuously ABSENT from the conversation.

### 5. EXTERNAL CONNECTIONS
Connect this thread's patterns to broader context YOU know:
- Relevant market trends, statistics, or research
- Adjacent communities or movements this connects to
- Timing context (cultural moments, news, seasons) if relevant
- How this compares to typical discourse on this topic

This is where you add value beyond the raw data.

### 6. WHO BENEFITS
| Audience | Actionable Insight |
|----------|-------------------|
| [Specific role] | [What they should do with this] |

Be specific: "PM at a habit-tracking app" not "product managers"

### 7. STRATEGIC TAKEAWAY
2-3 sentences. The single most valuable synthesis. If someone reads nothing else, what should they know?

═══════════════════════════════════════════════════════════════════════════
ANALYSIS PRINCIPLES
═══════════════════════════════════════════════════════════════════════════

ALWAYS:
- Tie insights to evidence (quote, paraphrase, or pattern)
- Count things that can be counted
- Notice language patterns (metaphors, justifications, defensive framing)
- The top-voted comment reveals emotional center of gravity
- Treat subreddit name as stated identity; compare to behavior
- Connect to external data/trends when you can add context
- Adapt your category counts to match the actual topic (hobbies → hobby types; investing → asset classes; parenting → age groups; etc.)

QUALITY OVER LENGTH:
- Delete any sentence that doesn't surprise or inform
- Short sections are fine if the data doesn't support more
- No filler phrases or hedging language
- If a tier has no insights, say "None identified" and move on

READABILITY:
- Use tables for structured data
- Bold key phrases within insights
- Keep insights to 1-2 sentences each
- White space is your friend

═══════════════════════════════════════════════════════════════════════════
POST DATA
═══════════════════════════════════════════════════════════════════════════

TITLE: ${post.title}

METADATA:
• Posted by: u/${post.author}
• Subreddit: r/${post.subreddit || 'unknown'}
• Post Score: ${post.score} upvotes
• Total Comments: ${post.num_comments}

EXTRACTION STATISTICS:
• Total Comments Processed: ${stats.total}
• High-Value Comments Extracted: ${stats.extracted} (${stats.percentageKept}% kept)
• Average Comment Score: ${stats.averageScore}
• Extraction Quality: ${stats.percentageKept}% retention indicates ${stats.percentageKept > 50 ? 'diverse quality' : 'highly selective filtering'}

POST BODY:
${post.selftext || '[No body text - link or image post]'}

═══════════════════════════════════════════════════════════════════════════
HIGH-VALUE COMMENTS (${comments.length} comments - ANALYZE ALL)
═══════════════════════════════════════════════════════════════════════════

${comments.map((comment, index) => `
────────────────────────────────────────────────────────────────────────────
COMMENT #${index + 1}
────────────────────────────────────────────────────────────────────────────
Author: u/${comment.author}
Score: ${comment.score} upvotes${comment.awards > 0 ? ` | Awards: ${comment.awards}` : ''}
Engagement Rank: #${index + 1} of ${comments.length}

${comment.body}
`).join('\n')}

═══════════════════════════════════════════════════════════════════════════
BEGIN ANALYSIS
═══════════════════════════════════════════════════════════════════════════

Now provide your structured analysis following the OUTPUT STRUCTURE format above. Remember:
- Every sentence must earn its place
- Tie all insights to evidence
- Count what can be counted
- Focus on non-obvious patterns
- Be specific and actionable
`;

  return prompt;
}

/**
 * Generate AI insights from extracted Reddit data
 * @param {object} contentData - Extracted Reddit data
 * @returns {Promise<object>} AI analysis result
 */
async function generateAIInsights(contentData) {
  console.log('Generating AI-powered insights with Gemini');
  console.log('Content data received:', {
    hasPost: !!contentData.post,
    commentsCount: contentData.valuableComments?.length || 0,
    hasStats: !!contentData.extractionStats
  });

  try {
    // Build analysis prompt
    console.log('Building analysis prompt...');
    const prompt = formatAnalysisPrompt(contentData);
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
