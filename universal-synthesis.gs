// ========== UNIVERSAL HUMAN-LIKE ANALYSIS SYSTEM ==========
// This system reads comments like a human analyst would - no predetermined patterns

function synthesizeStrategicInsights(post, comments, postContext, extractedInsights) {
  const insights = [];
  const totalComments = comments.length;

  console.log('=== HUMAN-LIKE ANALYSIS START ===');
  console.log('Reading', totalComments, 'comments for', postContext.type);

  // STEP 1: READ AND LEARN (like a human would)
  const learned = readAndLearnFromComments(comments);

  // STEP 2: FIND PATTERNS (what repeats, what stands out)
  const patterns = findNaturalPatterns(learned, comments, totalComments);

  // STEP 3: SYNTHESIZE INSIGHTS (connect the dots)
  const synthesized = synthesizeFromPatterns(patterns, learned, totalComments);

  return {
    id: 'strategic_insights',
    title: '🎯 Strategic Insights',
    description: 'Synthesized intelligence from reading all comments',
    type: 'strategic',
    data: synthesized
  };
}

// STEP 1: Read comments and extract everything we can learn
function readAndLearnFromComments(comments) {
  console.log('Step 1: Reading and learning from comments...');

  const learned = {
    // What's being discussed (entities)
    entities: {},

    // What phrases keep repeating
    phrases: {},

    // Sentiment vocabulary found in THIS discussion
    positiveWords: {},
    negativeWords: {},

    // Outcomes people report
    outcomes: {worked: [], failed: [], mixed: []},

    // Time-related mentions
    timeMentions: {},

    // Who's speaking (authority/experience)
    speakers: {expert: 0, experienced: 0, novice: 0, unknown: 0},

    // Personal vs reported
    experienceType: {firsthand: 0, secondhand: 0},

    // Numbers mentioned
    numbers: {percentages: [], prices: [], quantities: []},

    // Comparisons (X vs Y, better/worse)
    comparisons: [],

    // Questions being asked
    questions: [],

    // Emotional language
    emotions: {},

    // Geographic mentions
    locations: {},

    // Frequency words (always, never, sometimes, often)
    frequency: {}
  };

  // Universal sentiment words (starting point)
  const basePosWords = ['good', 'great', 'love', 'best', 'worked', 'helped', 'success', 'amazing', 'excellent'];
  const baseNegWords = ['bad', 'terrible', 'hate', 'worst', 'failed', 'useless', 'awful', 'didn\'t work'];

  comments.forEach((comment, index) => {
    const body = comment.body || '';
    const bodyLower = body.toLowerCase();

    // Extract entities (things being discussed - proper nouns)
    const properNouns = body.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) || [];
    properNouns.forEach(entity => {
      const cleaned = entity.trim();
      if (cleaned.length > 2 && !['Reddit', 'Edit', 'Update', 'Source', 'The', 'This', 'That', 'There'].includes(cleaned)) {
        if (!learned.entities[cleaned]) {
          learned.entities[cleaned] = {
            count: 0,
            contexts: [],
            coOccurs: {},
            sentiment: {pos: 0, neg: 0, neu: 0}
          };
        }
        learned.entities[cleaned].count++;

        // Context (60 chars before and after)
        const idx = body.indexOf(cleaned);
        const context = body.substring(Math.max(0, idx - 60), Math.min(body.length, idx + cleaned.length + 60));
        if (learned.entities[cleaned].contexts.length < 5) {
          learned.entities[cleaned].contexts.push({text: context, score: comment.score});
        }

        // Co-occurrence (what else is mentioned in same comment)
        properNouns.forEach(other => {
          if (other !== cleaned && other.length > 2) {
            learned.entities[cleaned].coOccurs[other] = (learned.entities[cleaned].coOccurs[other] || 0) + 1;
          }
        });

        // Sentiment from context
        const contextLower = context.toLowerCase();
        if (basePosWords.some(w => contextLower.includes(w))) {
          learned.entities[cleaned].sentiment.pos++;
        } else if (baseNegWords.some(w => contextLower.includes(w))) {
          learned.entities[cleaned].sentiment.neg++;
        } else {
          learned.entities[cleaned].sentiment.neu++;
        }
      }
    });

    // Extract repeated phrases (3-4 words)
    const words = bodyLower.split(/\s+/).filter(w => w.length > 2);
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      if (phrase.length >= 12 && phrase.length <= 60) {
        learned.phrases[phrase] = (learned.phrases[phrase] || 0) + 1;
      }
    }

    // Learn sentiment vocabulary from this dataset
    words.forEach(word => {
      if (basePosWords.includes(word)) {
        learned.positiveWords[word] = (learned.positiveWords[word] || 0) + 1;
      } else if (baseNegWords.includes(word)) {
        learned.negativeWords[word] = (learned.negativeWords[word] || 0) + 1;
      }
    });

    // Extract outcomes
    if (/\b(worked|helped|solved|fixed|cured|success)\b/i.test(body)) {
      learned.outcomes.worked.push({text: body.substring(0, 300), score: comment.score});
    }
    if (/\b(failed|didn't work|worse|useless|no help|waste)\b/i.test(body)) {
      learned.outcomes.failed.push({text: body.substring(0, 300), score: comment.score});
    }
    if (/\b(sometimes|depends|mixed|varies|hit or miss)\b/i.test(body)) {
      learned.outcomes.mixed.push({text: body.substring(0, 300), score: comment.score});
    }

    // Extract time mentions
    const timeMatches = body.match(/\b(immediately|instant|days?|weeks?|months?|years?|decades?|long.?term|short.?term)\b/gi) || [];
    timeMatches.forEach(match => {
      const normalized = match.toLowerCase();
      learned.timeMentions[normalized] = (learned.timeMentions[normalized] || 0) + 1;
    });

    // Determine speaker type
    if (/\b(I'm a|doctor|MD|PhD|professional|specialist|expert|work in)\b/i.test(body)) {
      learned.speakers.expert++;
    } else if (/\b(\d+\s*years?|experience|dealt with for)\b/i.test(body)) {
      learned.speakers.experienced++;
    } else if (/\b(new to|just started|beginner|first time)\b/i.test(body)) {
      learned.speakers.novice++;
    } else {
      learned.speakers.unknown++;
    }

    // Experience type
    if (/\b(I |my |me |I've|I'm)\b/.test(body)) {
      learned.experienceType.firsthand++;
    } else if (/\b(heard|read|told|people say|they say)\b/i.test(body)) {
      learned.experienceType.secondhand++;
    }

    // Extract numbers
    const percentages = body.match(/\d+%/g) || [];
    learned.numbers.percentages.push(...percentages.map(p => ({value: p, context: body.substring(0, 200)})));

    const prices = body.match(/\$\d+(?:,\d{3})*(?:\.\d{2})?/g) || [];
    learned.numbers.prices.push(...prices.map(p => ({value: p, context: body.substring(0, 200)})));

    const quantities = body.match(/\d+\s+(?:times|people|users|patients|months|years)/gi) || [];
    learned.numbers.quantities.push(...quantities);

    // Comparisons
    const compMatches = body.match(/.{0,40}\b(better|worse|more|less|prefer)\s+than\b.{0,40}/gi) || [];
    learned.comparisons.push(...compMatches);

    // Questions
    if (body.includes('?')) {
      const questionSents = body.split(/[.!]/);
      questionSents.forEach(sent => {
        if (sent.includes('?') && sent.trim().length > 15) {
          learned.questions.push(sent.trim());
        }
      });
    }

    // Emotions
    const emotionMatches = body.match(/\b(frustrated|angry|happy|sad|excited|scared|worried|hopeful|desperate|relieved)\b/gi) || [];
    emotionMatches.forEach(emotion => {
      const normalized = emotion.toLowerCase();
      learned.emotions[normalized] = (learned.emotions[normalized] || 0) + 1;
    });

    // Geographic mentions
    const locations = body.match(/\b(US|USA|UK|Canada|Europe|Asia|America|Britain|Australia|India|China|Iran|France|Germany)\b/g) || [];
    locations.forEach(loc => {
      learned.locations[loc] = (learned.locations[loc] || 0) + 1;
    });

    // Frequency words
    const freqMatches = body.match(/\b(always|never|sometimes|often|rarely|usually|frequently|occasionally)\b/gi) || [];
    freqMatches.forEach(freq => {
      const normalized = freq.toLowerCase();
      learned.frequency[normalized] = (learned.frequency[normalized] || 0) + 1;
    });
  });

  console.log('Learned:', Object.keys(learned.entities).length, 'entities');
  console.log('Found:', Object.keys(learned.phrases).length, 'unique phrases');

  return learned;
}

