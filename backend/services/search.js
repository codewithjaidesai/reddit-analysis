const axios = require('axios');
const config = require('../config');
const { getRedditAccessToken } = require('./reddit');

/**
 * Extract core keywords from a research question
 * @param {string} query - User's research question or keywords
 * @returns {string} Extracted keywords for search
 */
function extractKeywords(query) {
  // If query is already short and keyword-like, return as-is
  if (query.length < 30 && !query.includes('?')) {
    return query;
  }

  // Remove common question words and filler
  const fillerWords = [
    'why', 'how', 'what', 'when', 'where', 'who', 'which',
    'do', 'does', 'did', 'is', 'are', 'was', 'were',
    'users', 'people', 'someone', 'anyone',
    'the', 'a', 'an', 'and', 'or', 'but', 'for', 'to', 'of', 'in', 'on', 'at',
    'prefer', 'like', 'use', 'choose', 'think', 'feel'
  ];

  // Split into words and filter
  let keywords = query
    .toLowerCase()
    .replace(/[?!.,;]/g, '') // Remove punctuation
    .split(' ')
    .filter(word => !fillerWords.includes(word) && word.length > 2)
    .join(' ');

  // If we filtered too much, use original
  if (keywords.split(' ').length < 2) {
    // At least keep noun phrases - remove just the question start
    keywords = query
      .replace(/^(why|how|what|when|where|who)\s+(do|does|did|is|are|was|were)\s+/i, '')
      .replace(/^(why|how|what|when|where|who)\s+/i, '')
      .trim();
  }

  console.log(`Extracted keywords: "${keywords}" from "${query}"`);
  return keywords;
}

/**
 * Enhance search query with template-specific synonyms and modifiers
 * @param {string} topic - Base search query
 * @param {string} template - Analysis template type
 * @returns {string} Enhanced query
 */
function enhanceQueryWithTemplate(topic, template) {
  // First, extract keywords if this looks like a question
  const keywords = extractKeywords(topic);

  // For "All Insights" - NO MODIFICATION (back to basics that worked)
  if (!template || template === 'all') {
    return keywords;
  }

  // For templates - add MINIMAL, OPTIONAL modifiers
  // These are gentle hints, not required terms
  const modifiers = {
    'pain_points': '(problem OR issue)',
    'competitive': '(vs OR compare)',
    'features': '(feature OR request)',
    'market_gaps': '(missing OR gap)'
  };

  const modifier = modifiers[template];
  if (modifier) {
    console.log(`Template "${template}" enhancing with: ${modifier}`);
    return `${keywords} ${modifier}`;
  }

  return keywords;
}

/**
 * Get relevant subreddits for common topics
 * @param {string} query - Search query
 * @returns {string} Suggested subreddits (comma-separated) or empty string
 */
function suggestSubreddits(query) {
  const queryLower = query.toLowerCase();

  // Map common topics to relevant subreddits
  const topicMap = {
    'fire': 'financialindependence,fire,leanfire,fatfire',
    'financial independence': 'financialindependence,fire,leanfire,personalfinance',
    'notion': 'Notion,productivity,PKM',
    'evernote': 'Evernote,productivity,PKM',
    'obsidian': 'ObsidianMD,PKM,productivity',
    'saas': 'SaaS,startups,entrepreneur,smallbusiness',
    'startup': 'startups,entrepreneur,smallbusiness',
    'productivity': 'productivity,selfimprovement,getdisciplined'
  };

  // Check if query matches or contains any known topic
  for (const [topic, subreddits] of Object.entries(topicMap)) {
    if (queryLower.includes(topic)) {
      console.log(`Auto-suggesting subreddits for "${topic}": ${subreddits}`);
      return subreddits;
    }
  }

  return '';
}

/**
 * Format query for Reddit search
 * @param {string} query - User's search query
 * @returns {string} Cleaned query (no modifications, let Reddit's algorithm handle it)
 */
function formatSearchQuery(query) {
  // Just clean up extra whitespace and return as-is
  // Let Reddit's search algorithm do the work - it's smart enough to handle multi-word queries
  return query.trim().replace(/\s+/g, ' ');
}

