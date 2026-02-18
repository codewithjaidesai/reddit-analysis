const config = require('../config');
const { analyzeWithGemini, analyzeWithModel, callGeminiWithRetry } = require('./gemini');
const { extractRedditData } = require('./reddit');
const { extractYouTubeData } = require('./youtube');
const { detectSource, normalizeYouTubeExtraction } = require('./sourceDetector');

/**
 * Map-Reduce Analysis Service
 *
 * Analyzes large sets of Reddit posts by:
 * 1. Pre-screening posts for relevance (Gemini Flash)
 * 2. Chunking posts into groups of ~5
 * 3. Map: Analyzing each chunk in parallel (Gemini Flash)
 * 4. Reduce: Synthesizing all chunk results (Gemini Pro)
 *
 * This produces nuanced, deep analysis at scale rather than
 * the shallow analysis that results from stuffing 1000+ comments
 * into a single LLM call.
 */

// ============================================================
// PRE-SCREENING: Filter irrelevant posts using AI
// ============================================================

/**
 * AI pre-screen posts for relevance to the research topic
 * Uses Gemini Flash for speed/cost efficiency
 * @param {Array} posts - Array of post objects from Reddit search
 * @param {string} topic - Research topic/question
 * @param {string} role - User's role
 * @param {string} goal - User's goal
 * @returns {Promise<Array>} Filtered posts with relevance scores
 */
async function preScreenPosts(posts, topic, role = null, goal = null) {
  if (!posts || posts.length === 0) return [];

  console.log(`Pre-screening ${posts.length} posts for relevance to: "${topic}"`);

  const postList = posts.map((p, i) => {
    const isYouTube = p._source === 'youtube';
    const sourceTag = isYouTube
      ? `[YouTube: ${p._channelTitle || 'unknown'}]`
      : `[r/${p.subreddit}]`;
    const engagementLabel = isYouTube ? 'likes' : 'upvotes';
    return `${i + 1}. ${sourceTag} "${p.title}" (${p.score} ${engagementLabel}, ${p.num_comments} comments)${p.selftext ? '\n   ' + p.selftext.substring(0, 100) : ''}`;
  }).join('\n');

  const hasMixedSources = posts.some(p => p._source === 'youtube') && posts.some(p => p._source !== 'youtube');
  const sourceContext = hasMixedSources ? 'Reddit posts and YouTube videos' : (posts[0]?._source === 'youtube' ? 'YouTube videos' : 'Reddit posts');

  const prompt = `You are filtering ${sourceContext} for relevance to a research topic.

RESEARCH TOPIC: "${topic}"
RESEARCHER ROLE: ${role || 'Researcher'}
RESEARCH GOAL: ${goal || 'Extract insights'}

POSTS TO EVALUATE:
${postList}

For each post, score its relevance to the research topic from 1-5:
- 5: Directly about the topic, highly relevant discussion
- 4: Closely related, contains useful perspectives on the topic
- 3: Somewhat related, may contain tangential insights
- 2: Loosely related, mostly about something else
- 1: Not relevant at all

Return ONLY valid JSON (no markdown, no backticks). Structure:
{
  "scores": [
    {"index": 1, "score": 5, "reason": "Brief reason"},
    {"index": 2, "score": 2, "reason": "Brief reason"}
  ]
}

Score ALL ${posts.length} posts. Be strict - only score 4-5 for posts that genuinely discuss the research topic.`;

  try {
    const mapModel = config.mapReduce.mapModel;
    const result = await analyzeWithModel(prompt, mapModel);

    if (!result.success) {
      console.log('Pre-screening failed, returning all posts unfiltered');
      return posts.map(p => ({ ...p, relevanceScore: 3 }));
    }

    // Parse the response
    let scores;
    try {
      let cleaned = result.analysis.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];

      const parsed = JSON.parse(cleaned);
      scores = parsed.scores || [];
    } catch (parseError) {
      console.log('Failed to parse pre-screen response, returning all posts:', parseError.message);
      return posts.map(p => ({ ...p, relevanceScore: 3 }));
    }

    // Map scores back to posts
    const threshold = config.mapReduce.preScreenThreshold;
    const scoredPosts = posts.map((post, i) => {
      const scoreEntry = scores.find(s => s.index === i + 1);
      const relevanceScore = scoreEntry ? scoreEntry.score : 3;
      return { ...post, relevanceScore, relevanceReason: scoreEntry?.reason || '' };
    });

    const filteredPosts = scoredPosts
      .filter(p => p.relevanceScore >= threshold)
      .sort((a, b) => b.relevanceScore - a.relevanceScore || b.engagementScore - a.engagementScore);

    console.log(`Pre-screening: ${filteredPosts.length}/${posts.length} posts passed (threshold: ${threshold})`);

    // If too few posts pass, lower threshold
    if (filteredPosts.length < 5 && scoredPosts.length >= 5) {
      const relaxedPosts = scoredPosts
        .filter(p => p.relevanceScore >= 2)
        .sort((a, b) => b.relevanceScore - a.relevanceScore || b.engagementScore - a.engagementScore);
      console.log(`Relaxed threshold to 2: ${relaxedPosts.length} posts pass`);
      return relaxedPosts;
    }

    return filteredPosts;
  } catch (error) {
    console.error('Pre-screening error:', error.message);
    return posts.map(p => ({ ...p, relevanceScore: 3 }));
  }
}


