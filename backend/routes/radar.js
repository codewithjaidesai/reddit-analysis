/**
 * Content Radar API Routes
 * Handles subscriptions, digests, and subreddit info
 */

const express = require('express');
const router = express.Router();
const db = require('../services/supabase');
const { getSubredditInfo, fetchTimeBucketedPosts } = require('../services/search');
const { sendWelcomeDigest } = require('../services/scheduler');
const { generateDigest } = require('../services/contentRadar');

// ============================================
// SUBSCRIPTION ENDPOINTS
// ============================================

/**
 * POST /api/radar/subscribe
 * Create a new digest subscription
 */
router.post('/subscribe', async (req, res) => {
  try {
    const { email, subreddit, frequency, focusTopic } = req.body;

    // Validation
    if (!email || !subreddit) {
      return res.status(400).json({
        success: false,
        error: 'Email and subreddit are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate frequency
    if (frequency && !['daily', 'weekly'].includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: 'Frequency must be "daily" or "weekly"'
      });
    }

    // Normalize subreddit name
    const normalizedSubreddit = subreddit.replace(/^r\//, '').toLowerCase();

    // Verify subreddit exists
    let subredditInfo;
    try {
      subredditInfo = await getSubredditInfo(normalizedSubreddit);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: `Subreddit r/${normalizedSubreddit} not found or inaccessible`
      });
    }

    // Create subscription
    const subscription = await db.createSubscription({
      email,
      subreddit: normalizedSubreddit,
      frequency: frequency || 'weekly',
      focusTopic
    });

    // Try to get cached digest for welcome email
    let cachedDigest = null;
    try {
      cachedDigest = await db.getCachedDigest(normalizedSubreddit);
    } catch (err) {
      console.log('No cached digest available for welcome email');
    }

    // Calculate next digest date
    const nextDigestDate = calculateNextDigestDate(subscription.frequency, subscription.day_of_week);

    // Send welcome digest asynchronously (don't block response)
    let welcomeDigestSent = false;
    sendWelcomeDigest(subscription)
      .then(result => {
        console.log(`Welcome digest for ${subscription.email}: ${result.success ? 'sent' : 'failed'}`);
      })
      .catch(err => {
        console.error(`Welcome digest error for ${subscription.email}:`, err);
      });

    res.status(201).json({
      success: true,
      subscription: {
        id: subscription.id,
        email: subscription.email,
        subreddit: subscription.subreddit,
        frequency: subscription.frequency,
        focusTopic: subscription.focus_topic,
        createdAt: subscription.created_at
      },
      subredditInfo: {
        name: subredditInfo.subreddit,
        title: subredditInfo.title,
        subscribers: subredditInfo.subscribers,
        description: subredditInfo.description
      },
      nextDigestDate,
      welcomeDigestAvailable: !!cachedDigest,
      welcomeDigestSending: true,
      unsubscribeToken: subscription.unsubscribe_token
    });

  } catch (error) {
    console.error('Subscribe error:', error);

    // Handle duplicate subscription
    if (error.message?.includes('Already subscribed')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create subscription'
    });
  }
});

/**
 * GET /api/radar/subscriptions
 * Get all subscriptions for an email
 */
router.get('/subscriptions', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const subscriptions = await db.getSubscriptionsByEmail(email);

    res.json({
      success: true,
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        subreddit: s.subreddit,
        frequency: s.frequency,
        focusTopic: s.focus_topic,
        createdAt: s.created_at,
        lastSentAt: s.last_sent_at,
        unsubscribeToken: s.unsubscribe_token
      }))
    });

  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get subscriptions'
    });
  }
});

/**
 * PUT /api/radar/subscriptions/:id
 * Update a subscription
 */
router.put('/subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { frequency, focusTopic, dayOfWeek } = req.body;

    const updates = {};
    if (frequency) updates.frequency = frequency;
    if (focusTopic !== undefined) updates.focus_topic = focusTopic;
    if (dayOfWeek !== undefined) updates.day_of_week = dayOfWeek;

    const subscription = await db.updateSubscription(id, updates);

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        subreddit: subscription.subreddit,
        frequency: subscription.frequency,
        focusTopic: subscription.focus_topic,
        dayOfWeek: subscription.day_of_week
      }
    });

  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update subscription'
    });
  }
});

