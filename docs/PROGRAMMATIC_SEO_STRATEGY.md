# Programmatic SEO Strategy — Delta Sports

*Created: 2026-04-15*
*Owner: Growth / Marketing*
*Extends: `docs/SEO_PLAN_DELTA_2026.md`*

---

## 0. TL;DR

Delta is a Month-4, low-authority domain competing against ESPN, Covers, Action Network, OddsJam, and Unabated. Beating them head-on for "NFL picks" is impossible. Winning requires three programmatic plays, rolled out in waves:

| Wave | Playbook | Pages | Why now |
|------|----------|-------|---------|
| 1 | Calculators (one-per-URL) | ~22 | Link magnets, sharp-bettor intent, evergreen |
| 1 | Glossary | ~65 | Topical authority, long-tail, low competition |
| 2 | Comparisons / alternatives | ~12 | Highest-intent commercial traffic |
| 2 | Sharp-report league hubs | 7 | Static pillar pages for the Wave 3 spokes |
| 3 | Daily sharp reports (programmatic) | ∞ | Proprietary data moat — whales + Pinnacle moves |

**Conversion goal for all pages:** trial signup (`/trial` or platform-specific CTA).

---

## 1. Opportunity Analysis

### 1.1 Domain Constraints
- ~4 months old, low DA, ~$3.4k MRR.
- 8% visitor→trial conversion (strong product-market fit signal).
- 7-10 pageviews/visitor (engaged audience — good for internal linking).
- Must avoid head-term combat. Must win long-tail first, then expand.

### 1.2 Proprietary Data Assets (the moat)
Confirmed in the codebase:
- `lib/api/kalshi.ts`, `lib/api/polymarket.ts` — exchange orderbook reads
- `scripts/ingest-whale-trades.ts` + `/api/cron/ingest-whale-trades` — large-bet detection
- `scripts/ingest-whale-trades-historical.ts` — backfill for ranking trends
- `app/market-projections/page.tsx` — Pinnacle line-movement tracker (NBA/NCAAB/CFB/NFL/NHL/MLB)

This data is **not publishable by any competitor** without building the same pipelines. That asymmetry is the foundation of Wave 3.

### 1.3 Search Intent Alignment
Delta's ICP searches:
- **Tools:** "kelly calculator", "no vig calculator", "expected value bet calculator"
- **Education:** "what is CLV", "what is reverse line movement"
- **Shopping:** "oddsjam alternative", "cheaper than unabated"
- **Action:** "sharp money NFL", "whale bets today", "biggest sharp bets"

The first three are evergreen head/mid-tail. The fourth is where Wave 3 programmatic lives.

---

## 2. URL Architecture

```
/calculators/                      # Hub (refactor existing combined page)
  /calculators/kelly-criterion
  /calculators/no-vig
  /calculators/expected-value
  /calculators/hold
  /calculators/parlay
  /calculators/arbitrage
  /calculators/hedge
  /calculators/odds-converter
  /calculators/clv
  /calculators/implied-probability
  /calculators/round-robin
  /calculators/teaser
  /calculators/middle
  /calculators/half-point
  /calculators/poisson
  /calculators/fair-odds
  /calculators/bankroll
  /calculators/unit-size
  /calculators/breakeven
  /calculators/devig
  /calculators/freeplay
  /calculators/parlay-odds

/learn/                            # Hub (merge with existing /learn in SEO_PLAN_DELTA_2026)
  /learn/glossary/                 # Glossary index
  /learn/glossary/sharp-money
  /learn/glossary/clv
  /learn/glossary/steam-move
  /learn/glossary/reverse-line-movement
  /learn/glossary/[...65 more]

/vs/                               # Comparisons hub
  /vs/oddsjam-alternative          # EXISTING → move into /vs/ hub
  /vs/unabated-alternative
  /vs/action-network-alternative
  /vs/outlier-alternative
  /vs/crazy-ninja-odds-alternative
  /vs/betstamp-alternative
  /vs/betlabs-alternative
  /vs/pikkit-alternative
  /vs/don-best-alternative
  /vs/sports-insights-alternative
  /vs/sharp-side-alternative
  /vs/betting-pros-alternative

/sharp-report/                     # Wave 3 hub
  /sharp-report/nfl                # League pillar
  /sharp-report/nba
  /sharp-report/mlb
  /sharp-report/nhl
  /sharp-report/ncaaf
  /sharp-report/ncaab
  /sharp-report/all                # Cross-sport "today"

  /sharp-report/nfl/[date]         # Daily spoke (programmatic)
  /sharp-report/nba/[date]
  ...

/whale-trades/                     # Alt entry for the same data
  /whale-trades                    # Live "today" page
  /whale-trades/[date]             # Daily archive
  /whale-trades/[team]             # Rolling team page (e.g., /whale-trades/chiefs)
```