// STEP 2: Find natural patterns from what we learned
function findNaturalPatterns(learned, comments, totalComments) {
  console.log('Step 2: Finding natural patterns...');

  const patterns = {
    topEntities: [],
    repeatedPhrases: [],
    dominantSentiment: null,
    outcomeRatio: null,
    timelinePattern: null,
    speakerProfile: null,
    commonComparisons: [],
    emotionalTone: null,
    geographicPattern: null
  };

  // Top entities with full analysis
  patterns.topEntities = Object.entries(learned.entities)
    .filter(([_, data]) => data.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([entity, data]) => {
      const total = data.sentiment.pos + data.sentiment.neg + data.sentiment.neu;
      const posRate = total > 0 ? Math.round((data.sentiment.pos / total) * 100) : 0;

      // Find what co-occurs most
      const topCoOccur = Object.entries(data.coOccurs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([e, count]) => ({entity: e, count}));

      return {
        entity,
        count: data.count,
        percentage: Math.round((data.count / totalComments) * 100),
        sentiment: posRate,
        coOccurs: topCoOccur,
        contexts: data.contexts
      };
    });

  // Repeated phrases (what people actually say)
  patterns.repeatedPhrases = Object.entries(learned.phrases)
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase, count]) => ({phrase, count, percentage: Math.round((count / totalComments) * 100)}));

  // Outcome ratio
  const totalOutcomes = learned.outcomes.worked.length + learned.outcomes.failed.length;
  if (totalOutcomes >= 5) {
    patterns.outcomeRatio = {
      successRate: Math.round((learned.outcomes.worked.length / totalOutcomes) * 100),
      worked: learned.outcomes.worked.length,
      failed: learned.outcomes.failed.length,
      mixed: learned.outcomes.mixed.length
    };
  }

  // Timeline pattern
  const topTime = Object.entries(learned.timeMentions)
    .sort((a, b) => b[1] - a[1])[0];
  if (topTime && topTime[1] >= 3) {
    patterns.timelinePattern = {
      dominant: topTime[0],
      count: topTime[1],
      percentage: Math.round((topTime[1] / totalComments) * 100)
    };
  }

  // Speaker profile
  const totalSpeakers = Object.values(learned.speakers).reduce((a, b) => a + b, 0);
  patterns.speakerProfile = {
    expertPct: Math.round((learned.speakers.expert / totalSpeakers) * 100),
    experiencedPct: Math.round((learned.speakers.experienced / totalSpeakers) * 100),
    novicePct: Math.round((learned.speakers.novice / totalSpeakers) * 100),
    firsthandPct: Math.round((learned.experienceType.firsthand / totalComments) * 100)
  };

  // Common comparisons
  const compCounts = {};
  learned.comparisons.forEach(comp => {
    const normalized = comp.trim().toLowerCase();
    compCounts[normalized] = (compCounts[normalized] || 0) + 1;
  });
  patterns.commonComparisons = Object.entries(compCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([comp, count]) => ({comparison: comp, count}));

  // Emotional tone
  const topEmotions = Object.entries(learned.emotions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topEmotions.length > 0 && topEmotions[0][1] >= 3) {
    patterns.emotionalTone = topEmotions.map(([emotion, count]) => ({emotion, count}));
  }

  // Geographic pattern
  const geoEntries = Object.entries(learned.locations);
  if (geoEntries.length >= 2) {
    patterns.geographicPattern = geoEntries
      .sort((a, b) => b[1] - a[1])
      .map(([location, count]) => ({location, count}));
  }

  return patterns;
}

