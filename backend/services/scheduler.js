/**
 * Digest Scheduler Service
 *
 * Handles automated digest generation and delivery.
 * Uses node-cron for scheduling.
 */

const cron = require('node-cron');
const db = require('./supabase');
const { generateDigest } = require('./contentRadar');
const { sendDigestEmail } = require('./emailService');

let scheduledJobs = {};

/**
 * Start the digest scheduler
 * Runs checks at configured intervals
 */
function startScheduler() {
  console.log('Starting Content Radar scheduler...');

  // Check for due digests every hour
  // In production, you might want more frequent checks
  scheduledJobs.hourlyCheck = cron.schedule('0 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running hourly digest check...`);
    await processScheduledDigests();
  });

  // Also run at 9 AM every day (common digest time)
  scheduledJobs.morningDigests = cron.schedule('0 9 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running morning digest delivery...`);
    await processScheduledDigests();
  });

  // Cache digests for popular subreddits weekly (Sunday at 6 AM)
  scheduledJobs.weeklyCache = cron.schedule('0 6 * * 0', async () => {
    console.log(`[${new Date().toISOString()}] Caching weekly digests...`);
    await cachePopularDigests();
  });

  console.log('Scheduler started. Jobs scheduled:');
  console.log('  - Hourly check: Every hour at :00');
  console.log('  - Morning digests: Daily at 9:00 AM');
  console.log('  - Weekly cache: Sundays at 6:00 AM');

  return scheduledJobs;
}

/**
 * Stop the scheduler
 */
function stopScheduler() {
  console.log('Stopping Content Radar scheduler...');
  for (const [name, job] of Object.entries(scheduledJobs)) {
    job.stop();
    console.log(`  - Stopped job: ${name}`);
  }
  scheduledJobs = {};
}

/**
 * Process all scheduled digests that are due
 */
async function processScheduledDigests() {
  try {
    // Get subscriptions due for delivery
    const subscriptionsDue = await db.getSubscriptionsDue();

    if (subscriptionsDue.length === 0) {
      console.log('No digests due at this time.');
      return { processed: 0, errors: 0 };
    }

    console.log(`Found ${subscriptionsDue.length} subscriptions due for digest.`);

    let processed = 0;
    let errors = 0;

    for (const subscription of subscriptionsDue) {
      try {
        await processSubscriptionDigest(subscription);
        processed++;
      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error);
        errors++;
      }

      // Small delay between processing to avoid rate limits
      await sleep(2000);
    }

    console.log(`Digest processing complete. Processed: ${processed}, Errors: ${errors}`);
    return { processed, errors };

  } catch (error) {
    console.error('Error in processScheduledDigests:', error);
    throw error;
  }
}

/**
 * Process a single subscription - generate and send digest
 */
async function processSubscriptionDigest(subscription) {
  const { id, email, subreddit, frequency, focus_topic, unsubscribe_token } = subscription;

  console.log(`Processing digest for ${email} - r/${subreddit} (${frequency})`);

  // Generate the digest
  const digest = await generateDigest({
    subreddit,
    subscriptionId: id,
    focusTopic: focus_topic,
    frequency
  });

  // Send the email
  await sendDigestEmail({
    to: email,
    subreddit,
    digest,
    unsubscribeToken: unsubscribe_token,
    isWelcome: false
  });

  // Mark subscription as sent
  await db.markSubscriptionSent(id);

  // Save to history
  await db.saveDigestHistory({
    subscriptionId: id,
    subreddit,
    periodStart: digest.periodStart,
    periodEnd: digest.periodEnd,
    topThemes: digest.emergingTopics || [],
    topPosts: extractTopPostIds(digest),
    metrics: digest.metrics,
    digestContent: digest
  });

  // Mark posts as seen
  const postIds = extractAllPostIds(digest);
  if (postIds.length > 0) {
    const history = await db.getLastDigest(id);
    if (history) {
      await db.markPostsSeen(id, postIds, history.id);
    }
  }

  console.log(`Successfully sent digest to ${email} for r/${subreddit}`);
}

/**
 * Send a welcome email immediately after subscription
 * This sends a simple welcome message to avoid serverless timeout
 * The first full digest will arrive on the scheduled day
 */
async function sendWelcomeDigest(subscription) {
  const { id, email, subreddit, frequency, unsubscribe_token } = subscription;

  console.log(`[Welcome Email] Starting for ${email} - r/${subreddit}`);

  try {
    // Send a simple welcome email (no AI generation to avoid timeout)
    const { sendWelcomeEmail } = require('./emailService');

    const result = await sendWelcomeEmail({
      to: email,
      subreddit,
      frequency: frequency || 'weekly',
      unsubscribeToken: unsubscribe_token
    });

    console.log(`[Welcome Email] Sent to ${email}:`, result);
    return { success: true, ...result };

  } catch (error) {
    console.error(`[Welcome Email] FAILED for ${email}:`, error.message);
    // Don't throw - welcome email failure shouldn't break subscription
    return { success: false, error: error.message };
  }
}

/**
 * Cache digests for popular subreddits
 * This runs weekly to pre-generate digests for fast welcome emails
 */
async function cachePopularDigests() {
  // Get list of subreddits with active subscriptions
  // For now, hardcode the initial subreddits
  const popularSubreddits = [
    'artificialintelligence',
    'recipes',
    'WeightLossAdvice',
    'menopause'
  ];

  console.log(`Caching digests for ${popularSubreddits.length} subreddits...`);

  for (const subreddit of popularSubreddits) {
    try {
      console.log(`Caching digest for r/${subreddit}...`);

      const digest = await generateDigest({
        subreddit,
        frequency: 'weekly'
      });

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

      console.log(`Cached digest for r/${subreddit}`);

      // Delay between subreddits
      await sleep(5000);

    } catch (error) {
      console.error(`Failed to cache digest for r/${subreddit}:`, error);
    }
  }

  console.log('Weekly caching complete.');
}

/**
 * Manually trigger digest generation for a subscription
 */
async function triggerDigest(subscriptionId) {
  const subscription = await db.getSubscriptionByToken(subscriptionId);
  // Note: This function expects a subscription object with token lookup
  // For ID lookup, you'd need to add that to the db module

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  return processSubscriptionDigest(subscription);
}

/**
 * Extract post IDs from digest for tracking
 */
function extractTopPostIds(digest) {
  const ids = [];

  if (digest.coverStory?.post?.id) {
    ids.push({ id: digest.coverStory.post.id, title: digest.coverStory.title });
  }
  if (digest.threadOfTheWeek?.post?.id) {
    ids.push({ id: digest.threadOfTheWeek.post.id, title: digest.threadOfTheWeek.title });
  }

  return ids.slice(0, 10);
}

/**
 * Extract all post IDs mentioned in digest
 */
function extractAllPostIds(digest) {
  const ids = [];

  if (digest.coverStory?.post?.id) ids.push(digest.coverStory.post.id);
  if (digest.threadOfTheWeek?.post?.id) ids.push(digest.threadOfTheWeek.post.id);

  return [...new Set(ids)];
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  startScheduler,
  stopScheduler,
  processScheduledDigests,
  sendWelcomeDigest,
  cachePopularDigests,
  triggerDigest
};
