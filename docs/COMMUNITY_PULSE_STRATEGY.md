# Community Pulse Tab Strategy

## Overview

Community Pulse is a **single-community analysis tool** that helps users understand what a subreddit cares about, how discussions evolve over time, and identify actionable opportunities.

---

## Key Differentiators from Topic Search

| Aspect | Topic Search | Community Pulse |
|--------|--------------|-----------------|
| **User Intent** | "I have a topic, find discussions about it" | "What does this community care about?" |
| **Scope** | Specific topic across subreddits | Single subreddit, all topics |
| **Time Focus** | Recent/relevant posts | 1-year trend analysis |
| **Output** | Topic-specific insights | Community evolution, emerging/declining themes |
| **Post Selection** | User selects posts manually | Auto-selected based on engagement |

---

## Core Features

### 1. Time-Based Trend Analysis
- **4 Time Buckets**: Last 30 Days, 1-3 Months, 3-6 Months, 6-12 Months
- **Theme Evolution**: Track which topics are Rising, Ongoing, or Declining
- **Why it matters**: Shows what's gaining traction vs fading interest

### 2. Dynamic Activity Detection
- Automatically detect subreddit activity level (high/medium/low)
- Calculate posts per day
- Inform user about community engagement

### 3. Optional Focus Area
- User can specify a custom focus (e.g., "product recommendations")
- AI weights analysis toward focus while providing general overview
- Useful for targeted research within a community

### 4. Persona-Based Insights
- Product Manager: Pain points, feature requests, unmet needs
- Marketer/Copywriter: Language patterns, emotional triggers
- Content Creator: Trending topics, engagement patterns

---

## Data Collection Strategy

### Phase 1: Broad Theme Analysis (Current)
**Purpose**: Understand overall community themes and trends

```
Posts Fetched: 100 (top posts from past year)
Data Used: Post titles + first 500 chars of body
API Calls: 1
Time: ~5 seconds
```

**Output**:
- Top themes with percentages
- Trend indicators (Rising/Ongoing/Declining)
- Theme distribution across time buckets

### Phase 2: Deep Comment Analysis (To Implement)
**Purpose**: Extract community voice, recommendations, pain points

```
Posts Sampled: 40-50 (top 10-12 per time bucket)
Selection Criteria: Highest engagement (score × num_comments)
Data Used: Post + valuable comments (using existing quality filter)
API Calls: 1 (posts) + ~45 (comments) = ~46 total
Time: ~60-90 seconds
```

**Why Sample by Time Bucket**:
- Ensures representation across all time periods
- Captures how community voice changes over time
- Prevents recent posts from dominating

---

## Sampling Strategy for Comments

### Selection Algorithm
```javascript
For each time bucket:
  1. Sort posts by engagement score (score × num_comments)
  2. Select top 10-12 posts
  3. Fetch comments using existing extractRedditData(url)
  4. Apply existing extractValuableContent() quality filter
```

### Why This Works
- Reuses ALL existing code from Topic Search
- `fetchAuthenticatedRedditData()` - fetches post + comments
- `extractAllComments()` - recursive comment extraction
- `extractValuableContent()` - dual-path quality filtering

### API Load Management
| Scenario | API Calls | Estimated Time |
|----------|-----------|----------------|
| Current (no comments) | 1 | ~30-40 sec |
| With comments (45 posts) | 46 | ~60-90 sec |
| With comments (60 posts) | 61 | ~90-120 sec |

---

## Unique Insights from Comments

### Topic-Intelligent Analysis
The AI should detect what type of community it is and extract relevant patterns:

**For Product/Recommendation Communities** (e.g., r/menopause, r/skincareaddiction):
- Product/solution mentions and frequency
- Success stories ("this worked for me")
- Side effect warnings
- Price/accessibility concerns

**For Advice/Support Communities** (e.g., r/relationships, r/personalfinance):
- Common advice patterns
- Controversial vs consensus opinions
- Professional referrals (therapist, lawyer, etc.)

**For Technical Communities** (e.g., r/programming, r/homelab):
- Tool/technology recommendations
- Best practices mentioned
- Common pitfalls/warnings

