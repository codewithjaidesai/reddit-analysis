# Content Radar - Implementation Plan

## Overview

Content Radar is a weekly/daily digest service that delivers curated Reddit insights to content creators. It builds on the existing Community Pulse feature but adds:

- **Automated scheduling** (daily/weekly digests)
- **Persistent storage** (subscription management, digest history)
- **Email delivery** (beautiful magazine-style digests)
- **Differential analysis** (what's new vs. last period)

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Scheduler   │────▶│ Redis Queue  │────▶│   Worker     │
│  (cron)      │     │  (Upstash)   │     │  (analyzer)  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                     ┌───────────────────────────┤
                     ▼                           ▼
              ┌─────────────┐           ┌─────────────┐
              │   Email     │           │  Supabase   │
              │  (Resend)   │           │  Database   │
              └─────────────┘           └─────────────┘
```

## Tech Stack

| Component | Technology | Free Tier |
|-----------|------------|-----------|
| Database | Supabase (PostgreSQL) | 500MB |
| Queue | BullMQ + Upstash Redis | 10K commands/day |
| Email | Resend | 3K emails/month |
| Templates | React Email | Open source |
| Scheduler | node-cron | Built-in |

## Database Schema (Supabase)

### Tables

```sql
-- Subscriptions table
CREATE TABLE digest_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  subreddit VARCHAR(100) NOT NULL,
  frequency VARCHAR(20) NOT NULL DEFAULT 'weekly', -- 'daily' or 'weekly'
  day_of_week INT DEFAULT 0, -- 0=Sunday for weekly
  focus_topic TEXT, -- Optional personalization
  is_active BOOLEAN DEFAULT true,
  unsubscribe_token VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sent_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  unsubscribe_reason VARCHAR(255),
  UNIQUE(email, subreddit)
);

-- Digest history (for differential analysis)
CREATE TABLE digest_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES digest_subscriptions(id) ON DELETE CASCADE,
  subreddit VARCHAR(100) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  top_themes JSONB, -- Themes with percentages
  top_posts JSONB, -- Post IDs and titles included
  metrics JSONB, -- Engagement stats
  content_hash VARCHAR(64) -- For deduplication
);

-- Digest cache (for welcome emails)
CREATE TABLE digest_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit VARCHAR(100) NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  digest_content JSONB NOT NULL, -- Full structured content
  html_content TEXT, -- Pre-rendered HTML
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subreddit, week_start)
);

-- Seen posts (avoid repetition)
CREATE TABLE digest_seen_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES digest_subscriptions(id) ON DELETE CASCADE,
  post_id VARCHAR(20) NOT NULL, -- Reddit post ID
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  included_in_digest_id UUID REFERENCES digest_history(id),
  UNIQUE(subscription_id, post_id)
);

-- Indexes for performance
CREATE INDEX idx_subscriptions_active ON digest_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX idx_subscriptions_email ON digest_subscriptions(email);
CREATE INDEX idx_subscriptions_subreddit ON digest_subscriptions(subreddit);
CREATE INDEX idx_history_subscription ON digest_history(subscription_id);
CREATE INDEX idx_history_subreddit_date ON digest_history(subreddit, period_end DESC);
CREATE INDEX idx_cache_subreddit_week ON digest_cache(subreddit, week_start DESC);
```

## API Endpoints

### Subscription Management

```
POST   /api/radar/subscribe
       Body: { email, subreddit, frequency?, focus_topic? }
       Returns: { subscription, welcomeDigestSent }

GET    /api/radar/subscriptions?email=xxx
       Returns: { subscriptions[] }

PUT    /api/radar/subscriptions/:id
       Body: { frequency?, focus_topic?, is_active? }
       Returns: { subscription }

DELETE /api/radar/unsubscribe?token=xxx
       Returns: { success }
```

### Digest Operations

```
GET    /api/radar/digest/:subreddit/latest
       Returns: { digest } (cached)

POST   /api/radar/digest/generate
       Body: { subreddit } (admin only)
       Returns: { digest }

GET    /api/radar/subreddit-info/:subreddit
       Returns: { name, subscribers, postsPerDay, activityLevel, recommendedFrequency }
```

## File Structure

```
backend/
├── services/
│   ├── contentRadar.js      # Digest generation logic
│   ├── emailService.js      # Resend integration
│   ├── scheduler.js         # Cron job management
│   └── supabase.js          # Database client
├── routes/
│   └── radar.js             # API routes
├── workers/
│   └── digestWorker.js      # Queue worker
└── templates/
    └── digest/              # React Email templates
        ├── DigestEmail.jsx
        └── WelcomeEmail.jsx

