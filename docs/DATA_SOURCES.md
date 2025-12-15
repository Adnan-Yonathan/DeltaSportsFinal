# Data Sources Documentation

This document maps all data types to their sources in the DeltaSports application.

## Betting Odds

### Primary Provider
**Odds-API.io** (Default)
- Base URL: `https://api.odds-api.io/v3`
- Environment variable: `ODDS_API_KEY`
- Provides:
  - Moneyline, spreads, totals (h2h, spreads, totals markets)
  - Player props (points, rebounds, assists, passing yards, etc.)
  - Arbitrage opportunities
  - Multi-event odds fetching
  - Line movements and updated odds
  - Sports/leagues listings
  - Bookmaker selection
- File: `lib/api/odds-api.ts`

### Fallback Provider
**ESPN** (Fallback for specific events)
- Provides:
  - Basic odds from ESPN scoreboard/event summary endpoints
  - Used when primary provider fails
- File: `lib/services/espn-orchestrator.ts`

### Markets Supported
- Moneyline (h2h)
- Spreads
- Totals (over/under)
- Player Props:
  - NBA: points, rebounds, assists, threes
  - NFL: passing TDs, passing yards, rushing yards, receptions
  - MLB: hits, total bases, RBIs, runs scored
  - NHL: points, shots on goal, blocked shots

### Line Tracking & CLV
- **Storage**: Supabase `lines` table
- **Recording Service**: `lib/services/line-recorder.ts`
- **CLV Calculation**: `lib/services/clv.ts`
- Tracks: opening lines, current lines, closing lines, line movements
- Uses odds data from Odds-API.io to record line snapshots

---

## Sports Statistics

### Live Scores & Game Data
**Primary Source: ESPN**
- Base URL: `https://site.web.api.espn.com/apis/site/v2/sports`
- Provides:
  - Live scores for NBA, NFL, MLB, NHL, NCAAF, NCAAB
  - Game details and box scores
  - Real-time game status
- Files: `lib/espn-api.ts`, `lib/live-scores.ts`

### Player Statistics

#### NBA
1. **ESPN** (Primary)
   - Player search: `https://site.api.espn.com/apis/search/v2`
   - Player stats: `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{id}/stats`
   - Recent games/gamelog
   - File: `lib/sports-stats-api.ts`

2. **Sports Reference** (Fallback for historical)
   - Web scraping from `https://www.basketball-reference.com`
   - Player season stats
   - File: `lib/providers/sports-reference.ts`

3. **Static Data** (Fallback)
   - User-provided static player stats
   - File: `lib/nba-static-stats.ts`

#### NFL
**ESPN** (Primary)
- Player search via ESPN search API
- Athlete statistics: ESPN NFL endpoints
- Roster data
- File: `lib/providers/espn-nfl.ts`, `lib/sports-stats-api.ts`

#### MLB
**MLB Official API**
- Base URL: `https://statsapi.mlb.com/api/v1`
- Player search, stats, rosters
- File: `lib/sports-stats-api.ts`

#### NHL
**NHL Official API**
- Search: `https://search.d3.nhle.com/api/v1/search/player`
- Stats: `https://api-web.nhle.com/v1`
- Player stats and game logs
- File: `lib/sports-stats-api.ts`

#### NCAAB/NCAAF
**ESPN** (Primary)
- Player search and recent game stats
- Limited season stats (derived from recent games)
- File: `lib/sports-stats-api.ts`

### Team Statistics

#### NBA
1. **ESPN** (Primary)
   - Standings: `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings`
   - Team records, stats
   - File: `lib/sports-stats-api.ts`

2. **Sports Reference** (Fallback)
   - Web scraping from `https://www.basketball-reference.com/leagues/NBA_{year}.html`
   - Team stats, advanced metrics
   - File: `lib/providers/sports-reference.ts`

3. **Static Data** (Fallback)
   - User-provided static team stats
   - File: `lib/nba-static-team-stats.ts`

#### NFL
**ESPN** (Primary)
- Team statistics via ESPN NFL API
- Advanced metrics derived from ESPN data
- File: `lib/providers/espn-nfl.ts`, `lib/sports-stats-api.ts`

#### MLB
**MLB Official API**
- Standings: `https://statsapi.mlb.com/api/v1/standings`
- Team records
- File: `lib/sports-stats-api.ts`

#### NHL
**NHL Official API**
- Standings: `https://api-web.nhle.com/v1/standings/now`
- Team stats
- File: `lib/sports-stats-api.ts`

#### NCAAB
**Sports Reference** (Fallback)
- Web scraping
- File: `lib/providers/sports-reference.ts`

---

## Advanced Statistics

### NBA Advanced Metrics
**Calculated from Base Stats** (Primary)
- Calculated from team/player statistics:
  - Offensive Rating (ORtg)
  - Defensive Rating (DRtg)
  - Net Rating
  - Pace (estimated from possessions)
  - True Shooting Percentage (TS%)
  - Effective Field Goal Percentage (eFG%)
  - Usage Rate
  - Rebounding percentages
- File: `lib/services/metrics.ts` (deriveAdvancedRates)
- Uses base stats from ESPN/Sports Reference

