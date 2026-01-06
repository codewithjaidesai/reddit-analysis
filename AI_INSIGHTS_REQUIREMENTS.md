# Reddit Analysis Tool - Product Vision & Roadmap

## 🎯 Product Vision

**Transform Reddit discussions into strategic business intelligence through problem-first research.**

This tool helps businesses extract actionable insights from Reddit for marketing strategy, SEO planning, product development, and competitive intelligence. Unlike generic analytics tools, we focus on helping researchers ask the right questions and discover non-obvious patterns that drive business decisions.

**Core Principles:**
- Problem-first approach (research questions drive analysis, not features)
- Individual post depth over multi-post breadth (for now)
- Actionable insights over vanity metrics
- Visual, scannable output over dense text blocks
- Intelligent pattern recognition over mechanical counting

---

## ✅ COMPLETED FEATURES (Built & Deployed)

### AI Insights Quality Improvements
- ✅ **Executive Summary** - 30-second scannable overview (Biggest Finding + Key Opportunity + Immediate Action)
- ✅ **Visual Formatting** - Tables, icons (⚡📊💡🔗✅⚠️), 2-sentence max paragraphs, visual separators
- ✅ **Intelligent Quantitative Grouping** - Group up/down with percentages, not just raw counts
- ✅ **Derived Insights Section** - Observable Pattern → Immediate → Secondary → Tertiary effects
- ✅ **Structured Business Implications** - Organized by Marketing, Product, SEO/Content

### Export & Data Features
- ✅ **AI Insights PDF Export** - Export formatted insights as PDF (all 3 tabs)
- ✅ **Comments PDF/Text Export** - Export raw comments with metadata
- ✅ **Reddit Source URLs** - Post permalinks in all exports for authenticity validation
- ✅ **Individual Comment URLs** - Direct links to each comment for verification

### Core Extraction
- ✅ **Single URL Analysis** - Analyze individual Reddit posts
- ✅ **Search by Topic** - Find relevant posts by keyword with quality filtering
- ✅ **Search by Subreddit** - Analyze posts from specific communities

---

## 📋 RECENTLY COMPLETED

### Phase 1: Research Context + Templates ✅ (COMPLETED)
**Goal:** Make tool problem-first by adding research questions and analysis templates

**What was built:**
- ✅ Research question input (optional, at top of Search by Topic tab)
- ✅ Analysis templates dropdown: All Insights, Pain Points, Competitive Analysis, Features, Market Gaps
- ✅ Template-driven search enhancement (adds synonyms to queries while keeping quality filters)
- ✅ Recent Searches dropdown (browser localStorage, silent feature)
- ✅ Research context passed to AI for better analysis
- ✅ "Search by Topic" is now the default tab

**Technical changes:**
- ✅ `frontend/index.html` - UI layout with research input and templates
- ✅ `frontend/css/styles.css` - Styles for new UI components
- ✅ `backend/services/search.js` - Added `enhanceQueryWithTemplate()` function
- ✅ `backend/routes/search.js` - Accept `template` and `researchQuestion` parameters
- ✅ `backend/routes/analyze.js` - Pass research context to insights generation
- ✅ `frontend/js/app.js` - Handle template selection, recent searches, and search context
- ✅ `frontend/js/api.js` - Updated API calls to pass research context
- ✅ `backend/services/insights.js` - Pass research context to AI prompt

**How it works:**
1. User enters research question (optional) and selects analysis template
2. Template adds synonyms to search query (e.g., "pain_points" adds "problem OR issue OR frustration")
3. Search finds more relevant posts using enhanced query
4. Research context is passed to AI for focused analysis
5. Recent searches saved to localStorage and shown in dropdown

---

## 📋 CURRENTLY BUILDING (In Progress)

**Status:** Phase 1 completed - ready for next phase

---

## ❌ FUTURE PIPELINE (Not Building Yet)

### Problem-First Approach Phases
- ❌ **Phase 2: Research Projects** (1 day) - Group related analyses, track progress
- ❌ **Phase 3: Cross-Post Synthesis** (2 days) - **KILLER FEATURE** - Combine insights from multiple posts
- ❌ **Phase 5: Comparison View** (1 day) - Side-by-side insights for different segments

