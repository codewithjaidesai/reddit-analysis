const { analyzeWithGemini } = require('./gemini');

/**
 * Insights Service
 *
 * This service formats quality-filtered comments for AI analysis.
 * Comments are pre-filtered by the quality filter in reddit.js using
 * a dual-path approach (substance-based + engagement-based).
 *
 * All quality comments are sent to the AI - no additional slicing.
 *
 * @see docs/QUALITY_FILTER_LOGIC.md for quality filter documentation
 */

/**
 * Format extracted data for AI analysis (supports both Reddit and YouTube)
 * Returns structured JSON for rich UI display (similar to Analyze User)
 * @param {object} extractedData - Extracted post/video and comments
 * @param {string} role - User's role (e.g. Product Manager, Marketer, Founder)
 * @param {string} goal - User's goal (e.g. find pain points, validate idea)
 * @returns {string} Formatted prompt requesting JSON output
 */
function formatAnalysisPrompt(extractedData, role = null, goal = null) {
  const post = extractedData.post;
  const comments = extractedData.valuableComments || [];
  const commentCount = comments.length;
  const source = extractedData.source || 'reddit';
  const transcript = extractedData.transcript || null;

  // Source-specific labels
  const isYouTube = source === 'youtube';
  const sourceLabel = isYouTube
    ? `YouTube: ${post.channelTitle || 'unknown channel'}`
    : `r/${post.subreddit || 'unknown'}`;
  const contentType = isYouTube ? 'VIDEO' : 'POST';
  const engagementLabel = isYouTube ? 'likes' : 'pts';

  // Format comments with attribution
  const formattedComments = comments.map(c => {
    const author = c.author || 'anonymous';
    return `[${c.score} ${engagementLabel}, @${author}] ${c.body.substring(0, 350)}`;
  }).join('\n');

  // Video/post stats for context
  const statsContext = isYouTube
    ? `Views: ${post.viewCount?.toLocaleString() || 'N/A'} | Likes: ${post.score?.toLocaleString() || 'N/A'} | Comments: ${post.num_comments?.toLocaleString() || commentCount}`
    : `Upvotes: ${post.score?.toLocaleString() || 'N/A'} | Comments: ${post.num_comments?.toLocaleString() || commentCount}`;

  // Build transcript section for YouTube videos
  const hasTranscript = isYouTube && transcript?.textForAnalysis;
  const transcriptSection = hasTranscript
    ? `\nVIDEO TRANSCRIPT (${Math.round(transcript.durationSeconds / 60)} min):
${transcript.textForAnalysis}${transcript.fullText.length > 8000 ? '...[truncated]' : ''}`
    : '';

  const prompt = `You are an expert analyst performing a comprehensive analysis of a ${isYouTube ? 'YouTube video' : 'Reddit post'} and its comments.

USER CONTEXT:
- Role: ${role || 'Researcher'}
- Goal: "${goal || 'Extract actionable insights'}"

CONTENT TO ANALYZE:
- Source: ${source.toUpperCase()} - ${sourceLabel}
- ${contentType}: "${post.title}"
- ${statsContext}
- Published: ${post.created_utc ? new Date(post.created_utc * 1000).toISOString().split('T')[0] : 'Unknown'}
${post.selftext ? `\nDescription/Content:\n${post.selftext.substring(0, 500)}${post.selftext.length > 500 ? '...' : ''}` : ''}
${transcriptSection}

COMMENTS (${commentCount} high-quality comments):
${formattedComments}

===

ANALYSIS INSTRUCTIONS:
Perform a thorough, intelligent analysis. Return ONLY valid JSON (no markdown, no backticks).

{${hasTranscript ? `
  "videoSummary": {
    "contentType": "educational | entertainment | music | tutorial | review | podcast | news | other",
    "keyPoints": [
      "Key point 1 - the most important takeaway from the video",
      "Key point 2 - another significant point or concept covered",
      "Key point 3 - additional important information"
    ],
    "concepts": [
      {
        "term": "New concept or term introduced (e.g., 'Decency Quotient')",
        "definition": "Brief explanation of what this concept means as explained in the video"
      }
    ],
    "summary": "2-3 sentence summary of what the video covers and its main message"
  },
` : ''}
  "executiveSummary": "2-4 sentence overview answering the user's goal directly. What's the bottom line?",

  "goalAnalysis": {
    "hypothesis": "Infer the main hypothesis/question from their goal",
    "verdict": "Strongly Supported | Supported | Mixed Evidence | Weakly Supported | Not Supported | Insufficient Data",
    "confidenceLevel": "high | medium | low",
    "confidenceReason": "Why this confidence level based on data volume and consistency",
    "evidenceScore": 73,
    "breakdown": {
      "totalComments": ${commentCount},
      "relevantComments": 0,
      "supportingCount": 0,
      "supportingPercentage": 0,
      "counterCount": 0,
      "counterPercentage": 0
    }
  },

  "topicGroups": [
    {
      "topic": "Clear, descriptive topic name",
      "description": "What people are saying about this topic",
      "commentCount": 0,
      "sentiment": "positive | negative | mixed | neutral",
      "keyPoints": ["Main point 1", "Main point 2"],
      "quotes": [
        {
          "text": "Exact quote from comments (max 200 chars)",
          "score": 0,
          "author": "username"
        }
      ]
    }
  ],

  "sentimentAnalysis": {
    "overall": "positive | negative | mixed | neutral",
    "breakdown": {
      "positive": 35,
      "negative": 45,
      "neutral": 20
    },
    "emotionalTone": "Frustrated | Curious | Enthusiastic | Skeptical | Hopeful | Disappointed",
    "drivers": {
      "positive": ["What's driving positive sentiment"],
      "negative": ["What's driving negative sentiment"]
    }
  },

  "keyQuotes": [
    {
      "type": "INSIGHT | WARNING | TIP | COMPLAINT | PRAISE | QUESTION",
      "text": "Exact quote from comments (max 200 chars)",
      "score": 0,
      "author": "username",
      "context": "Why this quote matters (1 sentence)"
    }
  ],

  "actionableInsights": [
    {
      "title": "Short title (3-6 words)",
      "description": "1-2 sentence actionable insight",
      "relevanceToGoal": "How this helps achieve the user's goal",
      "priority": "high | medium | low"
    }
  ],

  "patterns": [
    {
      "pattern": "Pattern name",
      "description": "What this pattern means",
      "frequency": "How often it appears",
      "significance": "Why it matters"
    }
  ],

  "goDeeper": {
    "limitedData": ${commentCount < 15},
    "suggestions": [
      {
        "type": "search | subreddit | channel | video",
        "query": "Suggested search or resource",
        "reason": "Why this would help"
      }
    ]
  },

  "statistics": {
    "avgCommentScore": 0,
    "topComment": {
      "text": "Highest scored comment (max 200 chars)",
      "score": 0,
      "author": "username"
    },
    "discussionDepth": "surface | moderate | deep",
    "engagementQuality": "high | medium | low"
  }
}

ANALYSIS RULES:${hasTranscript ? `
0. videoSummary (ONLY for YouTube with transcript):
   - keyPoints: 3-6 selective bullet points covering the MOST important information (not extensive, just key takeaways)
   - concepts: If the video introduces NEW terms/concepts (like "Decency Quotient", "FIRE movement", etc.), explain them briefly. Skip if no new concepts.
   - contentType: Classify the video accurately (educational, music, tutorial, etc.)
   - For MUSIC videos: Instead of key points, describe the song's theme, mood, and message.
   - For TUTORIALS: Focus on the main steps or techniques taught.
   - For EDUCATIONAL: Extract the core learnings and any frameworks/concepts introduced.` : ''}
1. executiveSummary: DIRECTLY answer the user's goal in 2-4 sentences. Be specific and actionable.
2. goalAnalysis: Treat their goal as a hypothesis to validate. Calculate actual percentages from the data.
3. topicGroups: Identify 3-7 distinct topics discussed. Group related comments together.
4. keyQuotes: Pick 4-8 most impactful REAL quotes from the comments. Include author attribution.
5. actionableInsights: 3-5 insights that DIRECTLY help the ${role || 'user'} achieve their goal: "${goal || 'insights'}".
6. patterns: 2-4 recurring patterns you notice across comments.
7. All quotes must be EXACT text from comments provided, not paraphrased.
8. If data is limited (< 15 comments), acknowledge this and suggest follow-up research.
9. Return ONLY the JSON object, nothing else.`;

  return prompt;
}

