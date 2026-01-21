# Quality Filter Logic

> **Important**: This document describes the core logic for filtering high-quality comments from social platforms. Any changes to the filtering logic in code should be reflected here, and vice versa.

## Overview

The quality filter extracts valuable comments from social media posts using a **dual-path approach**:
- **Path A (Substance-based)**: Longer comments that meet a score threshold
- **Path B (Engagement-based)**: Shorter comments that have high engagement signals

This approach ensures we capture both thoughtful detailed responses AND viral/resonant short comments that spark discussion.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     QUALITY FILTER PIPELINE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. FETCH          Platform API → Raw Comments (up to 200)          │
│       ↓                                                             │
│  2. VALIDATE       Remove deleted, empty, too short (<10 chars)     │
│       ↓                                                             │
│  3. CALCULATE      Compute dynamic thresholds from post data        │
│       ↓                                                             │
│  4. FILTER         Apply dual-path quality filter                   │
│       ↓                                                             │
│  5. SORT & CAP     Sort by score, apply safety cap (150)            │
│       ↓                                                             │
│  6. USE            Send ALL quality comments to AI (no slicing)     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Dynamic Thresholds

All thresholds are calculated **relative to the post's actual engagement**, not hardcoded values. This allows the filter to adapt to different post types (viral vs niche).

### Threshold Formulas

| Threshold | Formula | Purpose |
|-----------|---------|---------|
| `score` | `max(median_score × 0.5, 3)` | Base quality bar for Path A |
| `highScore` | `max(75th_percentile, score × 2)` | Higher bar for short comments in Path B |
| `replies` | `max(median_replies × 2, 1)` | What counts as "discussion-sparking" |
| `awards` | `total_awards > 10 ? 2 : 1` | What counts as "notable" |
| `depth` | `max(max_depth × 0.4, 1)` | What counts as "top-level-ish" |

### How Thresholds Scale

**Small Post (50 comments, low engagement)**
| Threshold | Typical Value | Effect |
|-----------|---------------|--------|
| score | 3 | Floor minimum |
| highScore | 8 | Low bar for short comments |
| replies | 1 | Any reply is notable |
| awards | 1 | Single award is notable |
| depth | 1 | Only top-level |

**Viral Post (800 comments, high engagement)**
| Threshold | Typical Value | Effect |
|-----------|---------------|--------|
| score | 50 | High bar |
| highScore | 200 | Very high bar for short comments |
| replies | 10 | Need significant discussion |
| awards | 2 | Need multiple awards |
| depth | 4 | Top 40% of thread |

---

## Dual-Path Filter

### Path A: Substance-Based (Original Logic)

For comments that provide detailed, substantive content.

```
KEEP if:
  ├─ length >= 50 characters
  ├─ score >= thresholds.score
  └─ author !== automoderator
```

### Path B: Engagement-Based (Additive)

For short comments that resonated with the community despite being brief.

```
KEEP if:
  ├─ length >= 20 characters AND length < 50 characters
  ├─ score >= thresholds.highScore (higher bar)
  ├─ author !== automoderator
  └─ AND at least ONE engagement signal:
      ├─ replies >= thresholds.replies (sparked discussion)
      ├─ awards >= thresholds.awards (someone paid to highlight)
      └─ depth <= thresholds.depth AND replies > 0 (top-level discussion starter)
```

### Why Two Paths?

| Comment Type | Path A Only | With Path B |
|--------------|-------------|-------------|
| "This product changed my workflow completely. I was spending 3 hours daily on X, now it takes 20 minutes..." | Kept | Kept |
| "This is the way" (2000 upvotes, 0 replies) | Filtered | Filtered |
| "This is the way" (2000 upvotes, 45 replies) | Filtered | **Kept** |
| "Exactly this!" (500 upvotes, gilded) | Filtered | **Kept** |

Path B captures viral moments that **resonated** with the community, not just random witty comments.

---

## Data Flow to AI

After quality filtering, comments flow to the AI analysis without additional slicing:

| Stage | File | What Happens |
|-------|------|--------------|
| Single post analysis | `insights.js` → `formatAnalysisPrompt()` | All quality comments sent |
| Multi-post combined | `insights.js` → `formatCombinedAnalysisPrompt()` | All quality comments per post |
| Content generation | `insights.js` → `buildContentPrompt()` | All quality comments as quote sources |

**No arbitrary limits** (previously was 25, 12, 8). Quality filter decides what's valuable, AI gets everything.

---

## Safety Mechanisms

### Safety Cap (150 comments)

Even with quality filtering, extremely viral posts could pass 200+ comments. A safety cap of 150 ensures:
- Reasonable token usage
- Response time stays acceptable
- Best comments (sorted by score) are prioritized

### Edge Case Handling

| Scenario | Behavior |
|----------|----------|
| 0 comments | Returns empty array, no crash |
| 1 comment | Calculates thresholds from that one comment |
| All comments < 20 chars | Returns empty (no quality content) |
| All comments fail filter | Returns empty (no quality content) |
| Missing fields (replies, awards) | Defaults to 0 |

---

## Platform Scaling Guide

When adding new platforms (YouTube, Twitter, LinkedIn, etc.), the quality filter can be adapted:

### Platform-Specific Engagement Signals

| Platform | Score Equivalent | Engagement Signals |
|----------|------------------|-------------------|
| Reddit | `upvotes - downvotes` | replies, awards, depth |
| YouTube | `likes` | replies, hearts from creator |
| Twitter/X | `likes` | retweets, replies, quote tweets, bookmarks |
| LinkedIn | `likes` | comments, reposts |

### Abstraction Pattern

```javascript
// Future: Platform-agnostic engagement calculation
function calculateEngagement(item, platform) {
  switch(platform) {
    case 'reddit':
      return {
        score: item.score,
        replies: item.replies,
        awards: item.awards,
        depth: item.depth
      };
    case 'youtube':
      return {
        score: item.likes,
        replies: item.replyCount,
        awards: item.creatorHeart ? 1 : 0,
        depth: 0  // YouTube comments are flat
      };
    case 'twitter':
      return {
        score: item.likes,
        replies: item.replyCount,
        awards: item.bookmarks,  // Bookmarks as "save for later" signal
        depth: item.conversationDepth
      };
  }
}
```

The threshold calculation and dual-path filter can remain the same - just normalize the engagement signals per platform.

---

## Code References

| File | Function | What It Does |
|------|----------|--------------|
| `backend/services/reddit.js` | `extractAllComments()` | Extracts comments with engagement data |
| `backend/services/reddit.js` | `extractValuableContent()` | Applies dual-path quality filter |
| `backend/services/insights.js` | `formatAnalysisPrompt()` | Sends comments to AI (single post) |
| `backend/services/insights.js` | `formatCombinedAnalysisPrompt()` | Sends comments to AI (multi-post) |
| `backend/services/insights.js` | `buildContentPrompt()` | Uses comments for content generation |

---

## Changelog

| Date | Change | Reason |
|------|--------|--------|
| 2026-01-21 | Added dual-path filter (Path B) | Capture engaged short comments |
| 2026-01-21 | Made all thresholds dynamic | Scale to different post types |
| 2026-01-21 | Removed slice limits in insights.js | Let quality filter decide, not arbitrary limits |
| 2026-01-21 | Added reply count extraction | Enable engagement-based filtering |
| 2026-01-21 | Safety cap 50 → 150 | Allow more comments on viral posts |

---

## Testing Checklist

When modifying the quality filter, verify these scenarios:

- [ ] Post with 0 comments → Returns empty, no crash
- [ ] Post with 3 short low-score comments → Returns what's available
- [ ] Post with 500 comments → Returns up to 150, best first
- [ ] Post with all long substantive comments → Path A handles all
- [ ] Post with viral short comments → Path B captures engaged ones
- [ ] Post with no replies on any comment → Award/depth paths still work
- [ ] Multi-post analysis → All posts contribute comments
- [ ] Content generation → Has access to real quotes
