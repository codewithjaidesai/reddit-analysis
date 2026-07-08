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
const { encodeRadarTarget, parseRadarTarget, VALID_TYPES } = require('../services/radarTypes');

// ============================================
// SUBSCRIPTION ENDPOINTS
// ============================================

/**
 * POST /api/radar/subscribe
 * Create a new digest subscription
 */
router.post('/subscribe', async (req, res) => {
  try {
    const { email, subreddit, frequency, focusTopic, radarType, query } = req.body;

    // Radar type: 'subreddit' (default), 'topic', 'leads', or 'learning'.
    // Query-based radars use `query`; community radars use `subreddit`.
    const type = radarType || 'subreddit';
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid radar type. Must be one of: ${VALID_TYPES.join(', ')}`
      });
    }
    const isQueryRadar = type !== 'subreddit';
    const rawTarget = isQueryRadar ? query : subreddit;

    // Validation
    if (!email || !rawTarget) {
      return res.status(400).json({
        success: false,
        error: isQueryRadar ? 'Email and query are required' : 'Email and subreddit are required'
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

    let storedTarget;
    let subredditInfo = null;

    if (isQueryRadar) {
      const cleanQuery = rawTarget.trim().toLowerCase();
      // Encoded target must fit the subreddit column (VARCHAR(100))
      if (cleanQuery.length < 3 || cleanQuery.length > 90) {
        return res.status(400).json({
          success: false,
          error: 'Query must be between 3 and 90 characters'
        });
      }
      storedTarget = encodeRadarTarget(type, cleanQuery);
    } else {
      // Normalize subreddit name
      const normalizedSubreddit = subreddit.replace(/^r\//, '').toLowerCase();

      // Verify subreddit exists
      try {
        subredditInfo = await getSubredditInfo(normalizedSubreddit);
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: `Subreddit r/${normalizedSubreddit} not found or inaccessible`
        });
      }
      storedTarget = normalizedSubreddit;
    }

    // Create subscription
    const subscription = await db.createSubscription({
      email,
      subreddit: storedTarget,
      frequency: frequency || 'weekly',
      focusTopic
    });

    // Try to get cached digest for welcome email
    let cachedDigest = null;
    try {
      cachedDigest = await db.getCachedDigest(storedTarget);
    } catch (err) {
      console.log('No cached digest available for welcome email');
    }

    // Calculate next digest date
    const nextDigestDate = calculateNextDigestDate(subscription.frequency, subscription.day_of_week);

    // Try to send welcome email (wait for result with timeout)
    let welcomeEmailResult = { success: false, error: 'Not attempted' };
    try {
      // Set a timeout of 8 seconds for the welcome email
      const emailPromise = sendWelcomeDigest(subscription);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email timeout')), 8000)
      );

      welcomeEmailResult = await Promise.race([emailPromise, timeoutPromise]);
      console.log(`Welcome email for ${subscription.email}: ${welcomeEmailResult.success ? 'sent' : 'failed'}`);
    } catch (err) {
      console.error(`Welcome email error for ${subscription.email}:`, err.message);
      welcomeEmailResult = { success: false, error: err.message };
    }

    res.status(201).json({
      success: true,
      subscription: {
        id: subscription.id,
        email: subscription.email,
        subreddit: subscription.subreddit,
        radarType: type,
        target: parseRadarTarget(subscription.subreddit).target,
        frequency: subscription.frequency,
        focusTopic: subscription.focus_topic,
        createdAt: subscription.created_at
      },
      subredditInfo: subredditInfo ? {
        name: subredditInfo.subreddit,
        title: subredditInfo.title,
        subscribers: subredditInfo.subscribers,
        description: subredditInfo.description,
        // Use activity from getSubredditInfo (same as Community Pulse)
        activityLevel: subredditInfo.activityLevel,
        postsPerDay: subredditInfo.postsPerDay
      } : null,
      nextDigestDate,
      welcomeEmailSent: welcomeEmailResult.success,
      welcomeEmailError: welcomeEmailResult.error,
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
 * Uses same logic as Community Pulse for consistency
 */
router.get('/subreddit/:name', async (req, res) => {
  try {
    const subreddit = req.params.name.replace(/^r\//, '').trim();

    console.log(`[Radar] Fetching subreddit info for: ${subreddit}`);

    // Get subreddit info - same function used by Community Pulse
    // This already calculates activity level based on posts per day
    const info = await getSubredditInfo(subreddit);

    console.log(`[Radar] Info received:`, {
      name: info.subreddit,
      subscribers: info.subscribers,
      postsPerDay: info.postsPerDay,
      activityLevel: info.activityLevel
    });

    // Determine recommendation based on activity
    const activityLevel = info.activityLevel || 'medium';
    const recommendedFrequency = activityLevel === 'high' ? 'daily' : 'weekly';
    const reason = getActivityReason(activityLevel);

    res.json({
      success: true,
      subreddit: {
        name: info.subreddit,
        title: info.title,
        description: info.description,
        subscribers: info.subscribers || 0,
        created: info.created,
        postsPerDay: info.postsPerDay || 0,
        activityLevel: activityLevel
      },
      activity: {
        level: activityLevel,
        postsPerDay: info.postsPerDay || 0,
        recommendedFrequency,
        reason
      }
    });

  } catch (error) {
    console.error('[Radar] Get subreddit info error:', error);

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
    // Accepts plain subreddit names or encoded query-radar targets
    const raw = req.params.subreddit.replace(/^r\//, '').toLowerCase();
    const { radarDisplayLabel } = require('../services/radarTypes');

    const cached = await db.getCachedDigest(raw);

    if (!cached) {
      return res.status(404).json({
        success: false,
        error: `No cached digest found for ${radarDisplayLabel(raw)}`
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
 * POST /api/radar/send-preview
 * Send a preview digest to the subscriber (for manual triggering)
 */
router.post('/send-preview', async (req, res) => {
  try {
    const { subscriptionId, token } = req.body;

    if (!subscriptionId && !token) {
      return res.status(400).json({
        success: false,
        error: 'Either subscriptionId or token is required'
      });
    }

    // Get subscription
    let subscription;
    if (token) {
      subscription = await db.getSubscriptionByToken(token);
    } else {
      subscription = await db.getSubscriptionById(subscriptionId);
    }

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    if (!subscription.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Subscription is not active'
      });
    }

    // Decode radar type from the stored target (topic:/leads:/learn: prefix)
    const { type: radarType, target } = parseRadarTarget(subscription.subreddit);

    console.log(`[Preview] Generating ${radarType} digest for ${subscription.email} - ${target}...`);

    let digest;
    if (radarType === 'leads') {
      // Lead radar has its own pipeline and email template
      const { generateLeadDigest } = require('../services/leadRadar');
      const { sendLeadDigestEmail } = require('../services/emailService');
      digest = await generateLeadDigest({
        query: target,
        frequency: subscription.frequency,
        isPreview: true
      });

      if (digest.quiet) {
        // Never send a blank email — tell the user what's happening instead
        return res.json({
          success: true,
          quiet: true,
          message: `No one is asking for "${target}" right now (scanned ${digest.scanned} fresh posts). Your radar is live — you'll get an email the moment a qualified lead appears.`
        });
      }

      await sendLeadDigestEmail({
        to: subscription.email,
        query: target,
        leadDigest: digest,
        unsubscribeToken: subscription.unsubscribe_token
      });
    } else {
      // Generate the digest with isPreview flag: 7-day window, widening to a
      // month for query radars when the week is thin
      digest = await generateDigest({
        subreddit: target,
        radarType,
        subscriptionId: subscription.id,
        focusTopic: subscription.focus_topic,
        frequency: subscription.frequency,
        isPreview: true
      });

      // Never send a blank email — quiet query radars and empty community
      // digests get an honest status message instead
      const hasContent = !digest.quiet && (digest.metrics?.totalPosts || 0) > 0;
      if (!hasContent) {
        return res.json({
          success: true,
          quiet: true,
          message: radarType === 'subreddit'
            ? `r/${target} had no significant activity recently. Your radar is live — the next active period will land in your inbox.`
            : `Not enough genuinely relevant discussion about "${target}" in the last month to fill a digest. Your radar is live and checks continuously — you'll get an email when there's real signal (we never pad with off-topic posts).`
        });
      }

      // Send the email
      const { sendDigestEmail } = require('../services/emailService');
      await sendDigestEmail({
        to: subscription.email,
        subreddit: target,
        digest,
        unsubscribeToken: subscription.unsubscribe_token,
        isWelcome: true // Mark as welcome so it shows the banner
      });
    }

    // Update last_sent_at so subscription enters the regular digest cycle.
    // Without this, scheduled digests would never find this subscription.
    try {
      await db.updateSubscriptionLastSent(subscription.id);
      console.log(`[Preview] Updated last_sent_at for subscription ${subscription.id}`);
    } catch (dbError) {
      console.error(`[Preview] Failed to update last_sent_at:`, dbError.message);
    }

    console.log(`[Preview] Successfully sent digest preview to ${subscription.email}`);

    res.json({
      success: true,
      message: `Preview digest sent to ${subscription.email}`,
      digest: {
        subreddit: subscription.subreddit,
        periodStart: digest.periodStart,
        periodEnd: digest.periodEnd,
        quickHitsCount: digest.quickHits?.length || 0,
        hasCoverStory: !!digest.coverStory,
        contentIdeasCount: digest.contentIdeas?.length || 0
      }
    });

  } catch (error) {
    console.error('Send preview error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send preview digest'
    });
  }
});

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

    // Accepts encoded targets too (topic:/leads:/learn: prefixes)
    const { type: radarType, target } = parseRadarTarget(subreddit);
    console.log(`Admin: Generating ${radarType} digest for ${target}...`);

    const digest = await generateDigest({
      subreddit: target,
      radarType,
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