### NFL Advanced Metrics
**ESPN-derived** (Primary)
- Calculated from ESPN team statistics:
  - Yards per play
  - Success rate (third-down conversion rate as proxy)
  - Pass rate / Rush rate
  - EPA per play (proxy via yards/play)
- File: `lib/sports-stats-api.ts` (getNFLAdvancedTeamStats)

---

## Betting Statistics & Performance Data

### Betting Performance (User Data)
**Supabase** (Internal)
- User bet history
- Bankroll tracking
- CLV (Closing Line Value) calculations
- Bet settlement tracking
- Files:
  - `lib/services/bet-settlement.ts`
  - `lib/services/clv.ts`
  - `app/api/bankroll/`

### Line History & Movements
**Internal System** (Recorded from Odds Providers)
- Opening lines (first recorded line)
- Current lines (regular snapshots)
- Closing lines (line when game starts)
- Line movements tracked over time
- Storage: Supabase `lines` table
- Recording: `lib/services/line-recorder.ts`
- Source: Odds-API.io odds data
- Used for CLV calculation

---

## Injury Reports

### NBA
**ESPN**
- Endpoint: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries`
- File: `lib/sports-stats-api.ts` (getNBAInjuries)

### NFL
**ESPN**
- Via ESPN NFL provider
- File: `lib/providers/espn-nfl.ts`, `lib/sports-stats-api.ts` (getNFLInjuries)

### Storage
- Supabase `injury_reports` table (cached)
- File: `app/api/stats/route.ts`

---

## Roster Data

### NBA
**ESPN** (Primary)
- Endpoint: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{id}/roster`
- File: `lib/sports-stats-api.ts` (getNBARoster)

### NFL
**ESPN**
- Via ESPN NFL provider
- File: `lib/providers/espn-nfl.ts`, `lib/sports-stats-api.ts` (getNFLRoster)

### MLB
**MLB Official API**
- Via MLB stats API
- File: `lib/sports-stats-api.ts` (searchMLBPlayer)

### NHL
**NHL Official API**
- Via NHL search and player APIs
- File: `lib/sports-stats-api.ts` (searchNHLPlayer)

---

## Schedule & Game Context

### Game Schedules
**ESPN**
- Scoreboard endpoints provide upcoming games
- File: `lib/espn-api.ts`, `lib/live-scores.ts`

**Odds Providers**
- Event listings from Odds-API.io
- File: `lib/api/odds-api.ts`

---

## Static/Historical Data

### Sports Reference
**Web Scraping**
- Historical player and team statistics
- Used as fallback when live APIs fail
- Supports: NBA, NFL, MLB, NHL, NCAAB, NCAAF
- File: `lib/providers/sports-reference.ts`

### Static Files
**Local Data Files** (if provided)
- `data/nba_per_game_2025_26.ts`
- `data/nba_team_2025_26.ts`
- `data/nba_team_adv_2025_26.ts`
- Used as primary source for NBA when available

---

## User-Generated Data

### Supabase Storage
- **Bets**: User bet records
- **Bankroll**: Bankroll snapshots and history
- **Custom Models**: User-created prediction models
- **Lines**: Historical line tracking
- **Market Snapshots**: Odds snapshots at specific times
- **Player Props**: Player prop bet tracking
- **Injury Reports**: Cached injury data
- **Team Stats**: Cached team statistics

---

## Data Flow Summary

1. **Odds Data**: Odds-API.io → Line Recorder → Supabase `lines` table
2. **Live Scores**: ESPN → Live Scores Service → Frontend / Chat API
3. **Player Stats**: ESPN / Sports Reference / Static Data → Stats API → Chat API
4. **Team Stats**: ESPN / Sports Reference / Static Data → Stats API → Chat API
5. **Advanced Stats**: Calculated from base stats (NBA) / ESPN-derived (NFL) → Stats API
6. **Injuries**: ESPN → Stats API → Supabase cache → Chat API
7. **CLV**: Lines table + Bets table → CLV Service → Updates bets table

---

## Environment Variables

Key environment variables that control data sources:

- `ODDS_API_KEY`: Odds-API.io API key
- `ODDS_PROVIDER`: `odds-api-io` (default)
- `ODDS_BOOKMAKERS`: Comma-separated list of bookmakers to use
- `ODDS_REGIONS`: Regions for odds (default: 'us')
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: For backend operations
- `OPENAI_API_KEY`: OpenAI access for chat/models
- `ELEVENLABS_API_KEY`: For voice transcription
- `CRON_SECRET`: Protects cron-style ingestion endpoints

---

## Notes

- **Caching**: Most data sources implement caching (TTL varies by source)
- **Fallback Chains**: Most stats APIs have multiple fallback sources (ESPN → Sports Reference → Static Data)
- **Rate Limiting**: Odds-API.io has rate limits; implement retry logic when rate-limited
- **Web Scraping**: Sports Reference uses web scraping (may be brittle)
- **Real-time vs Batch**: Live scores are real-time; line recording is batch (via cron)
- **Calculated Metrics**: Advanced stats are derived from base statistics, not sourced directly
