const { analyzeWithGemini, analyzeWithModel } = require('./gemini');
const config = require('../config');

/**
 * Insights Service - Two-Phase Analysis
 *
 * Phase 1: Analyze each post individually (Gemini Flash for speed)
 * Phase 2: Synthesize across all posts into Content Radar-style output
 *
 * Comments are pre-filtered by the quality filter in reddit.js.
 * All quality comments are sent to AI - no additional slicing.
 *
 * @see docs/QUALITY_FILTER_LOGIC.md for quality filter documentation
 */

// ============================================================
// PERSONA DETECTION
// ============================================================

function detectPersona(role, goal) {
  const r = (role || '').toLowerCase();
  const isContentCreator = r.includes('content') || r.includes('creator');
  const isMarketer = r.includes('market') || r.includes('copywriter');
  return { isContentCreator, isMarketer };
}

// ============================================================
// PHASE 1: PER-POST ANALYSIS (uses Flash for speed)
// ============================================================

/**
 * Build prompt to analyze a batch of posts individually
 * Each post gets its own analysis block in the response
 */
function formatPerPostBatchPrompt(postsBatch, role, goal) {
  const { isContentCreator, isMarketer } = detectPersona(role, goal);

  let personaLens = '';
  if (isContentCreator) {
    personaLens = 'You are extracting data for a CONTENT CREATOR. Pay special attention to: what the audience wants, questions they ask, content gaps, funny/relatable moments, and language they use.';
  } else if (isMarketer) {
    personaLens = 'You are extracting data for a MARKETER. Pay special attention to: pain points, product mentions, purchase signals, competitive comparisons, and the exact language people use to describe problems.';
  }

  const postsContent = postsBatch.map((data, idx) => {
    const post = data.post;
    const comments = data.valuableComments || [];
    const isYT = data.source === 'youtube';
    const engLabel = isYT ? 'likes' : 'pts';
    const sourceLabel = isYT ? `YouTube: ${post.channelTitle}` : `r/${post.subreddit}`;

    const formattedComments = comments.map(c => {
      return `  [${c.score} ${engLabel}, @${c.author || 'anon'}] ${c.body.substring(0, 350)}`;
    }).join('\n');

    return `--- POST ${idx + 1} ---
"${post.title}"
${sourceLabel} | ${post.score} ${isYT ? 'likes' : 'upvotes'} | ${comments.length} quality comments
${post.selftext ? `Body: ${post.selftext.substring(0, 200)}${post.selftext.length > 200 ? '...' : ''}\n` : ''}COMMENTS:
${formattedComments}`;
  }).join('\n\n');

  return `Extract structured data from each post below. Read every comment carefully.
${personaLens ? '\n' + personaLens + '\n' : ''}
RESEARCH CONTEXT: "${goal || 'Extract insights'}"

${postsContent}

Return ONLY valid JSON (no markdown, no backticks):
{
  "posts": [
    {
      "postIndex": 0,
      "topicsTouched": ["2-5 specific topics discussed in this post's comments"],
      "notableQuotes": [
        {"text": "Exact quote that reveals something important (max 250 chars)", "author": "@username", "score": 0, "tag": "insight or funny or data or question or warning or tip"}
      ],
      "dataPoints": [
        {"fact": "Specific number, tool name, price, metric, or measurable claim someone shared", "author": "@username", "score": 0}
      ],
      "questions": [
        {"question": "Exact question from comments that shows what people want to know", "author": "@username", "score": 0}
      ],
      "funnyBits": [
        {"quote": "Actually funny, witty, or memorable comment - not just positive", "author": "@username", "score": 0}
      ],
      "sentiment": "positive or negative or mixed or neutral",
      "dominantEmotion": "frustration or excitement or curiosity or skepticism or humor or resignation or hope",
      "oneLiner": "One punchy sentence capturing what this discussion is really about - write it like a headline that hooks you in",
      "commentQuality": "high or medium or low - based on substance vs generic/spam ratio"
    }
  ]
}

EXTRACTION RULES:
1. notableQuotes: Pick 3-6 quotes that REVEAL something - pain, desire, expertise, controversy. Skip generic praise or "great post" comments.
2. dataPoints: Only include SPECIFIC facts - "$45/month", "switched from X to Y", "3 years experience", "took 6 months". Not opinions.
3. questions: Real questions people are asking. High score = high demand for answers.
4. funnyBits: Actually funny or clever comments. Dry humor, unexpected takes, relatable moments. If nothing is genuinely funny, return empty array.
5. oneLiner: Write this like a Content Radar headline - hook the reader. "A dev's rant about Copilot breaking prod got 2.3K upvotes — plot twist: the bug was theirs" style.
6. All quotes must be EXACT text from comments. Never paraphrase.
7. Analyze ALL ${postsBatch.length} posts. Return one object per post in the array.`;
}

/**
 * Run Phase 1: Analyze posts in batches using Flash model
 * Returns array of per-post analysis objects
 */