/**
 * Search Reddit by topic across all or specific subreddits
 * @param {string} topic - Search query
 * @param {string} timeRange - Time filter (hour, day, week, month, year, all)
 * @param {string} subreddits - Comma-separated subreddit list (optional)
 * @param {number} limit - Number of results (default: 15)
 * @returns {Promise<object>} Search results
 */
async function searchRedditByTopic(topic, timeRange = 'week', subreddits = '', limit = 15) {
  console.log('Searching Reddit for:', topic, 'Time:', timeRange, 'Subreddits:', subreddits, 'Limit:', limit);

  // Initialize debug object to return to frontend
  const debugInfo = {
    originalQuery: topic,
    timeRange,
    userSpecifiedSubreddits: subreddits || 'None',
    formattedQuery: '',
    finalQuery: '',
    autoSuggestedSubreddits: '',
    effectiveSubreddits: '',
    redditApiUrl: '',
    samplePosts: [],
    filterStats: {}
  };

  try {
    // Get Reddit OAuth token first
    const accessToken = await getRedditAccessToken();

    // Format query for better relevance
    let formattedQuery = formatSearchQuery(topic);
    debugInfo.formattedQuery = formattedQuery;
    console.log('Formatted query:', formattedQuery);

    // Auto-suggest subreddits for known topics (for debug info only, not used in query)
    const autoSuggestedSubreddits = suggestSubreddits(topic);
    if (autoSuggestedSubreddits) {
      debugInfo.autoSuggestedSubreddits = autoSuggestedSubreddits;
      console.log('Auto-detected topic, would have suggested subreddits:', autoSuggestedSubreddits, '(not applied - searching all of Reddit)');
    }

    // Only use subreddit filtering if user manually specified subreddits
    let effectiveSubreddits = subreddits && subreddits.trim() ? subreddits : '';
    debugInfo.effectiveSubreddits = effectiveSubreddits || 'All of Reddit';

    // Use Reddit's OAuth API to avoid 403 errors
    let searchUrl = 'https://oauth.reddit.com/search';
    let params = {
      q: formattedQuery,
      t: timeRange,
      sort: 'relevance',
      limit: 100, // Get more to filter by engagement
      restrict_sr: false,
      type: 'link',
      raw_json: 1
    };

    // ONLY add subreddit filtering if user manually specified subreddits
    // Do NOT restrict based on auto-suggestions - let Reddit's algorithm find relevant content
    if (effectiveSubreddits) {
      const subredditList = effectiveSubreddits.split(',').map(s => s.trim()).filter(s => s);
      if (subredditList.length > 0) {
        params.q = `${formattedQuery} (subreddit:${subredditList.join(' OR subreddit:')})`;
        console.log('User specified subreddits - restricting search to:', effectiveSubreddits);
      }
    }

    // Build full URL for debugging
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${searchUrl}?${queryString}`;

    debugInfo.finalQuery = params.q;
    debugInfo.redditApiUrl = fullUrl;

    console.log('\n=== REDDIT SEARCH DEBUG ===');
    console.log('Full API URL:', fullUrl);
    console.log('Query sent to Reddit:', params.q);
    console.log('Time range:', timeRange);
    console.log('Subreddits filter:', effectiveSubreddits || 'All of Reddit');
    console.log('===========================\n');

    const response = await axios.get(searchUrl, {
      params,
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': config.reddit.userAgent
      }
    });

    if (response.status !== 200) {
      throw new Error(`Reddit search API returned ${response.status}`);
    }

    const data = response.data;
    const posts = data.data.children.map(child => child.data);

    // Capture sample posts for debug info
    debugInfo.samplePosts = posts.slice(0, 3).map(post => ({
      subreddit: post.subreddit,
      title: post.title.substring(0, 80) + (post.title.length > 80 ? '...' : ''),
      score: post.score,
      comments: post.num_comments,
      upvoteRatio: post.upvote_ratio
    }));

    console.log(`\n=== REDDIT RESPONSE ===`);
    console.log(`Reddit returned ${posts.length} posts`);
    if (posts.length > 0) {
      console.log('Sample post titles (first 3):');
      posts.slice(0, 3).forEach((post, i) => {
        console.log(`  ${i+1}. r/${post.subreddit} - ${post.title.substring(0, 80)}... (${post.score} upvotes, ${post.num_comments} comments)`);
      });
    }
    console.log('======================\n');

    // Filter and score posts
    const MIN_SCORE = 20;
    const MIN_COMMENTS = 10;
    const MIN_UPVOTE_RATIO = 0.7;

    // Track filter reasons for debugging
    let filterStats = {
      total: posts.length,
      lowScore: 0,
      lowComments: 0,
      lowUpvoteRatio: 0,
      isVideo: 0,
      isStickied: 0,
      passed: 0
    };

    const scoredPosts = posts
      .filter(post => {
        // Track why posts are filtered
        if (post.score < MIN_SCORE) filterStats.lowScore++;
        if (post.num_comments < MIN_COMMENTS) filterStats.lowComments++;
        if (post.upvote_ratio < MIN_UPVOTE_RATIO) filterStats.lowUpvoteRatio++;
        if (post.is_video) filterStats.isVideo++;
        if (post.stickied) filterStats.isStickied++;

        const passes = post.score >= MIN_SCORE &&
               post.num_comments >= MIN_COMMENTS &&
               post.upvote_ratio >= MIN_UPVOTE_RATIO &&
               !post.is_video &&
               !post.stickied;

        if (passes) filterStats.passed++;

        return passes;
      })
      .map(post => {
        const engagementScore = post.score + (post.num_comments * 2);
        const engagementRate = post.subreddit_subscribers > 0
          ? (post.score / post.subreddit_subscribers) * 10000
          : 0;

        let engagementTier = 'low';
        let engagementStars = 2;
        if (post.score >= 1000 || engagementRate >= 5) {
          engagementTier = 'viral';
          engagementStars = 5;
        } else if (post.score >= 500 || engagementRate >= 3) {
          engagementTier = 'high';
          engagementStars = 4;
        } else if (post.score >= 100 || engagementRate >= 1) {
          engagementTier = 'medium';
          engagementStars = 3;
        }

        const postAgeHours = (Date.now() - (post.created_utc * 1000)) / (1000 * 60 * 60);
        let ageText = '';
        if (postAgeHours < 1) {
          ageText = Math.floor(postAgeHours * 60) + ' minutes ago';
        } else if (postAgeHours < 24) {
          ageText = Math.floor(postAgeHours) + ' hours ago';
        } else {
          ageText = Math.floor(postAgeHours / 24) + ' days ago';
        }

        return {
          id: post.id,
          title: post.title,
          subreddit: post.subreddit,
          subreddit_subscribers: post.subreddit_subscribers,
          score: post.score,
          num_comments: post.num_comments,
          upvote_ratio: post.upvote_ratio,
          created_utc: post.created_utc,
          url: 'https://www.reddit.com' + post.permalink,
          selftext: post.selftext ? post.selftext.substring(0, 200) : '',
          post_hint: post.post_hint || 'text',
          engagementScore,
          engagementRate: Math.round(engagementRate * 10) / 10,
          engagementTier,
          engagementStars,
          ageText,
          ageHours: postAgeHours
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);

    // Capture filter stats for debug info
    debugInfo.filterStats = {
      ...filterStats,
      minScore: MIN_SCORE,
      minComments: MIN_COMMENTS,
      minUpvoteRatio: MIN_UPVOTE_RATIO
    };

    // Add examples of filtered posts if all were filtered
    if (filterStats.passed === 0 && posts.length > 0) {
      debugInfo.filteredExamples = posts.slice(0, 3).map(post => {
        const reasons = [];
        if (post.score < MIN_SCORE) reasons.push(`score=${post.score}`);
        if (post.num_comments < MIN_COMMENTS) reasons.push(`comments=${post.num_comments}`);
        if (post.upvote_ratio < MIN_UPVOTE_RATIO) reasons.push(`ratio=${post.upvote_ratio}`);
        if (post.is_video) reasons.push('video');
        if (post.stickied) reasons.push('stickied');
        return {
          subreddit: post.subreddit,
          title: post.title.substring(0, 60) + (post.title.length > 60 ? '...' : ''),
          failedReasons: reasons
        };
      });
    }

    console.log(`\n=== FILTERING RESULTS ===`);
    console.log(`Passed filters: ${filterStats.passed} out of ${filterStats.total}`);
    console.log(`Filter breakdown (posts can fail multiple criteria):`);
    console.log(`  - Low score (<${MIN_SCORE}): ${filterStats.lowScore}`);
    console.log(`  - Low comments (<${MIN_COMMENTS}): ${filterStats.lowComments}`);
    console.log(`  - Low upvote ratio (<${MIN_UPVOTE_RATIO}): ${filterStats.lowUpvoteRatio}`);
    console.log(`  - Is video: ${filterStats.isVideo}`);
    console.log(`  - Is stickied: ${filterStats.isStickied}`);
    console.log(`Final results after limit (${limit}): ${scoredPosts.length}`);

    // Show examples of filtered out posts for debugging
    if (filterStats.passed === 0 && posts.length > 0) {
      console.log('\n⚠️  ALL POSTS FILTERED OUT - Examples of what was filtered:');
      posts.slice(0, 3).forEach((post, i) => {
        const reasons = [];
        if (post.score < MIN_SCORE) reasons.push(`score=${post.score}`);
        if (post.num_comments < MIN_COMMENTS) reasons.push(`comments=${post.num_comments}`);
        if (post.upvote_ratio < MIN_UPVOTE_RATIO) reasons.push(`ratio=${post.upvote_ratio}`);
        if (post.is_video) reasons.push('video');
        if (post.stickied) reasons.push('stickied');
        console.log(`  ${i+1}. r/${post.subreddit} - ${post.title.substring(0, 60)}...`);
        console.log(`     Failed: ${reasons.join(', ')}`);
      });
    }
    console.log('========================\n');

    return {
      success: true,
      query: topic,
      timeRange,
      totalFound: posts.length,
      afterFiltering: scoredPosts.length,
      posts: scoredPosts,
      debug: debugInfo  // Include debug info in response
    };

  } catch (error) {
    console.error('Search error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to search Reddit: ' + error.message,
      posts: [],
      debug: debugInfo  // Include debug info even on error
    };
  }
}

/**
 * Search top posts from a specific subreddit
 * @param {string} subreddit - Subreddit name (without r/)
 * @param {string} timeRange - Time filter (day, week, month, year)
 * @param {number} limit - Number of results (default: 15)
 * @returns {Promise<object>} Top posts
 */
async function searchSubredditTopPosts(subreddit, timeRange = 'week', limit = 15) {
  console.log('Searching subreddit:', subreddit, 'Time:', timeRange, 'Limit:', limit);

  try {
    const accessToken = await getRedditAccessToken();
    const url = `https://oauth.reddit.com/r/${subreddit}/top`;

    const response = await axios.get(url, {
      params: {
        t: timeRange,
        limit: 100,
        raw_json: 1
      },
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': config.reddit.userAgent
      }
    });

    if (response.status !== 200) {
      throw new Error(`Reddit API returned ${response.status}`);
    }

    const data = response.data;
    const posts = data.data.children.map(child => child.data);

    console.log(`Found ${posts.length} posts from r/${subreddit}`);

    // Filter and score
    const scoredPosts = posts
      .filter(post => {
        return post.score >= 20 &&
               post.num_comments >= 10 &&
               post.upvote_ratio >= 0.7 &&
               !post.is_video &&
               !post.stickied;
      })
      .map(post => {
        const engagementScore = post.score + (post.num_comments * 2);
        const engagementRate = post.subreddit_subscribers > 0
          ? (post.score / post.subreddit_subscribers) * 10000
          : 0;

        let engagementTier = 'low';
        let engagementStars = 2;
        if (post.score >= 1000 || engagementRate >= 5) {
          engagementTier = 'viral';
          engagementStars = 5;
        } else if (post.score >= 500 || engagementRate >= 3) {
          engagementTier = 'high';
          engagementStars = 4;
        } else if (post.score >= 100 || engagementRate >= 1) {
          engagementTier = 'medium';
          engagementStars = 3;
        }

        const postAgeHours = (Date.now() - (post.created_utc * 1000)) / (1000 * 60 * 60);
        let ageText = '';
        if (postAgeHours < 1) {
          ageText = Math.floor(postAgeHours * 60) + ' minutes ago';
        } else if (postAgeHours < 24) {
          ageText = Math.floor(postAgeHours) + ' hours ago';
        } else {
          ageText = Math.floor(postAgeHours / 24) + ' days ago';
        }

        return {
          id: post.id,
          title: post.title,
          subreddit: post.subreddit,
          subreddit_subscribers: post.subreddit_subscribers,
          score: post.score,
          num_comments: post.num_comments,
          upvote_ratio: post.upvote_ratio,
          created_utc: post.created_utc,
          url: 'https://www.reddit.com' + post.permalink,
          selftext: post.selftext ? post.selftext.substring(0, 200) : '',
          post_hint: post.post_hint || 'text',
          engagementScore,
          engagementRate: Math.round(engagementRate * 10) / 10,
          engagementTier,
          engagementStars,
          ageText,
          ageHours: postAgeHours
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);

    console.log(`Found ${scoredPosts.length} high-engagement posts from r/${subreddit}`);

    return {
      success: true,
      subreddit,
      timeRange,
      totalFound: posts.length,
      afterFiltering: scoredPosts.length,
      posts: scoredPosts
    };

  } catch (error) {
    console.error('Subreddit search error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to search r/' + subreddit + ': ' + error.message,
      posts: []
    };
  }
}

module.exports = {
  searchRedditByTopic,
  searchSubredditTopPosts,
  enhanceQueryWithTemplate,
  extractKeywords,
  suggestSubreddits,
  formatSearchQuery,
  getSubredditInfo,
  fetchTimeBucketedPosts,
  samplePostsForComments,
  fetchCommentsForPosts
};

/**
 * Get subreddit info for activity detection
 * @param {string} subreddit - Subreddit name (without r/)
 * @returns {Promise<object>} Subreddit info with activity level
 */
async function getSubredditInfo(subreddit) {
  console.log('Getting subreddit info for:', subreddit);

  try {
    const accessToken = await getRedditAccessToken();

    // Fetch subreddit about info
    const aboutUrl = `https://oauth.reddit.com/r/${subreddit}/about`;
    const aboutResponse = await axios.get(aboutUrl, {
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': config.reddit.userAgent
      }
    });

    if (aboutResponse.status !== 200) {
      throw new Error(`Reddit API returned ${aboutResponse.status}`);
    }

    const subredditData = aboutResponse.data.data;

    // Fetch recent posts to estimate activity
    const newUrl = `https://oauth.reddit.com/r/${subreddit}/new`;
    const newResponse = await axios.get(newUrl, {
      params: {
        limit: 25,
        raw_json: 1
      },
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': config.reddit.userAgent
      }
    });

    const recentPosts = newResponse.data.data.children.map(child => child.data);

    // Calculate posts per day based on timestamps
    let postsPerDay = 0;
    let activityLevel = 'low';

    if (recentPosts.length >= 2) {
      const oldestPost = recentPosts[recentPosts.length - 1];
      const newestPost = recentPosts[0];
      const timeDiffHours = (newestPost.created_utc - oldestPost.created_utc) / 3600;

      if (timeDiffHours > 0) {
        postsPerDay = (recentPosts.length / timeDiffHours) * 24;
      }
    }

    // Determine activity level
    if (postsPerDay >= 50) {
      activityLevel = 'high';
    } else if (postsPerDay >= 5) {
      activityLevel = 'medium';
    } else {
      activityLevel = 'low';
    }

    // Calculate recommended time range based on activity
    let recommendedTimeRange = 'year';
    if (activityLevel === 'high') {
      recommendedTimeRange = 'month';
    } else if (activityLevel === 'medium') {
      recommendedTimeRange = 'month';
    }

    return {
      success: true,
      subreddit: subredditData.display_name,
      title: subredditData.title,
      description: subredditData.public_description || subredditData.description,
      subscribers: subredditData.subscribers,
      activeUsers: subredditData.accounts_active || 0,
      created: subredditData.created_utc,
      postsPerDay: Math.round(postsPerDay * 10) / 10,
      activityLevel,
      recommendedTimeRange
    };

  } catch (error) {
    console.error('Subreddit info error:', error.message);

    // Check if it's a 404 (subreddit not found)
    if (error.response && error.response.status === 404) {
      return {
        success: false,
        error: 'Subreddit not found',
        message: `r/${subreddit} does not exist or is private`
      };
    }

    return {
      success: false,
      error: error.message,
      message: 'Failed to get subreddit info: ' + error.message
    };
  }
}

