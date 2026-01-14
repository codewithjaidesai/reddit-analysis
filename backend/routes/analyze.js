const express = require('express');
const router = express.Router();
const { extractRedditData } = require('../services/reddit');
const { generateAIInsights, generateCombinedInsights } = require('../services/insights');

/**
 * POST /api/analyze/extract
 * Extract high-value comments from a Reddit URL
 */
router.post('/extract', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    console.log('Extracting Reddit data from:', url);

    // Extract Reddit data
    const result = await extractRedditData(url);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Extract error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/analyze/insights
 * Generate AI insights from extracted data with role/goal context
 */
router.post('/insights', async (req, res) => {
  try {
    const { contentData, role, goal } = req.body;

    if (!contentData) {
      return res.status(400).json({
        success: false,
        error: 'Content data is required'
      });
    }

    console.log('Generating insights for post:', contentData.post?.title);
    if (role) {
      console.log('User role:', role);
    }
    if (goal) {
      console.log('User goal:', goal);
    }

    // Generate AI insights with role/goal context
    const insights = await generateAIInsights(contentData, role, goal);

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    console.error('Insights generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/analyze/full
 * Extract data AND generate insights in one call with role/goal context
 */
router.post('/full', async (req, res) => {
  try {
    const { url, role, goal } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    console.log('Full analysis for:', url);
    if (role) {
      console.log('User role:', role);
    }
    if (goal) {
      console.log('User goal:', goal);
    }

    // Step 1: Extract Reddit data
    const extractResult = await extractRedditData(url);

    if (!extractResult.success) {
      return res.status(400).json(extractResult);
    }

    // Step 2: Generate insights with role/goal context
    const insights = await generateAIInsights(extractResult.data, role, goal);

    res.json({
      success: true,
      extractedData: extractResult.data,
      insights: insights
    });

  } catch (error) {
    console.error('Full analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/analyze/combined
 * Extract data from multiple URLs and generate ONE combined analysis
 */
router.post('/combined', async (req, res) => {
  try {
    const { urls, role, goal } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URLs array is required'
      });
    }

    console.log(`Combined analysis for ${urls.length} posts`);
    if (role) console.log('User role:', role);
    if (goal) console.log('User goal:', goal);

    // Step 1: Extract data from all URLs in parallel
    const extractPromises = urls.map(url => extractRedditData(url));
    const extractResults = await Promise.all(extractPromises);

    // Separate successful and failed extractions
    const postsData = [];
    const posts = [];
    const failures = [];

    extractResults.forEach((result, idx) => {
      if (result.success) {
        postsData.push(result.data);
        posts.push({
          url: urls[idx],
          extractedData: result.data
        });
      } else {
        failures.push({
          url: urls[idx],
          error: result.error || 'Extraction failed'
        });
      }
    });

    if (postsData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'All extractions failed',
        failures
      });
    }

    // Step 2: Generate combined analysis
    const combinedInsights = await generateCombinedInsights(postsData, role, goal);

    res.json({
      success: true,
      combinedAnalysis: combinedInsights,
      posts,
      failures: failures.length > 0 ? failures : undefined
    });

  } catch (error) {
    console.error('Combined analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
