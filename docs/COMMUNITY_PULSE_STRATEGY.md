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

1. Should "Deep Analysis" with comments be opt-in (user toggle) or default?
2. How many posts per bucket is optimal? (10? 12? 15?)
3. Should we cache results for repeat analysis of same subreddit?
4. How to handle very low-activity subreddits?
