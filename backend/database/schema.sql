-- Content Radar Database Schema
-- Run this in Supabase SQL Editor to create tables

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
-- Stores user subscriptions to subreddit digests

CREATE TABLE IF NOT EXISTS digest_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  subreddit VARCHAR(100) NOT NULL,
  frequency VARCHAR(20) NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly')),
  day_of_week INT DEFAULT 0 CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
  focus_topic TEXT, -- Optional personalization focus
  is_active BOOLEAN DEFAULT true,
  unsubscribe_token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sent_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  unsubscribe_reason VARCHAR(255),

  -- Prevent duplicate subscriptions for same email+subreddit
  UNIQUE(email, subreddit)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON digest_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON digest_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subreddit ON digest_subscriptions(subreddit);
CREATE INDEX IF NOT EXISTS idx_subscriptions_token ON digest_subscriptions(unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_subscriptions_frequency ON digest_subscriptions(frequency, is_active) WHERE is_active = true;


-- ============================================
-- DIGEST HISTORY TABLE
-- ============================================
-- Tracks sent digests for differential analysis

CREATE TABLE IF NOT EXISTS digest_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES digest_subscriptions(id) ON DELETE CASCADE,
  subreddit VARCHAR(100) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Analysis data (for comparing changes over time)
  top_themes JSONB, -- [{ theme: "AI Tools", percentage: 15, trend: "rising" }]
  top_posts JSONB,  -- [{ id: "abc123", title: "...", score: 500 }]
  metrics JSONB,    -- { totalPosts: 100, totalComments: 500, avgSentiment: 0.7 }

  -- Full digest content
  digest_content JSONB, -- Full structured digest for reference

  content_hash VARCHAR(64) -- For deduplication
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_history_subscription ON digest_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_history_subreddit_date ON digest_history(subreddit, period_end DESC);


-- ============================================
-- DIGEST CACHE TABLE
-- ============================================
-- Caches generated digests for welcome emails

CREATE TABLE IF NOT EXISTS digest_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit VARCHAR(100) NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- Cached content
  digest_content JSONB NOT NULL, -- Full structured content
  html_content TEXT,             -- Pre-rendered HTML (optional)

  -- Metadata
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  post_count INT,
  comment_count INT,

  UNIQUE(subreddit, week_start)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_cache_subreddit_week ON digest_cache(subreddit, week_start DESC);


-- ============================================
-- SEEN POSTS TABLE
-- ============================================
-- Tracks which posts have been included to avoid repetition

CREATE TABLE IF NOT EXISTS digest_seen_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES digest_subscriptions(id) ON DELETE CASCADE,
  post_id VARCHAR(20) NOT NULL, -- Reddit post ID (e.g., "1abc234")
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  included_in_digest_id UUID REFERENCES digest_history(id) ON DELETE SET NULL,

  UNIQUE(subscription_id, post_id)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_seen_subscription ON digest_seen_posts(subscription_id);


-- ============================================
-- SUBREDDIT STATS CACHE TABLE
-- ============================================
-- Caches subreddit activity stats for frequency recommendations

CREATE TABLE IF NOT EXISTS subreddit_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit VARCHAR(100) UNIQUE NOT NULL,
  subscribers INT,
  posts_per_day FLOAT,
  avg_comments_per_post FLOAT,
  activity_level VARCHAR(20), -- 'low', 'medium', 'high'
  recommended_frequency VARCHAR(20), -- 'daily' or 'weekly'
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_stats_subreddit ON subreddit_stats(subreddit);


-- ============================================
-- HELPFUL VIEWS
-- ============================================

-- Active subscriptions with recent history
CREATE OR REPLACE VIEW active_subscriptions_with_history AS
SELECT
  s.*,
  h.sent_at as last_digest_sent,
  h.period_start as last_period_start,
  h.period_end as last_period_end
FROM digest_subscriptions s
LEFT JOIN LATERAL (
  SELECT * FROM digest_history
  WHERE subscription_id = s.id
  ORDER BY sent_at DESC
  LIMIT 1
) h ON true
WHERE s.is_active = true;

-- Subscriptions due for digest (weekly on Sunday, daily every day)
CREATE OR REPLACE VIEW subscriptions_due AS
SELECT *
FROM digest_subscriptions
WHERE is_active = true
  AND (
    -- Weekly: check if it's the right day and hasn't been sent this week
    (frequency = 'weekly'
     AND EXTRACT(DOW FROM NOW()) = day_of_week
     AND (last_sent_at IS NULL OR last_sent_at < NOW() - INTERVAL '6 days'))
    OR
    -- Daily: hasn't been sent today
    (frequency = 'daily'
     AND (last_sent_at IS NULL OR last_sent_at < NOW() - INTERVAL '23 hours'))
  );


-- ============================================
-- ROW LEVEL SECURITY (Optional but recommended)
-- ============================================

-- Enable RLS on tables
ALTER TABLE digest_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_seen_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subreddit_stats ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for backend)
CREATE POLICY "Service role has full access to subscriptions" ON digest_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to history" ON digest_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to cache" ON digest_cache
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to seen posts" ON digest_seen_posts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to stats" ON subreddit_stats
  FOR ALL USING (true) WITH CHECK (true);


-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get subscription by unsubscribe token
CREATE OR REPLACE FUNCTION get_subscription_by_token(token_param VARCHAR)
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  subreddit VARCHAR,
  frequency VARCHAR,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.email,
    s.subreddit,
    s.frequency,
    s.is_active
  FROM digest_subscriptions s
  WHERE s.unsubscribe_token = token_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unsubscribe
CREATE OR REPLACE FUNCTION unsubscribe_by_token(token_param VARCHAR, reason_param VARCHAR DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  affected_rows INT;
BEGIN
  UPDATE digest_subscriptions
  SET
    is_active = false,
    unsubscribed_at = NOW(),
    unsubscribe_reason = reason_param
  WHERE unsubscribe_token = token_param
    AND is_active = true;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
