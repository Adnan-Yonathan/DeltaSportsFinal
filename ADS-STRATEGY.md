# Delta Sports — Meta Ads Strategy

## Situation

- $4.5K MRR, ~65-70 subscribers, all organic (Reddit/X)
- Goal: Maximize new subscribers. Get to $10K MRR.
- Budget: $50/day ($1,500/month)
- Product: Sharp money tracking & betting analytics SaaS
- Pricing: Sharp ($59/mo) | Syndicate ($79/mo) — 3-day free trial
- Current CAC: $0 — every paid subscriber is net new growth

---

## Account Structure

Keep it tight. At $50/day, every dollar needs to work. Two campaigns only.

```
Delta Sports Ad Account
│
├── Campaign 1: PROSPECTING (CBO)
│   Budget: $42/day ($1,260/mo)
│   Objective: Conversions (Purchase)
│   Optimization: Lowest Cost
│   │
│   ├── Ad Set: Advantage+ Audience
│   │   Age: 21-45, Male, US
│   │   No interest targeting — let Meta find converters
│   │   Placements: Advantage+ (all placements)
│   │   │
│   │   ├── Ad 1: Results Proof A (verified bets screenshot)
│   │   ├── Ad 2: Results Proof B (different timeframe)
│   │   ├── Ad 3: Feature — Sharp Money Signals
│   │   ├── Ad 4: Feature — AI Projections
│   │   ├── Ad 5: Pain — "Betting against sharps"
│   │   ├── Ad 6: Pain — "The line moved. Do you know why?"
│   │   ├── Ad 7: Tip — Sharp Money 101
│   │   └── Ad 8: Tip — Line Movement
│   │
│   └── [MONTH 2] Ad Set: 1% Lookalike of Paying Subscribers
│       (Only add once you have 100+ in your subscriber list)
│
└── Campaign 2: RETARGETING
    Budget: $8/day ($240/mo)
    Objective: Conversions (Purchase)
    │
    ├── Ad Set: Website Visitors (3-30 days, exclude subscribers)
    │   ├── Ad 1: Trial reminder — "Still thinking about it?"
    │   └── Ad 2: Price anchor vs competitors
    │
    └── Ad Set: Trial Started, Didn't Convert
        ├── Ad 1: "Your trial ended — sharp money didn't stop"
        └── Ad 2: Feature they didn't try yet
```

**Why this structure:**

- **One prospecting ad set, not three.** At $42/day, splitting across multiple ad sets starves each one. One Advantage+ ad set with 4 ads gives Meta enough budget to optimize and exit learning phase.
- **Advantage+ Audience over interest stacking.** Meta's algorithm is better at finding converters than you are at picking interests. Give it broad parameters (age, gender, country) and let the creative do the targeting.
- **Retargeting at $8/day is cheap but high-ROI.** These people already visited your site. Conversion rate is 3-5x cold traffic.

---

## Conversion Setup (Do This First)

### Step 1: Meta Pixel

Install the Meta Pixel base code on deltasports.app. You can do this via:
- Direct install in `app/layout.tsx` (next to your existing GA4 gtag)
- Or Google Tag Manager if you prefer

```html
<!-- Meta Pixel Base Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'YOUR_PIXEL_ID');
fbq('track', 'PageView');
</script>
```

### Step 2: Conversion Events

Fire these events at the right moments:

| Event | When to Fire | Where in Code |
|-------|-------------|---------------|
| `PageView` | Every page load | Pixel base code (automatic) |
| `ViewContent` | Pricing page visited | `/pricing` page |
| `Lead` | Account created / trial started | Signup success handler |
| `Purchase` | Paid subscription confirmed | Stripe webhook success / `/stripe/success` page |

**The Purchase event must include value:**
```js
fbq('track', 'Purchase', {
  value: 59.00,  // or 79.00 for Syndicate
  currency: 'USD'
});
```

### Step 3: Conversions API (CAPI)

Client-side Pixel alone is unreliable (ad blockers, iOS). Set up server-side CAPI:

- Fire `Lead` and `Purchase` events from your Next.js API routes or Stripe webhook handler
- Use Meta's Conversions API directly or a partner integration (Segment, GTM Server-Side)
- This is a Day 1 priority — without CAPI, you'll undercount conversions and Meta can't optimize properly

### Step 4: Aggregated Event Measurement

In Meta Events Manager → Aggregated Event Measurement → Configure:

Priority ranking (highest to lowest):
1. Purchase
2. Lead (trial signup)
3. ViewContent
4. PageView

### Step 5: Optimization Event