### Platform Expansion (Multi-Source Intelligence)
- ❌ **YouTube Comments Analysis** (Q1 2026) - Extract and analyze video comments
- ❌ **App Store Reviews (iOS)** (Q2 2026) - Extract reviews with ratings and sentiment
- ❌ **Google Play Store Reviews** (Q3 2026) - Android feedback analysis
- ❌ **Multi-Source Synthesis** (Q4 2026) - Analyze same topic across all platforms

### UI/UX Enhancements
- ❌ **Frontend CSS Improvements** - Better table styling, visual cards, spacing
- ❌ **Interactive Features** - Collapsible sections, charts/graphs
- ❌ **Comparison Charts** - Visual comparison between platforms/segments

---

# AI Insights Output Requirements

## Problem Statement
Current AI insights output is:
- Too wordy and hard to read
- Dense blocks of text with poor visual hierarchy
- Quantitative insights are too simplistic (just counting)
- Missing second-level derived insights
- Not leveraging visual formatting effectively

## Requirements

### 1. Visual Formatting & Structure

#### Mandatory Formatting Rules
- ✅ **All quantitative data MUST use tables**
- ✅ **Maximum 2 sentences per paragraph**
- ✅ **Use bullet points (•) for all lists**
- ✅ **Bold all numbers and key findings**
- ✅ **Add visual icons**: 📊 (data), 💡 (insight), ⚠️ (warning), ✅ (action), 🎯 (key finding)
- ✅ **Use visual separators** (───) between major sections
- ✅ **Include executive summary** at the top (30-second read)

#### Visual Hierarchy
```markdown
# Major Section (H1)
## Sub-section (H2)
### Detail level (H3)

Use boxes/tables for emphasis:
┌─────────────────────────────┐
│ 🎯 KEY INSIGHT              │
├─────────────────────────────┤
│ [Content]                   │
└─────────────────────────────┘
```

---

### 2. Quantitative Insights - Intelligent Grouping

#### Current Problem
Simply counting raw occurrences:
```
❌ Spring rolls: 5 mentions
❌ Fries: 8 mentions
❌ Salad: 3 mentions
❌ Samosas: 6 mentions
```

#### Required Approach
Group and categorize intelligently with percentages:

```
✅ Starter Preferences by Preparation Method:
| Category | Count | % of Total |
|----------|-------|------------|
| Fried    | 14    | 65%        |
| Steamed  | 5     | 23%        |
| Fresh    | 3     | 14%        |

✅ Starter Preferences by Health Profile:
| Category    | Count | % of Total |
|-------------|-------|------------|
| Indulgent   | 16    | 73%        |
| Healthy     | 6     | 27%        |

✅ Starter Preferences by Protein Type:
| Category    | Count | % of Total |
|-------------|-------|------------|
| Meat-based  | 13    | 59%        |
| Vegetarian  | 9     | 41%        |
```

#### Grouping Guidelines
1. **Look for natural categories** in the data
2. **Group up** - Find higher-level patterns (fried vs steamed vs fresh)
3. **Group down** - Break into subcategories when revealing (meat vs veg, healthy vs indulgent)
4. **Calculate percentages** - Always show relative distribution
5. **Show business value** - Explain what each grouping reveals

**Examples of intelligent grouping:**
- **Products mentioned** → Group by: Price tier, Category, Use case
- **Pain points** → Group by: Severity, Frequency, Impact area
- **Demographics** → Group by: Age ranges, Life stages, Income brackets
- **Solutions discussed** → Group by: Complexity, Cost, Effectiveness
- **Behaviors** → Group by: Frequency, Intent, Stage of journey

---

### 3. Second-Level Derived Insights (NEW SECTION)

#### What Are Derived Insights?
**Not just what the data says, but what it IMPLIES.**

Connecting dots, finding cascading effects, making predictions based on patterns.

