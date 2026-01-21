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
${comments.map((c) => `[${c.score} pts] ${c.body.substring(0, 300)}`).join('\n---\n')}

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
${comments.map(c => `[r/${post.subreddit}, ${c.score} pts] ${c.body.substring(0, 300)}`).join('\n')}`;
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

/**
 * Generate content (articles, threads, etc.) using insights + raw data
 * @param {object} params - Generation parameters
 * @returns {Promise<object>} Generated content
 */
async function generateContent(params) {
  const { type, typeLabel, focus, tone, length, role, goal, insights, postsData } = params;

  console.log('Generating content:', { type, typeLabel, tone, length, role });

  // Build prompt based on content type
  const prompt = buildContentPrompt(type, typeLabel, focus, tone, length, role, goal, insights, postsData);

  try {
    const aiResult = await analyzeWithGemini(prompt);

    if (!aiResult.success) {
      throw new Error(`Gemini API failed: ${aiResult.error || 'Unknown error'}`);
    }

    return {
      success: true,
      content: aiResult.analysis,
      type: type,
      model: aiResult.model
    };

  } catch (error) {
    console.error('Content generation error:', error.message);
    throw new Error('Content generation failed: ' + error.message);
  }
}

/**
 * Build prompt for content generation based on type
 */
function buildContentPrompt(type, typeLabel, focus, tone, length, role, goal, insights, postsData) {
  // Extract key data
  const executiveSummary = insights?.executiveSummary || '';
  const keyInsights = insights?.keyInsights || [];
  const forYourGoal = insights?.forYourGoal || [];
  const topQuotes = insights?.topQuotes || [];

  // Get real quotes from raw data
  const realQuotes = [];
  if (postsData && postsData.length > 0) {
    postsData.forEach(post => {
      const comments = post.valuableComments || [];
      comments.forEach(c => {
        realQuotes.push({
          text: c.body.substring(0, 400),
          score: c.score,
          subreddit: post.post?.subreddit || 'unknown'
        });
      });
    });
  }

  // Length guidelines
  const lengthGuide = {
    short: 'Keep it concise, around 300-500 words.',
    medium: 'Aim for 600-1000 words with good detail.',
    long: 'Create comprehensive content, 1200-1800 words with depth.'
  };

  // Tone guidelines
  const toneGuide = {
    professional: 'Use formal, authoritative language. Cite data points. Avoid colloquialisms.',
    conversational: 'Write naturally, as if talking to a friend. Use "you" and relatable examples.',
    casual: 'Keep it light and fun. Use informal language, humor where appropriate.'
  };

  // Type-specific instructions
  const typeInstructions = {
    seo_article: `Write an SEO-optimized article with:
- A compelling headline (H1)
- Clear section headings (H2s)
- Real quotes from Reddit users woven naturally into the narrative
- A strong introduction hook
- Actionable takeaways
- Natural keyword integration based on the topic`,

    ad_copy: `Create 3-5 ad copy variations with:
- Attention-grabbing headlines
- Benefit-focused body copy
- Clear call-to-action
- Use language/phrases from the real quotes
Each variation should take a different angle.`,

    email_sequence: `Create a 3-email nurture sequence:
Email 1: Hook/Problem awareness
Email 2: Value/Education
Email 3: Solution/CTA
Include subject lines for each. Use real user language from the quotes.`,

    headlines: `Generate 10+ headline variations:
- Mix of curiosity, benefit, and urgency styles
- Based on real user language and pain points
- Suitable for blog posts, ads, and social media
Number each headline.`,

    twitter_thread: `Create a Twitter/X thread with 5-10 tweets:
- Start with a strong hook tweet
- Use real quotes (shortened if needed)
- Add thread numbers (1/, 2/, etc.)
- End with a CTA or summary tweet
Keep each tweet under 280 characters.`,

    linkedin_post: `Write a LinkedIn post with:
- Strong opening line (hook)
- Personal or professional angle
- Value-driven content
- Formatted with line breaks for readability
- CTA at the end`,

    youtube_outline: `Create a YouTube video outline:
- Attention-grabbing title options (3)
- Hook script (first 30 seconds)
- Main sections with talking points
- Key quotes to include
- CTA suggestions`,

    blog_draft: `Write a full blog post with:
- Engaging headline
- Introduction with hook
- Well-structured sections
- Real quotes integrated as evidence
- Conclusion with takeaways`,

    user_stories: `Generate user stories in the format:
"As a [type of user], I want [goal] so that [benefit]"
Base these on the pain points and needs discovered in the insights.
Create 5-10 distinct user stories.`,

    feature_brief: `Create a feature brief including:
- Feature name
- Problem statement (from user insights)
- Proposed solution
- Key requirements
- Success metrics
- Real user quotes as evidence`,

    pitch_points: `Create pitch deck talking points:
- Problem slide content (with real user quotes)
- Solution slide content
- Market opportunity points
- Key differentiators
Format as bullet points ready to use.`,

    problem_solution: `Create a problem-solution document:
- Problem definition (backed by user quotes)
- Impact/pain level analysis
- Proposed solution
- Validation points from the data
- Next steps`,

    user_persona: `Create a detailed user persona:
- Name and demographics
- Goals and motivations (from insights)
- Pain points (with real quotes)
- Behaviors and preferences
- How they describe their problems (user language)`,

    research_synthesis: `Create a research synthesis document:
- Executive summary
- Key themes discovered
- Supporting quotes for each theme
- Sentiment analysis
- Recommendations
- Areas for further research`
  };

  const prompt = `You are a ${role || 'content creator'} creating ${typeLabel}.

CONTEXT:
${executiveSummary ? `Summary: ${executiveSummary}` : ''}
${focus ? `Specific Focus: ${focus}` : ''}
Original Goal: ${goal || 'Create engaging content'}

KEY INSIGHTS:
${keyInsights.map(i => `- ${i.title}: ${i.description}`).join('\n')}

USER RECOMMENDATIONS:
${forYourGoal.map(g => `- ${g}`).join('\n')}

REAL QUOTES FROM REDDIT USERS (use these for authenticity):
${realQuotes.slice(0, 15).map(q => `[${q.score} upvotes, r/${q.subreddit}]: "${q.text}"`).join('\n\n')}

${topQuotes.length > 0 ? `
HIGHLIGHTED QUOTES:
${topQuotes.map(q => `[${q.type}] "${q.quote}" - r/${q.subreddit}`).join('\n')}
` : ''}

INSTRUCTIONS:
${typeInstructions[type] || `Create high-quality ${typeLabel} based on the insights and quotes above.`}

TONE: ${toneGuide[tone] || toneGuide.conversational}
LENGTH: ${lengthGuide[length] || lengthGuide.medium}

IMPORTANT:
- Weave real user quotes naturally into the content
- Use authentic language from the Reddit discussions
- Make it feel genuine and relatable, not generic
- Do NOT use placeholder text like [quote] - use actual quotes provided
- Output ONLY the final content, no explanations or meta-commentary`;

  return prompt;
}

module.exports = {
  formatAnalysisPrompt,
  generateAIInsights,
  formatCombinedAnalysisPrompt,
  generateCombinedInsights,
  generateContent
};