**Rules:**
- Subfolders only (never subdomains).
- Trailing-slash consistency (pick one in `next.config.js`, redirect the other).
- Canonical tags on every programmatic page.
- `/calculators/` becomes a hub with 22 spokes; the existing combined page becomes the hub layout.
- `/oddsjam-alternative` gets a 301 to `/vs/oddsjam-alternative`.

---

## 3. Playbook 1 — Calculators (Wave 1)

### 3.1 Why
Sharp bettors use these daily. Competitors (Action Network, OddsShark) have them but don't optimize per-URL. Each calculator = one URL = one primary keyword. The computation already exists in `lib/utils/calculators.ts`.

### 3.2 Keyword Targets
| URL | Primary | Est. US volume |
|-----|---------|----------------|
| `/calculators/kelly-criterion` | kelly criterion calculator | 4,400 |
| `/calculators/no-vig` | no vig calculator | 2,900 |
| `/calculators/expected-value` | expected value betting calculator | 2,400 |
| `/calculators/hold` | sportsbook hold calculator | 1,300 |
| `/calculators/parlay` | parlay calculator | 40,500 |
| `/calculators/arbitrage` | arbitrage betting calculator | 8,100 |
| `/calculators/hedge` | hedge bet calculator | 5,400 |
| `/calculators/odds-converter` | odds converter | 6,600 |
| `/calculators/clv` | clv calculator | 720 |
| `/calculators/implied-probability` | implied probability calculator | 1,900 |
| `/calculators/round-robin` | round robin bet calculator | 2,400 |
| `/calculators/teaser` | teaser calculator | 1,000 |
| `/calculators/middle` | middle bet calculator | 390 |
| `/calculators/half-point` | half point calculator | 320 |
| `/calculators/poisson` | poisson calculator betting | 210 |
| `/calculators/fair-odds` | fair odds calculator | 590 |
| `/calculators/bankroll` | betting bankroll calculator | 880 |
| `/calculators/unit-size` | betting unit size calculator | 480 |
| `/calculators/breakeven` | betting breakeven calculator | 260 |
| `/calculators/devig` | devig calculator | 1,600 |
| `/calculators/freeplay` | free play calculator | 170 |
| `/calculators/parlay-odds` | parlay odds calculator | 3,600 |

(Volumes approximate; validate with Ahrefs/Semrush before launch.)

### 3.3 Page Template

```
<title>{Calculator Name} Calculator — {Benefit} | Delta Sports</title>
<meta name="description">{Action verb} {what it does} in seconds. Free {calculator type} calculator used by sharp bettors. {Differentiator}.</meta>

H1: {Calculator Name} Calculator

[Calculator widget — interactive, above the fold]

H2: How to use this {calculator name}
  — 3-5 step walkthrough with a concrete example
  — Screenshot or inline example values

H2: Formula + math
  — The actual formula (LaTeX/MathML if possible)
  — Plain-English explanation
  — Edge cases / when it breaks

H2: Worked example
  — Full numerical walkthrough with a real market
  — Show input → output → interpretation

H2: When sharp bettors use this
  — 2-3 real-world scenarios
  — Tie to sharp-money / CLV framing

H2: Related tools
  — Internal links to 4-6 adjacent calculators
  — One link to /learn/glossary/[related-term]
  — One link to /sharp-report/ or /whale-trades/

[CTA block — "Delta auto-runs this on every line it tracks. Start 7-day trial →"]

H2: FAQ
  — 4-6 questions, schema-marked
```

**Uniqueness requirements (avoid thin-content penalty):**
- Unique worked example per page, with real numbers.
- Unique "when sharp bettors use this" narrative tying to Delta's positioning.
- Screenshot of Delta's product using the concept (different per page).
- No shared boilerplate beyond ~100 words of site-wide chrome.