async function runPerPostAnalysis(postsData, role, goal) {
  const batchSize = 3; // Posts per batch for Phase 1
  const mapModel = config.mapReduce?.mapModel || 'gemini-2.5-flash';
  const batches = [];

  for (let i = 0; i < postsData.length; i += batchSize) {
    batches.push(postsData.slice(i, i + batchSize));
  }

  console.log(`[Phase 1] Analyzing ${postsData.length} posts in ${batches.length} batch(es) using ${mapModel}`);

  const allPostAnalyses = [];
  let globalPostIndex = 0;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const prompt = formatPerPostBatchPrompt(batch, role, goal);

    console.log(`[Phase 1] Batch ${batchIdx + 1}/${batches.length}: ${batch.length} posts, ${prompt.length} chars`);

    try {
      const result = await analyzeWithModel(prompt, mapModel);

      if (result.success) {
        const parsed = parseJsonResponse(result.analysis);
        if (parsed?.posts) {
          // Remap postIndex to global index
          parsed.posts.forEach((p, localIdx) => {
            p.postIndex = globalPostIndex + localIdx;
            p.postTitle = batch[localIdx]?.post?.title || 'Unknown';
            p.source = batch[localIdx]?.source || 'reddit';
            p.subreddit = batch[localIdx]?.post?.subreddit || '';
            allPostAnalyses.push(p);
          });
        }
      } else {
        console.log(`[Phase 1] Batch ${batchIdx + 1} failed: ${result.error}`);
      }
    } catch (err) {
      console.error(`[Phase 1] Batch ${batchIdx + 1} error:`, err.message);
    }

    globalPostIndex += batch.length;

    // Small delay between batches
    if (batchIdx < batches.length - 1) {
      await sleep(1500);
    }
  }

  console.log(`[Phase 1] Complete: ${allPostAnalyses.length}/${postsData.length} posts analyzed`);
  return allPostAnalyses;
}


// ============================================================
// PHASE 2: CROSS-POST SYNTHESIS (Content Radar style)
// ============================================================

/**
 * Build the synthesis prompt from per-post analyses
 * Produces Content Radar-style output
 */
