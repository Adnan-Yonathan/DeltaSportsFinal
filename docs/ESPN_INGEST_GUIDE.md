## ESPN Historical Ingest Guide (Supabase)

This project now has sport-specific ESPN provider modules plus a Supabase schema prompt for storing season/game stats and limited betting context (futures/ATS/odds-records/predictor).

### 1) Apply the schema
- Run `supabase/schema-extended.sql` in the Supabase SQL editor (or psql) to create:
  - `teams`, `players`, `team_season_stats`, `player_season_stats`
  - `events`, `team_game_stats`, `player_game_stats`
  - `injury_reports`
  - Betting-lite tables: `team_ats_records`, `team_odds_records`, `futures`, `predictor_powerindex`, optional `team_past_performances`
  - Indexes/GIN and uniqueness constraints

### 2) Run the ingest script
- Command: `ts-node scripts/ingest-espn-data.ts --sport nfl --seasons 2020,2021,2022,2023,2024`
- Supported `--sport`: `nfl`, `nba`, `mlb`, `nhl`
- The script:
  - Pulls team lists and season stats
  - Pulls rosters and player season stats
  - Writes to `team_season_stats` and `player_season_stats`
  - Writes ATS/odds records and futures to betting tables
- Requirements:
  - Service-role Supabase env vars (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`)
  - Run after schema has been applied

### 3) Predictor/PowerIndex and game-level data
- The current script focuses on season aggregates. Event-level predictor/power index and game-level box data can be ingested via the ESPN summary endpoints; add a follow-up job that:
  - Enumerates events per season (scoreboard/calendar endpoints)
  - Fetches `/summary` for each event to populate `events`, `team_game_stats`, `player_game_stats`, and `predictor_powerindex`

### 4) Scheduling (GitHub Action)
- Use `.github/workflows/espn-backfill.yml` (manual trigger) with inputs:
  - `sport`: nfl|nba|mlb|nhl
  - `seasons`: comma list (e.g., `2020,2021,2022,2023,2024`)
- Configure repo secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- The workflow runs `ts-node` with the same command as above on GitHub runners.

### 5) Scheduling (local/cron)
- Backfill: run once per sport for 2020→present.
- Incremental: schedule daily/hourly runs per sport/season to keep season and betting tables fresh.

### 6) Notes
- These ESPN endpoints are undocumented and can change. Keep retries/caching and expect occasional structure shifts.
- No odds lines are pulled yet; only futures, ATS, odds records, and predictor/power index are in scope.
