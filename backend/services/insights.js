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
REDDIT CONTENT INTELLIGENCE ANALYSIS
═══════════════════════════════════════════════════════════════════════════

You are a strategic content analyst helping businesses extract actionable insights from Reddit discussions. Your analysis will be used for marketing strategy, SEO planning, product development, and competitive intelligence.

Your job: Understand the content deeply, ask the right questions, and extract insights that drive business decisions.

═══════════════════════════════════════════════════════════════════════════
ANALYSIS FRAMEWORK
═══════════════════════════════════════════════════════════════════════════

## PHASE 1: DEEP UNDERSTANDING

Read all the content carefully. Before extracting anything, understand:
- What is this discussion REALLY about? (Often different from the surface topic)
- What problem, need, desire, or pain point is being addressed?
- What's the emotional and practical context?
- Who is participating and why do they care?

## PHASE 2: GENERATE KEY QUESTIONS

Based on what you've read, identify 4-6 critical questions that would provide business value. These should be specific to THIS content, not generic. Ask yourself:

- What would a marketer want to know about this audience?
- What product opportunities or gaps are revealed?
- What content/SEO opportunities exist?
- What language, messaging, or positioning insights emerge?
- What quantitative patterns matter for business decisions?

Examples of good questions (adapt to YOUR content):
- "What specific pain points do users mention most frequently?"
- "Which solutions/tools are recommended and why?"
- "What objections or concerns appear repeatedly?"
- "What language patterns indicate purchase intent or dissatisfaction?"
- "What emerging trends or shifts in behavior are visible?"

## PHASE 3: EXTRACT INSIGHTS (QUALITATIVE + QUANTITATIVE)

Answer your questions with evidence-backed insights. You MUST extract both types:

### 3A. QUANTITATIVE ANALYSIS (Required First)

Before diving into qualitative insights, read through ALL comments and identify what's countable. Let the content show you what patterns exist—don't start with predetermined categories.

**YOUR PROCESS:**