function formatSynthesisPrompt(perPostAnalyses, postsData, role, goal) {
  const totalComments = postsData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0);
  const postCount = postsData.length;

  const { isContentCreator, isMarketer } = detectPersona(role, goal);

  // Source info
  const sources = {
    reddit: postsData.filter(p => p.source !== 'youtube'),
    youtube: postsData.filter(p => p.source === 'youtube')
  };
  const subreddits = [...new Set(sources.reddit.map(p => p.post?.subreddit).filter(Boolean))];
  const channels = [...new Set(sources.youtube.map(p => p.post?.channelTitle).filter(Boolean))];
  const isMixedSource = sources.reddit.length > 0 && sources.youtube.length > 0;

  let sourceDescription = '';
  if (isMixedSource) {
    sourceDescription = `Reddit (${subreddits.map(s => 'r/' + s).join(', ')}) + YouTube (${channels.join(', ')})`;
  } else if (sources.youtube.length > 0) {
    sourceDescription = `YouTube: ${channels.join(', ')}`;
  } else {
    sourceDescription = subreddits.map(s => 'r/' + s).join(', ');
  }

  // Format per-post analyses for the synthesis prompt
  const perPostSummary = perPostAnalyses.map(p => {
    const topics = (p.topicsTouched || []).join(', ');
    const quotes = (p.notableQuotes || []).map(q => `  [${q.tag}] "${q.text}" (@${q.author}, ${q.score} pts)`).join('\n');
    const dataPoints = (p.dataPoints || []).map(d => `  - ${d.fact} (@${d.author}, ${d.score} pts)`).join('\n');
    const questions = (p.questions || []).map(q => `  ? "${q.question}" (@${q.author}, ${q.score} pts)`).join('\n');
    const funny = (p.funnyBits || []).map(f => `  LOL: "${f.quote}" (@${f.author}, ${f.score} pts)`).join('\n');

    return `POST ${p.postIndex + 1}: "${p.postTitle}" [${p.source === 'youtube' ? 'YouTube' : 'r/' + p.subreddit}]
Vibe: ${p.oneLiner || 'N/A'}
Sentiment: ${p.sentiment || 'mixed'} | Emotion: ${p.dominantEmotion || 'mixed'} | Quality: ${p.commentQuality || 'medium'}
Topics: ${topics || 'N/A'}
${quotes ? 'Quotes:\n' + quotes : ''}
${dataPoints ? 'Data:\n' + dataPoints : ''}
${questions ? 'Questions:\n' + questions : ''}
${funny ? 'Funny:\n' + funny : ''}`;
  }).join('\n---\n');

  // Also include some raw high-scoring comments for the synthesis to reference
  const topRawComments = [];
  postsData.forEach((data, idx) => {
    const comments = (data.valuableComments || [])
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const isYT = data.source === 'youtube';
    comments.forEach(c => {
      topRawComments.push({
        text: c.body.substring(0, 250),
        author: c.author || 'anon',
        score: c.score,
        source: isYT ? `YouTube: ${data.post?.channelTitle}` : `r/${data.post?.subreddit}`,
        postIdx: idx
      });
    });
  });
  // Sort by score and take top 30
  topRawComments.sort((a, b) => b.score - a.score);
  const topCommentsFormatted = topRawComments.slice(0, 30).map(c =>
    `[${c.score} pts, @${c.author}, ${c.source}] ${c.text}`
  ).join('\n');

  // Persona-specific schema
  let personaContext = '';
  let personaJsonSchema = '';
  let personaRules = '';

  if (isContentCreator) {
    personaContext = `Think like a content creator's research assistant. What would make them say "I need to make a video about this"? Find the content gold.`;

    personaJsonSchema = `,

  "contentOpportunities": [
    {
      "idea": "Content idea in the audience's own words - NOT AI polished",
      "format": "TikTok or YouTube or Blog or Thread or Instagram or Podcast",
      "demandSignal": "X comments asked about this, Y upvotes on related questions",
      "audienceQuote": "Exact quote proving people want this",
      "urgency": "high or medium or low"
    }
  ],

  "audienceSegmentation": {
    "segments": [
      {
        "who": "Specific persona - not generic labels",
        "percentage": 0,
        "evidence": "Quote or pattern proving this segment exists",
        "whatTheyWant": "What this segment is looking for"
      }
    ]
  }`;

    personaRules = `
CONTENT CREATOR RULES:
- contentOpportunities: 3-5 ideas backed by DEMAND evidence. Use audience's exact words. "I wish someone would explain..." = content gold. Rank by urgency.
- audienceSegmentation: Find SPECIFIC personas from comment evidence. "Solo founders bootstrapping with no budget" not "business owners." Real percentages based on comment counts.`;

  } else if (isMarketer) {
    personaContext = `Think like a marketing strategist mining customer language. What phrases do people actually use? What makes them buy or leave?`;

    personaJsonSchema = `,

  "painPoints": [
    {
      "pain": "Specific pain in user's exact language",
      "severity": "high or medium or low",
      "frequency": 0,
      "topQuote": {"text": "Exact quote", "author": "@user", "score": 0},
      "marketingAngle": "How to use this in messaging"
    }
  ],

  "valueProp": {
    "primaryValue": "What users value MOST based on evidence",
    "userLanguage": ["Exact phrases users use - their words for what they want"],
    "competitorMentions": [{"name": "competitor", "sentiment": "positive or negative", "context": "why mentioned"}]
  },

  "audienceSegmentation": {
    "segments": [
      {
        "who": "Specific buyer persona",
        "percentage": 0,
        "evidence": "Quote or pattern",
        "buyingSignals": "Budget mentions, purchase intent, comparison shopping"
      }
    ]
  }`;

    personaRules = `
MARKETER RULES:
- painPoints: Deep frustrations, not surface complaints. "I spent 3 hours trying to..." is a pain point. Quantify how many people feel this way. Each pain = marketing angle.
- valueProp: What do people actually pay for or switch for? Use THEIR exact words. Look for: "I finally found...", "this solved...", "worth every penny because..."
- audienceSegmentation: Buyer personas with purchase signals. Budget mentions, tool comparisons, "looking for" statements.`;
  }

  const prompt = `You are synthesizing research findings from ${postCount} analyzed posts for a ${role || 'researcher'}.
${personaContext ? '\n' + personaContext + '\n' : ''}
RESEARCH GOAL: "${goal || 'Extract insights'}"
DATA SCOPE: ${postCount} posts, ${totalComments} quality comments from ${sourceDescription}

=== PER-POST ANALYSIS RESULTS ===
${perPostSummary}

=== TOP COMMENTS BY SCORE (for quote verification) ===
${topCommentsFormatted}

===

TONE RULES:
- Write like a sharp friend forwarding interesting threads, NOT a corporate newsletter
- Every sentence must contain useful information. Zero filler. If a sentence works without a phrase, cut the phrase.
- "46% of commenters mentioned X" beats "many users expressed interest in X"
- Be specific: names, numbers, prices, tools. Not "various solutions" but "Notion, Obsidian, and Logseq"

Return ONLY valid JSON (no markdown, no backticks):

{
  "whatBlewUp": [
    {
      "hook": "Story-style one-liner that makes you want to read more — write it like a magazine headline, not a summary",
      "detail": "One sentence with the specific data behind it",
      "source": "r/subreddit or YouTube: Channel"
    }
  ],

  "theVerdict": {
    "answer": "Bold, direct 2-3 sentence answer to their research goal. Lead with the conclusion, then the evidence. No hedging unless the data genuinely conflicts.",
    "confidence": "high or medium or low",
    "basis": "Based on X comments across Y posts. Z% of relevant comments support this.",
    "keyDataPoints": [
      "Specific data-backed finding that supports the verdict"
    ]
  },

  "rankedThemes": [
    {
      "rank": 1,
      "theme": "Theme name (2-5 words)",
      "mentions": 0,
      "postsFoundIn": 0,
      "sentiment": "positive or negative or mixed",
      "oneLiner": "One sharp sentence — what this theme actually means",
      "topQuote": {"text": "Best quote for this theme (max 200 chars)", "author": "@username", "score": 0},
      "nuance": "The caveat or condition most people miss"
    }
  ],

  "fromTheTrenches": [
    {
      "insight": "Real data point, number, tool, price, or practitioner advice someone shared — not opinions, FACTS",
      "author": "@username",
      "score": 0,
      "source": "r/subreddit or YouTube: Channel"
    }
  ],

  "whatTheyreAsking": [
    {
      "question": "Exact question from comments",
      "author": "@username",
      "score": 0,
      "demandSignal": "Why this question matters — how many people had this same question, or how much engagement it got"
    }
  ],

  "theDebate": {
    "topic": "What people genuinely disagree about — set to null if no real split exists",
    "sideA": {
      "position": "What this camp thinks (1 sentence)",
      "quotes": [{"text": "Exact quote", "author": "@username", "score": 0}]
    },
    "sideB": {
      "position": "What the other camp thinks (1 sentence)",
      "quotes": [{"text": "Exact quote", "author": "@username", "score": 0}]
    }
  },

  "worthQuoting": [
    {
      "quote": "Exact comment text (max 250 chars)",
      "author": "@username",
      "score": 0,
      "category": "insight or warning or tip or brutal-honesty",
      "context": "Why this quote matters (half sentence)"
    }
  ],

  "funnyAndMemorable": [
    {
      "quote": "The actual funny or memorable comment — must be genuinely entertaining, not just positive",
      "author": "@username",
      "score": 0,
      "context": "Brief context if needed"
    }
  ],

  "soWhat": {
    "signal": "The pattern you see across these ${postCount} discussions — be specific",
    "implications": [
      "What this means right now",
      "Where this leads — the non-obvious consequence",
      "For a ${role || 'researcher'}: what to do about it"
    ]
  },

  "confidence": {
    "level": "high or medium or low",
    "totalComments": ${totalComments},
    "postsAnalyzed": ${postCount},
    "relevantComments": 0,
    "dataQuality": "Honest assessment — how much of the data was substantive vs generic",
    "caveats": ["Important limitation or bias in the data"]
  }${personaJsonSchema}
}

SYNTHESIS RULES:
1. whatBlewUp: 3-5 story hooks. Each one should make the reader think "wait, what?" Write them like the Content Radar examples:
   BAD: "AI tools were discussed by many community members"
   GOOD: "A developer's CI/CD pipeline ran an LLM on every PR review — and caught a security bug their team missed for 6 months"
2. theVerdict: Answer the research goal DIRECTLY. "Yes, and here's why" or "No, but with caveats" — not "it depends on many factors." Use numbers.
3. rankedThemes: Stack rank by (mentions x posts appeared in). #1 is the strongest signal. Include nuance — conditions and caveats matter.
4. fromTheTrenches: 4-6 REAL data points from comments. Specific numbers, tools, prices, timeframes. Not opinions or feelings.
5. whatTheyreAsking: 3-5 questions ranked by demand signal (score + replies). These represent unmet needs.
6. theDebate: Only include if there's a GENUINE split. Null is better than a manufactured disagreement.
7. worthQuoting: 4-6 quotes that expose something — pain, expertise, surprising opinion. Not generic praise.
8. funnyAndMemorable: 2-4 actually funny comments. If nothing is genuinely funny, return empty array. Don't force humor.
9. soWhat: Connect the dots across posts. What pattern emerges? What's the implication most people would miss?
10. confidence: Be brutally honest. If 30% of comments were "nice post!" type filler, say so.
11. ALL quotes must be EXACT text from the source data. Never paraphrase or invent quotes.
12. FOCUS on the research goal. Every section should relate back to what they asked about.${personaRules}
LAST. Return ONLY the JSON object.`;

  return prompt;
}


