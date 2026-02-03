# Product Roadmap - Reddit Analysis Platform

## Vision

Transform Reddit community insights into actionable intelligence for different user personas, delivered automatically.

---

## Product Portfolio

### 1. Content Radar - Creator Tool (MVP)

**Status**: In Development

**Target Audience**:
- Newsletter writers
- Podcasters
- YouTubers
- Content creators
- Bloggers

**Value Proposition**: "Never run out of content ideas. Get weekly insights from Reddit communities delivered to your inbox."

**Price Point**: $19-39/month

**Key Features**:
- Weekly/daily digests from any subreddit
- "Content Ideas" section with trending topics
- Thread highlights with actual conversations
- Emerging topic detection (first-mover advantage)
- Magazine-style format with human voices preserved

**Metrics to Track**:
- Signups
- Retention (week over week)
- Open rates
- Click-through rates
- Content created (self-reported)

---

### 2. Pulse Insider - Market Research Tool

**Status**: Future

**Target Audience**:
- Product Managers
- Brand Managers
- Market Researchers
- Marketers
- UX Researchers

**Value Proposition**: "Know what your customers discuss when you're not in the room."

**Price Point**: $49-199/month

**Key Features**:
- All Content Radar features, plus:
- Competitor mention tracking
- Feature request aggregation
- Sentiment trends over time
- Product mention alerts
- Pain point analysis with quotes
- Export to CSV/Notion

**Differentiators from Content Radar**:
- Focus on product/brand intelligence
- Competitor comparison views
- Longer historical analysis
- Team sharing features

---

### 3. Community Health - Manager Tool

**Status**: Future

**Target Audience**:
- Community Managers
- Moderators
- DevRel professionals
- Discord/Slack admins

**Value Proposition**: "Weekly health check for your community."

**Price Point**: $29/month per community

**Key Features**:
- Engagement trend tracking
- Emerging concerns early detection
- Top contributor recognition
- Sentiment health score
- "Temperature check" alerts
- Moderator workload insights

**Unique Angle**: Monitor YOUR OWN community, not research others.

---

### 4. Voice of Patient - Healthcare Insights

**Status**: Future (Enterprise)

**Target Audience**:
- Healthcare startups
- Patient advocacy groups
- Pharmaceutical companies
- Health tech companies
- Medical device companies

**Value Proposition**: "Understand real patient experiences at scale."

**Price Point**: $500+/month (enterprise sales)

**Key Features**:
- Treatment discussion tracking
- Side effect mention analysis
- Provider sentiment
- Insurance pain points
- Support group dynamics
- Anonymized quote library
- Compliance-safe exports

**Compliance Considerations**:
- No PII collection
- Aggregate-only reporting option
- Audit trails
- HIPAA considerations for enterprise

**Target Subreddits**:
- r/menopause
- r/diabetes
- r/ADHD
- r/depression
- r/ChronicPain
- r/cancer
- Condition-specific communities

---

### 5. Investor Pulse - Alternative Data

**Status**: Future

**Target Audience**:
- Venture Capitalists
- Angel investors
- Equity analysts
- Retail investors

**Value Proposition**: "Sentiment signals before they hit headlines."

**Price Point**: $99-299/month

**Key Features**:
- Product sentiment tracking
- Early signal detection
- Category trend analysis
- Competitor comparison
- "Buzz" scoring
- Historical sentiment charts

**Target Subreddits**:
- r/startups
- r/SaaS
- r/technology
- Industry-specific communities
- Product communities (r/notion, r/obsidian, etc.)

---

## Cross-Sell Strategy

```
Content Radar ($19-39)
    │
    │ "Want deeper market insights?"
    ▼
Pulse Insider ($49-199)
    │
    │ "Need enterprise features?"
    ▼
Enterprise Custom ($500+)
```

---

## Feature Comparison Matrix

