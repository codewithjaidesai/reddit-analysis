const express = require('express');
const router = express.Router();
const { searchRedditByTopic, searchSubredditTopPosts } = require('../services/search');

/**
 * POST /api/search/topic
 * Search Reddit by topic/keywords with optional research context
 */
router.post('/topic', async (req, res) => {
  try {
    const { topic, timeRange, subreddits, limit, template, researchQuestion, customKeywords } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      });
    }

    console.log('Topic search:', topic, 'Template:', template, 'Custom keywords:', customKeywords, 'Research question:', researchQuestion ? 'provided' : 'none');

    const result = await searchRedditByTopic(
      topic,
      timeRange || 'week',
      subreddits || '',
      limit || 15,
      template || 'all',
      customKeywords || ''
    );

    // Add research context to result if provided
    if (result.success && researchQuestion) {
      result.researchQuestion = researchQuestion;
      result.template = template || 'all';
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

module.exports = router;