// ============================================================
// BATCHED EXTRACTION: Rate-limit-safe comment extraction
// ============================================================

/**
 * Extract comments from multiple URLs in rate-limit-safe batches
 * Supports both Reddit and YouTube URLs (auto-detects source)
 * @param {Array} urls - Array of Reddit or YouTube post URLs
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<object>} { postsData: [], failures: [] }
 */
async function batchExtractPosts(urls, progressCallback = null) {
  const batchSize = config.mapReduce.extractionBatchSize;
  const batchDelay = config.mapReduce.extractionBatchDelay;
  const commentCap = config.mapReduce.commentCapPerPost;

  const postsData = [];
  const failures = [];
  let completed = 0;

  // Split URLs into batches
  const batches = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }

  console.log(`Extracting ${urls.length} posts in ${batches.length} batch(es) of up to ${batchSize}`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    // Extract all posts in this batch concurrently (auto-detect Reddit vs YouTube)
    const results = await Promise.all(
      batch.map(url => {
        const source = detectSource(url);
        if (source.source === 'youtube' && source.isSupported) {
          return extractYouTubeData(url).then(result => {
            if (result.success && result.data) {
              result.data = normalizeYouTubeExtraction(result.data);
            }
            return result;
          });
        }
        return extractRedditData(url);
      })
    );

    results.forEach((result, idx) => {
      const url = batch[idx];
      if (result.success) {
        const data = result.data;
        // Apply comment cap for map-reduce (keep top N by score)
        if (data.valuableComments && data.valuableComments.length > commentCap) {
          data.valuableComments = data.valuableComments
            .sort((a, b) => b.score - a.score)
            .slice(0, commentCap);
          data.extractionStats.extracted = data.valuableComments.length;
        }
        postsData.push(data);
      } else {
        failures.push({ url, error: result.error || 'Extraction failed' });
      }
      completed++;
    });

    if (progressCallback) {
      progressCallback(completed, urls.length);
    }

    // Delay between batches to respect rate limits
    if (batchIdx < batches.length - 1) {
      console.log(`Batch ${batchIdx + 1}/${batches.length} complete. Waiting ${batchDelay}ms before next batch...`);
      await sleep(batchDelay);
    }
  }

  console.log(`Extraction complete: ${postsData.length} succeeded, ${failures.length} failed`);
  return { postsData, failures };
}


// ============================================================
// MAP STEP: Deep analysis of each chunk
// ============================================================

/**
 * Build the map prompt for a single chunk
 */