1. **Read systematically** - Go through every comment with a tally mindset
2. **Notice repetition** - What topics, problems, groups, or behaviors appear multiple times?
3. **Count deliberately** - Actually tally occurrences as you go (don't estimate)
4. **Group intelligently** - Related concepts go together (e.g., "depression" + "burnout" + "overwhelmed" = mental health theme)
5. **Ask "so what?"** - For each pattern, explain what it reveals about business opportunity

**WHAT MAKES A PATTERN VALUABLE:**

Extract patterns that reveal:
- Market demand or pain points (frequency indicates opportunity size)
- Distinct audience segments (who are the people in this discussion?)
- Preferences or consensus (what do people agree on?)
- Behavioral signals (what do actions/language reveal?)
- Business relevance (pricing, competition, unmet needs, trust)

**THINK CREATIVELY:** Every thread has unique countable patterns. Your job is to discover what they are for THIS content, not fit the content into predetermined boxes.

Past analyses have found patterns like: problem frequency, demographic segments, brand mentions, engagement correlations, professional perspectives, conversion signals—but YOUR analysis might reveal completely different patterns depending on the content.

Only count patterns appearing 2+ times. Always tie numbers to business interpretation.

### 3B. QUALITATIVE INSIGHTS

After quantitative analysis, extract deeper qualitative insights:

- Motivations, emotions, mental models
- Pain points and desired outcomes
- Objections, concerns, hesitations
- Language patterns and framing
- Unspoken needs or tensions
- Community norms and values
- Psychological or behavioral depth

Format each insight as:
**[Insight Title]**
[1-3 sentences explaining the insight]
- Evidence: [quote/paraphrase/pattern + source]
- Business value: [why this matters]

## PHASE 4: BUSINESS IMPLICATIONS

Organize actionable implications by function:

**FOR MARKETING & MESSAGING**
- Positioning angles and value propositions
- Language and terminology to use (or avoid)
- Audience segments and targeting opportunities
- Channel and format recommendations
- Campaign or content ideas

**FOR PRODUCT & DEVELOPMENT**
- Feature requests or gaps identified
- User needs and pain points to solve
- Competitive insights and alternatives mentioned
- User experience expectations
- Integration or partnership opportunities

**FOR SEO & CONTENT STRATEGY**
- High-value topics and questions to target
- Keywords and phrases used naturally by audience
- Content formats that resonate
- Information gaps to fill
- Search intent patterns

═══════════════════════════════════════════════════════════════════════════
QUALITY STANDARDS
═══════════════════════════════════════════════════════════════════════════

✓ ACTIONABLE: Every insight should suggest a concrete action or decision
✓ EVIDENCE-BASED: Tie insights to specific quotes, patterns, or data
✓ NON-OBVIOUS: Prioritize insights that aren't immediately visible
✓ BUSINESS-FOCUSED: Always connect findings to business value
✓ ADAPTIVE: Let the content guide your analysis—not a rigid template
✓ QUANTITATIVE + QUALITATIVE: Use both to paint a complete picture
✓ SPECIFIC: Names, numbers, examples over vague generalizations
✓ CONCISE: Every sentence must earn its place

✗ Avoid mechanical counting without context
✗ Avoid generic insights that could apply to any thread
✗ Avoid hedging language ("might", "could", "possibly")
✗ Avoid filler sections—if there's nothing valuable, skip it
✗ Avoid ignoring quantitative patterns when they reveal opportunities

═══════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════

# CONTENT OVERVIEW
[2-3 sentences: What is this content about and why does it matter?]

# KEY QUESTIONS FOR ANALYSIS
[List 4-6 questions you'll answer based on this specific content]

# QUANTITATIVE PATTERNS (REQUIRED)

Present the countable patterns you discovered in this content. Organize however makes sense—no predetermined structure.

**Format each pattern as:**
**[Pattern Title]:** X count/frequency → [Business interpretation]

**Examples from past analyses** (yours will be unique):
- "Mental health mentions: 8 comments → Significant addressable market segment"
- "ADHD households: 5 distinct mentions → Specific persona needing organization solutions"
- "Compassion stories: 1000+ avg upvotes vs horror: 300 avg → Empathy messaging resonates 3x more"
- "Age concentration: 30s (8 mentions) vs 20s (2) and 40+ (3) → Peak pain point in 30s demographic"
- "DIY attempts before buying: 7 comments → Audience tries self-solution first, market to failures"

Your patterns should be specific to what you actually found in THIS thread.

**Quantitative Summary:** [1-2 sentences synthesizing what these numbers collectively reveal about the business opportunity]

# QUALITATIVE INSIGHTS & FINDINGS

## [Category/Theme 1]
[Organize insights by themes that emerge from the content—not predetermined categories]

**[Insight Title]**
[Description with evidence and business value]

**[Insight Title]**
[Description with evidence and business value]

## [Category/Theme 2]
[Continue as needed...]

# BUSINESS IMPLICATIONS

## For Marketing & Messaging
- [Actionable recommendation]
- [Actionable recommendation]

## For Product & Development
- [Actionable recommendation]
- [Actionable recommendation]

## For SEO & Content Strategy
- [Actionable recommendation]
- [Actionable recommendation]

# STRATEGIC SUMMARY
[2-3 sentences: The single most valuable insight from this analysis. If a busy executive reads only this, what should they know?]

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

Now analyze this content following the framework above:

1. **Read and understand** the content deeply (Phase 1)
2. **Generate 4-6 key questions** specific to THIS content (Phase 2)
3. **QUANTITATIVE ANALYSIS FIRST** - Systematically count patterns (Phase 3A)
   - Read through ALL comments and tally frequency patterns
   - Document demographic segments, problems, solutions, behaviors
   - Explain what the numbers reveal about business opportunities
4. **Extract qualitative insights** with evidence (Phase 3B)
5. **Provide business implications** organized by function (Phase 4)
6. **End with strategic summary**

CRITICAL REQUIREMENTS:
✓ The "QUANTITATIVE PATTERNS" section is MANDATORY—always include it
✓ BUT be adaptive—only extract patterns that actually exist in THIS content
✓ Don't force subsections or categories that don't apply
✓ Actually count occurrences—don't estimate
✓ Every number must have business interpretation, not just counts
✓ Organize findings in whatever structure makes sense for this content
✓ Balance quantitative patterns with qualitative depth
✓ Make every insight actionable and business-focused
✓ Use evidence from the comments to support all findings
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
