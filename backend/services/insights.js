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
 * Personas: Content Creator, Marketer, Custom/Other
 *
 * @see docs/QUALITY_FILTER_LOGIC.md for quality filter documentation
 */

/**
 * Detect persona type from role/goal strings
 */
function detectPersona(role, goal) {
  const r = (role || '').toLowerCase();
  const g = (goal || '').toLowerCase();

  const isContentCreator = r.includes('content') || r.includes('creator');
  const isMarketer = r.includes('market') || r.includes('copywriter');

  return { isContentCreator, isMarketer };
}

/**
 * Format extracted data for AI analysis (supports both Reddit and YouTube)
 * Returns structured JSON for rich UI display
 * @param {object} extractedData - Extracted post/video and comments
 * @param {string} role - User's role (e.g. Content Creator, Marketer)
 * @param {string} goal - User's goal
 * @returns {string} Formatted prompt requesting JSON output
 */
function formatAnalysisPrompt(extractedData, role = null, goal = null) {
  const post = extractedData.post;
  const comments = extractedData.valuableComments || [];
  const commentCount = comments.length;
  const source = extractedData.source || 'reddit';
  const transcript = extractedData.transcript || null;

  const { isContentCreator, isMarketer } = detectPersona(role, goal);

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
  const hasDescription = isYouTube && post.selftext && post.selftext.length > 100;
  const descriptionHasTimestamps = hasDescription && /\d{1,2}:\d{2}/.test(post.selftext);

  let videoContentSection = '';
  if (hasTranscript) {
    videoContentSection = `\nVIDEO TRANSCRIPT (${Math.round(transcript.durationSeconds / 60)} min):
${transcript.textForAnalysis}${transcript.fullText.length > 8000 ? '...[truncated]' : ''}`;
  } else if (hasDescription) {
    videoContentSection = `\nVIDEO DESCRIPTION${descriptionHasTimestamps ? ' (includes timestamps/topics)' : ''}:
${post.selftext.substring(0, 2000)}${post.selftext.length > 2000 ? '...[truncated]' : ''}`;
  }

  // Build persona-specific instructions
  let personaContext = '';
  let personaJsonSchema = '';
  let personaRules = '';

  if (isContentCreator) {
    personaContext = `You are analyzing this for a CONTENT CREATOR. Focus on what content can be made from these comments.
CRITICAL: Use the audience's actual language and words - do NOT polish or rewrite their expressions. Raw authentic voice matters.
The goal is to find viral content potential, audience desires, and content gaps.`;

    personaJsonSchema = `,

  "audienceSegmentation": {
    "demographicPatterns": [
      {
        "identifier": "e.g., Beginners, Mothers, Business Owners, Students, etc.",
        "description": "Who these people are based on comment patterns",
        "estimatedCount": 0,
        "percentage": 0,
        "evidence": ["Quote or pattern that identifies this group"],
        "characteristics": ["Key trait or behavior"]
      }
    ],
    "summary": "Overview of who is commenting - identify by any discoverable pattern (gender, role, experience level, interest, life stage, etc.)"
  },

  "viralContentIdeas": {
    "ideas": [
      {
        "idea": "Content idea in the audience's own words - NOT AI polished",
        "whyViral": "Why this has viral potential with quantitative evidence (X comments about this, Y upvotes)",
        "audienceQuotes": ["Exact quote showing demand for this"],
        "suggestedFormats": ["TikTok", "YouTube", "LinkedIn", "Instagram", "Blog", "X/Twitter"],
        "demandScore": 0
      }
    ],
    "summary": "Overview of what the audience wants to see - in their language"
  },

  "topOpenQuestions": {
    "questions": [
      {
        "question": "Exact question from comments",
        "author": "@username",
        "score": 0,
        "engagementSignal": "X replies, Y upvotes - showing demand",
        "contentOpportunity": "How a creator can use this"
      }
    ],
    "summary": "Questions the audience is asking that creators can engage with or create content around"
  },

  "commentClassification": {
    "breakdown": {
      "substantive": { "count": 0, "percentage": 0 },
      "motivational": { "count": 0, "percentage": 0 },
      "promotional": { "count": 0, "percentage": 0 },
      "conversational": { "count": 0, "percentage": 0 }
    },
    "topSubstantiveComments": [
      {
        "author": "@username",
        "snippet": "First 150 chars of the comment",
        "score": 0,
        "whyValuable": "Why this comment matters for content creation"
      }
    ],
    "summary": "What percentage of engagement is actually useful vs generic"
  }`;

    personaRules = `
CONTENT CREATOR RULES:
- audienceSegmentation: Discover ANY identifiable patterns from comments to segment the audience. Don't limit to experience levels - look for: gender patterns (Male/Female), life roles (Mothers/Fathers, Students/Professionals), experience (Beginner/Expert), interests, occupation types, etc. Can have MULTIPLE identifier dimensions. Use actual comment evidence. Calculate REAL counts and percentages.
- viralContentIdeas: Extract what people are ACTUALLY talking about and wanting. Use their EXACT words - do not AI-polish the language. Each idea must have quantitative proof (comment counts, upvotes, reply counts). Rate demand 1-10.
- topOpenQuestions: Find real questions people asked. Each is a content opportunity. Note engagement (replies, score) as demand signal.
- commentClassification: Classify EVERY comment. "substantive" = adds value. "motivational" = generic encouragement. "promotional" = self-promotion. "conversational" = general chat. Calculate REAL percentages.`;

  } else if (isMarketer) {
    personaContext = `You are analyzing this for a MARKETER. Focus on customer language, pain points, competitive intelligence, and marketing insights.
The goal is actionable marketing intelligence - what resonates, what frustrates, what they want.`;

    personaJsonSchema = `,

  "painPoints": {
    "points": [
      {
        "pain": "Specific pain point in the user's language",
        "severity": "high | medium | low",
        "frequency": 0,
        "quotes": [{"text": "Exact quote", "score": 0, "author": "@user"}],
        "marketingAngle": "How to leverage this in marketing"
      }
    ],
    "summary": "Overview of pain landscape"
  },

  "keyValueProposition": {
    "primaryValue": "What users value MOST based on comment evidence",
    "supportingValues": ["Other important value drivers"],
    "userLanguage": ["Exact phrases users use to describe what they want - their words, not AI words"],
    "differentiators": ["What makes certain solutions stand out in comments"],
    "quotes": [{"text": "Exact quote showing value priority", "score": 0, "author": "@user"}]
  },

  "audienceSegmentation": {
    "demographicPatterns": [
      {
        "identifier": "e.g., Budget-conscious buyers, Power users, First-time buyers, etc.",
        "description": "Who these people are",
        "estimatedCount": 0,
        "percentage": 0,
        "evidence": ["Quote or pattern"],
        "characteristics": ["Key trait"]
      }
    ],
    "summary": "Overview of who is in this market conversation"
  }`;

    personaRules = `
MARKETER RULES:
- painPoints: Identify specific pain points with severity and frequency. Each pain point is a marketing opportunity. Use exact quotes as evidence.
- keyValueProposition: Distill what matters most to users. Use THEIR exact language for the value prop - do not AI-polish it. Find differentiators mentioned in comments.
- audienceSegmentation: Identify buyer segments from comment patterns. Look for purchase intent signals, budget indicators, use cases, experience levels.`;

  }

  const prompt = `You are an expert analyst performing a comprehensive analysis of a ${isYouTube ? 'YouTube video' : 'Reddit post'} and its comments.
${personaContext ? '\n' + personaContext + '\n' : ''}
USER CONTEXT:
- Role: ${role || 'Researcher'}
- Goal: "${goal || 'Extract actionable insights'}"
IMPORTANT: The user's research goal/query should DRIVE the analysis. If the goal is specific (e.g., "budget hiking shoes"), focus the analysis tightly on that topic. Do not generate generic advice unrelated to the query.

CONTENT TO ANALYZE:
- Source: ${source.toUpperCase()} - ${sourceLabel}
- ${contentType}: "${post.title}"
- ${statsContext}
- Published: ${post.created_utc ? new Date(post.created_utc * 1000).toISOString().split('T')[0] : 'Unknown'}
${!isYouTube && post.selftext ? `\nDescription/Content:\n${post.selftext.substring(0, 500)}${post.selftext.length > 500 ? '...' : ''}` : ''}
${videoContentSection}

COMMENTS (${commentCount} high-quality comments):
${formattedComments}

===

ANALYSIS INSTRUCTIONS:
Perform a thorough, intelligent analysis. Return ONLY valid JSON (no markdown, no backticks).
Focus the analysis on the user's SPECIFIC goal. If they asked about "budget hiking shoes", the insights should be about budget hiking shoes - not generic hiking advice.

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
        "term": "New concept or term introduced",
        "definition": "Brief explanation"
      }
    ],
    "summary": "2-3 sentence summary of what the video covers and its main message"
  },
` : (hasDescription ? `
  "videoOverview": {
    "contentType": "educational | entertainment | music | tutorial | review | podcast | news | other",
    "topicsFromDescription": ["Topic mentioned in description"],
    "summary": "Brief summary inferred from title and description.",
    "note": "Based on description only - transcript unavailable"
  },
` : '')}
  "executiveSummary": "2-4 sentence overview answering the user's goal directly. Be specific - if they asked about shoes, talk about shoes. What's the bottom line?",

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

  "confidence": {
    "level": "high | medium | low",
    "reason": "Brief explanation based on data volume (${commentCount} comments) and consistency",
    "totalComments": ${commentCount},
    "relevantComments": 0
  }${personaJsonSchema}
}