### 3.4 Schema Markup
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Kelly Criterion Calculator",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Any",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "creator": { "@type": "Organization", "name": "Delta Sports" }
}
```
Plus `FAQPage` schema on the FAQ block.

---

## 4. Playbook 2 — Glossary (Wave 1)

### 4.1 Why
Aggregates topical authority. Each term is low-volume alone but compounds: Google ranks whole-site expertise, and glossary breadth signals it. Every tool/blog/report page internally links into glossary terms.

### 4.2 Term List (65 terms, grouped)

**Sharp money (10)**
sharp money · sharp bettor · steam move · reverse line movement · square money · consensus picks · betting splits · ticket vs handle · limit move · liquidity move

**Exchange / market (10)**
betting exchange · orderbook · bid-ask spread · market maker · Pinnacle · Kalshi · Polymarket · Novig · ProphetX · liquidity

**Math & edge (12)**
CLV · expected value · kelly criterion · no-vig odds · implied probability · fair odds · devig · hold · vig / juice · variance · standard deviation · Z-score

**Bet types (14)**
moneyline · point spread · total (over/under) · parlay · teaser · round robin · middle · arb · hedge · freeplay · if-bet · reverse · pleaser · prop bet

**Execution (9)**
line shopping · closing line · opener · market consensus · soft book · sharp book · limits · bet sizing · unit

**Advanced (10)**
poisson distribution · regression to the mean · power ratings · pace of play · situational spots · look-ahead spot · sandwich spot · trap line · key numbers · half-point value

### 4.3 Page Template

```
<title>What Is {Term}? Definition + Example | Delta Sports</title>
<meta name="description">{Term} explained in 2 minutes. {One-sentence definition}. See how sharp bettors use it with a real market example.</meta>

H1: What is {term}?

[Definition block — 1-2 sentences, bolded, at top]

H2: {Term} in plain English
  — 100-150 word explanation, no jargon

H2: Example
  — Concrete market example with numbers
  — Screenshot if the term is product-visible in Delta

H2: Why it matters for profitable betting
  — Tie to CLV / sharp framing

H2: Common misconceptions
  — 2-3 bullets — unique per term

H2: Related terms
  — 5-8 internal links to other glossary entries

[CTA — "See {term} on live markets in Delta — start 7-day trial"]
```

### 4.4 Schema Markup
```json
{ "@context": "https://schema.org", "@type": "DefinedTerm",
  "name": "Closing Line Value",
  "description": "...",
  "inDefinedTermSet": "https://deltasports.app/learn/glossary" }
```
Plus a `DefinedTermSet` on the glossary index page listing all entries.

### 4.5 Uniqueness Guardrails
- Min 350 words of unique body per entry.
- Unique example per term (never reuse the same market).
- No auto-generated content. Draft in batches of 5-10 with a human editor.

---

## 5. Playbook 3 — Comparisons / Alternatives (Wave 2)

### 5.1 Why
"X alternative" = someone shopping sharp tools *right now*. Highest commercial intent in this vertical. Delta's 1/4-price positioning is a natural wedge.

### 5.2 Target List
| URL | Primary KW | Volume | Priority |
|-----|-----------|--------|----------|
| `/vs/oddsjam-alternative` | oddsjam alternative | 880 | Exists — upgrade |
| `/vs/unabated-alternative` | unabated alternative | 320 | P0 |
| `/vs/action-network-alternative` | action network alternative | 480 | P0 |
| `/vs/outlier-alternative` | outlier.bet alternative | 210 | P0 |
| `/vs/crazy-ninja-odds-alternative` | crazy ninja odds alternative | 110 | P1 |
| `/vs/betstamp-alternative` | betstamp alternative | 170 | P1 |
| `/vs/betlabs-alternative` | bet labs alternative | 90 | P1 |
| `/vs/pikkit-alternative` | pikkit alternative | 140 | P1 |
| `/vs/don-best-alternative` | don best alternative | 170 | P2 |
| `/vs/sports-insights-alternative` | sports insights alternative | 260 | P2 |
| `/vs/sharp-side-alternative` | sharpside alternative | 90 | P2 |
| `/vs/betting-pros-alternative` | bettingpros alternative | 590 | P2 |

### 5.3 Template

```
H1: The best {Competitor} alternative for {primary benefit}