#### Example Chain
```
📊 Data: "Temperature is 100°F"

💡 First-level insight: "Hot weather"

🔗 Second-level derived insights:
1. Ice cream sales likely to increase 40-60%
2. → More foot traffic in shopping districts with AC
3. → Increased afternoon socialization at cafes
4. → Outdoor evening activities decline
5. → Energy drink/beverage sales spike

Business implications:
- Restaurants: Promote cold desserts, AC seating
- Retail: Extend hours for evening shopping
- Marketing: Time campaigns for 2-4pm (heat peak)
```

#### Required Format

```markdown
# 🔗 DERIVED INSIGHTS & IMPLICATIONS

## [Insight Chain Title]

**Observable Pattern:**
[What the data directly shows]

**Derived Implications:**
1. **Immediate effect** → [What this directly causes]
2. **Secondary effect** → [What the immediate effect causes]
3. **Tertiary effect** → [Cascading impact]

**Business Probability:**
[Likelihood and confidence level]

**Strategic Action:**
[What to do based on this chain]

───

## [Next Insight Chain]
...
```

#### Examples for Reddit Analysis

**Example 1: Budget Sensitivity**
```markdown
## Budget-Conscious Decision Making

**Observable Pattern:**
- 12 comments mention price under $50
- 8 comments say "tried cheaper alternatives first"
- 5 comments mention "saving up" for premium option

**Derived Implications:**
1. **Immediate**: Users research extensively before buying
   → Longer consideration period (2-4 weeks estimated)
2. **Secondary**: They trust peer reviews over ads
   → Influencer/UGC marketing more effective than paid ads
3. **Tertiary**: They become brand loyal after purchase
   → High LTV if onboarding experience is good

**Business Probability:**
High confidence (15/50 comments = 30% of discussion)

**Strategic Action:**
- Offer freemium or trial period to reduce barrier
- Invest in review generation and testimonials
- Create comparison content showing value vs alternatives
```

**Example 2: Time-of-Day Patterns**
```markdown
## Evening Problem Discovery

**Observable Pattern:**
- 8 comments mention "late at night"
- 6 comments about "can't sleep because of this"
- 4 comments posted between 11pm-2am

**Derived Implications:**
1. **Immediate**: Problem surfaces during wind-down time
   → Anxiety/frustration peaks at night
2. **Secondary**: They're researching when problem is fresh
   → High intent, emotional state = conversion opportunity
3. **Tertiary**: They want immediate solutions
   → "Buy now" campaigns most effective 8pm-1am

**Business Probability:**
Medium-High (18/50 = 36% of engagement patterns)

**Strategic Action:**
- Schedule email campaigns for 7-9pm
- Offer 24/7 chat support or instant access
- Create "quick win" content for evening consumption
```

---

### 4. Output Structure Template

```markdown
# ⚡ EXECUTIVE SUMMARY (30 seconds)

┌──────────────────────────────────────────────────┐
│ **Biggest Finding:** [One sentence]              │
│ **Key Opportunity:** [One sentence]              │
│ **Immediate Action:** [One thing to do now]      │
└──────────────────────────────────────────────────┘

───

# 📊 QUANTITATIVE PATTERNS

## [Pattern Category 1]

| Grouping | Count | % | Business Insight |
|----------|-------|---|------------------|
| [Group A] | X | XX% | [What this reveals] |
| [Group B] | Y | YY% | [What this reveals] |

**Key Finding:** [1-2 sentences summarizing the table]

## [Pattern Category 2]
...

**Quantitative Summary:** [What all numbers collectively reveal]

───

# 💡 QUALITATIVE INSIGHTS

## [Theme 1]

**[Insight Title]**
- **Finding:** [1-2 sentences]
- **Evidence:** "[Quote]" (Comment #X)
- **Business Value:** [Why this matters]

**[Insight Title]**
...

───

# 🔗 DERIVED INSIGHTS & IMPLICATIONS

## [Insight Chain 1]

**Observable Pattern:** [What data shows]

**Derived Implications:**
1. [Immediate] → [Effect]
2. [Secondary] → [Effect]
3. [Tertiary] → [Effect]

**Business Probability:** [Confidence level]
**Strategic Action:** [What to do]

## [Insight Chain 2]
...

───

# 🎯 BUSINESS IMPLICATIONS

## For Marketing & Messaging
✅ [Action 1]
✅ [Action 2]

## For Product & Development
✅ [Action 1]
✅ [Action 2]

## For SEO & Content Strategy
✅ [Action 1]
✅ [Action 2]

───

# 📌 STRATEGIC SUMMARY

[2-3 sentences: The single most valuable synthesis]
```