function buildMapPrompt(chunkData, role, goal, chunkIndex, totalChunks) {
  const totalComments = chunkData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0);
  const subreddits = [...new Set(chunkData.map(p => p.post?.subreddit).filter(Boolean))];

  const postsContent = chunkData.map((data, idx) => {
    const post = data.post;
    const comments = data.valuableComments || [];
    return `
POST: "${post.title}"
r/${post.subreddit} | ${post.score} upvotes | ${comments.length} quality comments
${comments.map(c => `[${c.score} pts] ${c.body.substring(0, 300)}`).join('\n')}`;
  }).join('\n---\n');

  return `You are analyzing Reddit data (chunk ${chunkIndex + 1} of ${totalChunks}) for a ${role || 'researcher'}.
Their GOAL: "${goal || 'Extract insights'}"

DATA: ${chunkData.length} posts, ${totalComments} comments from: ${subreddits.map(s => 'r/' + s).join(', ')}

${postsContent}

===

Extract structured findings from THIS chunk. Return ONLY valid JSON (no markdown, no backticks):

{
  "themes": [
    {
      "name": "Theme name (3-5 words)",
      "frequency": 12,
      "sentiment": "positive or negative or mixed or neutral",
      "nuance": "Key nuance or conditional about this theme (1 sentence)",
      "quotes": ["Exact quote 1 (max 150 chars)", "Exact quote 2"]
    }
  ],
  "goalFindings": [
    "Finding directly relevant to the user's goal"
  ],
  "contradictions": [
    {
      "point": "What the contradiction is about",
      "sideA": "One perspective with supporting evidence",
      "sideB": "Opposing perspective with supporting evidence"
    }
  ],
  "outlierInsights": [
    {
      "insight": "Unusual or non-obvious finding",
      "quote": "Supporting quote",
      "subreddit": "SubredditName"
    }
  ],
  "sentimentSignals": {
    "positive": 40,
    "negative": 35,
    "neutral": 25,
    "dominantEmotion": "frustration or excitement or curiosity etc"
  },
  "topQuotes": [
    {
      "text": "Most impactful quote (max 200 chars)",
      "score": 234,
      "subreddit": "SubredditName",
      "type": "INSIGHT or WARNING or TIP or COMPLAINT"
    }
  ],
  "commonPhrases": [
    {"phrase": "Repeated phrase", "count": 5}
  ],
  "commentsAnalyzed": ${totalComments}
}

RULES:
1. themes: Find 3-7 distinct themes. Include nuance - don't just summarize, find the conditions and caveats.
2. goalFindings: 2-4 findings DIRECTLY answering the researcher's goal.
3. contradictions: Capture where users disagree. This is valuable signal.
4. outlierInsights: 1-3 non-obvious findings that most people would miss.
5. topQuotes: 3-5 most impactful EXACT quotes from the comments.
6. Be thorough with THIS chunk - extract everything relevant. The synthesis step will combine chunks later.
7. Return ONLY the JSON object, nothing else.`;
}

/**
 * Analyze a single chunk using the map model (Gemini Flash)
 */
async function mapAnalyzeChunk(chunkData, role, goal, chunkIndex, totalChunks) {
  const mapModel = config.mapReduce.mapModel;
  const prompt = buildMapPrompt(chunkData, role, goal, chunkIndex, totalChunks);

  console.log(`MAP chunk ${chunkIndex + 1}/${totalChunks}: ${chunkData.length} posts, prompt ${prompt.length} chars`);

  // Use callGeminiWithRetry directly — do NOT cascade through all fallback models.
  // Each failed chunk cascading through 4+ models (12 API calls) is what exhausts the quota.
  const result = await callGeminiWithRetry(mapModel, prompt, 2);

  if (!result.success) {
    console.error(`MAP chunk ${chunkIndex + 1} failed (${result.code || 'unknown'}): ${result.error}`);
    return null;
  }

  // Parse JSON response
  try {
    let cleaned = result.analysis.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    const parsed = JSON.parse(cleaned);
    parsed._chunkIndex = chunkIndex;
    parsed._model = result.model;
    console.log(`MAP chunk ${chunkIndex + 1} parsed successfully: ${parsed.themes?.length || 0} themes found`);
    return parsed;
  } catch (parseError) {
    console.error(`MAP chunk ${chunkIndex + 1} parse error:`, parseError.message);
    // Return raw analysis as fallback
    return {
      _chunkIndex: chunkIndex,
      _model: result.model,
      _raw: result.analysis,
      themes: [],
      goalFindings: [],
      contradictions: [],
      outlierInsights: [],
      topQuotes: []
    };
  }
}


