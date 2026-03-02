# Delta SEO Plan (2026)

## 1) Business Goal and Positioning
Delta should win search for bettors who want data-backed decision support, not pick-selling content.

Primary growth goal:
- Increase qualified organic traffic that converts into trial starts and paid subscriptions.

Positioning to reinforce:
- "AI sports betting assistant for sharp betting, player props, line shopping, and market movement."
- Educational + analytics-first + responsible gaming.

## 2) Priority SEO Themes
Prioritize these themes in this order:

1. Player Props
- Core intents: "player props today", "best player prop tool", "player prop odds".
- Commercial-intent pages should lead to Delta tools.

2. Sharp Betting
- Core intents: "sharp betting", "sharp money", "how to find sharp action", "sharp betting tools".
- Blend educational explainers and tool pages.

3. AI Betting
- Core intents: "AI sports betting", "AI betting app", "sports betting AI model".
- Emphasize transparent methodology and tracking.

4. Edge Math / Execution
- Core intents: "EV betting", "CLV tracker", "line shopping", "best odds finder", "bankroll management".
- This becomes Delta's trust/authority moat.

5. Live Betting Intelligence
- Core intents: "live betting tools", "in-game odds movement", "real-time betting signals".

## 3) Current Site Baseline (Repo-Specific)
Existing strengths:
- High-intent landing page already exists: `/sharp-betting-tools`.
- Dynamic blog + slate pages exist with indexable content and `Article` schema.
- `sitemap.ts` and `robots.ts` already implemented.

Immediate gaps:
- Most core tool pages have no route-level metadata exports.
- Sitemap currently includes `/about`, but no route exists for it.
- Several high-intent routes are dynamic/auth-heavy and need clear indexability strategy.
- FAQ schema is present, but FAQ rich results are restricted for most non-health/non-government sites.

## 4) Information Architecture and Page Map
Build a focused SEO architecture (pillar -> cluster -> daily/programmatic):

Pillar pages (money pages):
- `/sharp-betting-tools` (existing; keep as primary "sharp betting tools" target)
- `/player-prop-tools` (new; primary player props commercial page)
- `/ai-betting-tools` (new; primary AI betting commercial page)
- `/line-shopping` (existing; optimize as dedicated line shopping page)
- `/ev-bets` + `/crossed-ev` (existing; convert into EV education + tool intent)

Cluster pages (education + comparison intent):
- `/learn/what-is-sharp-betting`
- `/learn/sharp-money-vs-public-money`
- `/learn/how-to-bet-player-props`
- `/learn/ai-sports-betting-how-it-works`
- `/learn/closing-line-value-clv`
- `/learn/line-shopping-guide`
- `/learn/betting-unit-size-bankroll`

Programmatic/data pages (from existing projection feeds):
- Sport/date slate pages (already in `/slate/[sport]/[date]`)
- Game breakdown pages (already in `/blog/[sport]/[date]/[slug]`)
- Add player-prop market pages by sport/date/book (new templates later)

## 5) Keyword Cluster Plan
Use intent buckets and map one primary query + a tight semantic cluster per page.

Player Props cluster:
- Primary: player props, best player props, player prop tool, player prop odds
- Supporting: NBA player props today, NFL props today, prop line movement, prop EV

Sharp Betting cluster:
- Primary: sharp betting, sharp betting tools, sharp money
- Supporting: reverse line movement, public vs sharp betting, steam moves, betting splits

AI Betting cluster:
- Primary: AI sports betting, AI betting app, AI betting tools
- Supporting: betting model, predictive betting model, model tracking, AI picks explained

Execution/Math cluster:
- Primary: line shopping tool, EV calculator, CLV tracker, bankroll strategy
- Supporting: expected value betting, implied probability calculator, unit sizing

## 6) Content Engine (90-Day Plan)
Publishing mix:
- 40% evergreen explainers (authority)
- 40% data-backed game/market pages (freshness)
- 20% comparison + conversion pages (commercial intent)

Week 1-4 (Foundation):
1. Fix metadata/indexation/canonicals for top routes.
2. Publish 6 pillar/cluster pages (sharp, props, AI, line shopping, CLV, bankroll).
3. Create internal linking blocks across tools, blog, and docs.

Week 5-8 (Scale):
1. Publish 2 high-quality guides per week.
2. Launch "daily props board" pages (sport + date).
3. Add "methodology + model performance" trust pages.