// ============================================================
// SINGLE URL ANALYSIS (also updated to new style)
// ============================================================

/**
 * Format analysis prompt for a single post/video
 * Uses the same Content Radar-style output
 */
function formatAnalysisPrompt(extractedData, role = null, goal = null) {
  const post = extractedData.post;
  const comments = extractedData.valuableComments || [];
  const commentCount = comments.length;
  const source = extractedData.source || 'reddit';
  const transcript = extractedData.transcript || null;

  const { isContentCreator, isMarketer } = detectPersona(role, goal);

  const isYouTube = source === 'youtube';
  const sourceLabel = isYouTube
    ? `YouTube: ${post.channelTitle || 'unknown channel'}`
    : `r/${post.subreddit || 'unknown'}`;
  const engagementLabel = isYouTube ? 'likes' : 'pts';

  const formattedComments = comments.map(c => {
    return `[${c.score} ${engagementLabel}, @${c.author || 'anon'}] ${c.body.substring(0, 350)}`;
  }).join('\n');

  const statsContext = isYouTube
    ? `Views: ${post.viewCount?.toLocaleString() || 'N/A'} | Likes: ${post.score?.toLocaleString() || 'N/A'} | Comments: ${post.num_comments?.toLocaleString() || commentCount}`
    : `Upvotes: ${post.score?.toLocaleString() || 'N/A'} | Comments: ${post.num_comments?.toLocaleString() || commentCount}`;

  // YouTube content section
  const hasTranscript = isYouTube && transcript?.textForAnalysis;
  const hasDescription = isYouTube && post.selftext && post.selftext.length > 100;

  let videoContentSection = '';
  if (hasTranscript) {
    videoContentSection = `\nVIDEO TRANSCRIPT (${Math.round(transcript.durationSeconds / 60)} min):
${transcript.textForAnalysis}${transcript.fullText.length > 8000 ? '...[truncated]' : ''}`;
  } else if (hasDescription) {
    videoContentSection = `\nVIDEO DESCRIPTION:
${post.selftext.substring(0, 2000)}${post.selftext.length > 2000 ? '...[truncated]' : ''}`;
  }

  // Persona context
  let personaContext = '';
  let personaJsonSchema = '';
  let personaRules = '';

  if (isContentCreator) {
    personaContext = `Analyzing for a CONTENT CREATOR. Find what content can be made from this discussion. Use the audience's actual words.`;
    personaJsonSchema = `,

  "contentOpportunities": [
    {
      "idea": "Content idea in audience's own words",
      "format": "TikTok or YouTube or Blog or Thread or Instagram",
      "demandSignal": "Evidence people want this",
      "audienceQuote": "Exact quote proving demand",
      "urgency": "high or medium or low"
    }
  ],
  "audienceSegmentation": {
    "segments": [
      {
        "who": "Specific persona from comment evidence",
        "percentage": 0,
        "evidence": "Quote or pattern",
        "whatTheyWant": "What this segment is looking for"
      }
    ]
  },
  "commentClassification": {
    "substantive": 0, "motivational": 0, "promotional": 0, "conversational": 0,
    "summary": "Honest breakdown of comment quality"
  }`;
    personaRules = `
- contentOpportunities: Ideas backed by demand evidence from comments. Use their exact words.
- audienceSegmentation: Specific personas from comment evidence, not generic labels.
- commentClassification: Real percentages. If 40% is "great post!" type comments, say so.`;

  } else if (isMarketer) {
    personaContext = `Analyzing for a MARKETER. Find pain points, customer language, and marketing angles.`;
    personaJsonSchema = `,

  "painPoints": [
    {
      "pain": "Pain in user's exact language",
      "severity": "high or medium or low",
      "frequency": 0,
      "topQuote": {"text": "Exact quote", "author": "@user", "score": 0},
      "marketingAngle": "How to use in messaging"
    }
  ],
  "valueProp": {
    "primaryValue": "What users value MOST",
    "userLanguage": ["Exact phrases they use"],
    "competitorMentions": [{"name": "competitor", "sentiment": "positive or negative", "context": "why mentioned"}]
  },
  "audienceSegmentation": {
    "segments": [
      {
        "who": "Buyer persona from evidence",
        "percentage": 0,
        "evidence": "Quote or pattern",
        "buyingSignals": "Purchase intent signals"
      }
    ]
  }`;
    personaRules = `
- painPoints: Deep frustrations with quantified frequency. Each pain = marketing angle.
- valueProp: What people actually value, in their exact words.
- audienceSegmentation: Buyer personas with purchase signals from comments.`;
  }

  const prompt = `Analyze this ${isYouTube ? 'YouTube video' : 'Reddit post'} and its comments. Every sentence you write must contain useful information — zero filler.
${personaContext ? '\n' + personaContext + '\n' : ''}
USER CONTEXT:
- Role: ${role || 'Researcher'}
- Goal: "${goal || 'Extract actionable insights'}"

CONTENT:
- Source: ${sourceLabel}
- Title: "${post.title}"
- ${statsContext}
- Published: ${post.created_utc ? new Date(post.created_utc * 1000).toISOString().split('T')[0] : 'Unknown'}
${!isYouTube && post.selftext ? `\nPost body:\n${post.selftext.substring(0, 500)}${post.selftext.length > 500 ? '...' : ''}` : ''}
${videoContentSection}

COMMENTS (${commentCount} quality-filtered):
${formattedComments}

===

Return ONLY valid JSON (no markdown, no backticks):

{${hasTranscript ? `
  "videoSummary": {
    "contentType": "educational or entertainment or tutorial or review or podcast or news or other",
    "keyPoints": ["Key takeaway 1", "Key takeaway 2"],
    "summary": "2-3 sentence summary of the video content"
  },` : (hasDescription ? `
  "videoOverview": {
    "contentType": "educational or entertainment or tutorial or review or podcast or news or other",
    "summary": "Brief summary inferred from title and description"
  },` : '')}

  "theVerdict": {
    "answer": "Bold 2-3 sentence overview. Lead with the most important finding. Be specific — names, numbers, conclusions. Not 'the community has diverse opinions.'",
    "confidence": "high or medium or low",
    "basis": "Based on ${commentCount} comments, X% relevant to the goal"
  },

  "sentimentAnalysis": {
    "overall": "positive or negative or mixed or neutral",
    "breakdown": {"positive": 0, "negative": 0, "neutral": 0},
    "emotionalTone": "Frustrated or Curious or Enthusiastic or Skeptical or Hopeful",
    "drivers": {
      "positive": ["What's driving positive sentiment with evidence"],
      "negative": ["What's driving negative sentiment with evidence"]
    }
  },

  "rankedThemes": [
    {
      "rank": 1,
      "theme": "Theme name",
      "mentions": 0,
      "sentiment": "positive or negative or mixed",
      "oneLiner": "Sharp one-sentence summary",
      "topQuote": {"text": "Best quote for this theme", "author": "@user", "score": 0}
    }
  ],

  "fromTheTrenches": [
    {
      "insight": "Real data point, number, tool, or practitioner advice from comments",
      "author": "@username",
      "score": 0
    }
  ],

  "whatTheyreAsking": [
    {
      "question": "Exact question from comments",
      "author": "@username",
      "score": 0,
      "demandSignal": "Why this question matters"
    }
  ],

  "worthQuoting": [
    {
      "quote": "Exact comment text (max 250 chars)",
      "author": "@username",
      "score": 0,
      "category": "insight or warning or tip or brutal-honesty or funny",
      "context": "Why this quote matters"
    }
  ],

  "funnyAndMemorable": [
    {
      "quote": "Actually funny comment",
      "author": "@username",
      "score": 0,
      "context": "Brief context"
    }
  ],

  "confidence": {
    "level": "high or medium or low",
    "totalComments": ${commentCount},
    "relevantComments": 0,
    "dataQuality": "Honest assessment of comment substance vs filler"
  }${personaJsonSchema}
}

RULES:
1. theVerdict: Lead with the MOST IMPORTANT finding. "46% of commenters struggle with X, specifically Y and Z" beats "users have mixed feelings."
2. rankedThemes: 3-6 themes ranked by mention count. Each needs a quote as evidence.
3. fromTheTrenches: ONLY specific facts from comments — prices, tools, numbers, timeframes. Not opinions.
4. worthQuoting: 4-6 most REVEALING quotes. Pick ones that expose pain, expertise, or surprise.
5. funnyAndMemorable: If nothing is genuinely funny, return empty array. Don't manufacture humor.
6. All quotes = EXACT text from comments. Never paraphrase.
7. Quantify: "12 of ${commentCount} comments mention X" not "several users mentioned X"
8. FOCUS on the user's specific goal. Every section should relate back to "${goal || 'Extract actionable insights'}".${personaRules}
LAST. Return ONLY the JSON object.`;

  return prompt;
}


