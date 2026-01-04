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
