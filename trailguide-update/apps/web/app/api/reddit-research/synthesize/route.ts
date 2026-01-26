import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface RedditComment {
  author: string;
  body: string;
  score: number;
  depth: number;
}

/**
 * AI-powered synthesis of Reddit discussions
 * Supports single post analysis, combined multi-post analysis with personas,
 * and multiple analysis types (comprehensive, product_research, sentiment, quick).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { post, comments, analysisType = 'comprehensive', postsData, role, goal } = body;

    // Combined analysis mode (multiple posts with persona)
    if (postsData && Array.isArray(postsData) && postsData.length > 0) {
      return handleCombinedAnalysis(postsData, role, goal);
    }

    // Single post analysis mode
    if (!post || !post.title) {
      return NextResponse.json(
        { success: false, error: 'Post data is required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'AI analysis not configured. Please add ANTHROPIC_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    const postContent = buildSinglePostContent(post, comments);
    const analysisPrompt = buildAnalysisPrompt(analysisType);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [{ role: 'user', content: `${postContent}\n\n${analysisPrompt}` }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = JSON.parse(responseText);
      }
    } catch {
      analysis = { rawAnalysis: responseText, parseError: 'Could not parse structured JSON' };
    }

    return NextResponse.json({
      success: true,
      analysisType,
      analysis,
      metadata: {
        model: 'claude-sonnet-4',
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
        postScore: post.score,
        commentCount: comments?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('Reddit synthesis error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Synthesis failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle combined analysis for multiple posts with persona support
 */
async function handleCombinedAnalysis(postsData: any[], role?: string, goal?: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'AI analysis not configured.' },
      { status: 500 }
    );
  }

  const totalComments = postsData.reduce((sum: number, p: any) => sum + (p.valuableComments?.length || 0), 0);
  const subreddits = [...new Set(postsData.map((p: any) => p.post?.subreddit).filter(Boolean))];

  const postsContent = postsData.map((data: any, idx: number) => {
    const post = data.post;
    const comments = data.valuableComments || [];
    return `
POST ${idx + 1}: "${post.title}"
r/${post.subreddit} • ${post.score} upvotes • ${comments.length} comments
${comments.slice(0, 12).map((c: any) => `[r/${post.subreddit}, ${c.score} pts] ${c.body.substring(0, 300)}`).join('\n')}`;
  }).join('\n---\n');

  const prompt = `You are analyzing Reddit comments for a ${role || 'researcher'}.
Their GOAL: "${goal || 'Extract insights'}"

DATA: ${postsData.length} posts, ${totalComments} comments from: ${subreddits.map((s: string) => 'r/' + s).join(', ')}

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
   - topicsDiscussed: 4-7 distinct topics/themes with actual mention counts
   - sentimentBreakdown: Estimate % breakdown based on comment tone
   - commonPhrases: 3-5 frequently mentioned terms/phrases with counts
   - dataPatterns: 2-4 patterns you notice in the data
   - engagementCorrelation: What content gets upvoted
5. Keep it concise. No fluff.
6. Return ONLY the JSON object, nothing else.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  let structuredAnalysis = null;
  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    structuredAnalysis = JSON.parse(cleaned);
  } catch {
    // Keep as null, frontend will handle fallback
  }

  return NextResponse.json({
    success: true,
    combinedAnalysis: {
      mode: 'combined_analysis',
      postCount: postsData.length,
      totalComments,
      subreddits,
      structured: structuredAnalysis,
      aiAnalysis: responseText,
    },
    posts: postsData.map((data: any) => ({ extractedData: data })),
  });
}

function buildSinglePostContent(post: any, comments: any[]) {
  return `
# Reddit Post Analysis

## Post Details
- **Subreddit**: r/${post.subreddit}
- **Title**: ${post.title}
- **Author**: u/${post.author}
- **Score**: ${post.score} upvotes
- **Comments**: ${post.num_comments}

## Post Content
${post.selftext || '(No text content)'}

## Top Comments (${comments?.length || 0} comments)
${comments && comments.length > 0
    ? comments.slice(0, 30).map((c: RedditComment, i: number) => `
### Comment ${i + 1} (Score: ${c.score})
**Author**: u/${c.author}
${c.body}
`).join('\n')
    : '(No comments available)'}
`;
}

function buildAnalysisPrompt(analysisType: string): string {
  switch (analysisType) {
    case 'comprehensive':
      return `Analyze this Reddit discussion comprehensively. Return JSON:
{
  "mainTopic": "string",
  "keyThemes": ["theme1", "theme2"],
  "sentiment": "positive|negative|neutral|mixed",
  "sentimentScore": 75,
  "topInsights": ["insight1", "insight2"],
  "painPoints": ["pain1", "pain2"],
  "solutions": ["solution1", "solution2"],
  "notableQuotes": [{"author": "username", "text": "quote", "score": 10}],
  "actionableTakeaways": ["takeaway1", "takeaway2"],
  "summary": "2-3 sentence summary"
}`;

    case 'product_research':
      return `Analyze from product research perspective. Return JSON:
{
  "userNeeds": ["need1"],
  "featureRequests": ["feature1"],
  "painPoints": ["pain1"],
  "competitiveMentions": [{"competitor": "name", "sentiment": "positive", "context": "what"}],
  "userPersonas": ["persona1"],
  "marketInsights": ["insight1"],
  "opportunityScore": 75,
  "summary": "summary"
}`;

    case 'sentiment':
      return `Analyze sentiment. Return JSON:
{
  "overallSentiment": "positive|negative|neutral|mixed",
  "sentimentScore": 65,
  "sentimentDistribution": {"positive": 40, "negative": 35, "neutral": 25},
  "emotionalTones": ["emotion1"],
  "controversyLevel": "low|medium|high",
  "controversyScore": 30,
  "sentimentDrivers": ["driver1"],
  "summary": "summary"
}`;

    default:
      return `Quick analysis. Return JSON:
{
  "summary": "string",
  "keyPoints": ["point1"],
  "sentiment": "positive|negative|neutral|mixed",
  "keyTakeaway": "string"
}`;
  }
}
