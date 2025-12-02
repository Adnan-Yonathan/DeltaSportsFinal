# Database Cleanup Scripts

## cleanup-null-messages.ts

Removes messages with null or empty content from the Supabase database.

### Why is this needed?

In earlier versions of the app, empty/null assistant messages could be saved to the database. This causes errors when the chat API tries to send them to OpenAI.

### Prerequisites

1. Set up environment variables in `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### How to run

```bash
npm run cleanup:messages
```

### What it does

1. Connects to your Supabase database
2. Finds all messages where `content` is `null` or empty string
3. Displays a list of messages to be deleted
4. Deletes them from the database
5. Shows a summary of deleted messages

### Safety

- Only deletes messages with `null` or empty `content`
- Does not affect messages with valid content
- Shows what will be deleted before doing so

### After running

Your chat functionality should work normally (assuming you also have OpenAI credits).

## ingest-team-stats.ts

Captures hourly team stats/trend snapshots for NBA, NFL, MLB, and NHL using ESPN data and stores them in the `team_stats` and `team_trends` tables.

### How to run

```
npm run ingest:team-stats
```

### What it does

1. Fetches team standings/metrics for each supported sport
2. Calculates per-game scoring, streak summaries, and lightweight trend tags
3. Inserts snapshots into Supabase (service role key required)

### Notes

- Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Mirrors the hourly GitHub Action (`team-stats-ingest.yml`) so local runs produce identical payloads

## ingest-espn-data.ts

Backfills season-level ESPN data to Supabase (teams, players, season stats, futures, ATS/odds records) per sport.

### How to run

```
ts-node scripts/ingest-espn-data.ts --sport nfl --seasons 2020,2021,2022,2023,2024
```

Supported sports: `nfl`, `nba`, `mlb`, `nhl`.

### What it does
- Pulls team lists and season statistics
- Pulls rosters and player season statistics
- Writes team/player season stats to Supabase
- Writes futures, ATS records, and odds records (no per-game odds lines)

### Prerequisites
- Apply `supabase/schema-extended.sql` in your project
- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