frontend/
├── content-radar/
│   ├── index.html           # Landing page
│   ├── subscribe.html       # Signup form
│   ├── manage.html          # Manage subscriptions
│   ├── unsubscribe.html     # Unsubscribe page
│   ├── digest.html          # View digest in browser
│   ├── js/
│   │   ├── subscribe.js
│   │   ├── manage.js
│   │   └── unsubscribe.js
│   └── css/
│       └── radar.css
```

## Digest Content Structure

```javascript
{
  subreddit: "artificialintelligence",
  issueNumber: 7,
  periodStart: "2026-01-27",
  periodEnd: "2026-02-02",

  // Quick overview
  quickHits: [
    "AI agents dominated discussion (+340% vs last week)",
    "New Claude model sparked 200+ comparison threads",
    "Most mentioned: Cursor, Claude, Windsurf"
  ],

  // Cover story
  coverStory: {
    title: "I replaced my entire dev workflow with AI",
    post: { id, url, author, score, numComments },
    summary: "This thread sparked the biggest debate...",
    topQuotes: [...]
  },

  // Community voices
  voicesOfTheWeek: [
    {
      quote: "The real skill now isn't coding...",
      author: "u/senior_dev_20yrs",
      score: 423,
      postUrl: "..."
    }
  ],

  // Statistics
  metrics: {
    totalPosts: 2847,
    totalComments: 34521,
    vsLastWeek: { posts: "+12%", comments: "+23%" },
    avgSentiment: 0.72
  },

  // Thread of the week
  threadOfTheWeek: {
    title: "What AI tool actually saved you time?",
    post: { ... },
    topReplies: [
      { text: "Cursor + Claude. Not even close.", author: "...", score: 89 },
      { text: "How do you handle the context limit?", author: "...", score: 45, isReply: true }
    ]
  },

  // Emerging topics
  emergingTopics: [
    { topic: "AI agent frameworks", mentions: 45, isNew: true },
    { topic: "Vibe coding", mentions: 23, isControversial: true }
  ],

  // Content ideas (for Content Radar specifically)
  contentIdeas: [
    {
      title: "AI Tools Comparison: What Reddit Actually Uses",
      rationale: "12 threads comparing tools, lots of opinions",
      relevanceToFocus: 0.9 // If user has focus topic
    }
  ],

  // The debate
  theDebate: {
    topic: "Will AI replace developers?",
    forSide: { summary: "Junior roles are already shrinking...", quotes: [...] },
    againstSide: { summary: "Someone still needs to know what to...", quotes: [...] }
  }
}
```

## Implementation Phases

### Phase 1: Foundation (Current)
- [x] Document architecture
- [ ] Set up Supabase database
- [ ] Create backend services (supabase client, basic routes)
- [ ] Build signup/unsubscribe pages

### Phase 2: Digest Generation
- [ ] Extend Community Pulse for digest format
- [ ] Add differential analysis (vs last period)
- [ ] Create digest content structure
- [ ] Build React Email templates

### Phase 3: Delivery System
- [ ] Set up Resend integration
- [ ] Implement welcome email flow
- [ ] Set up BullMQ + Upstash Redis
- [ ] Create digest worker

### Phase 4: Scheduler
- [ ] Implement cron scheduling
- [ ] Add subreddit activity detection
- [ ] Auto-suggest frequency

### Phase 5: Polish
- [ ] Personalization (focus topics)
- [ ] Digest preview in browser
- [ ] Analytics (open rates, click rates)

## Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

# Upstash Redis
UPSTASH_REDIS_URL=xxx
UPSTASH_REDIS_TOKEN=xxx

# Resend
RESEND_API_KEY=xxx
RESEND_FROM_EMAIL=digest@contentradar.com

# Security
UNSUBSCRIBE_SECRET=xxx  # For signing unsubscribe tokens

# App
BASE_URL=https://your-domain.com
```

## Frequency Auto-Detection

```javascript
function classifyActivity(subredditStats) {
  const { postsPerDay, avgCommentsPerPost } = subredditStats;
  const activityScore = postsPerDay * (1 + avgCommentsPerPost / 50);

  if (activityScore > 200) {
    return {
      level: 'high',
      recommended: 'daily',
      reason: 'High-activity community. Daily keeps you ahead.'
    };
  }

  if (activityScore > 50) {
    return {
      level: 'medium',
      recommended: 'weekly',
      reason: 'Moderate activity. Weekly captures the best.'
    };
  }

  return {
    level: 'low',
    recommended: 'weekly',
    reason: 'Thoughtful community. Weekly digest is ideal.'
  };
}
```

## Target Subreddits (Initial)

| Subreddit | Est. Activity | Recommended |
|-----------|---------------|-------------|
| r/artificialintelligence | High | Daily/Weekly |
| r/WeightLossAdvice | Medium | Weekly |
| r/recipes | Medium | Weekly |
| r/menopause | Low-Medium | Weekly |

## Compliance Checklist

- [ ] Unsubscribe link in every email
- [ ] List-Unsubscribe header for one-click
- [ ] Physical address in email footer
- [ ] Soft delete (keep unsubscribe records)
- [ ] Honor unsubscribe immediately
- [ ] Clear "why you're receiving this" text