- **Optimize for Purchase from day one.**
- At $42/day prospecting, you need ~1 purchase/day for Meta to optimize. If you're converting 20-25% of trials, you need ~4 trials/day. At $10-15 CPA per trial, that's $40-60/day — right in range.
- If after 2 weeks you have fewer than 15 purchases total, temporarily switch to Lead (trial signup) optimization, then switch back once volume picks up.

---

## Creative Strategy

### Static Creatives — 8 at Launch

Every creative in both **1080x1080** (feed) and **1080x1920** (story/reel).

**Results (2 creatives)**

1. **Results Proof A** — Screenshot of verified winning bets
   - Overlay: "Public. Verified. Real."
   - Subtext: "Not picks. Just data."
   - CTA: "Start free →"

2. **Results Proof B** — Different screenshot, different timeframe/sport
   - Overlay: "We post every bet. Check the record."
   - CTA: "Try it free for 3 days →"

**Feature Showcases (2 creatives)**

3. **Feature: Sharp Money Signals** — Product screenshot of a sharp signal firing
   - Overlay: "Sharp money just hit the over. The line moved 2 points in 30 seconds."
   - CTA: "See it before it moves →"

4. **Feature: AI Projections** — Product screenshot of projections board
   - Overlay: "Model-driven projections across NBA, NFL, NHL, MLB."
   - Subtext: "Know the edge before you place the bet."
   - CTA: "3 days free →"

**Pain Points (2 creatives)**

5. **Pain: Betting Blind** — Bold text on dark background, no product screenshot
   - Main text: "You're betting against sharps and you don't even know it."
   - Subtext: "Delta shows you where the smart money is. Every game."
   - CTA: "Stop guessing →"

6. **Pain: Information Gap** — Bold text on dark background
   - Main text: "The line moved. Do you know why?"
   - Subtext: "Sharp money, whale bets, exchange orderbooks — all in one place."
   - CTA: "See what you're missing →"

**Tips / Education (2 creatives)**

7. **Tip: Sharp Money 101** — Clean graphic with a quick insight
   - Main text: "When 30% of bets move the line the opposite direction — that's sharp money."
   - Subtext: "Delta tracks it in real time so you don't have to guess."
   - CTA: "Try it free →"

8. **Tip: Line Movement** — Clean graphic with a quick insight
   - Main text: "The line opened -3. It's now -5. That's not public money."
   - Subtext: "See who moved it and why — in real time."
   - CTA: "Start free →"

### Creative Rotation Schedule

| Week | Action |
|------|--------|
| Week 1 | Launch with all 8 statics |
| Week 2 | Review CTR — kill anything below 1% after $30 spend |
| Week 3 | Replace killed ads with new variations of the winning category |
| Week 4 | Add 1 video (15s screen recording of product in action) |
| Every 2-3 weeks | Refresh bottom 2-3 performers with new hooks in winning formats |

### Fatigue Signal
When frequency hits 3+ on any ad, it's time to refresh. At $50/day this will happen every 2-3 weeks on retargeting, every 4-6 weeks on prospecting.

---

## Ad Copy Bank

### Primary Text (use one per ad)

**Results-focused:**
> We post every bet. Public, verified, on the record.
>
> No picks. No promises. Just data — and a track record you can check yourself.
>
> Try it free for 3 days →

**Feature-focused:**
> Sharp money just moved on tonight's game. Do you see it?
>
> Delta reads exchange orderbooks and tracks whale bets — so you bet with the sharps, not against them.
>
> Free for 3 days →

**Pain-focused:**
> You're betting against sharps and you don't even know it.
>
> Delta shows you where the smart money sits — exchange orderbooks, whale bets, real-time signals.
>
> Stop guessing → 3-day free trial

**FOMO:**
> The line just moved 2 points in 30 seconds. Was it sharp money?
>
> Delta would have shown you before it happened.
>
> Try it free →

**Tips / Education:**
> When 30% of bets move the line the opposite direction — that's sharp money.
>
> Most bettors never see it. Delta tracks it in real time across NBA, NFL, NHL, MLB.
>
> See it yourself — 3 days free →

**Short (for placements with limited text):**
> Sharp money tracking. See what moves the line.
> 3-day free trial →

### Headlines (40 chars max)
1. See Where Sharps Are Betting
2. 3 Days Free — Start Now
3. Sharp Money Signals — Real Time
4. Stop Guessing. Start Tracking.
5. The Line Moved. Here's Why.
6. Bet With the Sharps, Not Against.

### Retargeting Copy

**Website visitors:**
> Still thinking about it?
>
> Sharp money doesn't wait. Neither should you.
> Your 3-day free trial is ready →

**Expired trials:**
> Your trial ended. The sharp money signals didn't.
>
> Come back for $59/mo — less than $2/day for real edge.
> Reactivate →

---

## Custom Audiences

Build these before launching:

