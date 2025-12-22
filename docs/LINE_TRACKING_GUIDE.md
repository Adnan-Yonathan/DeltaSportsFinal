# Line Tracking & CLV System

## Overview

This system tracks betting lines over time to enable:
- **Opening Line Tracking** - First line when a game appears
- **Current Line Monitoring** - Continuous snapshots of line movements
- **Closing Line Capture** - Final line when game starts
- **CLV Calculation** - Closing Line Value for bet analysis
- **Sharp Move Detection** - Identify professional money movements

## Database Schema

### Lines Table

Stores all line snapshots with the following key fields:

```sql
- odds_api_id: Unique game identifier
- market_type: 'spread', 'total', or 'moneyline'
- bookmaker: Sportsbook name
- line_type: 'opening', 'current', or 'closing'
- spread_home/away: Point spread values
- total_line: Over/under total
- moneyline_home/away: Moneyline odds
- is_sharp_move: Flag for significant movements
- recorded_at: Timestamp of snapshot
```

### Bets Table Additions

```sql
- opening_line: Line when bet was placed
- closing_line: Line when game started
- clv_value: Closing Line Value
- clv_percent: CLV as percentage
- line_movement: 'sharp', 'public', 'steam', or 'neutral'
- odds_api_id: Link to game in lines table
```

## API Endpoints

### 1. Record Lines

**POST/GET `/api/lines/record`**

Records current lines for all major sports.

**Authentication:** Requires `CRON_SECRET` in production

**Request (POST):**
```json
{
  "sports": ["basketball_nba", "americanfootball_nfl", "icehockey_nhl"]
}
```

**Response:**
```json
{
  "success": true,
  "linesRecorded": 450,
  "openingLinesMarked": 12,
  "timestamp": "2025-11-10T15:30:00Z"
}
```

**Usage:**
```bash
# Manual trigger (development)
curl http://localhost:3002/api/lines/record

# Authenticated trigger (production)
curl -X POST http://yourapp.com/api/lines/record \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 2. Line History

**GET `/api/lines/history`**

Fetches historical line data for analysis.

**Query Parameters:**
- `gameId` - Filter by specific game
- `sport` - Filter by sport
- `marketType` - Filter by market (spread, total, moneyline)
- `bookmaker` - Filter by bookmaker
- `lineType` - Filter by line type (opening, current, closing)
- `limit` - Max results (default: 100)

**Response:**
```json
{
  "success": true,
  "count": 45,
  "lines": [...],
  "movements": [
    {
      "bookmaker": "FanDuel",
      "movement": -1.5,
      "direction": "down",
      "dataPoints": 12
    }
  ]
}
```

**Usage:**
```bash
# Get spread history for a game
curl "http://localhost:3002/api/lines/history?gameId=abc123&marketType=spread"

# Get all lines for NBA
curl "http://localhost:3002/api/lines/history?sport=basketball_nba&limit=200"
```

### 3. Sharp Moves

**GET `/api/lines/sharp-moves`**

Fetches lines with significant movement (sharp money indicators).

**Query Parameters:**
- `sport` - Filter by sport
- `limit` - Max results (default: 50)
- `detect` - Run detection first (default: false)

**Response:**
```json
{
  "success": true,
  "count": 8,
  "sharpMoves": [...],
  "grouped": [
    {
      "game": "Lakers @ Celtics",
      "marketType": "spread",
      "bookmakers": [...]
    }
  ]
}
```

**POST `/api/lines/sharp-moves`**

Manually trigger sharp move detection.

**Usage:**
```bash
# Get recent sharp moves
curl "http://localhost:3002/api/lines/sharp-moves?sport=basketball_nba"

# Run detection and fetch
curl "http://localhost:3002/api/lines/sharp-moves?detect=true"

# Trigger detection
curl -X POST http://localhost:3002/api/lines/sharp-moves \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 4. Chat betting splits (public vs sharp)

The chat endpoint can answer “who has the public money” or “what % of bets/handle are on each side” for spreads, moneylines, and totals.

- **Input**: Natural language (e.g., “Who’s the public on Eagles-Cowboys spread?”).
- **Behavior**: Pulls sportsbook-reported ticket% vs handle% for the requested game/market, returns per-side percentages, and labels public vs sharp lean with confidence tiers.
- **Output**: `Side A: xx% bets / yy% money` and `Side B: ...` plus a note like “public → Side A; sharp → Side B (moderate).”
- **Fallbacks**: If splits are missing for the game/market, the chat responds that no split is available.

## Service Functions

### recordCurrentLines(sports: string[])

Records current lines for specified sports.

```typescript
import { recordCurrentLines } from '@/lib/services/line-recorder'

const count = await recordCurrentLines([
  'basketball_nba',
  'americanfootball_nfl'
])
console.log(`Recorded ${count} lines`)
```

### detectSharpMoves()

Analyzes recent lines for sharp money indicators.

```typescript
import { detectSharpMoves } from '@/lib/services/line-recorder'

await detectSharpMoves()
```

**Sharp Move Criteria:**
- Spread: ≥2 points movement
- Total: ≥3 points movement
- Multiple bookmakers moving simultaneously
- Movement against public betting percentage

