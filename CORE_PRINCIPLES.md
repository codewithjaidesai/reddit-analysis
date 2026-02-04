# Core Principles - Voice of the Customer

**CRITICAL: These principles MUST be followed for all features and modifications.**

---

## 1. Real Data, No Hallucinations

**All data displayed to users MUST come from real sources. AI should NEVER fabricate data.**

### What this means:

- **Posts, comments, scores, usernames** - Must be fetched directly from Reddit API
- **Quotes in digests** - Must be exact quotes from actual comments, not AI-generated
- **Statistics (upvotes, comment counts, subscriber counts)** - Must be real numbers from API
- **Trends and topics** - Must be derived from actual post/comment analysis

### AI's permitted role:

- **Summarization** - Condensing real data into digestible formats
- **Selection** - Choosing which real content to highlight
- **Analysis** - Identifying patterns in real data
- **Content Ideas** - Suggesting topics based on real trends (clearly marked as suggestions)

### AI is NOT permitted to:

- Invent quotes or attribute fake statements to users
- Make up statistics or engagement numbers
- Fabricate post titles or content
- Create fictional usernames or communities
- Fill gaps with plausible-sounding but fake data

### Implementation requirements:

1. Always fetch fresh data from Reddit API before analysis
2. Pass actual post/comment data to AI prompts
3. AI responses should reference real data by index/ID when possible
4. Consider validation that AI-returned quotes exist in source data

---

## 2. Transparency About AI-Generated Content

When AI generates suggestions (like content ideas), clearly indicate this:
- Content ideas are "AI-suggested based on community trends"
- Summaries are AI-generated from real discussions
- Never present AI opinions as community consensus

---

## 3. Data Freshness

- Community Pulse: Real-time data
- Content Radar digests: Data from the specified period (daily/weekly)
- Never show stale data without indicating its age

---

## Current Implementation Status

### Community Pulse Tab
- **Posts**: Real Reddit data via `fetchTimeBucketedPosts()`
- **Activity levels**: Calculated from real post frequency
- **Themes**: AI-analyzed from real posts
- **Quotes**: Real comments from Reddit

### Content Radar Digests
- **Posts**: Real Reddit data via `fetchTimeBucketedPosts()`
- **Comments**: Real via `fetchCommentsForPosts()`
- **Voices of the Week**: Instructed to use exact quotes (see note below)
- **Metrics**: Real counts from fetched data

### Note on Quote Validation
The current implementation instructs AI to use exact quotes but doesn't programmatically validate that returned quotes match source comments. Consider adding validation in future iterations.

---

## For Developers

When building new features:

1. **Before coding**: Ask "Where does this data come from?"
2. **Data fetching**: Always use authenticated Reddit API calls
3. **AI prompts**: Include explicit instructions against fabrication
4. **Testing**: Verify displayed data matches source
5. **Documentation**: Note any AI-generated vs real data distinction

---

*Last updated: 2024*
*This document should be referenced for all feature development.*