/**
 * Fetch posts with time bucketing for trend analysis
 * @param {string} subreddit - Subreddit name (without r/)
 * @param {string} depth - Analysis depth: 'quick' (30 days) or 'full' (1 year)
 * @returns {Promise<object>} Posts organized by time buckets
 */
async function fetchTimeBucketedPosts(subreddit, depth = 'full') {
  console.log('Fetching time-bucketed posts for:', subreddit, 'Depth:', depth);

  try {
    const accessToken = await getRedditAccessToken();
    const now = Date.now() / 1000; // Current time in seconds

    // Define time buckets based on depth
    let buckets;
    if (depth === 'quick') {
      // Quick: Just recent 30 days
      buckets = [
        { name: 'recent', label: 'Last 30 Days', startDays: 0, endDays: 30, posts: [] }
      ];
    } else {
      // Full: 1 year with multiple buckets
      buckets = [
        { name: 'recent', label: 'Last 30 Days', startDays: 0, endDays: 30, posts: [] },
        { name: 'month1to3', label: '1-3 Months Ago', startDays: 30, endDays: 90, posts: [] },
        { name: 'month3to6', label: '3-6 Months Ago', startDays: 90, endDays: 180, posts: [] },
        { name: 'month6to12', label: '6-12 Months Ago', startDays: 180, endDays: 365, posts: [] }
      ];
    }

    // Fetch top posts from the past year
    const timeRange = depth === 'quick' ? 'month' : 'year';
    const url = `https://oauth.reddit.com/r/${subreddit}/top`;

    const response = await axios.get(url, {
      params: {
        t: timeRange,
        limit: 100,
        raw_json: 1
      },
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': config.reddit.userAgent
      }
    });

    if (response.status !== 200) {
      throw new Error(`Reddit API returned ${response.status}`);
    }

    const allPosts = response.data.data.children.map(child => child.data);
    console.log(`Fetched ${allPosts.length} posts from r/${subreddit}`);

    // Filter posts with minimum engagement
    const qualityPosts = allPosts.filter(post => {
      return post.score >= 10 &&
             post.num_comments >= 5 &&
             !post.is_video &&
             !post.stickied;
    });

    console.log(`${qualityPosts.length} posts passed quality filter`);

    // Sort posts into buckets
    for (const post of qualityPosts) {
      const postAgeSeconds = now - post.created_utc;
      const postAgeDays = postAgeSeconds / (24 * 60 * 60);

      for (const bucket of buckets) {
        if (postAgeDays >= bucket.startDays && postAgeDays < bucket.endDays) {
          bucket.posts.push({
            id: post.id,
            title: post.title,
            selftext: post.selftext ? post.selftext.substring(0, 500) : '',
            score: post.score,
            num_comments: post.num_comments,
            upvote_ratio: post.upvote_ratio,
            created_utc: post.created_utc,
            url: 'https://www.reddit.com' + post.permalink,
            ageDays: Math.round(postAgeDays)
          });
          break;
        }
      }
    }

    // Sort each bucket by score and limit to top 25
    const postsPerBucket = depth === 'quick' ? 50 : 25;
    for (const bucket of buckets) {
      bucket.posts = bucket.posts
        .sort((a, b) => b.score - a.score)
        .slice(0, postsPerBucket);
    }

    // Calculate total posts for analysis
    const totalPosts = buckets.reduce((sum, b) => sum + b.posts.length, 0);

    return {
      success: true,
      subreddit,
      depth,
      totalPosts,
      buckets: buckets.map(b => ({
        name: b.name,
        label: b.label,
        postCount: b.posts.length,
        posts: b.posts
      }))
    };

  } catch (error) {
    console.error('Time-bucketed fetch error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to fetch posts: ' + error.message
    };
  }
}