/**
 * GET /api/radar/unsubscribe
 * Unsubscribe using token (GET for email link compatibility)
 */
router.get('/unsubscribe', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Unsubscribe token is required'
      });
    }

    // Get subscription info first
    const subscription = await db.getSubscriptionByToken(token);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      subscription: {
        email: subscription.email,
        subreddit: subscription.subreddit,
        isActive: subscription.is_active
      }
    });

  } catch (error) {
    console.error('Get unsubscribe info error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get subscription info'
    });
  }
});

/**
 * POST /api/radar/unsubscribe
 * Confirm unsubscribe
 */
router.post('/unsubscribe', async (req, res) => {
  try {
    const { token, reason } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Unsubscribe token is required'
      });
    }

    const success = await db.unsubscribe(token, reason);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found or already unsubscribed'
      });
    }

    res.json({
      success: true,
      message: 'Successfully unsubscribed'
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to unsubscribe'
    });
  }
});

/**
 * POST /api/radar/resubscribe
 * Reactivate a subscription
 */
router.post('/resubscribe', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    const subscription = await db.resubscribe(token);

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        email: subscription.email,
        subreddit: subscription.subreddit,
        frequency: subscription.frequency
      }
    });

  } catch (error) {
    console.error('Resubscribe error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resubscribe'
    });
  }
});

// ============================================
// SUBREDDIT INFO ENDPOINTS
// ============================================

/**
 * GET /api/radar/subreddit/:name
 * Get subreddit info with activity classification
 */