/**
 * Generate AI insights from extracted Reddit/YouTube data
 * Returns structured JSON analysis (like Analyze User)
 * @param {object} contentData - Extracted post/video data
 * @param {string} role - User's role (e.g. Product Manager, Marketer)
 * @param {string} goal - User's goal (e.g. find pain points, validate idea)
 * @returns {Promise<object>} AI analysis result with structured data
 */
async function generateAIInsights(contentData, role = null, goal = null) {
  console.log('Generating AI-powered insights with Gemini');
  console.log('Content data received:', {
    hasPost: !!contentData.post,
    commentsCount: contentData.valuableComments?.length || 0,
    hasStats: !!contentData.extractionStats,
    source: contentData.source || 'reddit',
    role: role || 'not specified',
    goal: goal || 'not specified'
  });

  try {
    // Build analysis prompt with role/goal context
    console.log('Building structured analysis prompt...');
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

    // Parse JSON response (like Analyze User)
    let structuredAnalysis = null;
    try {
      let cleaned = aiResult.analysis.trim();

      // Remove markdown code block wrappers
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      // Try to extract JSON if there's extra text around it
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      structuredAnalysis = JSON.parse(cleaned);
      console.log('Successfully parsed structured JSON response');
    } catch (parseError) {
      console.log('Failed to parse JSON, will use markdown fallback:', parseError.message);
      console.log('Raw response preview:', aiResult.analysis.substring(0, 300));
      // Keep structuredAnalysis as null, frontend will use markdown fallback
    }

    // Return analysis with both structured and raw fallback
    console.log('Returning AI analysis successfully');
    return {
      mode: 'ai_analysis',
      model: aiResult.model,
      source: contentData.source || 'reddit',
      structured: structuredAnalysis,
      aiAnalysis: aiResult.analysis, // Raw fallback
      // Legacy fields for backward compatibility
      totalInsights: 1,
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
 * Format combined analysis prompt for multiple posts/videos - returns structured JSON
 * Supports mixed sources (Reddit + YouTube)
 * @param {array} postsData - Array of extracted data from multiple posts/videos
 * @param {string} role - User's role
 * @param {string} goal - User's goal
 * @returns {string} Formatted prompt
 */
function formatCombinedAnalysisPrompt(postsData, role = null, goal = null) {
  const totalComments = postsData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0);
  const postCount = postsData.length;

  // Detect sources present in the data
  const sources = {
    reddit: postsData.filter(p => p.source !== 'youtube'),
    youtube: postsData.filter(p => p.source === 'youtube')
  };
  const hasReddit = sources.reddit.length > 0;
  const hasYouTube = sources.youtube.length > 0;
  const isMixedSource = hasReddit && hasYouTube;

  // Build source attribution strings
  const subreddits = [...new Set(sources.reddit.map(p => p.post?.subreddit).filter(Boolean))];
  const channels = [...new Set(sources.youtube.map(p => p.post?.channelTitle).filter(Boolean))];

  let sourceDescription = '';
  if (isMixedSource) {
    sourceDescription = `Reddit (${subreddits.map(s => 'r/' + s).join(', ')}) and YouTube (${channels.join(', ')})`;
  } else if (hasYouTube) {
    sourceDescription = `YouTube channels: ${channels.join(', ')}`;
  } else {
    sourceDescription = subreddits.map(s => 'r/' + s).join(', ');
  }

  // Build posts/videos content with source attribution
  const postsContent = postsData.map((data, idx) => {
    const post = data.post;
    const comments = data.valuableComments || [];
    const isYouTube = data.source === 'youtube';

    if (isYouTube) {
      const viewStats = post.viewCount ? ` • ${(post.viewCount / 1000).toFixed(0)}K views` : '';
      return `
VIDEO ${idx + 1}: "${post.title}"
YouTube: ${post.channelTitle}${viewStats} • ${post.score} likes • ${comments.length} comments
${comments.map(c => `[YouTube: ${post.channelTitle}, ${c.score} likes] ${c.body.substring(0, 300)}`).join('\n')}`;
    } else {
      return `
POST ${idx + 1}: "${post.title}"
r/${post.subreddit} • ${post.score} upvotes • ${comments.length} comments
${comments.map(c => `[r/${post.subreddit}, ${c.score} pts] ${c.body.substring(0, 300)}`).join('\n')}`;
    }
  }).join('\n---\n');

  // Source type for prompt
  const contentTypeLabel = isMixedSource ? 'posts/videos' : (hasYouTube ? 'videos' : 'posts');
  const platformLabel = isMixedSource ? 'Reddit and YouTube comments' : (hasYouTube ? 'YouTube comments' : 'Reddit comments');

  const prompt = `You are analyzing ${platformLabel} for a ${role || 'researcher'}.
Their GOAL: "${goal || 'Extract insights'}"

DATA: ${postCount} ${contentTypeLabel}, ${totalComments} comments from: ${sourceDescription}

${postsContent}

===

Return ONLY valid JSON (no markdown, no backticks). Structure:

{
  "executiveSummary": "2-3 sentence summary tailored to their goal as a ${role || 'researcher'}. What should they know?",
  "topQuotes": [
    {
      "type": "INSIGHT or WARNING or TIP or COMPLAINT",
      "quote": "Exact quote from comments (max 200 chars)",
      "source": "r/SubredditName or YouTube: ChannelName"
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
  },
  "evidenceAnalysis": {
    "primaryClaim": "The main hypothesis or claim that emerges from this data (inferred from the user's goal)",
    "verdict": "Strongly Supported or Supported or Mixed Evidence or Weakly Supported or Not Supported",
    "evidenceScore": 73,
    "totalAnalyzed": 300,
    "relevantCount": 190,
    "notRelevantCount": 110,
    "supporting": {
      "count": 156,
      "percentage": 82,
      "keyPoints": ["Point 1 from data", "Point 2 from data"],
      "quotes": [
        {"text": "Exact quote supporting the claim (max 150 chars)", "score": 234, "source": "r/SubredditName or YouTube: ChannelName"}
      ]
    },
    "counter": {
      "count": 34,
      "percentage": 18,
      "keyPoints": ["Counter point 1", "Counter point 2"],
      "quotes": [
        {"text": "Exact quote contradicting the claim (max 150 chars)", "score": 45, "source": "r/SubredditName or YouTube: ChannelName"}
      ]
    },
    "nuances": ["Important nuance or caveat about this evidence"],
    "confidenceLevel": "high or medium or low",
    "confidenceReason": "Why this confidence level (data volume, consistency, etc.)"
  }
}

ANALYSIS APPROACH (think through these phases before producing output):
1. SCAN: Read through ALL comments to identify recurring themes and patterns
2. GROUP: Mentally cluster comments by topic/sentiment - note which themes appear across multiple posts
3. DEPTH: For each major theme, identify the nuances, conditions, and contradictions
4. OUTLIERS: Find the non-obvious insights that most people would miss
5. SYNTHESIZE: Connect the dots across themes to form your final analysis

RULES:
1. topQuotes: Pick 4-6 most impactful REAL quotes from the comments. Include source (r/SubredditName or YouTube: ChannelName).
2. keyInsights: 3-5 insights. Title should be catchy. Focus on what matters for their GOAL.
3. forYourGoal: 3-5 bullets that DIRECTLY answer what the ${role || 'user'} asked for: "${goal || 'insights'}"
4. quantitativeInsights: Analyze the data quantitatively:
   - topicsDiscussed: 4-7 distinct topics/themes with actual mention counts from the data
   - sentimentBreakdown: Estimate % breakdown based on comment tone
   - commonPhrases: 3-5 frequently mentioned terms/phrases with counts
   - dataPatterns: 2-4 patterns you notice in the data
   - engagementCorrelation: What content gets upvoted
5. evidenceAnalysis: Treat the user's goal as a hypothesis to validate:
   - primaryClaim: Infer the main claim/hypothesis from their goal (e.g., goal "find if users want dark mode" → claim "Users want dark mode")
   - totalAnalyzed: Total number of comments you analyzed
   - relevantCount: How many comments are relevant to this hypothesis (speak to it directly or indirectly)
   - notRelevantCount: How many comments are not relevant (about other topics)
   - supporting.count and counter.count must add up to relevantCount
   - evidenceScore: percentage of RELEVANT comments supporting the claim (supporting.count / relevantCount * 100)
   - Include 2-4 supporting quotes and 1-2 counter quotes with scores
   - verdict: Based on evidence score (>75% = Strongly Supported, 60-75% = Supported, 40-60% = Mixed Evidence, 25-40% = Weakly Supported, <25% = Not Supported)
   - confidenceLevel: high (50+ relevant comments), medium (20-50), low (<20)
6. Keep it concise. No fluff.
7. Return ONLY the JSON object, nothing else.`;

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

    // Extract sources for metadata
    const redditPosts = postsData.filter(p => p.source !== 'youtube');
    const youtubePosts = postsData.filter(p => p.source === 'youtube');
    const subreddits = [...new Set(redditPosts.map(p => p.post?.subreddit).filter(Boolean))];
    const channels = [...new Set(youtubePosts.map(p => p.post?.channelTitle).filter(Boolean))];

    return {
      mode: 'combined_analysis',
      model: aiResult.model,
      postCount: postsData.length,
      totalComments: postsData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0),
      subreddits: subreddits, // Reddit subreddits
      channels: channels, // YouTube channels
      sources: {
        reddit: redditPosts.length,
        youtube: youtubePosts.length
      },
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

  // Get real quotes from raw data (supports both Reddit and YouTube)
  const realQuotes = [];
  if (postsData && postsData.length > 0) {
    postsData.forEach(post => {
      const comments = post.valuableComments || [];
      const isYouTube = post.source === 'youtube';
      const sourceLabel = isYouTube
        ? `YouTube: ${post.post?.channelTitle || 'unknown'}`
        : `r/${post.post?.subreddit || 'unknown'}`;
      const engagementLabel = isYouTube ? 'likes' : 'upvotes';

      comments.forEach(c => {
        realQuotes.push({
          text: c.body.substring(0, 400),
          score: c.score,
          source: sourceLabel,
          engagementLabel: engagementLabel
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

REAL QUOTES FROM USERS (use these for authenticity):
${realQuotes.slice(0, 15).map(q => `[${q.score} ${q.engagementLabel}, ${q.source}]: "${q.text}"`).join('\n\n')}

${topQuotes.length > 0 ? `
HIGHLIGHTED QUOTES:
${topQuotes.map(q => `[${q.type}] "${q.quote}" - ${q.source || q.subreddit}`).join('\n')}
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