ANALYSIS RULES:${hasTranscript ? `
0. videoSummary (ONLY for YouTube with transcript):
   - keyPoints: 3-6 key takeaways
   - concepts: New terms/concepts introduced. Skip if none.
   - contentType: Classify accurately.` : (hasDescription ? `
0. videoOverview (for YouTube WITHOUT transcript):
   - topicsFromDescription: 2-5 topics from description.
   - summary: Inferred from title + description.` : '')}
1. executiveSummary: DIRECTLY answer the user's goal in 2-4 sentences. Be specific to their query - if they asked about "budget hiking shoes", talk about budget hiking shoes, NOT generic hiking advice.
2. sentimentAnalysis: Calculate REAL percentages from comments. Identify what drives positive and negative sentiment.
3. confidence: Based on data volume and consistency. Be honest about limitations.
4. All quotes must be EXACT text from comments provided - never paraphrase.
5. If data is limited (< 15 comments), acknowledge this.
6. CRITICAL: Stay focused on the user's specific query. Do NOT generate generic filler content unrelated to their research topic.${personaRules}
LAST. Return ONLY the JSON object, nothing else.`;

  return prompt;
}

/**
 * Generate AI insights from extracted Reddit/YouTube data
 * Returns structured JSON analysis
 * @param {object} contentData - Extracted post/video data
 * @param {string} role - User's role (e.g. Content Creator, Marketer)
 * @param {string} goal - User's goal
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

    // Parse JSON response
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
    }

    // Return analysis with both structured and raw fallback
    console.log('Returning AI analysis successfully');
    return {
      mode: 'ai_analysis',
      model: aiResult.model,
      source: contentData.source || 'reddit',
      structured: structuredAnalysis,
      aiAnalysis: aiResult.analysis,
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

  const { isContentCreator, isMarketer } = detectPersona(role, goal);

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
    const isYT = data.source === 'youtube';

    if (isYT) {
      const viewStats = post.viewCount ? ` * ${(post.viewCount / 1000).toFixed(0)}K views` : '';
      return `
