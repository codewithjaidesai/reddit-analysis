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

  const prompt = `═══════════════════════════════════════════════════════════════════════════
REDDIT CONTENT INTELLIGENCE ANALYSIS
═══════════════════════════════════════════════════════════════════════════

You are a strategic content analyst helping businesses extract actionable insights from Reddit discussions. Your analysis will be used for marketing strategy, SEO planning, product development, and competitive intelligence.

Your job: Understand the content deeply, ask the right questions, and extract insights that drive business decisions.
${researchContext}

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
VISUAL FORMATTING REQUIREMENTS (MANDATORY)
═══════════════════════════════════════════════════════════════════════════

✓ ALL quantitative data MUST use tables with percentages
✓ Maximum 2 sentences per paragraph
✓ Use • bullets for all lists
✓ Bold all **numbers** and **key findings**
✓ Add visual icons: 📊 (data), 💡 (insight), 🔗 (derived), ✅ (action), ⚠️ (warning)
✓ Use visual separators (───) between major sections
✓ Keep paragraphs short and scannable

═══════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════

# ⚡ EXECUTIVE SUMMARY (30 seconds)

**Biggest Finding:** [One sentence - the most important discovery]

**Key Opportunity:** [One sentence - biggest business opportunity]

**Immediate Action:** [One specific thing to do right now]

───

# 📊 QUANTITATIVE PATTERNS

## [Pattern Category Name]

Use tables for all quantitative data. Group intelligently, show percentages.

**IMPORTANT:** Don't just count raw occurrences. Group up (find higher-level categories) and group down (break into meaningful subcategories).

**Example - If analyzing starters mentioned:**

BAD (just counting):
- Spring rolls: 5
- Fries: 8
- Salad: 3

GOOD (intelligent grouping):

| Preparation Method | Count | % of Total | Business Insight |
|-------------------|-------|------------|------------------|
| Fried | 14 | 65% | Dominant preference for indulgent options |
| Steamed | 5 | 23% | Secondary interest in lighter prep |
| Fresh | 3 | 14% | Health-conscious segment exists but small |

| Health Profile | Count | % of Total | Business Insight |
|----------------|-------|------------|------------------|
| Indulgent | 16 | 73% | Primary audience seeks comfort food |
| Healthy | 6 | 27% | Quarter of market wants healthier options |

**Key Finding:** [1-2 sentences summarizing the table's business implications]

## [Next Pattern Category]
...

**Quantitative Summary:** [What all these numbers collectively reveal about business opportunities]

───

# 💡 QUALITATIVE INSIGHTS

## [Theme/Category from content]

**[Insight Title]**
- **Finding:** [1-2 sentences max]
- **Evidence:** "[Quote or pattern]" (Comment #X)
- **Business Value:** [Why this matters - 1 sentence]

**[Next Insight]**
...

## [Next Theme]
...

───

# 🔗 DERIVED INSIGHTS & IMPLICATIONS

This section connects dots and reveals cascading effects. Not just what data says, but what it IMPLIES.

## [Insight Chain Title]

**Observable Pattern:**
[What the data directly shows - 1-2 sentences]

**Derived Implications:**
1. **Immediate Effect** → [What this directly causes]
2. **Secondary Effect** → [What the immediate effect causes]
3. **Tertiary Effect** → [Cascading impact if applicable]

**Business Probability:** [High/Medium/Low confidence + why]

**Strategic Action:** [Specific recommendation based on this chain]

## [Next Insight Chain]
...

───

# 🎯 BUSINESS IMPLICATIONS

## For Marketing & Messaging
✅ [Specific actionable item]
✅ [Specific actionable item]
✅ [Specific actionable item]

## For Product & Development
✅ [Specific actionable item]
✅ [Specific actionable item]

## For SEO & Content Strategy
✅ [Specific actionable item]
✅ [Specific actionable item]

───

# 📌 STRATEGIC SUMMARY

[2-3 sentences: If a busy executive reads only this, what's the single most valuable insight and what should they do?]

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
3. **START WITH EXECUTIVE SUMMARY** - Write the 30-second summary FIRST
4. **QUANTITATIVE ANALYSIS with intelligent grouping** (Phase 3A)
   - Count patterns AND group them intelligently
   - Show percentages and distributions
   - Group UP (higher-level categories) and DOWN (meaningful subcategories)
   - Use TABLES for all quantitative data
5. **Extract qualitative insights** with evidence (Phase 3B)
6. **Create DERIVED INSIGHTS** - Connect dots, show cascading effects, make predictions
7. **Provide business implications** organized by function (Phase 4)
8. **End with strategic summary**

CRITICAL REQUIREMENTS:

VISUAL FORMATTING (MANDATORY):
✓ ALL quantitative data MUST be in tables with percentages
✓ Use icons: ⚡ 📊 💡 🔗 ✅ ⚠️
✓ Maximum 2 sentences per paragraph
✓ Bold all **numbers** and **key findings**
✓ Use • bullets for all lists
✓ Use ─── separators between major sections

QUANTITATIVE ANALYSIS (MANDATORY):
✓ Don't just count—GROUP INTELLIGENTLY
✓ Show percentages and distributions
✓ Find higher-level patterns (group up)
✓ Break into subcategories when revealing (group down)
✓ Example: Don't list "spring rolls: 5, fries: 8" → Instead group as "Fried: 65%, Steamed: 23%"

DERIVED INSIGHTS SECTION (MANDATORY):
✓ Must include "🔗 DERIVED INSIGHTS & IMPLICATIONS" section
✓ At least 2-3 insight chains
✓ Show Observable Pattern → Immediate Effect → Secondary Effect → Strategic Action
✓ Include business probability/confidence level
✓ Connect dots that aren't explicitly stated in data

EXECUTIVE SUMMARY (MANDATORY):
✓ Must start with "⚡ EXECUTIVE SUMMARY (30 seconds)"
✓ Include: Biggest Finding + Key Opportunity + Immediate Action
✓ Each must be ONE sentence only

CONTENT QUALITY:
✓ Be adaptive—only extract patterns that actually exist in THIS content
✓ Actually count occurrences—don't estimate
✓ Every insight must have evidence + business value
✓ Make every recommendation specific and actionable
✓ Skip sections only if genuinely no relevant data exists
`;

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