**For Hobby Communities** (e.g., r/photography, r/cooking):
- Gear/equipment recommendations
- Skill progression patterns
- Resource sharing

### Quantitative Metrics from Comments
- **Recommendation Frequency**: How often specific products/solutions are mentioned
- **Sentiment Distribution**: Positive/negative/neutral across themes
- **Advice vs Empathy Ratio**: Solution-focused vs support-focused responses
- **Consensus Score**: Agreement vs disagreement in replies

---

## Output Structure

### Insights Tab (Qualitative)
1. **Community Snapshot** - What this community is about
2. **Top Themes** - Major discussion topics with trend indicators
3. **Community Language** - Phrases, triggers, slang
4. **For Your Persona** - Key insights + Actionable opportunities
5. **High-Engagement Topics** - What drives discussion

### Data Analysis Tab (Quantitative)
1. **Posts by Time Period** - Distribution across buckets
2. **Analysis Summary** - Stats (posts analyzed, community size, activity)
3. **Engagement Metrics** - Avg upvotes, comments, discussion ratio, viral posts
4. **Data Insights** - Derived insights from numbers (dominant topic %, trends)

### Source Posts Tab (Transparency)
- Collapsible list of actual posts analyzed
- Organized by time bucket
- Links to original Reddit posts

---

## Implementation Phases

### Phase 1: ✅ Complete
- Basic Community Pulse with post titles/bodies
- Time bucket analysis
- Trend indicators
- Persona-based insights
- Engagement metrics from post metadata

### Phase 2: 🔄 To Implement
- Comment fetching for sampled posts
- Topic-intelligent insight extraction
- Deeper quantitative analysis from comment data
- Product/solution frequency analysis

### Phase 3: Future Considerations
- Caching for repeat analysis
- Comparison between time periods
- Export functionality
- Historical tracking

---

## Technical Implementation Notes

### Reuse from Topic Search
```javascript
// These functions already exist in reddit.js:
const {
  extractRedditData,      // Main function - fetches post + comments
  extractValuableContent, // Quality filter for comments
  extractAllComments      // Recursive comment extraction
} = require('./services/reddit');
```

### New Code Needed
1. **Sampling function**: Select top posts per time bucket
2. **Batch fetching**: Fetch comments for sampled posts (with rate limiting)
3. **AI prompt updates**: Include comment data in analysis prompt
4. **Progress updates**: Show comment fetching progress to user

### Rate Limiting Strategy
- Reddit OAuth: ~60 requests/minute
- With 45 posts: ~45 seconds minimum for comment fetching
- Add small delay between requests to be safe
- Use Promise.all with concurrency limit (e.g., 5 at a time)

---

## Success Metrics

A good Community Pulse analysis should:
1. Accurately identify the top 4-6 themes in the community
2. Correctly classify trends (rising/ongoing/declining)
3. Extract actionable insights relevant to the user's persona
4. Provide transparency on methodology and source data
5. Complete in under 2 minutes

---

## Open Questions

### ✅ Resolved Decisions
1. **Comment analysis**: Default (not opt-in toggle)
2. **Posts per bucket**: 10-12 posts per time bucket
3. **Caching**: Yes, cache results for repeat analysis of same subreddit
4. **Low-activity subreddits**: Use Quick Snapshot mode with adjusted expectations

---

## Future Feature: Continuous Feed

### Overview
Automated periodic analysis that delivers curated updates about community activity via email or notification. Think of it as a "community digest" that surfaces what's new and trending.

### User Value
- Stay updated on communities without manual checking
- Discover new trending content automatically
- Get personalized alerts based on interests/focus areas

### Example Use Cases

| Community Type | What Continuous Feed Delivers |
|----------------|------------------------------|
| r/recipes | New highly-liked recipes, trending ingredients, seasonal dishes |
| r/menopause | New product recommendations, emerging treatments, viral success stories |
| r/programming | New tools gaining traction, trending frameworks, common pain points |
| r/personalfinance | New strategies being discussed, market sentiment, tax tips |

### Proposed Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Scheduler      │────▶│  Worker      │────▶│  Notification   │
│  (Cron/Queue)   │     │  (Analysis)  │     │  (Email/Push)   │
└─────────────────┘     └──────────────┘     └─────────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  User Prefs     │     │  Cache/DB    │     │  Delivery       │
│  (Frequency,    │     │  (Previous   │     │  Service        │
│   Focus Areas)  │     │   Results)   │     │  (SendGrid etc) │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