| Feature | Content Radar | Pulse Insider | Community Health | Voice of Patient | Investor Pulse |
|---------|---------------|---------------|------------------|------------------|----------------|
| Weekly Digest | ✅ | ✅ | ✅ | ✅ | ✅ |
| Daily Digest | ✅ | ✅ | ✅ | Optional | ✅ |
| Content Ideas | ✅ | ❌ | ❌ | ❌ | ❌ |
| Competitor Tracking | ❌ | ✅ | ❌ | ✅ | ✅ |
| Sentiment Trends | Basic | Advanced | ✅ | ✅ | Advanced |
| Alert System | ❌ | ✅ | ✅ | ✅ | ✅ |
| Team Sharing | ❌ | ✅ | ✅ | ✅ | ✅ |
| API Access | ❌ | Add-on | ❌ | ✅ | Add-on |
| Historical Data | 4 weeks | 12 months | 12 months | 24 months | 12 months |
| Custom Reports | ❌ | ✅ | ❌ | ✅ | ✅ |
| Export | Basic | Full | Basic | Compliance | Full |

---

## Technical Foundation (Shared)

All products share:
- Core digest generation engine
- Supabase database
- BullMQ queue system
- Resend email delivery
- Community Pulse analysis logic

Product-specific additions:
- Different email templates per product
- Different analysis prompts per persona
- Different UI/dashboards
- Different pricing/billing logic

---

## Go-to-Market Strategy

### Content Radar (MVP)

**Distribution Channels**:
1. Twitter/X - Share interesting Reddit insights
2. Product Hunt - Launch with creator angle
3. Newsletter cross-promotions
4. YouTube creator communities
5. Indie hacker communities

**Content Marketing**:
- "What Reddit thinks about X" blog posts
- Weekly "Reddit Pulse" public digest
- "How I found my next video topic" case studies

**Pricing Strategy**:
- Free tier: 1 subreddit, weekly only
- Pro ($19/mo): 5 subreddits, daily + weekly
- Team ($39/mo): 10 subreddits, shared dashboard

### Future Products

- Pulse Insider: LinkedIn ads, PM communities, direct outreach
- Community Health: Discord/community manager networks
- Voice of Patient: Healthcare conferences, direct sales
- Investor Pulse: VC networks, finance newsletters

---

## Roadmap Timeline

### Q1 2026 (Current)
- [x] Community Pulse (manual analysis)
- [ ] Content Radar MVP
  - [ ] Subscription system
  - [ ] Weekly digest generation
  - [ ] Email delivery
  - [ ] Basic landing page

### Q2 2026
- [ ] Content Radar refinement
  - [ ] Focus topic personalization
  - [ ] Daily digest option
  - [ ] Improved email templates
- [ ] Free tier launch
- [ ] Product Hunt launch

### Q3 2026
- [ ] Pulse Insider beta
  - [ ] Competitor tracking
  - [ ] Historical trends
  - [ ] Team features
- [ ] Content Radar paid tier

### Q4 2026
- [ ] Community Health beta
- [ ] Voice of Patient research
- [ ] API development

### 2027
- [ ] Investor Pulse
- [ ] Enterprise features
- [ ] Multi-platform (beyond Reddit)

---

## Success Metrics

### Content Radar MVP Success Criteria

| Metric | Target (3 months) |
|--------|-------------------|
| Signups | 500+ |
| Weekly active | 200+ |
| Open rate | 40%+ |
| Retention (W4) | 30%+ |
| Paid conversion | 5%+ |

### Key Leading Indicators

1. **Engagement**: Are people opening/clicking digests?
2. **Retention**: Are they staying subscribed?
3. **Word of mouth**: Are they sharing/recommending?
4. **Upgrade interest**: Are free users asking about paid features?

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Reddit API changes | High | Cache data, diversify sources |
| Low engagement | Medium | A/B test formats, ask for feedback |
| Email deliverability | Medium | Use reputable provider (Resend), warm up domain |
| Competition | Low | Focus on creator niche, human voice preservation |
| Scale costs | Medium | Monitor Gemini API costs, optimize prompts |

---

## Notes

- Start narrow (Content Radar for creators)
- Validate before expanding
- Each product should fund the next
- Keep core engine shared, customize presentation
- Human voice preservation is the key differentiator
