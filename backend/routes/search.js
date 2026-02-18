const express = require('express');
const router = express.Router();
const { searchRedditByTopic, searchSubredditTopPosts, getSubredditInfo, fetchTimeBucketedPosts } = require('../services/search');
const { preScreenPosts } = require('../services/mapReduceAnalysis');
const { searchVideos, timeRangeToPublishedAfter } = require('../services/youtube');
const { canAffordSearch, getQuotaStatus } = require('../services/youtubeQuota');
const config = require('../config');

/**
 * Normalize a YouTube search result video into the same shape as a Reddit post.
 * This allows pre-screening, selection, and analysis flows to work unchanged.
 * @param {object} video - Video object from searchVideos()
 * @returns {object} Normalized post-shaped object
 */
function normalizeYouTubeVideo(video) {
  const engagementScore = Math.round(video.viewCount / 1000 + video.commentCount * 2 + video.likeCount);

  let engagementTier = 'low';
  let engagementStars = 2;
  if (video.viewCount >= 100000 || video.likeCount >= 5000) {
    engagementTier = 'viral'; engagementStars = 5;
  } else if (video.viewCount >= 50000 || video.likeCount >= 1000) {
    engagementTier = 'high'; engagementStars = 4;
  } else if (video.viewCount >= 10000 || video.likeCount >= 100) {
    engagementTier = 'medium'; engagementStars = 3;
  }

  const publishedDate = new Date(video.publishedAt);
  const ageHours = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60);
  let ageText = '';
  if (ageHours < 24) ageText = Math.floor(ageHours) + ' hours ago';
  else if (ageHours < 24 * 30) ageText = Math.floor(ageHours / 24) + ' days ago';
  else if (ageHours < 24 * 365) ageText = Math.floor(ageHours / (24 * 30)) + ' months ago';
  else ageText = Math.floor(ageHours / (24 * 365)) + ' years ago';

  return {
    id: video.id,
    title: video.title,
    subreddit: `YouTube: ${video.channelTitle}`,
    score: video.likeCount,
    num_comments: video.commentCount,
    url: video.url,
    selftext: (video.description || '').substring(0, 200),
    engagementScore,
    engagementTier,
    engagementStars,
    ageText,
    ageHours,
    created_utc: Math.floor(publishedDate.getTime() / 1000),
    // YouTube-specific metadata (preserved for downstream use)
    _source: 'youtube',
    _viewCount: video.viewCount,
    _channelTitle: video.channelTitle,
    _channelId: video.channelId,
    _thumbnailUrl: video.thumbnailUrl
  };
}

/**
 * POST /api/search/topic
 * Search Reddit and/or YouTube by topic/keywords
 * @param {string} sources - 'both' (default), 'reddit', 'youtube'
 */
