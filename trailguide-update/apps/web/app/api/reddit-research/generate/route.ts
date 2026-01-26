import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Content generation endpoint - creates deliverables (articles, threads, etc.)
 * using AI insights + raw Reddit quotes for authenticity.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, typeLabel, focus, tone, length, role, goal, insights, postsData } = body;

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Content type is required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'AI not configured. Please add ANTHROPIC_API_KEY.' },
        { status: 500 }
      );
    }

    const prompt = buildContentPrompt(type, typeLabel, focus, tone, length, role, goal, insights, postsData);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';

    return NextResponse.json({
      success: true,
      content,
      type,
      model: 'claude-sonnet-4',
    });
  } catch (error: any) {
    console.error('Content generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Generation failed' },
      { status: 500 }
    );
  }
}

function buildContentPrompt(
  type: string,
  typeLabel: string,
  focus: string,
  tone: string,
  length: string,
  role: string,
  goal: string,
  insights: any,
  postsData: any[]
): string {
  const executiveSummary = insights?.executiveSummary || '';
  const keyInsights = insights?.keyInsights || [];
  const forYourGoal = insights?.forYourGoal || [];
  const topQuotes = insights?.topQuotes || [];

  // Extract real quotes from raw data
  const realQuotes: { text: string; score: number; subreddit: string }[] = [];
  if (postsData && postsData.length > 0) {
    postsData.forEach((post: any) => {
      const comments = post.valuableComments || [];
      comments.slice(0, 8).forEach((c: any) => {
        realQuotes.push({
          text: c.body.substring(0, 400),
          score: c.score,
          subreddit: post.post?.subreddit || 'unknown',
        });
      });
    });
  }

  const lengthGuide: Record<string, string> = {
    short: 'Keep it concise, around 300-500 words.',
    medium: 'Aim for 600-1000 words with good detail.',
    long: 'Create comprehensive content, 1200-1800 words with depth.',
  };

  const toneGuide: Record<string, string> = {
    professional: 'Use formal, authoritative language. Cite data points. Avoid colloquialisms.',
    conversational: 'Write naturally, as if talking to a friend. Use "you" and relatable examples.',
    casual: 'Keep it light and fun. Use informal language, humor where appropriate.',
  };

  const typeInstructions: Record<string, string> = {
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
- Areas for further research`,
  };

  return `You are a ${role || 'content creator'} creating ${typeLabel}.

CONTEXT:
${executiveSummary ? `Summary: ${executiveSummary}` : ''}
${focus ? `Specific Focus: ${focus}` : ''}
Original Goal: ${goal || 'Create engaging content'}

KEY INSIGHTS:
${keyInsights.map((i: any) => `- ${i.title}: ${i.description}`).join('\n')}

USER RECOMMENDATIONS:
${forYourGoal.map((g: string) => `- ${g}`).join('\n')}

REAL QUOTES FROM REDDIT USERS (use these for authenticity):
${realQuotes.slice(0, 15).map((q) => `[${q.score} upvotes, r/${q.subreddit}]: "${q.text}"`).join('\n\n')}

${topQuotes.length > 0 ? `
HIGHLIGHTED QUOTES:
${topQuotes.map((q: any) => `[${q.type}] "${q.quote}" - r/${q.subreddit}`).join('\n')}
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
}