| Audience | Source | Use |
|----------|--------|-----|
| Website visitors (30 days) | Pixel | Retargeting campaign |
| Pricing page visitors (14 days) | Pixel | Retargeting (hot leads) |
| Trial signups (didn't pay) | Customer list upload | Retargeting campaign |
| Paying subscribers | Customer list upload | **Exclude** from all campaigns |
| 1% Lookalike of subscribers | From subscriber list | Prospecting (Month 2, need 100+) |

**Important:** Exclude paying subscribers from everything. Don't pay to show ads to people already paying you.

---

## Week-by-Week Launch Plan

### Week 1: Foundation
- [ ] Create Meta Business Manager + ad account
- [ ] Install Pixel on deltasports.app
- [ ] Set up CAPI (server-side Lead + Purchase events)
- [ ] Verify domain in Business Manager
- [ ] Configure Aggregated Event Measurement (priority: Purchase > Lead > ViewContent)
- [ ] Upload customer list (paying subscribers) → create exclusion audience
- [ ] Create website visitor custom audience
- [ ] Create 8 static creatives (2 results, 2 features, 2 pain points, 2 tips) in 1080x1080 + 1080x1920
- [ ] Write 5 primary text variations + 6 headlines

### Week 2: Launch
- [ ] Launch Prospecting campaign: 1 Advantage+ ad set, 4 ads, $42/day
- [ ] Launch Retargeting campaign: website visitors ad set, 2 ads, $8/day
- [ ] Optimization: Purchase, Bidding: Lowest Cost
- [ ] **Do not touch anything for 5 days.** Let the learning phase complete.
- [ ] Daily check: is Pixel firing? Are conversions tracking? Is spend pacing correctly?

### Week 3: First Read
- [ ] Review performance: CTR, CPC, CPA per trial, CPA per subscriber
- [ ] Kill any ad with CTR below 1% after $30+ spend
- [ ] Check frequency — anything above 2.5 already? (unlikely this early on prospecting)
- [ ] Review Pixel events: are Purchase events recording with correct values?
- [ ] If 0 purchases tracked in 7 days at $42/day ($294 spent), switch optimization to Lead temporarily

### Week 4: Iterate
- [ ] Create 2-3 new ad variations based on what's working (same format, new hooks)
- [ ] Add trial-didn't-convert custom audience to retargeting
- [ ] Review demographic breakdown — any age/gender/placement outliers?
- [ ] Check: are you getting trial signups? What's trial→paid conversion rate from paid traffic?

### Month 2: Optimize
- [ ] Upload updated subscriber list → refresh Lookalike (if 100+, create 1% LAL and add as new ad set)
- [ ] Refresh creative — retire any ad running 3+ weeks
- [ ] Test new creative concept (UGC, talking head, different hook angle)
- [ ] Shift retargeting budget up if CPA is strong ($8→$12/day)
- [ ] Monthly review: total subscribers added, CPA, trial→paid rate

### Month 3: Scale or Cut
- [ ] If CPA per subscriber is under $80: increase to $65-75/day
- [ ] If CPA per subscriber is $80-120: optimize creative + landing page before scaling
- [ ] If CPA per subscriber is above $120: pause, diagnose, and fix before spending more
- [ ] Test Advantage+ Shopping Campaign as a separate $10-15/day experiment
- [ ] Consider adding $200/mo Google Search (competitor keywords only) alongside

---

## Numbers to Watch

| Metric | Red Flag | Acceptable | Good |
|--------|----------|------------|------|
| CTR | Below 1% | 1-2% | 2%+ |
| CPC | Above $4 | $1.50-3 | Below $1.50 |
| CPA (trial) | Above $30 | $15-25 | Below $15 |
| CPA (subscriber) | Above $120 | $60-100 | Below $60 |
| Frequency (prospecting) | Above 4 | 1.5-3 | Below 2 |
| Frequency (retargeting) | Above 6 | 2-4 | Below 3 |
| Trial → paid rate | Below 15% | 20-25% | 30%+ |

## Rules

1. **Don't touch campaigns for 5 days after launch or any significant change.** Learning phase needs time.
2. **Kill ads at $30 spend with <1% CTR.** They won't improve.
3. **Kill ad sets at 3x target CPA with 0 conversions.** Move on.
4. **Refresh creative every 2-3 weeks.** Fatigue is the #1 killer at this budget.
5. **Never scale more than 20% at a time.** Jumping $42→$60 is fine. $42→$80 resets learning.
6. **Your creative IS your targeting.** At Advantage+ with broad audience, the ad itself determines who sees it. Bad creative = wasted budget. Good creative = Meta finds your audience for you.
7. **Check Search → Paid channel attribution weekly.** Make sure paid subscribers are actually coming from Meta, not organic users who happened to click an ad.