/**
 * Sample top posts from each time bucket for comment analysis
 * @param {object} bucketedData - Data from fetchTimeBucketedPosts
 * @param {number} postsPerBucket - Number of posts to sample per bucket (default 12)
 * @returns {Array} Array of sampled posts with bucket info
 */
function samplePostsForComments(bucketedData, postsPerBucket = 12) {
  const sampledPosts = [];

  for (const bucket of bucketedData.buckets) {
    // Sort by engagement score (score × num_comments)
    const sortedPosts = [...bucket.posts].sort((a, b) => {
      const engagementA = (a.score || 0) * Math.log(1 + (a.num_comments || 0));
      const engagementB = (b.score || 0) * Math.log(1 + (b.num_comments || 0));
      return engagementB - engagementA;
    });

    // Take top N posts from this bucket
    const selected = sortedPosts.slice(0, postsPerBucket);

    // Add bucket info to each post
    for (const post of selected) {
      sampledPosts.push({
        ...post,
        bucketName: bucket.name,
        bucketLabel: bucket.label
      });
    }
  }

  console.log(`Sampled ${sampledPosts.length} posts for comment analysis`);
  return sampledPosts;
}

/**
 * Fetch comments for multiple posts with rate limiting
 * Reuses existing reddit.js functions
 * @param {Array} posts - Array of posts to fetch comments for
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Array>} Posts with their comments
 */