// ============================================================
// INSIGHT GENERATION
// ============================================================

/**
 * Generate AI insights from a single post/video
 */
async function generateAIInsights(contentData, role = null, goal = null) {
  console.log('Generating AI-powered insights with Gemini');
  console.log('Content data received:', {
    hasPost: !!contentData.post,
    commentsCount: contentData.valuableComments?.length || 0,
    source: contentData.source || 'reddit',
    role: role || 'not specified',
    goal: goal || 'not specified'
  });

  try {
    const prompt = formatAnalysisPrompt(contentData, role, goal);
    console.log('Prompt length:', prompt.length, 'characters');

    const aiResult = await analyzeWithGemini(prompt);

    if (!aiResult.success) {
      throw new Error(`Gemini API failed: ${aiResult.error || aiResult.message || 'Unknown error'}`);
    }

    const structuredAnalysis = parseJsonResponse(aiResult.analysis);

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
    throw new Error('AI analysis failed: ' + error.message);
  }
}

/**
 * Generate combined insights using two-phase analysis
 * Phase 1: Per-post analysis (Flash)
 * Phase 2: Cross-post synthesis (Pro)
 */
async function generateCombinedInsights(postsData, role = null, goal = null) {
  const totalComments = postsData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0);

  console.log('=== TWO-PHASE ANALYSIS ===');
  console.log(`Posts: ${postsData.length}, Comments: ${totalComments}`);
  console.log(`Role: ${role || 'not specified'}, Goal: ${goal || 'not specified'}`);

  try {
    // Phase 1: Per-post analysis
    console.log('\n--- Phase 1: Per-Post Analysis ---');
    let perPostAnalyses = [];

    try {
      perPostAnalyses = await runPerPostAnalysis(postsData, role, goal);
    } catch (phase1Error) {
      console.error('Phase 1 failed, proceeding with direct synthesis:', phase1Error.message);
    }

    // Phase 2: Cross-post synthesis
    console.log('\n--- Phase 2: Cross-Post Synthesis ---');

    let synthesisPrompt;
    if (perPostAnalyses.length > 0) {
      // Use per-post analyses for richer synthesis
      synthesisPrompt = formatSynthesisPrompt(perPostAnalyses, postsData, role, goal);
    } else {
      // Fallback: direct synthesis from raw data (if Phase 1 failed entirely)
      synthesisPrompt = formatDirectSynthesisPrompt(postsData, role, goal);
    }

    console.log('Synthesis prompt length:', synthesisPrompt.length, 'characters');

    const aiResult = await analyzeWithGemini(synthesisPrompt);

    if (!aiResult.success) {
      throw new Error(`Gemini API failed: ${aiResult.error || 'Unknown error'}`);
    }

    const structuredAnalysis = parseJsonResponse(aiResult.analysis);

    // Extract metadata
    const redditPosts = postsData.filter(p => p.source !== 'youtube');
    const youtubePosts = postsData.filter(p => p.source === 'youtube');
    const subreddits = [...new Set(redditPosts.map(p => p.post?.subreddit).filter(Boolean))];
    const channels = [...new Set(youtubePosts.map(p => p.post?.channelTitle).filter(Boolean))];

    console.log('=== ANALYSIS COMPLETE ===\n');

    return {
      mode: 'combined_analysis',
      model: aiResult.model,
      postCount: postsData.length,
      totalComments,
      subreddits,
      channels,
      sources: {
        reddit: redditPosts.length,
        youtube: youtubePosts.length
      },
      structured: structuredAnalysis,
      perPostAnalyses: perPostAnalyses.length > 0 ? perPostAnalyses : undefined,
      aiAnalysis: aiResult.analysis
    };

  } catch (error) {
    console.error('Combined insights generation error:', error.message);
    throw new Error('Combined AI analysis failed: ' + error.message);
  }
}