// ============================================================
// REDUCE STEP: Synthesize all chunk results
// ============================================================

/**
 * Build the reduce prompt that synthesizes all chunk outputs
 */
function buildReducePrompt(chunkResults, role, goal, metadata) {
  const validChunks = chunkResults.filter(c => c !== null);

  // Aggregate data from all chunks (capped to prevent oversized prompts)
  const allThemes = validChunks.flatMap(c => c.themes || []).slice(0, 30);
  const allGoalFindings = validChunks.flatMap(c => c.goalFindings || []).slice(0, 15);
  const allContradictions = validChunks.flatMap(c => c.contradictions || []).slice(0, 10);
  const allOutliers = validChunks.flatMap(c => c.outlierInsights || []).slice(0, 10);
  const allQuotes = validChunks.flatMap(c => c.topQuotes || []).slice(0, 20);
  const allPhrases = validChunks.flatMap(c => c.commonPhrases || []).slice(0, 15);
  const totalComments = validChunks.reduce((sum, c) => sum + (c.commentsAnalyzed || 0), 0);

  // Aggregate sentiment
  const sentimentAgg = { positive: 0, negative: 0, neutral: 0 };
  const emotions = [];
  validChunks.forEach(c => {
    if (c.sentimentSignals) {
      sentimentAgg.positive += c.sentimentSignals.positive || 0;
      sentimentAgg.negative += c.sentimentSignals.negative || 0;
      sentimentAgg.neutral += c.sentimentSignals.neutral || 0;
      if (c.sentimentSignals.dominantEmotion) emotions.push(c.sentimentSignals.dominantEmotion);
    }
  });
  const sentTotal = sentimentAgg.positive + sentimentAgg.negative + sentimentAgg.neutral;
  if (sentTotal > 0) {
    sentimentAgg.positive = Math.round((sentimentAgg.positive / sentTotal) * 100);
    sentimentAgg.negative = Math.round((sentimentAgg.negative / sentTotal) * 100);
    sentimentAgg.neutral = 100 - sentimentAgg.positive - sentimentAgg.negative;
  }

  return `You are synthesizing research findings from ${validChunks.length} analysis chunks for a ${role || 'researcher'}.
Their GOAL: "${goal || 'Extract insights'}"

METADATA:
- Total posts analyzed: ${metadata.totalPosts}
- Total comments analyzed: ~${totalComments}
- Subreddits covered: ${metadata.subreddits.map(s => 'r/' + s).join(', ')}
- Analysis chunks: ${validChunks.length}

THEMES FOUND ACROSS ALL CHUNKS (${allThemes.length} total):
${allThemes.map(t => `- "${t.name}" (${t.frequency}x, ${t.sentiment}) — ${t.nuance || ''}${t.quotes ? '\n  Quotes: ' + t.quotes.slice(0, 2).map(q => `"${q}"`).join(', ') : ''}`).join('\n')}

GOAL-SPECIFIC FINDINGS (${allGoalFindings.length} total):
${allGoalFindings.map(f => `- ${f}`).join('\n')}

CONTRADICTIONS FOUND (${allContradictions.length} total):
${allContradictions.map(c => `- ${c.point}: "${c.sideA}" vs "${c.sideB}"`).join('\n')}

OUTLIER INSIGHTS (${allOutliers.length} total):
${allOutliers.map(o => `- ${o.insight} [r/${o.subreddit}]: "${o.quote}"`).join('\n')}

TOP QUOTES (${allQuotes.length} total):
${allQuotes.map(q => `- [${q.type}] "${q.text}" (${q.score} pts, r/${q.subreddit})`).join('\n')}

COMMON PHRASES: ${allPhrases.map(p => `"${p.phrase}" (${p.count}x)`).join(', ')}

SENTIMENT AGGREGATE: ${sentimentAgg.positive}% positive, ${sentimentAgg.negative}% negative, ${sentimentAgg.neutral}% neutral
DOMINANT EMOTIONS: ${emotions.join(', ') || 'mixed'}

===

Now SYNTHESIZE these findings into a final analysis. Look for:
1. Themes that appear across MULTIPLE chunks (strong signal)
2. Themes unique to one chunk (potential outlier insight)
3. Contradictions between chunks (important nuance)
4. The most impactful quotes across all data
5. Patterns in the aggregate data

Return ONLY valid JSON (no markdown, no backticks) in this EXACT structure:

{
  "executiveSummary": "2-3 sentence synthesis tailored to their goal as a ${role || 'researcher'}. Focus on the most significant cross-chunk findings.",
  "topQuotes": [
    {
      "type": "INSIGHT or WARNING or TIP or COMPLAINT",
      "quote": "Best quote from across all chunks (max 200 chars)",
      "subreddit": "SubredditName"
    }
  ],
  "keyInsights": [
    {
      "title": "Short title (3-5 words)",
      "description": "1-2 sentence insight. Mention how many chunks/data points support this.",
      "sentiment": "positive or negative or neutral"
    }
  ],
  "forYourGoal": [
    "Bullet point directly answering: ${goal || 'key findings'}"
  ],
  "confidence": {
    "level": "high or medium or low",
    "reason": "Based on ${metadata.totalPosts} posts, ~${totalComments} comments across ${metadata.subreddits.length} subreddits"
  },
  "quantitativeInsights": {
    "topicsDiscussed": [
      {
        "topic": "Merged theme name",
        "mentions": 15,
        "sentiment": "positive or negative or mixed",
        "example": "Brief example from quotes"
      }
    ],
    "sentimentBreakdown": {
      "positive": ${sentimentAgg.positive},
      "negative": ${sentimentAgg.negative},
      "neutral": ${sentimentAgg.neutral}
    },
    "commonPhrases": [
      {
        "phrase": "Merged phrase",
        "count": 12,
        "context": "How it's typically used"
      }
    ],
    "dataPatterns": [
      "Cross-chunk pattern 1",
      "Cross-chunk pattern 2"
    ],
    "engagementCorrelation": "What types of comments get more upvotes across the dataset"
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
      "keyPoints": ["Point from cross-chunk data"],
      "quotes": [
        {"text": "Supporting quote (max 150 chars)", "score": 100, "subreddit": "Name"}
      ]
    },
    "counter": {
      "count": 0,
      "percentage": 0,
      "keyPoints": ["Counter point from data"],
      "quotes": [
        {"text": "Counter quote (max 150 chars)", "score": 50, "subreddit": "Name"}
      ]
    },
    "nuances": ["Important caveat from contradictions data"],
    "confidenceLevel": "high or medium or low",
    "confidenceReason": "Based on data volume and cross-chunk consistency"
  }
}

RULES:
1. MERGE similar themes from different chunks - if "Price concerns" appeared in 4 chunks, it's one strong theme with combined frequency.
2. topQuotes: Pick the 4-6 BEST quotes across ALL chunks. Prefer diversity of perspectives.
3. keyInsights: 4-6 insights. Prioritize findings that appear across multiple chunks.
4. forYourGoal: 4-6 bullets that DIRECTLY answer what the ${role || 'user'} asked for.
5. quantitativeInsights.topicsDiscussed: Merge similar topics, combine mention counts. 5-8 topics.
6. evidenceAnalysis: Use the aggregated data to build a strong evidence case. Fill in actual counts.
7. Keep it concise but nuanced. Highlight where chunks agreed AND where they diverged.
8. Return ONLY the JSON object, nothing else.`;
}