async function fetchCommentsForPosts(posts, progressCallback = null) {
  const { extractRedditData } = require('./reddit');

  const postsWithComments = [];
  const concurrencyLimit = 5; // Fetch 5 at a time to respect rate limits
  const delayBetweenBatches = 1000; // 1 second between batches

  console.log(`Fetching comments for ${posts.length} posts...`);

  // Process in batches
  for (let i = 0; i < posts.length; i += concurrencyLimit) {
    const batch = posts.slice(i, i + concurrencyLimit);

    // Fetch comments for this batch in parallel
    const batchPromises = batch.map(async (post) => {
      try {
        const result = await extractRedditData(post.url);

        if (result.success && result.data) {
          return {
            ...post,
            comments: result.data.valuableComments || [],
            commentStats: result.data.extractionStats || {}
          };
        } else {
          console.warn(`Failed to fetch comments for post ${post.id}: ${result.error}`);
          return {
            ...post,
            comments: [],
            commentStats: { error: result.error }
          };
        }
      } catch (error) {
        console.error(`Error fetching comments for post ${post.id}:`, error.message);
        return {
          ...post,
          comments: [],
          commentStats: { error: error.message }
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    postsWithComments.push(...batchResults);

    // Progress update
    const progress = Math.round(((i + batch.length) / posts.length) * 100);
    console.log(`Comment fetch progress: ${progress}% (${i + batch.length}/${posts.length})`);

    if (progressCallback) {
      progressCallback({
        current: i + batch.length,
        total: posts.length,
        percentage: progress
      });
    }

    // Delay before next batch (except for last batch)
    if (i + concurrencyLimit < posts.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  // Calculate total comments fetched
  const totalComments = postsWithComments.reduce(
    (sum, p) => sum + (p.comments?.length || 0), 0
  );
  console.log(`Fetched ${totalComments} comments from ${postsWithComments.length} posts`);

  return postsWithComments;
}