Week 9-12 (Authority):
1. Publish 2 data studies using your own lines/splits/CLV dataset.
2. Build link outreach around studies.
3. Refresh top pages with new data and FAQ sections.

## 7) Technical SEO Backlog (Highest Impact First)
1. Add metadata exports for high-intent routes lacking them:
- `app/sharp-props/page.tsx`
- `app/player-prop-odds/page.tsx`
- `app/line-shopping/page.tsx`
- `app/ev-bets/page.tsx`
- `app/crossed-ev/page.tsx`
- `app/live-projections/page.tsx`
- `app/market-projections/page.tsx`

2. Add canonical + OG/Twitter for dynamic pages where missing:
- `app/blog/[sport]/[date]/[slug]/page.tsx`
- `app/slate/[sport]/[date]/page.tsx`

3. Fix sitemap integrity:
- Remove `/about` from `app/sitemap.ts` or create `/about`.

4. Add structured data where relevant:
- `SoftwareApplication` on core tool pages.
- `BreadcrumbList` on blog/slate/learn pages.
- Keep FAQ schema for semantics, but do not rely on FAQ rich snippets.

5. Page speed/Core Web Vitals:
- Prioritize interaction responsiveness (INP), especially for data tables and filters.

## 8) Conversion SEO (Turn Traffic into Revenue)
Each SEO landing page should have:
1. One clear hero CTA ("Start Free Trial" / "Open Tool").
2. One trust strip (methodology, update timestamps, data sources).
3. One proof block (tracked performance, CLV, line capture examples).
4. One internal link block to adjacent workflows:
- "Found a prop -> line shop -> track CLV -> review bankroll impact."

## 9) Internal Linking System
Mandatory links on each page:
1. To a relevant tool page.
2. To one methodology/trust page.
3. To one adjacent educational page.
4. From daily pages back to pillar pages.

Anchor examples:
- "player prop odds scanner"
- "sharp money signals"
- "line shopping tool"
- "closing line value tracker"
- "AI betting model breakdown"

## 10) Trust, Compliance, and Responsible Gaming
Do not position content as guaranteed picks.

Standards:
1. Keep educational/analytics framing consistent with Terms and responsible gaming docs.
2. Add clear risk/disclaimer language on commercial-intent pages.
3. Keep helpline references current. As of September 29, 2025, NCPG transitioned away from 1-800-GAMBLER branding and now promotes 1-800-MY-RESET.
4. Show "last updated" timestamps on all fast-changing market pages.

## 11) Measurement and KPI Targets
Primary KPIs:
1. Non-brand organic clicks (GSC).
2. Trial starts from organic sessions.
3. Organic conversion rate by landing page.
4. Rankings for head terms:
- sharp betting tools
- player prop tools
- AI sports betting tools
- line shopping tool
- CLV tracker

Leading indicators:
1. Indexed pages count and crawl health.
2. CTR gains from title/meta improvements.
3. Internal link depth to money pages.
4. Core Web Vitals pass rate (especially INP).

Suggested 90-day targets:
1. +30-50% non-brand organic clicks.
2. +20-30% trial starts from organic.
3. Top 10 positions for 10+ mid-tail intent queries.

## 12) Execution Checklist
Week 1:
1. Metadata/canonical/sitemap fixes.
2. Define keyword map per URL.

Week 2-3:
1. Publish player props + AI betting pillar pages.
2. Publish first 4 educational cluster pages.

Week 4-6:
1. Roll out daily props pages and stronger internal linking.
2. Add methodology/performance pages.

Week 7-12:
1. Publish 2 proprietary data studies.
2. Run digital PR/outreach.
3. Refresh top pages based on GSC query data.

---

## References (used for strategy constraints)
- Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Creating helpful, people-first content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google spam policies (including scaled content abuse): https://developers.google.com/search/docs/essentials/spam-policies
- FAQ structured data feature availability: https://developers.google.com/search/docs/appearance/structured-data/faqpage
- Subscription/paywalled content markup: https://developers.google.com/search/docs/appearance/structured-data/paywalled-content
- INP (Interaction to Next Paint): https://web.dev/articles/inp
- NCPG helpline update resources: https://www.ncpgambling.org/help-treatment/about-the-national-problem-gambling-helpline/ and https://www.ncpgambling.org/helpline-stakeholder-faq/