VIDEO ${idx + 1}: "${post.title}"
YouTube: ${post.channelTitle}${viewStats} * ${post.score} likes * ${comments.length} comments
${comments.map(c => `[YouTube: ${post.channelTitle}, ${c.score} likes] ${c.body.substring(0, 300)}`).join('\n')}`;
    } else {
      return `
POST ${idx + 1}: "${post.title}"
r/${post.subreddit} * ${post.score} upvotes * ${comments.length} comments
${comments.map(c => `[r/${post.subreddit}, ${c.score} pts] ${c.body.substring(0, 300)}`).join('\n')}`;
    }
  }).join('\n---\n');

  // Source type for prompt
  const contentTypeLabel = isMixedSource ? 'posts/videos' : (hasYouTube ? 'videos' : 'posts');
  const platformLabel = isMixedSource ? 'Reddit and YouTube comments' : (hasYouTube ? 'YouTube comments' : 'Reddit comments');

  // Build persona-specific context and schema
  let personaContext = '';
  let personaJsonSchema = '';
  let personaRules = '';

  if (isContentCreator) {
    personaContext = `You are analyzing this for a CONTENT CREATOR. Focus on what content can be made from these comments.
CRITICAL: Use the audience's actual language - do NOT AI-polish their words. Raw authentic voice matters.
Find viral content potential, audience desires, content gaps, and audience segments.`;

    personaJsonSchema = `,
  "contentGaps": {
    "summary": "Brief overview of content opportunities",
    "gaps": [
      {
        "topic": "Topic with a content gap",
        "currentCoverage": "How well covered (or not)",
        "opportunity": "What content could fill this gap",
        "platform": "reddit or youtube or both",
        "demandSignal": "Evidence of demand (comment counts, upvotes)",
        "priority": "high or medium or low"
      }
    ],
    "underservedQuestions": ["Question from comments lacking good answers"],
    "suggestedContentFormats": [
      {
        "format": "e.g., Tutorial video, TikTok, Blog post",
        "reason": "Why this format works"
      }
    ]
  },

  "audienceSegmentation": {
    "demographicPatterns": [
      {
        "identifier": "e.g., Beginners, Mothers, Business Owners, etc.",
        "description": "Who these people are",
        "estimatedCount": 0,
        "percentage": 0,
        "evidence": ["Quote or pattern identifying this group"],
        "characteristics": ["Key trait"]
      }
    ],
    "summary": "Overview of who is commenting - use any discoverable pattern"
  },

  "viralContentIdeas": {
    "ideas": [
      {
        "idea": "Content idea in audience's own words - NOT AI polished",
        "whyViral": "Why this has viral potential with quantitative evidence",
        "audienceQuotes": ["Exact quote showing demand"],
        "suggestedFormats": ["TikTok", "YouTube", "LinkedIn", "Instagram", "Blog", "X/Twitter"],
        "demandScore": 0
      }
    ],
    "summary": "What the audience wants - in their language"
  },

  "topOpenQuestions": {
    "questions": [
      {
        "question": "Exact question from comments",
        "author": "@username",
        "score": 0,
        "engagementSignal": "X replies, Y upvotes",
        "contentOpportunity": "How a creator can use this"
      }
    ],
    "summary": "Questions the audience wants answered"
  },

  "commentClassification": {
    "breakdown": {
      "substantive": { "count": 0, "percentage": 0 },
      "motivational": { "count": 0, "percentage": 0 },
      "promotional": { "count": 0, "percentage": 0 },
      "conversational": { "count": 0, "percentage": 0 }
    },
    "topSubstantiveComments": [
      {
        "author": "@username",
        "snippet": "First 150 chars",
        "score": 0,
        "whyValuable": "Why this matters"
      }
    ],
    "summary": "Engagement quality breakdown"
  },

  "spamAndPromotions": {
    "flaggedComments": [],
    "summary": "Overview of spam activity",
    "spamPercentage": 0
  }`;

    personaRules = `
