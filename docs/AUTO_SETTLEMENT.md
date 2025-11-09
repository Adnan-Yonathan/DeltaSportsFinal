# Automatic Bet Settlement

## Overview

The system now supports automatic bet settlement using live scores from ESPN. When games finish, pending bets can be automatically evaluated and settled based on the final scores.

## How It Works

### 1. Settlement Logic (`lib/utils/bet-settlement.ts`)

The system determines bet outcomes for three bet types:

**Moneyline Bets:**
- Compares final scores to determine winner
- If bet team wins → bet wins
- If bet team loses → bet loses
- If tie → push (stake returned)

**Spread Bets:**
- Applies point spread to team's score
- Examples: "Lakers -5.5" needs Lakers to win by more than 5.5 points
- If bet covers → bet wins
- If bet doesn't cover → bet loses
- If exactly on the number → push

**Total (Over/Under) Bets:**
- Sums both team scores
- Compares to the line
- Examples: "Over 223.5" needs total > 223.5 points
- If correct → bet wins
- If incorrect → bet loses
- If exactly on the number → push

### 2. Auto-Settlement API (`app/api/bets/auto-settle/route.ts`)

**POST /api/bets/auto-settle**
- Automatically settles all pending bets with finished games
- Requires authentication OR API key
- Matches bets to live scores using team names
- Only settles games with status = 'post' (finished)
- Updates bet status and bankroll automatically

**GET /api/bets/auto-settle**
- Dry run - shows which bets WOULD be settled
- Useful for testing and verification
- Returns pending bets with their projected outcomes

### 3. Live Score Integration

The system fetches live scores from ESPN for:
- NBA
- NFL
- MLB
- NHL
- NCAA Football
- NCAA Basketball

Scores update every 30 seconds via the `/api/live-scores` endpoint.

## Usage

### Manual Trigger (Authenticated User)

Call from frontend:
```typescript
const response = await fetch('/api/bets/auto-settle', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
})

const result = await response.json()
console.log(`Settled ${result.settled} bets`)
```

### Check Settleable Bets (Preview)

```typescript
const response = await fetch('/api/bets/auto-settle')
const result = await response.json()
console.log(`${result.settleable} bets ready to settle:`, result.bets)
```

### Automated Settlement (Cron Job)

Set up a cron job or scheduled task to call the endpoint with an API key:

```bash
curl -X POST https://your-domain.com/api/bets/auto-settle \
  -H "x-api-key: YOUR_SECRET_KEY"
```

Add to `.env.local`:
```
AUTO_SETTLE_API_KEY=your-secret-key-here
```

## Response Format

### POST /api/bets/auto-settle

```json
{
  "message": "Auto-settlement complete",
  "totalPending": 10,
  "settled": 5,
  "failed": 0,
  "settledBets": [
    {
      "betId": "uuid",
      "gameDescription": "Lakers vs Warriors",
      "status": "won",
      "actualResult": 91.00
    }
  ]
}
```

### GET /api/bets/auto-settle

```json
{
  "totalPending": 10,
  "settleable": 3,
  "bets": [
    {
      "betId": "uuid",
      "gameDescription": "Lakers vs Warriors",
      "betType": "spread",
      "betSide": "Lakers -5.5",
      "stake": 100,
      "game": {
        "homeTeam": "Los Angeles Lakers",
        "awayTeam": "Golden State Warriors",
        "homeScore": 115,
        "awayScore": 105,
        "status": "post"
      },
      "projectedOutcome": {
        "status": "won",
        "actualResult": 91.00
      }
    }
  ]
}
```

## Database Updates

When a bet is settled:

1. **Bet table** updated:
   - `status` changed to 'won', 'lost', or 'push'
   - `actual_result` set (positive for wins, negative for losses, 0 for push)
   - `settled_at` timestamp set

2. **User bankroll** automatically updated via database trigger:
   - `current_bankroll` adjusted by `actual_result`
   - Bankroll snapshot created for the day

## Team Matching

The system uses fuzzy matching to connect bets to games:

- Handles full team names: "Los Angeles Lakers"
- Handles nicknames: "Lakers"
- Handles abbreviations: "LAL"
- Case insensitive
- Matches partial names

## Error Handling

The system handles:
- No matching game found (bet not settled, remains pending)
- Game in progress (only settles when status = 'post')
- Parsing errors (logged, bet not settled)
- Database errors (logged, returned in failed array)

## Recommendations

1. **Schedule regular auto-settlement**:
   - Run every 15-30 minutes during game times
   - Run hourly during off-peak times

2. **Monitor failed settlements**:
   - Check the `failedBets` array in responses
   - Manually review bets that fail to settle

3. **Verify before deploying**:
   - Use GET endpoint to preview settlements
   - Test with a few bets first

4. **Bet description format**:
   - Use team names that match ESPN: "Lakers vs Warriors"
   - Avoid excessive abbreviations
   - Include both team names when possible

## Future Enhancements

Potential improvements:
- UI button to manually trigger settlement
- Notification when bets are settled
- Settlement history/audit log
- Support for more bet types (parlays, props)
- Integration with more score providers