router.post('/topic', async (req, res) => {
  try {
    const { topic, timeRange, subreddits, limit, role, goal, sources } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      });
    }

    const sourceMode = sources || 'both';
    const youtubeEnabled = config.features?.youtube === true;

    console.log('Topic search:', topic, 'Sources:', sourceMode, 'Role:', role || 'not specified');

    // Determine what to search
    const searchReddit = sourceMode !== 'youtube';
    const searchYouTube = sourceMode !== 'reddit' && youtubeEnabled && canAffordSearch();
    const youtubeSkipReason = !youtubeEnabled ? 'disabled' : (!canAffordSearch() ? 'quota_exhausted' : null);

    if (sourceMode === 'youtube' && !searchYouTube) {
      return res.status(400).json({
        success: false,
        error: youtubeSkipReason === 'disabled'
          ? 'YouTube integration is not enabled. Configure YOUTUBE_API_KEY to use YouTube search.'
          : 'YouTube API daily quota exhausted. Try again tomorrow or switch to Reddit.'
      });
    }

    // Run searches in parallel
    const promises = [];

    if (searchReddit) {
      promises.push(
        searchRedditByTopic(topic, timeRange || 'year', subreddits || '', limit || 15)
          .then(r => ({ _searchSource: 'reddit', ...r }))
          .catch(err => {
            console.error('Reddit search failed:', err.message);
            return { _searchSource: 'reddit', success: false, error: err.message, posts: [] };
          })
      );
    }

    if (searchYouTube) {
      const publishedAfter = timeRangeToPublishedAfter(timeRange || 'year');
      const ytLimit = Math.min(limit || 10, config.youtube?.searchMaxResults || 10);
      promises.push(
        searchVideos(topic, { maxResults: ytLimit, publishedAfter })
          .then(r => ({ _searchSource: 'youtube', ...r }))
          .catch(err => {
            console.error('YouTube search failed (non-fatal):', err.message);
            return { _searchSource: 'youtube', success: false, error: err.message, videos: [] };
          })
      );
    }

    const results = await Promise.all(promises);

    // Collect results from each source
    const redditResult = results.find(r => r._searchSource === 'reddit');
    const youtubeResult = results.find(r => r._searchSource === 'youtube');

    let allPosts = [];

    if (redditResult?.success && redditResult.posts) {
      allPosts.push(...redditResult.posts);
    }

    if (youtubeResult?.success && youtubeResult.videos?.length > 0) {
      const normalizedVideos = youtubeResult.videos.map(v => normalizeYouTubeVideo(v));
      allPosts.push(...normalizedVideos);
    }

    // Sort combined results by engagementScore descending
    allPosts.sort((a, b) => b.engagementScore - a.engagementScore);

    const response = {
      success: true,
      query: topic,
      timeRange: timeRange || 'year',
      sources: {
        reddit: {
          searched: searchReddit,
          found: redditResult?.posts?.length || 0
        },
        youtube: {
          searched: searchYouTube,
          found: youtubeResult?.videos?.length || 0,
          skipReason: searchYouTube ? null : youtubeSkipReason
        }
      },
      totalFound: allPosts.length,
      posts: allPosts
    };

    // Add role/goal context
    if (role) response.role = role;
    if (goal) response.goal = goal;

    // Include debug info from Reddit result if available
    if (redditResult?.debug) response.debug = redditResult.debug;
    if (redditResult?.filterStats) response.filterStats = redditResult.filterStats;

    res.json(response);

  } catch (error) {
    console.error('Topic search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/search/subreddit
 * Get top posts from a specific subreddit
 */
router.post('/subreddit', async (req, res) => {
  try {
    const { subreddit, timeRange, limit } = req.body;

    if (!subreddit) {
      return res.status(400).json({
        success: false,
        error: 'Subreddit is required'
      });
    }

    console.log('Subreddit search:', subreddit);

    const result = await searchSubredditTopPosts(
      subreddit,
      timeRange || 'week',
      limit || 15
    );

    res.json(result);

  } catch (error) {
    console.error('Subreddit search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/search/prescreen
 * AI pre-screen posts for relevance to research topic
 */
router.post('/prescreen', async (req, res) => {
  try {
    const { posts, topic, role, goal } = req.body;

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Posts array is required'
      });
    }

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required for pre-screening'
      });
    }

    console.log(`Pre-screening ${posts.length} posts for topic: "${topic}"`);

    const screenedPosts = await preScreenPosts(posts, topic, role, goal);

    res.json({
      success: true,
      originalCount: posts.length,
      screenedCount: screenedPosts.length,
      posts: screenedPosts
    });

  } catch (error) {
    console.error('Pre-screen error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/search/subreddit-info
 * Get subreddit info and activity level for Community Pulse
 */
router.post('/subreddit-info', async (req, res) => {
  try {
    const { subreddit } = req.body;

    if (!subreddit) {
      return res.status(400).json({
        success: false,
        error: 'Subreddit name is required'
      });
    }

    // Clean subreddit name (remove r/ if present)
    const cleanSubreddit = subreddit.replace(/^r\//, '').trim();

    console.log('Getting subreddit info for:', cleanSubreddit);

    const result = await getSubredditInfo(cleanSubreddit);

    res.json(result);

  } catch (error) {
    console.error('Subreddit info error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/search/subreddit-autocomplete
 * Search for subreddits matching a query (for autocomplete)
 */
router.get('/subreddit-autocomplete', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        subreddits: []
      });
    }

    // Clean query (remove r/ if present)
    const cleanQuery = q.replace(/^r\//, '').trim();

    console.log('Subreddit autocomplete search:', cleanQuery);

    // Use authenticated Reddit OAuth API to avoid rate limiting
    const { getRedditAccessToken } = require('../services/reddit');
    const accessToken = await getRedditAccessToken();

    const response = await fetch(
      `https://oauth.reddit.com/subreddits/search?q=${encodeURIComponent(cleanQuery)}&limit=8`,
      {
        headers: {
          'Authorization': `bearer ${accessToken}`,
          'User-Agent': 'VoiceOfCustomer/1.0'
        }
      }
    );

    if (!response.ok) {
      console.error('Reddit API response not ok:', response.status, response.statusText);
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract relevant subreddit info
    const subreddits = (data.data?.children || []).map(child => ({
      name: child.data.display_name,
      title: child.data.title,
      subscribers: child.data.subscribers,
      description: child.data.public_description?.substring(0, 100) || ''
    }));

    res.json({
      success: true,
      subreddits
    });

  } catch (error) {
    console.error('Subreddit autocomplete error:', error.message);
    // Return empty array on error so UI doesn't break
    res.json({
      success: true,
      subreddits: []
    });
  }
});

/**
 * POST /api/search/community-posts
 * Fetch time-bucketed posts for Community Pulse analysis
 */
router.post('/community-posts', async (req, res) => {
  try {
    const { subreddit, depth } = req.body;

    if (!subreddit) {
      return res.status(400).json({
        success: false,
        error: 'Subreddit name is required'
      });
    }

    // Clean subreddit name
    const cleanSubreddit = subreddit.replace(/^r\//, '').trim();

    console.log('Fetching community posts for:', cleanSubreddit, 'Depth:', depth);

    const result = await fetchTimeBucketedPosts(cleanSubreddit, depth || 'full');

    res.json(result);

  } catch (error) {
    console.error('Community posts error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