CONTENT CREATOR RULES:
- contentGaps: 2-5 content opportunities. Focus on unanswered needs with high engagement.
- audienceSegmentation: Discover ANY identifiable patterns - gender, life roles, experience, interests, occupation, etc. Multiple dimensions OK. Use REAL counts.
- viralContentIdeas: Use audience's EXACT words. Each must have quantitative proof. Rate demand 1-10.
- topOpenQuestions: Real questions = content opportunities. Note engagement as demand signal.
- commentClassification: Classify EVERY comment. Calculate REAL percentages.
- spamAndPromotions: Only flag clear cases. Empty array if none.`;

  } else if (isMarketer) {
    personaContext = `You are analyzing this for a MARKETER. Focus on customer language, pain points, competitive intelligence, and marketing insights.
Find actionable marketing intelligence - what resonates, what frustrates, what they want.`;

    personaJsonSchema = `,
  "painPoints": {
    "points": [
      {
        "pain": "Pain point in user's language",
        "severity": "high | medium | low",
        "frequency": 0,
        "quotes": [{"text": "Exact quote", "score": 0, "author": "@user"}],
        "marketingAngle": "How to leverage in marketing"
      }
    ],
    "summary": "Pain landscape overview"
  },

  "keyValueProposition": {
    "primaryValue": "What users value MOST",
    "supportingValues": ["Other value drivers"],
    "userLanguage": ["Exact phrases users use - their words, not AI words"],
    "differentiators": ["What makes certain solutions stand out"],
    "quotes": [{"text": "Exact quote", "score": 0, "author": "@user"}]
  },

  "audienceSegmentation": {
    "demographicPatterns": [
      {
        "identifier": "e.g., Budget-conscious, Power users, etc.",
        "description": "Who these people are",
        "estimatedCount": 0,
        "percentage": 0,
        "evidence": ["Quote or pattern"],
        "characteristics": ["Key trait"]
      }
    ],
    "summary": "Who is in this market conversation"
  }`;

    personaRules = `
MARKETER RULES:
- painPoints: Identify pains with severity and frequency. Each pain = marketing opportunity. Use exact quotes.
- keyValueProposition: Distill what matters most. Use THEIR language for value prop - not AI-polished.
- audienceSegmentation: Identify buyer segments. Look for purchase intent, budget indicators, use cases, experience levels.`;

  }

  const prompt = `You are analyzing ${platformLabel} for a ${role || 'researcher'}.
${personaContext ? '\n' + personaContext + '\n' : ''}
Their GOAL: "${goal || 'Extract insights'}"
IMPORTANT: Focus the analysis tightly on the user's specific goal/query. Don't generate generic advice unrelated to their research topic.

DATA: ${postCount} ${contentTypeLabel}, ${totalComments} comments from: ${sourceDescription}

${postsContent}

===