/**
 * Fallback: Direct synthesis when Phase 1 fails
 * Uses the same output schema but builds from raw comments
 */
function formatDirectSynthesisPrompt(postsData, role, goal) {
  const totalComments = postsData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0);
  const postCount = postsData.length;
  const { isContentCreator, isMarketer } = detectPersona(role, goal);

  const sources = {
    reddit: postsData.filter(p => p.source !== 'youtube'),
    youtube: postsData.filter(p => p.source === 'youtube')
  };
  const subreddits = [...new Set(sources.reddit.map(p => p.post?.subreddit).filter(Boolean))];
  const channels = [...new Set(sources.youtube.map(p => p.post?.channelTitle).filter(Boolean))];
  const isMixedSource = sources.reddit.length > 0 && sources.youtube.length > 0;

  let sourceDescription = isMixedSource
    ? `Reddit (${subreddits.map(s => 'r/' + s).join(', ')}) + YouTube (${channels.join(', ')})`
    : sources.youtube.length > 0
      ? `YouTube: ${channels.join(', ')}`
      : subreddits.map(s => 'r/' + s).join(', ');

  const postsContent = postsData.map((data, idx) => {
    const post = data.post;
    const comments = data.valuableComments || [];
    const isYT = data.source === 'youtube';
    const engLabel = isYT ? 'likes' : 'pts';

    return `
POST ${idx + 1}: "${post.title}"
${isYT ? `YouTube: ${post.channelTitle}` : `r/${post.subreddit}`} | ${post.score} ${isYT ? 'likes' : 'upvotes'} | ${comments.length} comments
${comments.map(c => `[${c.score} ${engLabel}, @${c.author || 'anon'}] ${c.body.substring(0, 300)}`).join('\n')}`;
  }).join('\n---\n');

  // Persona schemas
  let personaJsonSchema = '';
  let personaRules = '';

  if (isContentCreator) {
    personaJsonSchema = `,
  "contentOpportunities": [{"idea": "Content idea", "format": "format", "demandSignal": "evidence", "audienceQuote": "exact quote", "urgency": "high or medium or low"}],
  "audienceSegmentation": {"segments": [{"who": "persona", "percentage": 0, "evidence": "quote", "whatTheyWant": "need"}]}`;
    personaRules = '\n- contentOpportunities: Ideas backed by demand. Use audience exact words.\n- audienceSegmentation: Specific personas from evidence.';
  } else if (isMarketer) {
    personaJsonSchema = `,
  "painPoints": [{"pain": "pain in user language", "severity": "high or medium or low", "frequency": 0, "topQuote": {"text": "quote", "author": "@user", "score": 0}, "marketingAngle": "angle"}],
  "valueProp": {"primaryValue": "value", "userLanguage": ["phrases"], "competitorMentions": [{"name": "name", "sentiment": "sentiment", "context": "context"}]},
  "audienceSegmentation": {"segments": [{"who": "persona", "percentage": 0, "evidence": "quote", "buyingSignals": "signals"}]}`;
    personaRules = '\n- painPoints: Deep frustrations with frequency counts.\n- valueProp: What people value in their own words.';
  }

  return `Analyze ${postCount} posts (${totalComments} comments) for a ${role || 'researcher'}.
GOAL: "${goal || 'Extract insights'}"
DATA FROM: ${sourceDescription}

APPROACH: First understand each post's discussion individually, then find patterns across all posts.

${postsContent}

===

TONE: Write like a sharp analyst, not a summarizer. Every sentence must contain useful information. Quantify everything.

Return ONLY valid JSON matching this structure:
{
  "whatBlewUp": [{"hook": "story-style headline", "detail": "data behind it", "source": "r/sub or YouTube: Channel"}],
  "theVerdict": {"answer": "direct answer to goal", "confidence": "high or medium or low", "basis": "data basis", "keyDataPoints": ["data point"]},
  "rankedThemes": [{"rank": 1, "theme": "name", "mentions": 0, "postsFoundIn": 0, "sentiment": "sentiment", "oneLiner": "summary", "topQuote": {"text": "quote", "author": "@user", "score": 0}, "nuance": "caveat"}],
  "fromTheTrenches": [{"insight": "real data/number/tool", "author": "@user", "score": 0, "source": "r/sub"}],
  "whatTheyreAsking": [{"question": "exact question", "author": "@user", "score": 0, "demandSignal": "why it matters"}],
  "theDebate": {"topic": "disagreement topic or null", "sideA": {"position": "position", "quotes": [{"text": "quote", "author": "@user", "score": 0}]}, "sideB": {"position": "position", "quotes": [{"text": "quote", "author": "@user", "score": 0}]}},
  "worthQuoting": [{"quote": "exact text", "author": "@user", "score": 0, "category": "insight or warning or tip or brutal-honesty", "context": "why it matters"}],
  "funnyAndMemorable": [{"quote": "funny comment", "author": "@user", "score": 0, "context": "context"}],
  "soWhat": {"signal": "pattern across posts", "implications": ["now", "future", "for ${role || 'researcher'}"]},
  "confidence": {"level": "level", "totalComments": ${totalComments}, "postsAnalyzed": ${postCount}, "relevantComments": 0, "dataQuality": "assessment", "caveats": ["limitation"]}${personaJsonSchema}
}

ALL quotes must be EXACT text from comments. Focus on the research goal. Quantify everything.${personaRules}
Return ONLY the JSON object.`;
}


