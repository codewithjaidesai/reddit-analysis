const express = require('express');
const router = express.Router();
const { extractRedditData } = require('../services/reddit');
const { generateAIInsights } = require('../services/insights');

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
 * Generate AI insights from extracted data
 */
router.post('/insights', async (req, res) => {
  try {
    const { contentData } = req.body;

    if (!contentData) {
      return res.status(400).json({
        success: false,
        error: 'Content data is required'
      });
    }

    console.log('Generating insights for post:', contentData.post?.title);

    // Generate AI insights
    const insights = await generateAIInsights(contentData);

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
 * Extract data AND generate insights in one call
 */
router.post('/full', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    console.log('Full analysis for:', url);

    // Step 1: Extract Reddit data
    const extractResult = await extractRedditData(url);

    if (!extractResult.success) {
      return res.status(400).json(extractResult);
    }

    // Step 2: Generate insights
    const insights = await generateAIInsights(extractResult.data);

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

module.exports = router;