Return ONLY valid JSON (no markdown, no backticks). Structure:

{
  "executiveSummary": "2-3 sentence summary tailored to their goal as a ${role || 'researcher'}. Be SPECIFIC to what they asked about.",
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
    "engagementCorrelation": "What types of comments get more upvotes"
  },
  "evidenceAnalysis": {
    "primaryClaim": "Main hypothesis inferred from the user's goal",
    "verdict": "Strongly Supported or Supported or Mixed Evidence or Weakly Supported or Not Supported",
    "evidenceScore": 73,
    "totalAnalyzed": ${totalComments},
    "relevantCount": 0,
    "notRelevantCount": 0,
    "supporting": {
      "count": 0,
      "percentage": 0,
      "keyPoints": ["Point from data"],
      "quotes": [{"text": "Exact quote (max 150 chars)", "score": 0, "source": "r/Sub or YouTube: Channel"}]
    },
    "counter": {
      "count": 0,
      "percentage": 0,
      "keyPoints": ["Counter point"],
      "quotes": [{"text": "Exact quote (max 150 chars)", "score": 0, "source": "r/Sub or YouTube: Channel"}]
    },
    "nuances": ["Important caveat"],
    "confidenceLevel": "high or medium or low",
    "confidenceReason": "Why this confidence level"
  }${isMixedSource ? `,
  "crossPlatformComparison": {
    "summaryDifference": "How Reddit and YouTube discussions differ",
    "redditPerspective": {
      "dominantThemes": ["Theme stronger on Reddit"],
      "tone": "Overall Reddit tone",
      "uniqueInsight": "Something found only on Reddit"
    },
    "youtubePerspective": {
      "dominantThemes": ["Theme stronger on YouTube"],
      "tone": "Overall YouTube tone",
      "uniqueInsight": "Something found only on YouTube"
    },
    "agreementAreas": ["Where both agree"],
    "disagreementAreas": ["Where they differ"]
  }` : ''}${personaJsonSchema}
}

ANALYSIS APPROACH:
1. SCAN: Read ALL comments, identify themes and patterns
2. GROUP: Cluster by topic/sentiment${isMixedSource ? '\n2b. COMPARE: Note Reddit vs YouTube differences' : ''}
3. DEPTH: Identify nuances and contradictions per theme
4. OUTLIERS: Find non-obvious insights
5. SYNTHESIZE: Connect dots across themes

RULES:
1. topQuotes: 4-6 most impactful REAL quotes with source attribution.
2. keyInsights: 3-5 insights focused on their GOAL. Stay on topic.
3. forYourGoal: 3-5 bullets DIRECTLY answering: "${goal || 'insights'}"
4. quantitativeInsights: Real counts and percentages from the data.
5. evidenceAnalysis: Validate goal as hypothesis. supporting + counter = relevantCount.${isMixedSource ? `
6. crossPlatformComparison: Compare Reddit vs YouTube perspectives genuinely.` : ''}${personaRules}
LAST. Keep it concise. No fluff. Return ONLY the JSON object.`;

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
      let cleanedResponse = aiResult.analysis.trim();

      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7);
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();

      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      structuredAnalysis = JSON.parse(cleanedResponse);
      console.log('Successfully parsed structured JSON response');
    } catch (parseError) {
      console.log('Failed to parse JSON, falling back to markdown:', parseError.message);
      console.log('Raw response preview:', aiResult.analysis.substring(0, 200));
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
      subreddits: subreddits,
      channels: channels,
      sources: {
        reddit: redditPosts.length,
        youtube: youtubePosts.length
      },
      structured: structuredAnalysis,
      aiAnalysis: aiResult.analysis
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
- Real quotes from users woven naturally into the narrative
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

    tiktok_script: `Create a TikTok/Reels script with:
- Hook (first 3 seconds - grab attention)
- Main content (15-60 seconds)
- Call to action
- Suggested on-screen text/captions
- Hashtag suggestions
Keep it punchy and visual.`,

    instagram_post: `Create an Instagram post with:
- Caption with hook line
- Main content with value
- Call to action
- 15-20 relevant hashtags
- Carousel slide suggestions (if applicable)`,

    facebook_post: `Create a Facebook post with:
- Engaging opening line
- Story-driven content
- Call to action
- Formatted for readability
- Suggested image/visual description`,

    video_script: `Create a full video script with:
- Cold open / hook (first 15 seconds)
- Introduction and context
- Main content sections with talking points
- B-roll suggestions
- Conclusion and CTA
- Estimated duration notes`,

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
- Areas for further research`,

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
- Real user quotes as evidence`
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
- Use authentic language from the discussions
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
