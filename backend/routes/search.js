const express = require('express');
const router = express.Router();
const { searchRedditByTopic, searchSubredditTopPosts, getSubredditInfo, fetchTimeBucketedPosts } = require('../services/search');
const { preScreenPosts } = require('../services/mapReduceAnalysis');

/**
 * POST /api/search/topic
 * Search Reddit by topic/keywords with optional role/goal context
 */
router.post('/topic', async (req, res) => {
  try {
    const { topic, timeRange, subreddits, limit, role, goal } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      });
    }

    console.log('Topic search:', topic, 'Role:', role || 'not specified', 'Goal:', goal || 'not specified');

    const result = await searchRedditByTopic(
      topic,
      timeRange || 'week',
      subreddits || '',
      limit || 15
    );

    // Add role/goal context to result if provided
    if (result.success) {
      if (role) result.role = role;
      if (goal) result.goal = goal;
    }

    res.json(result);

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