router.get('/subreddit/:name', async (req, res) => {
  try {
    const subreddit = req.params.name.replace(/^r\//, '').toLowerCase();

    // Get basic subreddit info
    const info = await getSubredditInfo(subreddit);

    // Try to get cached stats
    let stats = await db.getSubredditStats(subreddit);

    // If no cached stats or stale (> 24 hours), calculate fresh
    const isStale = !stats || (Date.now() - new Date(stats.last_updated).getTime() > 24 * 60 * 60 * 1000);

    if (isStale) {
      // Fetch recent posts to calculate activity
      try {
        const { buckets } = await fetchTimeBucketedPosts(subreddit, 'quick'); // 30 days
        const totalPosts = buckets.reduce((sum, b) => sum + b.posts.length, 0);
        const postsPerDay = totalPosts / 30;

        const allPosts = buckets.flatMap(b => b.posts);
        const avgComments = allPosts.length > 0
          ? allPosts.reduce((sum, p) => sum + (p.numComments || 0), 0) / allPosts.length
          : 0;

        // Classify activity
        const activityScore = postsPerDay * (1 + avgComments / 50);
        let activityLevel, recommendedFrequency, reason;

        if (activityScore > 200) {
          activityLevel = 'high';
          recommendedFrequency = 'daily';
          reason = 'High-activity community. Daily keeps you ahead of trends.';
        } else if (activityScore > 50) {
          activityLevel = 'medium';
          recommendedFrequency = 'weekly';
          reason = 'Moderate activity. Weekly captures the best without noise.';
        } else {
          activityLevel = 'low';
          recommendedFrequency = 'weekly';
          reason = 'Thoughtful community. Weekly digest is ideal.';
        }

        // Save stats
        stats = await db.saveSubredditStats({
          subreddit,
          subscribers: info.subscribers,
          postsPerDay,
          avgCommentsPerPost: avgComments,
          activityLevel,
          recommendedFrequency
        });

        stats.reason = reason;
      } catch (err) {
        console.error('Error calculating activity stats:', err);
        // Return basic info without stats
        stats = {
          activity_level: 'unknown',
          recommended_frequency: 'weekly',
          reason: 'Unable to calculate activity level.'
        };
      }
    }

    res.json({
      success: true,
      subreddit: {
        name: info.subreddit,
        title: info.title,
        description: info.description,
        subscribers: info.subscribers,
        created: info.created,
        postsPerDay: info.postsPerDay,
        activityLevel: info.activityLevel
      },
      activity: {
        level: stats?.activity_level || info.activityLevel,
        postsPerDay: stats?.posts_per_day || info.postsPerDay,
        avgCommentsPerPost: stats?.avg_comments_per_post,
        recommendedFrequency: stats?.recommended_frequency || (info.activityLevel === 'high' ? 'daily' : 'weekly'),
        reason: stats?.reason || getActivityReason(stats?.activity_level || info.activityLevel)
      }
    });

  } catch (error) {
    console.error('Get subreddit info error:', error);

    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return res.status(404).json({
        success: false,
        error: `Subreddit r/${req.params.name} not found`
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get subreddit info'
    });
  }
});

// ============================================
// DIGEST ENDPOINTS
// ============================================

/**
 * GET /api/radar/digest/:subreddit/latest
 * Get the latest cached digest for a subreddit
 */
router.get('/digest/:subreddit/latest', async (req, res) => {
  try {
    const subreddit = req.params.subreddit.replace(/^r\//, '').toLowerCase();

    const cached = await db.getCachedDigest(subreddit);

    if (!cached) {
      return res.status(404).json({
        success: false,
        error: `No cached digest found for r/${subreddit}`
      });
    }

    res.json({
      success: true,
      digest: {
        subreddit: cached.subreddit,
        weekStart: cached.week_start,
        weekEnd: cached.week_end,
        generatedAt: cached.generated_at,
        content: cached.digest_content
      }
    });

  } catch (error) {
    console.error('Get digest error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get digest'
    });
  }
});

/**
 * GET /api/radar/digest/:subreddit/history
 * Get digest history for a subreddit
 */
router.get('/digest/:subreddit/history', async (req, res) => {
  try {
    const subreddit = req.params.subreddit.replace(/^r\//, '').toLowerCase();
    const limit = parseInt(req.query.limit) || 10;

    const history = await db.getDigestHistoryBySubreddit(subreddit, limit);

    res.json({
      success: true,
      history: history.map(h => ({
        id: h.id,
        periodStart: h.period_start,
        periodEnd: h.period_end,
        sentAt: h.sent_at,
        metrics: h.metrics,
        topThemes: h.top_themes
      }))
    });

  } catch (error) {
    console.error('Get digest history error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get digest history'
    });
  }
});

/**
 * GET /api/radar/health
 * Health check for Content Radar
 */
router.get('/health', async (req, res) => {
  const dbConnected = await db.isConnected();

  res.json({
    success: true,
    status: 'healthy',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate when the next digest will be sent
 */
function calculateNextDigestDate(frequency, dayOfWeek = 0) {
  const now = new Date();

  if (frequency === 'daily') {
    // Next day at 9 AM
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    return next.toISOString();
  }

  // Weekly: find next occurrence of dayOfWeek
  const currentDay = now.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;

  const next = new Date(now);
  next.setDate(next.getDate() + daysUntil);
  next.setHours(9, 0, 0, 0);
  return next.toISOString();
}

/**
 * Get activity reason text
 */
function getActivityReason(level) {
  switch (level) {
    case 'high':
      return 'High-activity community. Daily keeps you ahead of trends.';
    case 'medium':
      return 'Moderate activity. Weekly captures the best without noise.';
    case 'low':
      return 'Thoughtful community. Weekly digest is ideal.';
    default:
      return 'Weekly digest recommended.';
  }
}

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * POST /api/radar/admin/generate
 * Manually generate a digest (for testing)
 */
router.post('/admin/generate', async (req, res) => {
  try {
    const { subreddit, frequency = 'weekly', focusTopic } = req.body;

    if (!subreddit) {
      return res.status(400).json({
        success: false,
        error: 'Subreddit is required'
      });
    }

    console.log(`Admin: Generating digest for r/${subreddit}...`);

    const digest = await generateDigest({
      subreddit,
      focusTopic,
      frequency
    });

    // Optionally cache it
    if (req.body.cache) {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);

      await db.cacheDigest({
        subreddit,
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: now.toISOString().split('T')[0],
        digestContent: digest,
        postCount: digest.metrics?.totalPosts,
        commentCount: digest.metrics?.totalComments
      });
    }

    res.json({
      success: true,
      digest
    });

  } catch (error) {
    console.error('Admin generate error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate digest'
    });
  }
});

/**
 * POST /api/radar/admin/cache-all
 * Cache digests for all popular subreddits
 */
router.post('/admin/cache-all', async (req, res) => {
  const { cachePopularDigests } = require('../services/scheduler');

  try {
    // Run in background
    cachePopularDigests()
      .then(() => console.log('Cache-all completed'))
      .catch(err => console.error('Cache-all error:', err));

    res.json({
      success: true,
      message: 'Caching started in background'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
