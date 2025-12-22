## Sports & Betting Data Gaps (Delta)

Last updated: 2025-12-11

### Sports Data We’re Missing or Need to Derive
- **Team opponent-allowed details (per game & per event):** paint points, fast-break points, points off turnovers, second-chance points, bench points, opponent 3PA/3PM/eFG/3P%, opponent ORB/TO/FTA, pace. If not available in a static feed, derive from richer box scores and cache per team/season.
- **Per-event detailed box scores:** need reliable source (ESPN or alternative) for team totals above, plus quarter/OT line scores, starter flags, minutes, bench vs starters.
- **Start-time data:** local tip times for early/late buckets.
- **Quarter/OT caches:** period-level scoring stored per event for split queries.
- **Closing lines:** for CLV/backtesting (side/total/props).
- **Odds history/line moves:** to support “why did the line move” narratives.
- **Public vs sharp splits:** live bets%/handle% per market (spread/ML/total/props); SBD covers spread/total/moneyline for supported leagues, props still limited.
- **Arena metadata completeness:** we added NBA travel matrix; need equivalent for other leagues if we want cross-sport travel/rest tagging.

### Betting Data We’re Missing
- **Public/handle splits feed:** Covered for major leagues via SportsBettingDime (spread/total/moneyline). Still missing: prop splits and historical backfill.
- **Line history:** opening/closing and intra-day moves to explain moves and run backtests.
- **State-specific promos feed:** not wired; needed for “promo aggregator” claims.
- **Arbitrage/stale detection:** requires multi-book odds snapshots and basic consensus price to flag outliers.

### Dependencies to Complete the Feature List
- **Explanations of line movement / public vs sharp:** needs splits + line history (bets/handle + prices over time).
- **Edge Creation Toolkit (backtesting/CLV):** needs closing lines, line history; optional: backfill historical odds.
- **Advanced stats & trends:** needs derived opponent-allowed stats (paint/FB/2nd-chance/points off TO/bench) and quarter/OT caches.
- **Public vs sharp % splits:** SBD covers live splits; still needs odds history for full narratives/backtests.
- **Promo aggregator:** requires a maintained promo feed per state/book.

### Nice-to-Haves (Risk & UX)
- **Alias maps:** robust team/player aliasing (nicknames/legacy names) to cut “not found” errors.
- **Start-time & timezone-normalized scheduling:** to power early/late tip flags and user-local times.
- **Multi-league travel matrices:** if we extend travel/rest tagging beyond NBA.
