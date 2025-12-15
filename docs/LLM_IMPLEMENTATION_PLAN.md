## LLM Implementation Plan (Statmuse-like, Betting-First)

Last updated: 2025-12-11

### Goal
Build an all-encompassing LLM that:
- Fetches the right sports/betting data (live, historical, derived).
- Explains why the data matters (context, matchup, travel/rest, injuries).
- Detects and narrates line movement (what moved, why, public vs sharp).
- Answers statmuse-style queries across players/teams/seasons with accuracy.

### Core Capabilities & Data
1) **Data routing & season logic**
   - Enforce season start-year across all tools.
   - Robust entity resolution (team/player aliases, diacritics, abbreviations).

2) **Live/Historical Stats & Derived Metrics**
   - Player logs with boxscore augmentation (blocks/steals/3PM/TO/FTA/min).
   - Team allowances: paint/fast-break/points off TO/2nd-chance/bench, opp 3P/pace, opponent ORB/TO/FTA.
   - Quarter/OT line scores cached per event.
   - Travel/rest tags: distance/TZ/altitude + rest buckets (B2B, 3-in-4/4-in-6/5-in-7).
   - Start-time data for early/late tip flags.

3) **Odds & Market Intelligence**
   - Live odds (spread/ML/total/props) and multi-book snapshots.
   - Line history: open → close; intra-day moves.
   - Public vs sharp splits (bets%/handle%) per market.
   - Closing lines for CLV/backtesting.
   - Promo feed (state-specific) and stale-line detection (consensus vs outliers). **Promos are manually maintained (not AI-sourced); include “last updated” metadata and a simple manual update path.**

4) **Injury/News Context**
   - Up-to-date injuries with status and expected impact.
   - Optional news triggers if available via trusted feeds.

### LLM Behaviors & UX
1) **Intent detection**
   - Stat queries: season/game counts, thresholds, opponent splits, rest/travel, schedule.
   - Betting queries: odds, line moves, public vs sharp, promo/stale-line checks.
   - Model queries: run/list/apply models; edge explanations.
   - Explanatory queries: “why did the line move?”, “why is the line set this way?”.

2) **Tool orchestration**
   - Single router to: player logs (with box augment), team allowances (derived/static), travel/rest tags, odds + splits + line history, injuries, model runner, promo/stale checks.
   - Fallbacks: if a feed is missing (splits/line history), state it and avoid hallucination.

3) **Answer patterns**
   - For stats: result → context (season/rest/travel/opponent) → caveats (sample, role changes).
   - For betting: price → why (injury/travel/pace/allowance/splits/line move) → action (bet/monitor/pass) → risks.
   - For line moves: what moved (open→current), when, likely cause (injury/news/splits/steam), public vs sharp read, current best price.
   - For “why the line is set”: list key factors (injuries, rest/travel, pace/efficiency, matchup allowances, splits if live).

4) **Safety/accuracy guards**
   - If data is absent (e.g., splits, line history, closing lines), say so plainly.
   - Avoid promising “locks”; emphasize EV/CLV and risk notes.
   - Use explicit seasons/dates; no ambiguous “this year” without resolving season start-year.

### Implementation Steps
1) **Data plumbing**
   - Finish derived allowances (paint/FB/2nd-chance/points off TO/bench) per team/season from box scores.
   - Cache quarter/OT line scores per event.
   - Add start-time capture for early/late tips.
   - Integrate closing-line storage (sides/totals/props) and line history capture.
   - Secure a splits feed (bets%/handle%) and line history (open/current/close).
   - Build promo/stale detection (consensus price vs outliers).

2) **Tooling & APIs**
   - Extend router with: team allowances, travel/rest tags, line history (open/current/close), splits fetch, promo finder, stale-line checker, model runner/backtester.
   - Harden ID resolution with alias maps (team/player).

3) **LLM prompts & schemas**
   - Update system/developer prompts to enforce: season start-year, cite missing feeds, avoid hallucinating splits/line moves.
   - Define structured outputs for: stats answers, line-move narratives, EV/edge cards, model summaries.

4) **UI/UX**
   - Chips/autocomplete for statmuse-style queries (teams/players/markets).
   - Line-move panel: show open/current/close, timestamps, splits (if live), and inferred cause.
   - Edge cards: price, rationale (injury/travel/allowance/splits), risk notes, best book.
   - Backtest/CLV view once closing lines are live.

5) **Validation**
   - Test intents: player 40+ games, opponent 3P% allowed, B2B performance, travel burden, odds + best price, “why line moved,” “why line set,” and public vs sharp (when splits live).
   - Check failure cases: no splits, no line history, missing allowances—model should say “data unavailable.”

### Dependencies/Risks
   - Splits/feed access (bets%/handle%) and line history are critical for “public vs sharp” and line-move explanations.
   - Closing lines needed for CLV/backtesting claims.
   - Derived stats pipeline (paint/FB/etc.) must be reliable to avoid empty answers.
   - Promo/stale detection requires multi-book coverage and a consensus line; promos are manual and need clear “last updated” tracking.