---

### 5. Quality Checklist

Before submitting output, verify:

- [ ] Executive summary exists and is scannable in 30 seconds
- [ ] All quantitative data is in tables with percentages
- [ ] Quantitative insights show intelligent grouping (not just raw counts)
- [ ] Derived insights section exists with at least 2 insight chains
- [ ] No paragraph exceeds 2 sentences
- [ ] All numbers are bolded
- [ ] Visual icons are used appropriately
- [ ] Each insight has evidence + business value
- [ ] Strategic actions are specific and immediate

---

## Implementation Priority

1. **Phase 1 (Immediate)** - Prompt changes:
   - Add visual formatting requirements
   - Require intelligent grouping for quantitative
   - Add derived insights section
   - Add executive summary requirement

2. **Phase 2 (Next)** - Frontend CSS:
   - Style tables better
   - Add visual cards for insights
   - Highlight key metrics
   - Better spacing and readability

3. **Phase 3 (Future)** - Interactive features:
   - Collapsible sections
   - Charts/graphs
   - Export with better formatting

---

## Success Metrics

**Good output:**
- ✅ Scannable in 30 seconds (executive summary)
- ✅ Digestible in 3 minutes (quantitative + derived insights)
- ✅ Actionable (clear next steps)
- ✅ Visual (tables, bullets, icons, boxes)
- ✅ Insightful (reveals non-obvious patterns)

**Bad output:**
- ❌ Wall of text
- ❌ No tables or structure
- ❌ Just counting without interpretation
- ❌ No derived implications
- ❌ Vague or generic insights
- ❌ Vague or generic insights

---

## Problem-First Approach (Product Direction)

### Current Problem
The tool is feature-driven rather than problem-driven. Users paste random URLs without clear research objectives, leading to insights that feel "interesting but not useful."

### Solution: Research Context & Project Management

#### Phase 1: Research Context (Quick Win - 2 hours)
**Add research question input before analysis**

Before analyzing any Reddit post, ask:
```
What are you researching?
[Text input]
Example: "Why do users prefer Notion over Evernote?"

Optional tags: [Competitive Analysis] [Feature Research] [Pain Points]
```

**Benefits:**
- Forces problem-first thinking
- Insights become answers to specific questions
- Better context for AI analysis

#### Phase 2: Research Projects (Medium - 1 day)
**Group related analyses together**

```
MY RESEARCH PROJECTS
┌─────────────────────────────────────┐
│ 📁 Subscription Churn Analysis      │
│    Posts analyzed: 8                │
│    [View] [Add Posts] [Export]      │
├─────────────────────────────────────┤
│ 📁 Competitor Analysis              │
│    Posts analyzed: 12               │
│    [View] [Add Posts] [Export]      │
└─────────────────────────────────────┘
```

**Benefits:**
- Organize research over time
- Track progress on projects
- Build comprehensive reports

#### Phase 3: Cross-Post Synthesis (High Impact - 2 days)
**Combine insights from multiple posts**

```
SYNTHESIZED INSIGHTS (8 posts analyzed)

📊 PATTERNS ACROSS DISCUSSIONS

| Theme | Frequency | Confidence |
|-------|-----------|------------|
| Billing confusion | 6/8 posts | High |
| Poor onboarding | 5/8 posts | High |

🔗 CROSS-POST DERIVED INSIGHTS

Pattern: Billing confusion in 75% of discussions
→ Immediate: Drop-off at renewal
→ Secondary: Support ticket spikes
→ Recommendation: Add billing preview 7 days before charge
```

**Benefits:**
- See patterns invisible in single posts
- Higher confidence in findings
- Strategic insights, not tactical observations

#### Phase 4: Research Templates (Quick Win - 4 hours)
**Pre-built research scenarios**