[Hero comparison card — side-by-side pricing]

H2: TL;DR — {Competitor} vs Delta
  Table: Feature | {Competitor} | Delta

H2: Where {Competitor} wins
  — HONEST assessment (2-3 points)
  — Establishes trust + avoids sounding like a hit piece

H2: Where Delta wins
  — 3-5 points
  — Lead with price + sharp-money focus

H2: Who should choose {Competitor}
  — User segments where competitor is the right answer

H2: Who should choose Delta
  — Sharp-leaning bettors, price-sensitive, exchange-data fans

H2: Pricing comparison (detailed)
  — Full breakdown of plans, free trial, contract length

H2: Migration / switching
  — How to move from {Competitor} to Delta
  — What data carries over

H2: FAQ — schema-marked
```

**Trust rules:**
- Never lie about the competitor. Google penalizes, and sharps smell BS.
- Include at least one point where the competitor genuinely wins.
- Reference `.agents/product-marketing-context.md` objection handling.

---

## 6. Playbook 4 — Sharp Reports (Wave 3, programmatic)

### 6.1 Why This Is the Moat
No competitor publishes daily whale-trade + Pinnacle-movement recaps indexed for Google. Once Wave 1/2 build authority, this fires off indefinitely — every game day = fresh content + fresh URLs.

### 6.2 Page Types

**A. League pillar (static, 7 pages)**
`/sharp-report/nfl`, `/sharp-report/nba`, `/sharp-report/mlb`, `/sharp-report/nhl`, `/sharp-report/ncaaf`, `/sharp-report/ncaab`, `/sharp-report/all`

Content:
- Live "today's biggest whale trades" widget (30s cache)
- Rolling 7-day recap
- Archive of all daily spokes (indexed, paginated)
- Educational intro: "How to read sharp reports for {league}"

**B. Daily spoke (programmatic)**
`/sharp-report/{league}/{yyyy-mm-dd}`

Template:
```
H1: {League} Sharp Money Report — {Long date}

[Summary stats block — total whale trades, total handle detected, biggest move]

H2: Biggest whale trades
  — Ranked list: team/market, size estimate, bookmaker/exchange, timestamp
  — Data from ingest-whale-trades pipeline

H2: Biggest Pinnacle moves
  — Data from market-projections
  — Line at open → line at close, limit-expansion flags

H2: Sharp consensus by game
  — Per-game micro-section, 2-3 sentences each
  — Links to per-team page

H2: How these bets closed
  — Updated 24h post-game — adds results + CLV analysis
  — Makes each page self-updating with fresh content even post-publication

[CTA — "Get alerts the moment whale trades hit — start trial"]
```

**C. Team rolling page**
`/whale-trades/{team-slug}` (e.g., `/whale-trades/kansas-city-chiefs`)

Content:
- Rolling 30-day whale-trade history for that team
- Regenerates daily
- Win rate of whale-tracked bets on this team
- Links to upcoming games + their sharp reports

### 6.3 Indexation Strategy for Wave 3

**Problem:** Naively generating 6 sports × 365 days = 2,190 pages/year, most with little content on off-days.

**Solution:**
- Only generate `/sharp-report/{league}/{date}` if that day had ≥3 whale trades OR ≥5 Pinnacle moves ≥ threshold. Otherwise 404 (no `noindex` on empty pages — just don't create them).
- Historical backfill: generate pages for past 180 days where data exists (from `ingest-whale-trades-historical.ts`). Gets you ~500-1,000 starter pages for Wave 3.
- Per-league sitemap: `/sitemap-sharp-report-nfl.xml`, etc. Keeps each under 50k URLs (well within Google limits, but helps crawl-budget segmentation).

### 6.4 Schema Markup
```json
{ "@context": "https://schema.org", "@type": "Report",
  "reportNumber": "nfl-2026-04-15",
  "datePublished": "2026-04-15",
  "about": { "@type": "SportsOrganization", "name": "NFL" },
  "author": { "@type": "Organization", "name": "Delta Sports" } }