// STEP 3: Synthesize insights from patterns (like a human would)
function synthesizeFromPatterns(patterns, learned, totalComments) {
  console.log('Step 3: Synthesizing insights...');

  const insights = [];

  // Insight: Top entities with context
  if (patterns.topEntities.length > 0) {
    patterns.topEntities.slice(0, 5).forEach(entity => {
      let insight = `"${entity.entity}" discussed in ${entity.percentage}% of comments (${entity.count} mentions)`;

      if (entity.sentiment >= 70) {
        insight += ` with ${entity.sentiment}% positive sentiment - highly favored`;
      } else if (entity.sentiment <= 30 && entity.sentiment > 0) {
        insight += ` with only ${entity.sentiment}% positive sentiment - significant concerns`;
      }

      if (entity.coOccurs.length > 0) {
        const topPair = entity.coOccurs[0];
        insight += `. Often mentioned with "${topPair.entity}" (${topPair.count} times)`;
      }

      insights.push({
        type: 'entity_analysis',
        insight: insight,
        entity: entity.entity,
        data: entity
      });
    });
  }

  // Insight: Repeated phrases
  if (patterns.repeatedPhrases.length > 0) {
    patterns.repeatedPhrases.slice(0, 3).forEach(item => {
      insights.push({
        type: 'repeated_language',
        insight: `"${item.phrase}" repeated ${item.count} times (${item.percentage}% of comments) - common shared experience`,
        phrase: item.phrase,
        count: item.count,
        percentage: item.percentage
      });
    });
  }

  // Insight: Outcome ratio
  if (patterns.outcomeRatio) {
    const ratio = patterns.outcomeRatio;
    let interpretation = '';
    if (ratio.successRate >= 70) {
      interpretation = 'highly effective';
    } else if (ratio.successRate >= 50) {
      interpretation = 'moderately effective';
    } else if (ratio.successRate >= 30) {
      interpretation = 'mixed results';
    } else {
      interpretation = 'low success rate - caution advised';
    }

    insights.push({
      type: 'outcome_analysis',
      insight: `${ratio.successRate}% success rate across reported attempts (${ratio.worked} worked vs ${ratio.failed} failed) - ${interpretation}`,
      successRate: ratio.successRate,
      data: ratio
    });
  }

  // Insight: Timeline
  if (patterns.timelinePattern) {
    insights.push({
      type: 'timeline',
      insight: `"${patterns.timelinePattern.dominant}" mentioned in ${patterns.timelinePattern.percentage}% of comments - sets realistic timeline expectations`,
      timeline: patterns.timelinePattern.dominant,
      percentage: patterns.timelinePattern.percentage
    });
  }

  // Insight: Speaker profile
  if (patterns.speakerProfile) {
    const prof = patterns.speakerProfile;
    let insight = '';

    if (prof.expertPct >= 20) {
      insight = `${prof.expertPct}% expert/professional input, ${prof.firsthandPct}% firsthand experiences - balanced authoritative and personal perspectives`;
    } else if (prof.firsthandPct >= 70) {
      insight = `${prof.firsthandPct}% firsthand personal experiences - highly authentic, lived-experience based discussion`;
    } else {
      insight = `Community-driven discussion with ${prof.firsthandPct}% firsthand experiences`;
    }

    insights.push({
      type: 'speaker_analysis',
      insight: insight,
      data: prof
    });
  }

  // Insight: Comparisons
  if (patterns.commonComparisons.length > 0) {
    patterns.commonComparisons.forEach(comp => {
      insights.push({
        type: 'comparison',
        insight: `Common comparison: "${comp.comparison}" (${comp.count} mentions) - indicates active evaluation`,
        comparison: comp.comparison,
        count: comp.count
      });
    });
  }

  // Insight: Emotional tone
  if (patterns.emotionalTone) {
    const emotions = patterns.emotionalTone.map(e => `${e.emotion} (${e.count})`).join(', ');
    insights.push({
      type: 'emotional_tone',
      insight: `Dominant emotions: ${emotions} - high emotional engagement in discussion`,
      emotions: patterns.emotionalTone
    });
  }

  // Insight: Geographic
  if (patterns.geographicPattern && patterns.geographicPattern.length >= 2) {
    const locations = patterns.geographicPattern.map(g => `${g.location} (${g.count})`).join(', ');
    insights.push({
      type: 'geographic_variance',
      insight: `Geographic differences noted: ${locations} - treatment/experience varies by location`,
      locations: patterns.geographicPattern
    });
  }

  console.log('=== GENERATED', insights.length, 'INSIGHTS ===');

  return insights;
}