/**
 * Run the reduce step using the primary model (Gemini Pro)
 */
async function reduceAnalysis(chunkResults, role, goal, metadata) {
  const reduceModel = config.mapReduce.reduceModel || config.gemini.model;
  const prompt = buildReducePrompt(chunkResults, role, goal, metadata);

  console.log(`REDUCE: Synthesizing ${chunkResults.filter(c => c).length} chunks, prompt ${prompt.length} chars`);

  const result = await analyzeWithModel(prompt, reduceModel);

  if (!result.success) {
    throw new Error(`Reduce step failed: ${result.error}`);
  }

  // Parse JSON response
  let structured = null;
  try {
    let cleaned = result.analysis.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    structured = JSON.parse(cleaned);
    console.log('REDUCE: Successfully parsed structured response');
  } catch (parseError) {
    console.log('REDUCE: Failed to parse JSON, returning raw:', parseError.message);
  }

  return {
    mode: 'map_reduce_analysis',
    model: result.model,
    structured,
    aiAnalysis: result.analysis,
    mapModel: config.mapReduce.mapModel,
    reduceModel: reduceModel,
    chunksProcessed: chunkResults.filter(c => c).length,
    totalPosts: metadata.totalPosts,
    totalComments: metadata.totalComments,
    subreddits: metadata.subreddits
  };
}