```
For team pages: `SportsTeam` schema.

### 6.5 Content Uniqueness
Every daily spoke has:
- Unique data (different whales, different moves, different games)
- Unique AI-generated summary paragraph per game (via existing OpenAI pipeline — prompt to be strict/factual, no fluff)
- Unique "how they closed" update 24h post-game

This passes the thin-content bar because the data itself is the unique value, not just variable-swapped prose.

---

## 7. Internal Linking Architecture

### 7.1 Hub-and-Spoke Map

```
                    HOMEPAGE
                        │
      ┌────────┬────────┼────────┬────────────────┐
      │        │        │        │                │
/calculators  /learn   /vs    /sharp-report   /whale-trades
      │        │        │        │                │
   22 spokes  glossary 12 vs  7 leagues      rolling teams
              (65)    pages   + daily spokes
```

### 7.2 Cross-linking Rules

1. **Calculator → Glossary:** Every calculator page links to 3-5 glossary terms it uses (e.g., Kelly page links to "kelly criterion", "bankroll", "variance").
2. **Glossary → Calculator:** Every glossary term links to the relevant calculator if one exists (e.g., "hold" links to `/calculators/hold`).
3. **Glossary → Sharp report:** Each relevant term ("sharp money", "steam move", "reverse line movement") links to `/sharp-report/all`.
4. **Sharp report daily → League pillar:** Breadcrumb.
5. **Sharp report daily → Team rolling:** Each game section links to both teams' `/whale-trades/{team}`.
6. **Team rolling → Upcoming sharp reports:** Future games linked forward.
7. **Comparison → Calculator / Glossary:** Whenever a feature is mentioned ("we calculate CLV"), link it.

### 7.3 Sitewide Footer
Add new footer columns:
- "Tools" → top 6 calculators + `/calculators/` hub
- "Learn" → `/learn/glossary/` + top 5 glossary terms
- "Sharp Reports" → 6 league hubs

### 7.4 Breadcrumbs
Every programmatic page gets `BreadcrumbList` schema:
`Home › Sharp Reports › NFL › April 15, 2026`

---

## 8. Technical SEO Requirements

### 8.1 Metadata
Every page exports Next.js `Metadata`:
```ts
export const metadata: Metadata = {
  title: "{unique per page}",
  description: "{unique per page, 140-160 chars}",
  alternates: { canonical: "https://deltasports.app/{path}" },
  openGraph: { ... },
  robots: { index: true, follow: true }
}
```

### 8.2 Sitemaps
Extend `app/sitemap.ts` or split into multiple:
- `sitemap.xml` → index
- `sitemap-static.xml` → homepage, product pages, calculators, glossary, comparisons
- `sitemap-sharp-report-{league}.xml` → daily spokes per league
- `sitemap-whale-trades.xml` → team rolling pages

Update frequency:
- Static: weekly
- Daily spokes: daily, `changefreq: weekly` (because "how they closed" updates)
- Team rolling: daily

### 8.3 Crawl Budget
- Robots.txt: `Disallow: /api/`, `Disallow: /admin/`, keep `/sharp-report/` fully open.
- Internal linking density caps at ~150 links/page (don't over-link from the hub).
- Avoid generating daily pages on low-data days (see 6.3).

### 8.4 Page Speed
- All calculators server-render the shell, hydrate the widget client-side.
- Glossary is fully static.
- Sharp reports use Next.js ISR with 15-minute revalidation for "today" pages, `force-static` for archival dates.
- Lighthouse targets: LCP < 2.5s, CLS < 0.1, INP < 200ms.

### 8.5 Mobile
- 60%+ of sports-betting traffic is mobile. Every template must be mobile-first.
- Calculator widgets: numeric keyboards on inputs (`inputMode="decimal"`).

---

## 9. Content Generation Workflow

### 9.1 Wave 1 (Weeks 1-6)

**Week 1-2: Infrastructure**
- Refactor `/calculators` into hub + 22 spokes (routes + templates)
- Build `/learn/glossary/` route scaffolding
- Add sitemap segmentation

**Week 3-4: Calculators content**
- Write unique walkthrough + example + "when sharps use this" for all 22 calculators
- Human editor review (not LLM-only)
- Target: 5 calculators/day with a writer

**Week 5-6: Glossary content**
- Write 65 glossary entries in batches of 10
- Each entry: 350+ unique words, one unique example
- Cross-link as you go

### 9.2 Wave 2 (Weeks 7-10)

**Week 7-8: Comparisons**
- 4 P0 comparisons with full competitor research
- Honest assessment (brand integrity + SEO trust)

**Week 9: Sharp report pillars**
- 7 league pillar pages with rolling "today" widget

**Week 10: Migration + measurement**
- 301 `/oddsjam-alternative` → `/vs/oddsjam-alternative`
- Set up Search Console tracking per cluster
- Install event tracking for calculator → trial conversion

### 9.3 Wave 3 (Week 11+)

**Week 11-12: Programmatic plumbing**
- Build `/sharp-report/[league]/[date]` route with ISR
- Build `/whale-trades/[team]` route
- Historical backfill cron: generate past 180 days of sharp reports
- "How they closed" 24h updater cron

**Ongoing:**
- Daily sharp-report pages generate automatically from existing ingestion.
- Monthly audit: drop pages with 0 impressions after 90 days (keeps quality signal high).

### 9.4 LLM Usage Rules
- **LLM allowed:** Sharp-report per-game summaries (factual, data-grounded), first drafts of calculator walkthroughs.
- **LLM forbidden:** Glossary entries (must be human-written for topical authority), comparison pages (stakes too high for factual errors about competitors).
- All LLM output passes through a human editor before publish.

---

## 10. Measurement & KPIs

### 10.1 Leading Indicators (Weeks 1-12)
- Indexation rate: `indexed / submitted` in Search Console, target ≥ 80% by week 8
- Avg position for target keywords: track top-20 primary KWs weekly
- Crawl stats: pages crawled/day should rise with Wave 1 ship

### 10.2 Lagging Indicators (Months 3-9)
- Organic sessions to programmatic pages (segmented by playbook)
- Programmatic → trial signup rate (target: 2-4% of pSEO sessions)
- Trial → paid conversion from pSEO cohort
- Keyword ranking distribution: # of KWs ranking top-3, top-10, top-30

### 10.3 Cohort Reports
Tag trials by entry path: `?utm_source=organic&utm_medium=pseo&utm_campaign={playbook}`. Monthly report:
- Trials by playbook
- LTV by playbook
- Cost per trial (should be ~$0 variable after content investment)

### 10.4 Kill Criteria
- Any page with 0 impressions after 90 days → noindex + internal-link audit → if still 0 after 180 days, delete.
- Any playbook with trial-conversion < 0.5% after 1,000 sessions → rework CTAs before scaling.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Thin-content penalty on programmatic pages | Strict 3.5 content-uniqueness bar; only generate sharp reports on data-rich days |
| Keyword cannibalization across playbooks | One URL = one primary KW; audit with Search Console monthly |
| Competitor comparison factual error | Human-only review, link to sources, update quarterly |
| Whale-trade data quality | Manual QA on top-10 pages weekly during Wave 3 |
| Sharp-report pages feel spammy to users | Every page must have a real "why this matters" section, not just a data dump |
| Google algorithm update targeting programmatic | Diversify across 4 playbooks so no single update wipes out traffic |

---

## 12. Immediate Next Steps (This Sprint)

1. Approve this strategy doc
2. Validate keyword volumes in Ahrefs/Semrush (should take ~2 hours)
3. Refactor `app/calculators/page.tsx` into hub + 22 dynamic routes — `app/calculators/[slug]/page.tsx` with per-slug metadata + content MDX
4. Build `app/learn/glossary/[slug]/page.tsx` template
5. Write Kelly + No-Vig + Expected Value calculators end-to-end as reference implementations
6. Write 5 glossary entries as reference implementations (sharp money, CLV, hold, no-vig odds, steam move)
7. Set up Search Console property for `/calculators/*` and `/learn/*` path filters

---

## Appendix A — Full Keyword Map

*(To be populated after volume validation. Structure: URL | Primary KW | Secondary KWs (3-5) | Est. volume | Difficulty | Assigned writer | Status)*

## Appendix B — Competitor Audit

*(One-time research: for each of the 12 competitors, capture their pricing page, feature list, pricing changes over 12 months, and 3 differentiators. Updated quarterly.)*

## Appendix C — Sharp Report Data Contract

*(Source-of-truth mapping from `ingest-whale-trades` and `market-projections` fields → template variables. Written alongside Wave 3 implementation.)*
