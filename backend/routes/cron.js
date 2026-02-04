/**
 * Cron Job Routes
 * Handles scheduled tasks like sending welcome digests
 */

const express = require('express');
const router = express.Router();
const db = require('../services/supabase');
const { generateDigest } = require('../services/contentRadar');
const { sendDigestEmail } = require('../services/emailService');

/**
 * GET /api/cron/welcome-digests
 * Process pending welcome digests (called by Vercel Cron)
 */
router.get('/welcome-digests', async (req, res) => {
  // Verify cron secret (Vercel adds this header)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Cron] Unauthorized cron request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] Starting welcome digest processing...');

  try {
    // Get subscriptions that need welcome digests (never sent, created in last 24 hours)
    const pendingSubscriptions = await db.getPendingWelcomeDigests(2); // Process max 2 per run

    if (pendingSubscriptions.length === 0) {
      console.log('[Cron] No pending welcome digests');
      return res.json({ success: true, processed: 0 });
    }

    console.log(`[Cron] Found ${pendingSubscriptions.length} pending welcome digests`);

    let successCount = 0;
    let errorCount = 0;

    for (const sub of pendingSubscriptions) {
      try {
        console.log(`[Cron] Processing welcome digest for ${sub.email} - r/${sub.subreddit}`);

        // Generate the digest
        const digest = await generateDigest({
          subreddit: sub.subreddit,
          subscriptionId: sub.id,
          focusTopic: sub.focus_topic,
          frequency: sub.frequency
        });

        console.log(`[Cron] Digest generated for r/${sub.subreddit}`);

        // Send the welcome digest email
        await sendDigestEmail({
          to: sub.email,
          subreddit: sub.subreddit,
          digest,
          unsubscribeToken: sub.unsubscribe_token,
          isWelcome: true
        });

        // Mark as sent
        await db.updateSubscriptionLastSent(sub.id);

        console.log(`[Cron] Welcome digest sent to ${sub.email}`);
        successCount++;

      } catch (error) {
        console.error(`[Cron] Failed to process ${sub.email}:`, error.message);
        errorCount++;
      }
    }

    console.log(`[Cron] Completed: ${successCount} sent, ${errorCount} failed`);

    res.json({
      success: true,
      processed: pendingSubscriptions.length,
      sent: successCount,
      failed: errorCount
    });

  } catch (error) {
    console.error('[Cron] Welcome digest cron error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cron/scheduled-digests
 * Process scheduled daily/weekly digests (called by Vercel Cron)
 */
router.get('/scheduled-digests', async (req, res) => {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] Starting scheduled digest processing...');

  try {
    // Get subscriptions due for digest
    const dueSubscriptions = await db.getSubscriptionsDueForDigest();

    if (dueSubscriptions.length === 0) {
      console.log('[Cron] No scheduled digests due');
      return res.json({ success: true, processed: 0 });
    }

    console.log(`[Cron] Found ${dueSubscriptions.length} scheduled digests due`);

    let successCount = 0;

    for (const sub of dueSubscriptions) {
      try {
        const digest = await generateDigest({
          subreddit: sub.subreddit,
          subscriptionId: sub.id,
          focusTopic: sub.focus_topic,
          frequency: sub.frequency
        });

        await sendDigestEmail({
          to: sub.email,
          subreddit: sub.subreddit,
          digest,
          unsubscribeToken: sub.unsubscribe_token,
          isWelcome: false
        });

        await db.updateSubscriptionLastSent(sub.id);
        successCount++;

      } catch (error) {
        console.error(`[Cron] Failed scheduled digest for ${sub.email}:`, error.message);
      }
    }

    res.json({
      success: true,
      processed: dueSubscriptions.length,
      sent: successCount
    });

  } catch (error) {
    console.error('[Cron] Scheduled digest cron error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