### Key Components

**1. Subscription Management**
- User subscribes to subreddits with preferences:
  - Frequency: Daily / Weekly / Based on activity level
  - Focus areas: Optional topic filters
  - Delivery: Email / In-app notification / Both

**2. Scheduler**
- Determines when to run analysis based on:
  - User-selected frequency
  - Subreddit activity level (high activity = more frequent)
  - Last analysis timestamp

**3. Differential Analysis**
- Compare new analysis with cached previous analysis
- Identify what's NEW or CHANGED:
  - New trending posts since last digest
  - Rising themes that weren't rising before
  - New product recommendations mentioned
  - Significant engagement spikes

**4. Digest Generation**
- AI-generated summary of changes
- Highlight most interesting new content
- Personalized based on user's focus areas

**5. Delivery**
- Email template with digest content
- Direct links to interesting posts
- Quick actions (view full analysis, adjust preferences)

### Frequency Logic

```javascript
function determineFrequency(subreddit, userPreference) {
  if (userPreference === 'manual') return null;

  const activity = subreddit.postsPerDay;

  if (userPreference === 'auto') {
    if (activity > 50) return 'daily';
    if (activity > 10) return 'twice_weekly';
    if (activity > 2) return 'weekly';
    return 'biweekly';
  }

  return userPreference; // 'daily', 'weekly', etc.
}
```

### Digest Content Structure

```markdown
# Your Weekly Digest: r/recipes

## 🔥 Trending This Week
- **One-pot pasta dishes** - 3 viral posts, 2.5K+ combined upvotes
- **Air fryer recipes** - Continued strong interest

## 🆕 New & Notable
1. "Budget meal prep for family of 4" - 1.2K upvotes, 234 comments
2. "Finally perfected homemade ramen" - 890 upvotes, 156 comments

## 💡 Community Recommendations
- **Most mentioned ingredient**: Gochujang (Korean chili paste)
- **Popular technique**: Reverse searing for steaks

## 📈 Rising Interest
- "Sheet pan dinners" - up 40% from last week

[View Full Analysis] [Manage Preferences]
```

### Technical Considerations

**Storage Requirements**
- User subscriptions table
- Previous analysis cache (per subreddit)
- Delivery history/logs

**API Rate Limits**
- Batch analysis jobs during off-peak hours
- Respect Reddit API limits (queue with delays)
- Cache aggressively to minimize re-fetching

**Cost Considerations**
- AI API costs for periodic analysis
- Email delivery costs (SendGrid, etc.)
- Consider tiered pricing for heavy users

### Implementation Phases

**Phase 1: Foundation**
- Caching infrastructure for analysis results
- Differential comparison logic
- Basic subscription model

**Phase 2: MVP**
- Simple email digest (weekly only)
- Manual subscription management
- Basic "what's new" detection

**Phase 3: Full Feature**
- Flexible frequency options
- Focus area filtering
- Rich email templates
- In-app notifications
- Subscription management UI

### Database Schema (Proposed)

```sql
-- User subscriptions
CREATE TABLE community_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  subreddit VARCHAR(255) NOT NULL,
  frequency ENUM('daily', 'twice_weekly', 'weekly', 'biweekly', 'auto'),
  focus_areas TEXT[], -- Optional topic filters
  persona VARCHAR(50),
  delivery_method ENUM('email', 'push', 'both'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Cached analysis results
CREATE TABLE analysis_cache (
  id UUID PRIMARY KEY,
  subreddit VARCHAR(255) NOT NULL,
  analysis_data JSONB,
  analyzed_at TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(subreddit)
);

-- Digest history
CREATE TABLE digest_history (
  id UUID PRIMARY KEY,
  subscription_id UUID REFERENCES community_subscriptions(id),
  digest_content JSONB,
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_links INTEGER DEFAULT 0
);
```

### Open Questions for Continuous Feed
1. What's the MVP scope for first release?
2. Email service provider preference?
3. Should this be a premium feature or free?
4. How to handle user authentication/accounts?