// ============================================================
// ORCHESTRATOR: Run the full map-reduce pipeline
// ============================================================

/**
 * Run the full map-reduce analysis pipeline
 * @param {Array} postsData - Array of extracted post data
 * @param {string} role - User's role
 * @param {string} goal - User's goal
 * @returns {Promise<object>} Analysis result (same format as generateCombinedInsights)
 */
async function runMapReduceAnalysis(postsData, role = null, goal = null) {
  const chunkSize = config.mapReduce.chunkSize;
  const totalComments = postsData.reduce((sum, p) => sum + (p.valuableComments?.length || 0), 0);
  const subreddits = [...new Set(postsData.map(p => p.post?.subreddit).filter(Boolean))];

  console.log(`\n=== MAP-REDUCE ANALYSIS ===`);
  console.log(`Posts: ${postsData.length}, Comments: ${totalComments}, Chunk size: ${chunkSize}`);
  console.log(`Map model: ${config.mapReduce.mapModel}`);
  console.log(`Reduce model: ${config.mapReduce.reduceModel || config.gemini.model}`);
  console.log(`===========================\n`);

  // If small enough for single call, use direct analysis
  if (postsData.length <= chunkSize) {
    console.log(`Only ${postsData.length} posts - using single-call analysis (no map-reduce needed)`);
    const { generateCombinedInsights } = require('./insights');
    return generateCombinedInsights(postsData, role, goal);
  }

  // Step 1: Chunk the posts
  const chunks = [];
  for (let i = 0; i < postsData.length; i += chunkSize) {
    chunks.push(postsData.slice(i, i + chunkSize));
  }
  console.log(`Split into ${chunks.length} chunks`);

  // Step 2: MAP — Use "canary" approach: test first chunk, if it fails fall back immediately
  const MAP_BATCH_DELAY = 3000; // ms between map calls
  console.log(`Starting MAP phase: ${chunks.length} chunks...`);

  // Try the first chunk as a canary — if API can't handle it, don't waste quota on 12 more
  console.log(`MAP canary: testing first chunk...`);
  const canaryResult = await mapAnalyzeChunk(chunks[0], role, goal, 0, chunks.length);

  if (canaryResult === null) {
    // First chunk failed — API can't handle map calls right now
    // Fall back to single-call analysis immediately instead of burning more quota
    console.log('MAP canary failed — API cannot handle chunked analysis.');
    console.log('Falling back to single-call analysis (pre-map-reduce approach)...');
    await sleep(3000); // Brief pause for API recovery
    const { generateCombinedInsights } = require('./insights');
    return generateCombinedInsights(postsData, role, goal);
  }

  console.log('MAP canary succeeded — continuing with remaining chunks...');
  const chunkResults = new Array(chunks.length).fill(null);
  chunkResults[0] = canaryResult;

  // Process remaining chunks sequentially
  for (let i = 1; i < chunks.length; i++) {
    await sleep(MAP_BATCH_DELAY);
    chunkResults[i] = await mapAnalyzeChunk(chunks[i], role, goal, i, chunks.length);
  }

  const successfulChunks = chunkResults.filter(c => c !== null);
  console.log(`MAP phase complete: ${successfulChunks.length}/${chunks.length} chunks succeeded`);

  // Delay between map and reduce to let API quota recover
  const REDUCE_DELAY = 3000;
  console.log(`Waiting ${REDUCE_DELAY}ms before REDUCE phase to let API recover...`);
  await sleep(REDUCE_DELAY);

  // Step 3: REDUCE - Synthesize all chunk results
  console.log(`Starting REDUCE phase...`);
  const metadata = {
    totalPosts: postsData.length,
    totalComments,
    subreddits
  };

  let result;
  try {
    result = await reduceAnalysis(chunkResults, role, goal, metadata);
  } catch (reduceError) {
    console.error('REDUCE failed, building fallback from map chunks:', reduceError.message);
    result = buildFallbackFromChunks(chunkResults, role, goal, metadata);
  }

  console.log(`\n=== MAP-REDUCE COMPLETE ===`);
  console.log(`Chunks: ${successfulChunks.length}, Result has structured: ${!!result.structured}`);
  console.log(`===========================\n`);

  return result;
}