### calculateCLV(betId: string)

Calculates Closing Line Value for a bet.

```typescript
import { calculateCLV } from '@/lib/services/line-recorder'

const result = await calculateCLV('bet-uuid')
if (result) {
  console.log(`CLV: ${result.clvValue} (${result.clvPercent}%)`)
}
```

**CLV Interpretation:**
- **Positive CLV**: You got a better line than closing (good!)
- **Negative CLV**: You got a worse line than closing (bad)
- **Target**: Long-term positive CLV indicates sharp betting

### markOpeningLines(sport: string)

Marks the first recorded lines as "opening" lines for new games.

```typescript
import { markOpeningLines } from '@/lib/services/line-recorder'

const marked = await markOpeningLines('basketball_nba')
console.log(`Marked ${marked} games with opening lines`)
```

## Cron Jobs

Configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/lines/record",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

**Schedule:** Every 30 minutes

**What it does:**
1. Fetches current odds from odds provider (SportsBettingDime)
2. Records all lines to database
3. Marks opening lines for new games
4. Enables CLV calculations later

**Alternative schedules:**
- Every hour: `"0 * * * *"`
- Every 15 minutes: `"*/15 * * * *"`
- Twice per day: `"0 */12 * * *"`

## Environment Variables

Required in `.env.local`:

```bash
# Odds Provider (SportsBettingDime)
# Optional: override book selection
SBD_BOOK_IDS=sr:book:18149,sr:book:18186

# Cron authentication (required for production)
CRON_SECRET=your_random_secret_here

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Database Setup

Run the migration:

```sql
-- In Supabase SQL Editor
\i supabase/migrations/20251110_add_line_tracking.sql
```

Or copy the contents of `supabase/migrations/20251110_add_line_tracking.sql` and run in the SQL editor.

## Usage Examples

### Example 1: Track Line Movement for a Game

```typescript
// 1. Record current lines
await recordCurrentLines(['basketball_nba'])

// 2. Check line history
const response = await fetch('/api/lines/history?gameId=abc123&marketType=spread')
const { lines, movements } = await response.json()

// 3. Analyze movements
movements.forEach(m => {
  console.log(`${m.bookmaker}: ${m.direction} ${Math.abs(m.movement)} points`)
})
```

### Example 2: Find Sharp Moves

```typescript
// Run detection
await detectSharpMoves()

// Get sharp moves
const response = await fetch('/api/lines/sharp-moves?sport=basketball_nba')
const { grouped } = await response.json()

grouped.forEach(game => {
  console.log(`Sharp move detected: ${game.game} (${game.marketType})`)
})
```

### Example 3: Calculate CLV for All Settled Bets

```typescript
// Get all settled bets from last week
const { data: bets } = await supabase
  .from('bets')
  .select('*')
  .in('status', ['won', 'lost'])
  .gte('settled_at', sevenDaysAgo)

// Calculate CLV for each
for (const bet of bets) {
  if (bet.odds_api_id) {
    const clv = await calculateCLV(bet.id)
    if (clv) {
      console.log(`Bet ${bet.id}: CLV ${clv.clvPercent.toFixed(2)}%`)
    }
  }
}
```

## Performance Considerations

### Indexes

The migration creates indexes for optimal query performance:
- `idx_lines_game` - Fast game lookups
- `idx_lines_market` - Fast market queries
- `idx_lines_sharp` - Sharp move queries
- `idx_lines_game_id` - API ID lookups

### Data Volume

With 4 sports recording every 30 minutes:
- ~400 lines per recording
- ~800 lines per hour
- ~19,200 lines per day
- ~576,000 lines per month

**Storage:** ~50-100 MB per month

**Cleanup Strategy:**
```sql
-- Delete lines older than 90 days (keep seasonal trends)
DELETE FROM lines
WHERE created_at < NOW() - INTERVAL '90 days'
AND line_type = 'current';

-- Keep all opening and closing lines
```

## Troubleshooting

### Cron Job Not Running

1. Check Vercel dashboard > Settings > Cron Jobs
2. Verify `CRON_SECRET` is set in environment variables
3. Check function logs for errors

### No Opening Lines

Opening lines are marked on the first run. If you want to backfill:

```typescript
// Mark existing current lines as opening lines
for (const sport of ['basketball_nba', 'americanfootball_nfl']) {
  await markOpeningLines(sport)
}
```

### CLV Not Calculating

Requirements:
1. Bet must have `odds_api_id`
2. Closing line must exist for the game
3. Bet type must be 'spread' or 'total' (props not supported yet)

## Future Enhancements

- **Real-time alerts** for sharp moves
- **Reverse line movement** detection (line moves opposite to money)
- **Steam moves** detection (rapid line changes)
- **Machine learning** for move classification
- **CLV leaderboards** for users
- **Automated bet grading** using closing lines

## References

- [Closing Line Value Explained](https://www.pinnacle.com/en/betting-articles/Betting-Strategy/what-is-closing-line-value/5MJN49CN9XNZ3YGZ)
- [Sharp vs Public Money](https://www.actionnetwork.com/education/sharp-money)
- [Line Movement Guide](https://www.covers.com/betting-education/how-to-read-betting-lines)