```
CHOOSE RESEARCH TYPE:
- 🎯 Competitive Analysis
- 💡 Feature Validation
- 😤 Pain Point Discovery
- 📈 Market Opportunity
```

**Benefits:**
- Guided workflows
- Higher success rate
- Users know what to research

#### Phase 5: Comparison View (Medium - 1 day)
**Side-by-side insights**

```
COMPARING: r/productivity vs r/ObsidianMD

┌─────────────────────┬─────────────────────┐
│ r/productivity      │ r/ObsidianMD        │
├─────────────────────┼─────────────────────┤
│ Top concern:        │ Top concern:        │
│ Pricing (67%)       │ Learning curve (82%)│
└─────────────────────┴─────────────────────┘
```

**Benefits:**
- Understand different segments
- Market segmentation opportunities

### Implementation Priority
1. **This week:** Research question input (2 hours)
2. **Next week:** Research templates (4 hours)
3. **Week 3:** Project management (1 day)
4. **Week 4:** Cross-post synthesis (killer feature - 2 days)

---

## Future Platform Expansion

### Additional Content Sources (Planned)

The tool currently focuses on Reddit. Future expansion will include:

#### 1. YouTube Comments Analysis
- Extract comments from videos
- Analyze sentiment and themes
- Identify influencer impact
- Compare discussion quality vs Reddit

**Use cases:**
- Product launch feedback
- Tutorial/education content validation
- Influencer audience analysis
- Competitive video content research

#### 2. App Store Reviews (iOS)
- Extract reviews with ratings
- Analyze feature requests
- Track sentiment over versions
- Identify bug patterns and UX issues

**Use cases:**
- Product roadmap prioritization
- Competitive app analysis
- Version release impact tracking
- User pain point discovery

#### 3. Google Play Store Reviews (Android)
- Extract reviews with ratings
- Compare iOS vs Android user feedback
- Device/OS-specific issues
- Regional sentiment analysis

**Use cases:**
- Platform-specific feature development
- Cross-platform comparison
- Market-specific insights
- Technical issue identification

### Multi-Source Analysis (Future Goal)

**Vision:** Analyze the same topic across multiple platforms

Example research flow:
```
RESEARCH: "Notion user feedback on mobile experience"

Sources:
- Reddit r/Notion: 10 posts
- App Store reviews: 500 reviews
- YouTube video comments: 5 videos
- Play Store reviews: 500 reviews

SYNTHESIZED INSIGHTS ACROSS PLATFORMS:

Mobile sync issues:
- Reddit: 8/10 posts mention sync problems
- App Store: 45% of 1-star reviews cite sync
- YouTube: Top complaint in tutorial comments
- Play Store: 52% of recent negative reviews

→ HIGH CONFIDENCE: Sync is critical issue across all platforms
→ PRIORITY: Immediate fix required
```

### Technical Considerations

**API Requirements:**
- YouTube Data API v3 (comment extraction)
- App Store Connect API or web scraping
- Google Play Developer API or web scraping
- Rate limiting and quota management

**Data Consistency:**
- Unified data format across sources
- Consistent sentiment analysis
- Cross-platform comparison methodology

**Feature Parity:**
- Same AI analysis quality across sources
- Consistent export formats
- Unified project management

### Implementation Timeline

**Not immediate** - Focus on problem-first approach first:
1. ✅ Fix Reddit tool to be problem-first
2. ✅ Validate with users
3. ✅ Build cross-post synthesis
4. → Then expand to new platforms

**Estimated timeline for platform expansion:**
- Q1 2026: YouTube comments
- Q2 2026: App Store reviews
- Q3 2026: Play Store reviews
- Q4 2026: Multi-source synthesis

---

## Notes on Focused Extraction

**User requirement:** Option to focus on one medium at a time

**Implementation approach:**
```
SELECT CONTENT SOURCE:
○ Reddit Only
○ YouTube Only
○ App Store Only
○ Play Store Only
○ All Sources (synthesize)

[Continue →]
```

This allows:
- Faster analysis (single source)
- Source-specific insights
- Gradual adoption of multi-source
- Easier testing and validation