// ============================================================
// FALLBACK: Build result from map chunks when reduce fails
// ============================================================

/**
 * Build a usable analysis result directly from map chunk outputs
 * when the reduce step fails. Not as polished as a real reduce,
 * but much better than showing an error.
 */
function buildFallbackFromChunks(chunkResults, role, goal, metadata) {
  const validChunks = chunkResults.filter(c => c !== null);

  // Merge themes - deduplicate by name similarity
  const themeMap = new Map();
  validChunks.forEach(c => {
    (c.themes || []).forEach(t => {
      const key = t.name.toLowerCase().replace(/[^a-z]/g, '');
      if (themeMap.has(key)) {
        const existing = themeMap.get(key);
        existing.frequency = (existing.frequency || 0) + (t.frequency || 0);
        if (t.quotes) existing.quotes = (existing.quotes || []).concat(t.quotes).slice(0, 3);
      } else {
        themeMap.set(key, { ...t });
      }
    });
  });
  const mergedThemes = [...themeMap.values()]
    .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
    .slice(0, 8);

  // Aggregate other data
  const allGoalFindings = validChunks.flatMap(c => c.goalFindings || []).slice(0, 6);
  const allQuotes = validChunks.flatMap(c => c.topQuotes || [])
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 6);
  const allContradictions = validChunks.flatMap(c => c.contradictions || []).slice(0, 4);
  const allOutliers = validChunks.flatMap(c => c.outlierInsights || []).slice(0, 4);
  const allPhrases = validChunks.flatMap(c => c.commonPhrases || []).slice(0, 10);

  // Aggregate sentiment
  const sentimentAgg = { positive: 0, negative: 0, neutral: 0 };
  validChunks.forEach(c => {
    if (c.sentimentSignals) {
      sentimentAgg.positive += c.sentimentSignals.positive || 0;
      sentimentAgg.negative += c.sentimentSignals.negative || 0;
      sentimentAgg.neutral += c.sentimentSignals.neutral || 0;
    }
  });
  const sentTotal = sentimentAgg.positive + sentimentAgg.negative + sentimentAgg.neutral;
  if (sentTotal > 0) {
    sentimentAgg.positive = Math.round((sentimentAgg.positive / sentTotal) * 100);
    sentimentAgg.negative = Math.round((sentimentAgg.negative / sentTotal) * 100);
    sentimentAgg.neutral = 100 - sentimentAgg.positive - sentimentAgg.negative;
  }

  const totalComments = validChunks.reduce((sum, c) => sum + (c.commentsAnalyzed || 0), 0);

  // Confidence is based on actual data volume, not chunk survival rate
  const confidenceLevel = metadata.totalPosts >= 15 && metadata.subreddits.length >= 5 ? 'high'
    : metadata.totalPosts >= 8 && metadata.subreddits.length >= 3 ? 'medium'
    : 'low';

  // Build structured response matching the reduce output format
  const structured = {
    executiveSummary: `Analysis of ${metadata.totalPosts} posts across ${metadata.subreddits.length} subreddits found ${mergedThemes.length} key themes. ${allGoalFindings.length > 0 ? allGoalFindings[0] : 'Multiple perspectives emerged from the discussion.'}`,
    topQuotes: allQuotes.map(q => ({
      type: q.type || 'INSIGHT',
      quote: q.text || q.quote || '',
      subreddit: q.subreddit || ''
    })),
    keyInsights: mergedThemes.slice(0, 6).map(t => ({
      title: t.name,
      description: t.nuance || `Mentioned ${t.frequency || 'multiple'} times across discussions.`,
      sentiment: t.sentiment || 'neutral'
    })),
    forYourGoal: allGoalFindings,
    confidence: {
      level: confidenceLevel,
      reason: `Based on ${metadata.totalPosts} posts, ~${totalComments} comments across ${metadata.subreddits.length} subreddits (synthesized from ${validChunks.length} analysis chunk${validChunks.length !== 1 ? 's' : ''})`
    },
    quantitativeInsights: {
      topicsDiscussed: mergedThemes.map(t => ({
        topic: t.name,
        mentions: t.frequency || 0,
        sentiment: t.sentiment || 'mixed',
        example: (t.quotes && t.quotes[0]) || ''
      })),
      sentimentBreakdown: sentimentAgg,
      commonPhrases: allPhrases.map(p => ({
        phrase: p.phrase,
        count: p.count || 0,
        context: ''
      })),
      dataPatterns: allOutliers.map(o => o.insight),
      engagementCorrelation: 'Data synthesized from map chunks'
    },
    evidenceAnalysis: {
      primaryClaim: goal || 'Research findings',
      verdict: 'Mixed Evidence',
      evidenceScore: 50,
      totalAnalyzed: totalComments,
      relevantCount: totalComments,
      notRelevantCount: 0,
      supporting: {
        count: 0,
        percentage: 0,
        keyPoints: allGoalFindings.slice(0, 3),
        quotes: allQuotes.filter(q => q.type === 'INSIGHT' || q.type === 'TIP').slice(0, 3).map(q => ({
          text: q.text || q.quote || '',
          score: q.score || 0,
          subreddit: q.subreddit || ''
        }))
      },
      counter: {
        count: 0,
        percentage: 0,
        keyPoints: allContradictions.map(c => c.point).slice(0, 2),
        quotes: allQuotes.filter(q => q.type === 'WARNING' || q.type === 'COMPLAINT').slice(0, 2).map(q => ({
          text: q.text || q.quote || '',
          score: q.score || 0,
          subreddit: q.subreddit || ''
        }))
      },
      nuances: allContradictions.map(c => `${c.point}: ${c.sideA} vs ${c.sideB}`).slice(0, 3),
      confidenceLevel: confidenceLevel,
      confidenceReason: `Based on ${metadata.totalPosts} posts across ${metadata.subreddits.length} subreddits`
    }
  };

  console.log('FALLBACK: Built result from map chunks');
  return {
    mode: 'map_reduce_analysis',
    model: 'fallback_from_chunks',
    structured,
    aiAnalysis: JSON.stringify(structured, null, 2),
    mapModel: config.mapReduce.mapModel,
    reduceModel: 'fallback',
    chunksProcessed: validChunks.length,
    totalPosts: metadata.totalPosts,
    totalComments: metadata.totalComments,
    subreddits: metadata.subreddits
  };
}


// ============================================================
// HELPERS
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


module.exports = {
  preScreenPosts,
  batchExtractPosts,
  runMapReduceAnalysis,
  mapAnalyzeChunk,
  reduceAnalysis
};