// ============================================================
// CONTENT GENERATION (unchanged)
// ============================================================

/**
 * Generate content (articles, threads, etc.) using insights + raw data
 */
async function generateContent(params) {
  const { type, typeLabel, focus, tone, length, role, goal, insights, postsData } = params;

  console.log('Generating content:', { type, typeLabel, tone, length, role });

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
 * Supports both old and new insight structures
 */
function buildContentPrompt(type, typeLabel, focus, tone, length, role, goal, insights, postsData) {
  // Support both old and new schema field names
  const executiveSummary = insights?.theVerdict?.answer || insights?.executiveSummary || '';
  const keyInsights = insights?.rankedThemes?.map(t => ({ title: t.theme, description: t.oneLiner }))
    || insights?.keyInsights || [];
  const forYourGoal = insights?.theVerdict?.keyDataPoints || insights?.forYourGoal || [];
  const topQuotes = insights?.worthQuoting?.map(q => ({ type: q.category?.toUpperCase() || 'INSIGHT', quote: q.quote, source: q.author }))
    || insights?.topQuotes || [];

  // Get real quotes from raw data
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

  const lengthGuide = {
    short: 'Keep it concise, around 300-500 words.',
    medium: 'Aim for 600-1000 words with good detail.',
    long: 'Create comprehensive content, 1200-1800 words with depth.'
  };

  const toneGuide = {
    professional: 'Use formal, authoritative language. Cite data points. Avoid colloquialisms.',
    conversational: 'Write naturally, as if talking to a friend. Use "you" and relatable examples.',
    casual: 'Keep it light and fun. Use informal language, humor where appropriate.'
  };

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


// ============================================================
// HELPERS
// ============================================================

/**
 * Parse JSON from AI response, handling markdown wrappers
 */
function parseJsonResponse(responseText) {
  try {
    let cleaned = responseText.trim();

    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned);
    console.log('Successfully parsed JSON response');
    return parsed;
  } catch (parseError) {
    console.log('Failed to parse JSON:', parseError.message);
    console.log('Raw response preview:', responseText.substring(0, 300));
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  formatAnalysisPrompt,
  generateAIInsights,
  formatCombinedAnalysisPrompt: formatSynthesisPrompt, // backward compat alias
  formatSynthesisPrompt,
  generateCombinedInsights,
  generateContent,
  runPerPostAnalysis
};
