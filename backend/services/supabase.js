/**
 * Supabase Client Service
 * Handles all database operations for Content Radar
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Warning: Supabase credentials not configured. Database features will not work.');
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * Generate a secure unsubscribe token
 */
function generateUnsubscribeToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================
// SUBSCRIPTION OPERATIONS
// ============================================

/**
 * Create a new subscription or reactivate an inactive one
 * @param {Object} params - Subscription parameters
 * @param {string} params.email - User's email
 * @param {string} params.subreddit - Subreddit name (without r/)
 * @param {string} params.frequency - 'daily' or 'weekly'
 * @param {string} [params.focusTopic] - Optional focus topic for personalization
 * @returns {Promise<Object>} Created or reactivated subscription
 */
async function createSubscription({ email, subreddit, frequency = 'weekly', focusTopic = null }) {
  if (!supabase) throw new Error('Database not configured');

  // Normalize inputs
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedSubreddit = subreddit.replace(/^r\//, '').toLowerCase();

  // First, check if there's an existing subscription (active or inactive)
  const { data: existing, error: checkError } = await supabase
    .from('digest_subscriptions')
    .select('*')
    .eq('email', normalizedEmail)
    .eq('subreddit', normalizedSubreddit)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    throw checkError;
  }

  // If exists and active, throw error
  if (existing && existing.is_active) {
    throw new Error(`Already subscribed to r/${normalizedSubreddit}`);
  }

  // If exists but inactive, reactivate it
  if (existing && !existing.is_active) {
    const { data: reactivated, error: reactivateError } = await supabase
      .from('digest_subscriptions')
      .update({
        is_active: true,
        frequency,
        focus_topic: focusTopic,
        unsubscribed_at: null,
        unsubscribe_reason: null,
        last_sent_at: null // Reset so they get welcome digest
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (reactivateError) throw reactivateError;
    console.log(`Reactivated subscription for ${normalizedEmail} to r/${normalizedSubreddit}`);
    return reactivated;
  }

  // Create new subscription
  const unsubscribeToken = generateUnsubscribeToken();

  const { data, error } = await supabase
    .from('digest_subscriptions')
    .insert({
      email: normalizedEmail,
      subreddit: normalizedSubreddit,
      frequency,
      focus_topic: focusTopic,
      unsubscribe_token: unsubscribeToken,
      day_of_week: 0 // Sunday for weekly digests
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Already subscribed to r/${normalizedSubreddit}`);
    }
    throw error;
  }

  return data;
}

/**
 * Get all subscriptions for an email
 * @param {string} email - User's email
 * @returns {Promise<Array>} List of subscriptions
 */
async function getSubscriptionsByEmail(email) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('digest_subscriptions')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get a subscription by its unsubscribe token
 * @param {string} token - Unsubscribe token
 * @returns {Promise<Object|null>} Subscription or null
 */
async function getSubscriptionByToken(token) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('digest_subscriptions')
    .select('*')
    .eq('unsubscribe_token', token)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data || null;
}

/**
 * Get subscription by ID
 * @param {string} id - Subscription ID
 * @returns {Promise<Object|null>}
 */
async function getSubscriptionById(id) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('digest_subscriptions')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

/**
 * Unsubscribe using token
 * @param {string} token - Unsubscribe token
 * @param {string} [reason] - Optional reason for unsubscribing
 * @returns {Promise<boolean>} Success
 */
async function unsubscribe(token, reason = null) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('digest_subscriptions')
    .update({
      is_active: false,
      unsubscribed_at: new Date().toISOString(),
      unsubscribe_reason: reason
    })
    .eq('unsubscribe_token', token)
    .eq('is_active', true)
    .select()
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}

/**
 * Resubscribe (reactivate) using token
 * @param {string} token - Unsubscribe token
 * @returns {Promise<Object|null>} Reactivated subscription
 */
async function resubscribe(token) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('digest_subscriptions')
    .update({
      is_active: true,
      unsubscribed_at: null,
      unsubscribe_reason: null
    })
    .eq('unsubscribe_token', token)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update subscription settings
 * @param {string} id - Subscription ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated subscription
 */
async function updateSubscription(id, updates) {
  if (!supabase) throw new Error('Database not configured');

  const allowedFields = ['frequency', 'focus_topic', 'day_of_week'];
  const filteredUpdates = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  }

  const { data, error } = await supabase
    .from('digest_subscriptions')
    .update(filteredUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all subscriptions due for digest delivery
 * @returns {Promise<Array>} Subscriptions that need digests sent
 */
async function getSubscriptionsDue() {
  if (!supabase) throw new Error('Database not configured');

  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  const twentyThreeHoursAgo = new Date(now - 23 * 60 * 60 * 1000).toISOString();
  const sixDaysAgo = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString();

  // Get weekly subscriptions due today
  const { data: weeklyDue, error: weeklyError } = await supabase
    .from('digest_subscriptions')
    .select('*')
    .eq('is_active', true)
    .eq('frequency', 'weekly')
    .eq('day_of_week', dayOfWeek)
    .or(`last_sent_at.is.null,last_sent_at.lt.${sixDaysAgo}`);

  if (weeklyError) throw weeklyError;

  // Get daily subscriptions due
  const { data: dailyDue, error: dailyError } = await supabase
    .from('digest_subscriptions')
    .select('*')
    .eq('is_active', true)
    .eq('frequency', 'daily')
    .or(`last_sent_at.is.null,last_sent_at.lt.${twentyThreeHoursAgo}`);

  if (dailyError) throw dailyError;

  return [...(weeklyDue || []), ...(dailyDue || [])];
}

/**
 * Mark subscription as sent
 * @param {string} id - Subscription ID
 * @returns {Promise<void>}
 */
async function markSubscriptionSent(id) {
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('digest_subscriptions')
    .update({ last_sent_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// DIGEST HISTORY OPERATIONS
// ============================================

/**
 * Save digest to history
 * @param {Object} params - Digest history parameters
 * @returns {Promise<Object>} Created history record
 */
async function saveDigestHistory({
  subscriptionId,
  subreddit,
  periodStart,
  periodEnd,
  topThemes,
  topPosts,
  metrics,
  digestContent
}) {
  if (!supabase) throw new Error('Database not configured');

  const contentHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(digestContent))
    .digest('hex')
    .substring(0, 64);

  const { data, error } = await supabase
    .from('digest_history')
    .insert({
      subscription_id: subscriptionId,
      subreddit,
      period_start: periodStart,
      period_end: periodEnd,
      top_themes: topThemes,
      top_posts: topPosts,
      metrics,
      digest_content: digestContent,
      content_hash: contentHash
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get last digest for a subscription
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object|null>} Last digest or null
 */
async function getLastDigest(subscriptionId) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('digest_history')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

/**
 * Get digest history for a subreddit
 * @param {string} subreddit - Subreddit name
 * @param {number} limit - Max records to return
 * @returns {Promise<Array>} Digest history
 */
async function getDigestHistoryBySubreddit(subreddit, limit = 10) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('digest_history')
    .select('*')
    .eq('subreddit', subreddit.toLowerCase())
    .order('period_end', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ============================================
// DIGEST CACHE OPERATIONS
// ============================================

/**
 * Cache a digest for welcome emails
 * @param {Object} params - Cache parameters
 * @returns {Promise<Object>} Cached digest
 */
async function cacheDigest({ subreddit, weekStart, weekEnd, digestContent, htmlContent, postCount, commentCount }) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('digest_cache')
    .upsert({
      subreddit: subreddit.toLowerCase(),
      week_start: weekStart,
      week_end: weekEnd,
      digest_content: digestContent,
      html_content: htmlContent,
      post_count: postCount,
      comment_count: commentCount,
      generated_at: new Date().toISOString()
    }, {
      onConflict: 'subreddit,week_start'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get cached digest for a subreddit
 * @param {string} subreddit - Subreddit name
 * @returns {Promise<Object|null>} Cached digest or null
 */
async function getCachedDigest(subreddit) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('digest_cache')
    .select('*')
    .eq('subreddit', subreddit.toLowerCase())
    .order('week_start', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

// ============================================
// SEEN POSTS OPERATIONS
// ============================================

/**
 * Mark posts as seen for a subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {Array<string>} postIds - Reddit post IDs
 * @param {string} digestId - Digest history ID
 * @returns {Promise<void>}
 */
async function markPostsSeen(subscriptionId, postIds, digestId) {
  if (!supabase) throw new Error('Database not configured');

  const records = postIds.map(postId => ({
    subscription_id: subscriptionId,
    post_id: postId,
    included_in_digest_id: digestId
  }));

  const { error } = await supabase
    .from('digest_seen_posts')
    .upsert(records, {
      onConflict: 'subscription_id,post_id',
      ignoreDuplicates: true
    });

  if (error) throw error;
}

/**
 * Get seen post IDs for a subscription
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Set<string>>} Set of seen post IDs
 */
async function getSeenPostIds(subscriptionId) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('digest_seen_posts')
    .select('post_id')
    .eq('subscription_id', subscriptionId);

  if (error) throw error;
  return new Set((data || []).map(r => r.post_id));
}

// ============================================
// SUBREDDIT STATS OPERATIONS
// ============================================

/**
 * Save or update subreddit stats
 * @param {Object} stats - Subreddit statistics
 * @returns {Promise<Object>} Saved stats
 */
async function saveSubredditStats({
  subreddit,
  subscribers,
  postsPerDay,
  avgCommentsPerPost,
  activityLevel,
  recommendedFrequency
}) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('subreddit_stats')
    .upsert({
      subreddit: subreddit.toLowerCase(),
      subscribers,
      posts_per_day: postsPerDay,
      avg_comments_per_post: avgCommentsPerPost,
      activity_level: activityLevel,
      recommended_frequency: recommendedFrequency,
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'subreddit'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get subreddit stats
 * @param {string} subreddit - Subreddit name
 * @returns {Promise<Object|null>} Stats or null
 */
async function getSubredditStats(subreddit) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('subreddit_stats')
    .select('*')
    .eq('subreddit', subreddit.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if database is configured and connected
 * @returns {Promise<boolean>}
 */
async function isConnected() {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('digest_subscriptions')
      .select('id')
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}

// ============================================
// CRON JOB OPERATIONS
// ============================================

/**
 * Get subscriptions that need welcome digests
 * (active, never sent, created within last 24 hours)
 * @param {number} limit - Max subscriptions to return
 * @returns {Promise<Array>} Subscriptions needing welcome digests
 */
async function getPendingWelcomeDigests(limit = 2) {
  if (!supabase) throw new Error('Database not configured');

  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const { data, error } = await supabase
    .from('digest_subscriptions')
    .select('*')
    .eq('is_active', true)
    .is('last_sent_at', null)
    .gte('created_at', oneDayAgo.toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Update subscription last_sent_at timestamp
 * @param {string} subscriptionId - Subscription ID
 */
async function updateSubscriptionLastSent(subscriptionId) {
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('digest_subscriptions')
    .update({ last_sent_at: new Date().toISOString() })
    .eq('id', subscriptionId);

  if (error) throw error;
}

/**
 * Get subscriptions due for scheduled digest
 * @returns {Promise<Array>} Subscriptions due for digest
 */
async function getSubscriptionsDueForDigest() {
  if (!supabase) throw new Error('Database not configured');

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday
  const currentHour = now.getHours();

  // Only process during morning hours (8-10 AM)
  if (currentHour < 8 || currentHour > 10) {
    return [];
  }

  // Build query based on frequency
  let query = supabase
    .from('digest_subscriptions')
    .select('*')
    .eq('is_active', true);

  // For weekly: check if it's the right day
  // For daily: always include
  // Also ensure we haven't sent in the last 20 hours (prevent double sends)
  const twentyHoursAgo = new Date();
  twentyHoursAgo.setHours(twentyHoursAgo.getHours() - 20);

  const { data, error } = await query
    .or(`frequency.eq.daily,and(frequency.eq.weekly,day_of_week.eq.${currentDay})`)
    .or(`last_sent_at.is.null,last_sent_at.lt.${twentyHoursAgo.toISOString()}`)
    .limit(10);

  if (error) throw error;

  // Filter to only include subscriptions that haven't been sent recently
  return (data || []).filter(sub => {
    if (!sub.last_sent_at) return true; // Never sent
    const lastSent = new Date(sub.last_sent_at);
    return (now - lastSent) > 20 * 60 * 60 * 1000; // More than 20 hours ago
  });
}

module.exports = {
  supabase,
  isConnected,

  // Subscriptions
  createSubscription,
  getSubscriptionsByEmail,
  getSubscriptionByToken,
  getSubscriptionById,
  unsubscribe,
  resubscribe,
  updateSubscription,
  getSubscriptionsDue,
  markSubscriptionSent,

  // History
  saveDigestHistory,
  getLastDigest,
  getDigestHistoryBySubreddit,

  // Cache
  cacheDigest,
  getCachedDigest,

  // Seen posts
  markPostsSeen,
  getSeenPostIds,

  // Stats
  saveSubredditStats,
  getSubredditStats,

  // Cron
  getPendingWelcomeDigests,
  updateSubscriptionLastSent,
  getSubscriptionsDueForDigest
};
