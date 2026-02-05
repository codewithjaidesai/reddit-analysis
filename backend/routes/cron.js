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
 * Verify cron request authenticity
 * Vercel cron jobs can be verified via CRON_SECRET or are from Vercel's IPs
 */
function verifyCronRequest(req) {
  const cronSecret = process.env.CRON_SECRET;

  // If no secret configured, allow all (for development)
  if (!cronSecret) {
    return true;
  }

  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Check for Vercel cron header (automatically set by Vercel)
  // When using Vercel cron, requests come from Vercel's infrastructure
  const userAgent = req.headers['user-agent'] || '';
  if (userAgent.includes('vercel-cron')) {
    return true;
  }

  return false;
}

/**
 * GET /api/cron/welcome-digests
 * Process pending welcome digests (called by Vercel Cron or manually)
 *
 * Can also be triggered manually via POST for testing
 */
router.get('/welcome-digests', processWelcomeDigests);
router.post('/welcome-digests', processWelcomeDigests);

async function processWelcomeDigests(req, res) {
  // Allow POST for manual testing, verify GET requests
  if (req.method === 'GET' && !verifyCronRequest(req)) {
    console.log('[Cron] Unauthorized cron request - check CRON_SECRET');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] ========================================');
  console.log('[Cron] Starting welcome digest processing...');
  console.log('[Cron] Time:', new Date().toISOString());

  try {
    // Get subscriptions that need welcome digests (never sent)
    const pendingSubscriptions = await db.getPendingWelcomeDigests(5); // Process max 5 per run

    if (pendingSubscriptions.length === 0) {
      console.log('[Cron] No pending welcome digests');
      console.log('[Cron] ========================================');
      return res.json({ success: true, processed: 0, message: 'No pending welcome digests' });
    }

    console.log(`[Cron] Found ${pendingSubscriptions.length} pending welcome digests:`);
    pendingSubscriptions.forEach(sub => {
      console.log(`[Cron]   - ${sub.email} -> r/${sub.subreddit} (created: ${sub.created_at})`);
    });

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
    console.log('[Cron] ========================================');

    res.json({
      success: true,
      processed: pendingSubscriptions.length,
      sent: successCount,
      failed: errorCount
    });

  } catch (error) {
    console.error('[Cron] Welcome digest cron error:', error);
    console.log('[Cron] ========================================');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/cron/scheduled-digests
 * Process scheduled daily/weekly digests (called by Vercel Cron)
 */
router.get('/scheduled-digests', processScheduledDigests);
router.post('/scheduled-digests', processScheduledDigests);

async function processScheduledDigests(req, res) {
  // Allow POST for manual testing, verify GET requests
  if (req.method === 'GET' && !verifyCronRequest(req)) {
    console.log('[Cron] Unauthorized scheduled digest request - check CRON_SECRET');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] ========================================');
  console.log('[Cron] Starting scheduled digest processing...');
  console.log('[Cron] Time:', new Date().toISOString());
  console.log('[Cron] Day of week (UTC):', new Date().getUTCDay(), '(0=Sunday)');

  try {
    // Get subscriptions due for digest
    const dueSubscriptions = await db.getSubscriptionsDueForDigest();

    if (dueSubscriptions.length === 0) {
      console.log('[Cron] No scheduled digests due');
      console.log('[Cron] ========================================');
      return res.json({ success: true, processed: 0, message: 'No digests due' });
    }

    console.log(`[Cron] Found ${dueSubscriptions.length} scheduled digests due:`);
    dueSubscriptions.forEach(sub => {
      console.log(`[Cron]   - ${sub.email} -> r/${sub.subreddit} (${sub.frequency})`);
    });

    let successCount = 0;
    let errorCount = 0;

    for (const sub of dueSubscriptions) {
      try {
        console.log(`[Cron] Processing scheduled digest for ${sub.email} - r/${sub.subreddit}...`);

        const digest = await generateDigest({
          subreddit: sub.subreddit,
          subscriptionId: sub.id,
          focusTopic: sub.focus_topic,
          frequency: sub.frequency
        });

        console.log(`[Cron] Digest generated for r/${sub.subreddit}, sending email...`);

        await sendDigestEmail({
          to: sub.email,
          subreddit: sub.subreddit,
          digest,
          unsubscribeToken: sub.unsubscribe_token,
          isWelcome: false
        });

        await db.updateSubscriptionLastSent(sub.id);
        successCount++;
        console.log(`[Cron] Successfully sent scheduled digest to ${sub.email}`);

      } catch (error) {
        console.error(`[Cron] Failed scheduled digest for ${sub.email}:`, error.message);
        errorCount++;
      }
    }

    console.log(`[Cron] Completed: ${successCount} sent, ${errorCount} failed`);
    console.log('[Cron] ========================================');

    res.json({
      success: true,
      processed: dueSubscriptions.length,
      sent: successCount,
      failed: errorCount
    });

  } catch (error) {
    console.error('[Cron] Scheduled digest cron error:', error);
    console.log('[Cron] ========================================');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = router;
