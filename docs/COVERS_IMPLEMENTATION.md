# Covers.com Scraper - Implementation Guide

## Overview
Complete the Covers.com integration by adding chat tool support for betting data.

**What Exists**: Core scraping infrastructure
**What's Missing**: Chat LLM integration
**Goal**: Enable users to ask about betting data in chat

---

## Implementation Steps

### Step 1: Create Chat Helper Functions

**Create new file**: `lib/providers/covers/chat-helpers.ts`

```typescript
/**
 * Chat-friendly helpers for Covers.com data
 * These wrap database queries in formats the LLM can easily consume
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Get ATS data for a team
 */
export async function getTeamATSData(
  teamName: string,
  sport: string = 'basketball_nba'
) {
  const supabase = createClient()

  const { data: records, error } = await supabase
    .from('team_ats_records')
    .select('*')
    .eq('sport_key', sport)
    .or(`team_name.ilike.%${teamName}%,covers_slug.ilike.%${teamName}%`)
    .order('captured_at', { ascending: false })
    .limit(1)

  if (error || !records || records.length === 0) {
    return {
      success: false,
      error: `No ATS data found for ${teamName}`
    }
  }

  const r = records[0]

  return {
    success: true,
    data: {
      team: r.team_name,
      season: r.season,
      overallATS: r.record,
      homeATS: r.home_ats_record,
      awayATS: r.away_ats_record,
      favoriteATS: r.favorite_ats_record,
      underdogATS: r.underdog_ats_record,
      overUnder: r.over_under_record,
      last10: r.last_10_ats,
      streak: r.ats_streak,
      lastUpdated: r.captured_at,
    }
  }
}

/**
 * Get today's betting splits
 */
export async function getCurrentBettingSplits(
  sport: string = 'basketball_nba'
) {
  const supabase = createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: splits, error } = await supabase
    .from('latest_betting_splits')
    .select('*')
    .eq('sport_key', sport)
    .gte('game_time', today.toISOString())
    .order('game_time', { ascending: true })

  if (error || !splits || splits.length === 0) {
    return {
      success: false,
      error: 'No betting splits found for today'
    }
  }

  // Group by game
  const gameMap = new Map()

  for (const split of splits) {
    if (!gameMap.has(split.game_id)) {
      gameMap.set(split.game_id, {
        gameId: split.game_id,
        matchup: `${split.away_team} @ ${split.home_team}`,
        gameTime: split.game_time,
        markets: {},
        sharpAction: []
      })
    }

    const game = gameMap.get(split.game_id)
    game.markets[split.market_type] = {
      homeBets: split.home_bets_pct,
      awayBets: split.away_bets_pct,
      homeMoney: split.home_money_pct,
      awayMoney: split.away_money_pct,
      sharp: split.sharp_indicator,
    }

    if (split.sharp_indicator?.startsWith('sharp_')) {
      game.sharpAction.push({
        market: split.market_type,
        side: split.sharp_indicator.replace('sharp_', ''),
      })
    }
  }

  return {
    success: true,
    data: Array.from(gameMap.values())
  }
}

/**
 * Analyze splits for specific game
 */
export async function analyzeGameSplits(gameId: string) {
  const supabase = createClient()

  const { data: splits, error } = await supabase
    .from('latest_betting_splits')
    .select('*')
    .eq('game_id', gameId)

  if (error || !splits || splits.length === 0) {
    return {
      success: false,
      error: `No splits found for game ${gameId}`
    }
  }

  const game = splits[0]
  const analysis = {
    matchup: `${game.away_team} @ ${game.home_team}`,
    gameTime: game.game_time,
    markets: splits.map(s => ({
      market: s.market_type,
      homeBets: s.home_bets_pct,
      awayBets: s.away_bets_pct,
      homeMoney: s.home_money_pct,
      awayMoney: s.away_money_pct,
      sharp: s.sharp_indicator,
      divergence: s.home_money_pct && s.home_bets_pct
        ? Math.abs(s.home_money_pct - s.home_bets_pct)
        : null
    }))
  }

  return {
    success: true,
    data: analysis
  }
}
```

---

### Step 2: Export Helpers

**Edit**: `lib/providers/covers/index.ts`

**Add to end of file**:
```typescript
// Chat helpers
export {
  getTeamATSData,
  getCurrentBettingSplits,
  analyzeGameSplits,
} from './chat-helpers'
```

---

### Step 3: Add Tool Definitions

**Edit**: `lib/statmuse/tools.ts`

**Add these three tools to the tools array**:

```typescript
{
  type: 'function',
  function: {
    name: 'get_team_ats_records',
    description: 'Get Against The Spread (ATS) betting records for an NBA team from Covers.com. Returns overall, home/away, favorite/underdog records, streaks, and last 10 games. Use when users ask about team betting performance, covering trends, or ATS records.',
    parameters: {
      type: 'object',
      properties: {
        team_name: {
          type: 'string',
          description: 'Team name or abbreviation (e.g., "Lakers", "Boston Celtics", "BOS")'
        }
      },
      required: ['team_name']
    }
  }
},
{
  type: 'function',
  function: {
    name: 'get_betting_splits',
    description: 'Get public betting percentages for today\'s NBA games from Covers.com. Shows what % of bets and money are on each side, and detects sharp money (when money % diverges from bet % by 15%+). Use when users ask about public betting trends, sharp action, or where the money is going.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
},
{
  type: 'function',
  function: {
    name: 'analyze_game_splits',
    description: 'Deep analysis of betting splits for a specific NBA game. Shows bet %, money %, and divergence to identify sharp vs public action. Use when users want detailed betting breakdown for a particular matchup.',
    parameters: {
      type: 'object',
      properties: {
        game_id: {
          type: 'string',
          description: 'The game ID (usually from get_betting_splits output)'
        }
      },
      required: ['game_id']
    }
  }
}
```

---

### Step 4: Add Tool Handlers

**Edit**: `lib/statmuse/data-router.ts`

**Add these three cases to the switch statement** (around where other tool handlers are):

```typescript
case 'get_team_ats_records': {
  const { team_name } = args as { team_name: string }

  const { getTeamATSData } = await import('@/lib/providers/covers')
  const result = await getTeamATSData(team_name, 'basketball_nba')

  if (!result.success) {
    return { error: result.error }
  }

  const d = result.data
  return {
    team: d.team,
    season: d.season,
    overall_ats: d.overallATS,
    home_ats: d.homeATS,
    away_ats: d.awayATS,
    as_favorite: d.favoriteATS,
    as_underdog: d.underdogATS,
    over_under: d.overUnder,
    last_10: d.last10,
    streak: d.streak,
    last_updated: d.lastUpdated
  }
}

case 'get_betting_splits': {
  const { getCurrentBettingSplits } = await import('@/lib/providers/covers')
  const result = await getCurrentBettingSplits('basketball_nba')

  if (!result.success) {
    return { error: result.error }
  }

  return {
    games_count: result.data.length,
    games: result.data,
    has_sharp_action: result.data.some((g: any) => g.sharpAction.length > 0)
  }
}

case 'analyze_game_splits': {
  const { game_id } = args as { game_id: string }

  const { analyzeGameSplits } = await import('@/lib/providers/covers')
  const result = await analyzeGameSplits(game_id)

  if (!result.success) {
    return { error: result.error }
  }

  return result.data
}
```

---

## Usage Guide

### Manual Data Ingestion

**Before using chat tools, populate the database**:

```bash
# Scrape ATS records for all NBA teams
npm run ingest:ats

# Scrape today's betting splits
npm run ingest:splits

# Or both at once
npm run ingest:ats && npm run ingest:splits
```

**Expected output**:
```
=============================================================
Covers.com ATS Records Ingestion
=============================================================
Started at: 2024-12-14T12:00:00.000Z
Season: 2025

Scraped 30 teams successfully, 0 failures
Upserting 30 records to team_ats_records...
✓ Upsert complete

Completed at: 2024-12-14T12:02:30.000Z
=============================================================
```

**When to run**:
- **ATS records**: Once per day (after games finish, ideally morning)
- **Betting splits**: As needed (closer to game time for freshest data)

---

### Chat Examples

Once data is populated, users can ask:

#### Example 1: Team ATS Performance
**User**: "What's the Lakers' ATS record?"

**LLM calls**: `get_team_ats_records({ team_name: "Lakers" })`

**LLM receives**:
```json
{
  "team": "Los Angeles Lakers",
  "season": 2025,
  "overall_ats": "24-18-1",
  "home_ats": "14-7-0",
  "away_ats": "10-11-1",
  "as_favorite": "18-12-1",
  "as_underdog": "6-6-0",
  "over_under": "22-20-1",
  "last_10": "7-3-0",
  "streak": "W4"
}
```

**LLM responds**:
> The Lakers have a 24-18-1 ATS record this season (57% cover rate).
>
> **Home**: 14-7 (strong)
> **Away**: 10-11-1 (below .500)
> **As favorite**: 18-12-1
> **As underdog**: 6-6
>
> They're currently on a W4 streak and went 7-3 ATS in their last 10 games. They cover significantly better at home.

---

#### Example 2: Today's Betting Splits
**User**: "Show me where the money is going tonight"

**LLM calls**: `get_betting_splits({})`

**LLM receives**:
```json
{
  "games_count": 8,
  "has_sharp_action": true,
  "games": [
    {
      "gameId": "401585039",
      "matchup": "Celtics @ Lakers",
      "gameTime": "2024-12-14T02:30:00Z",
      "markets": {
        "spread": {
          "homeBets": 65,
          "awayBets": 35,
          "homeMoney": 72,
          "awayMoney": 28,
          "sharp": "neutral"
        }
      },
      "sharpAction": []
    },
    {
      "gameId": "401585040",
      "matchup": "Heat @ Warriors",
      "gameTime": "2024-12-14T03:00:00Z",
      "markets": {
        "spread": {
          "homeBets": 45,
          "awayBets": 55,
          "homeMoney": 62,
          "awayMoney": 38,
          "sharp": "sharp_home"
        }
      },
      "sharpAction": [
        { "market": "spread", "side": "home" }
      ]
    }
  ]
}
```

**LLM responds**:
> Here are tonight's betting splits (8 games):
>
> **Celtics @ Lakers** - 7:30 PM ET
> Public: 65% on Lakers
> Money: 72% on Lakers
> ➡️ Public and money aligned on Lakers
>
> **Heat @ Warriors** - 8:00 PM ET
> Public: 45% on Warriors
> Money: 62% on Warriors
> ⚠️ **Sharp action detected on Warriors** - Money % much higher than bet %
>
> Sharp bettors are fading the public on the Warriors spread.

---

#### Example 3: Deep Game Analysis
**User**: "Analyze the Warriors game betting"

**LLM calls**: `analyze_game_splits({ game_id: "401585040" })`

**LLM receives**:
```json
{
  "matchup": "Heat @ Warriors",
  "gameTime": "2024-12-14T03:00:00Z",
  "markets": [
    {
      "market": "spread",
      "homeBets": 45,
      "awayBets": 55,
      "homeMoney": 62,
      "awayMoney": 38,
      "sharp": "sharp_home",
      "divergence": 17
    },
    {
      "market": "total",
      "homeBets": 48,
      "awayBets": 52,
      "homeMoney": 51,
      "awayMoney": 49,
      "sharp": "neutral",
      "divergence": 3
    }
  ]
}
```

**LLM responds**:
> **Heat @ Warriors** - Betting Analysis
>
> **Spread**:
> - 45% of bets on Warriors
> - 62% of money on Warriors
> - **17% divergence** ⚠️
> - Sharp action detected: Sharps taking Warriors despite public on Heat
>
> **Total**:
> - 48% of bets on Over
> - 51% of money on Over
> - 3% divergence
> - Neutral - no clear sharp/public split
>
> The significant divergence on the spread suggests sharp money is backing the Warriors while the public likes the Heat. This is often a valuable contrarian indicator.

---

## Testing Checklist

### 1. Data Ingestion
- [ ] Run `npm run ingest:ats`
- [ ] Check database: `SELECT COUNT(*) FROM team_ats_records WHERE sport_key = 'basketball_nba'` should be 30
- [ ] Run `npm run ingest:splits`
- [ ] Check database: `SELECT COUNT(*) FROM public_betting_splits WHERE captured_at::date = CURRENT_DATE` should be > 0

### 2. API Endpoints
- [ ] GET `/api/betting/ats?team=Lakers` returns data
- [ ] GET `/api/betting/splits` returns data
- [ ] Response format matches expected schema

### 3. Chat Integration
- [ ] Open chat interface
- [ ] Ask: "What's the Celtics ATS record?"
- [ ] Verify: LLM calls `get_team_ats_records` and returns formatted answer
- [ ] Ask: "Show me today's betting splits"
- [ ] Verify: LLM calls `get_betting_splits` and lists games
- [ ] Ask: "Is there sharp action tonight?"
- [ ] Verify: LLM identifies games with sharp indicators

---

## File Summary

### Files to CREATE:
- `lib/providers/covers/chat-helpers.ts` - 3 helper functions

### Files to EDIT:
- `lib/providers/covers/index.ts` - Add 3 exports
- `lib/statmuse/tools.ts` - Add 3 tool definitions
- `lib/statmuse/data-router.ts` - Add 3 tool handlers

**Total**: 1 new file, 3 edited files

---

## Maintenance

### Daily Workflow (Manual)
```bash
# Run in morning after games finish
npm run ingest:ats

# Run before games start (for fresh splits)
npm run ingest:splits
```

### If Scraping Fails
1. Check Covers.com URL is still valid
2. Check HTML structure hasn't changed
3. Review error logs from script
4. Update parsing logic if needed

### Data Freshness
- **ATS records**: Update daily (changes after each game)
- **Betting splits**: Update as needed (changes hourly as game approaches)

---

## Success Criteria

After implementation:

✅ **Database has data**:
```sql
-- Should return 30 rows
SELECT COUNT(*) FROM team_ats_records WHERE sport_key = 'basketball_nba';

-- Should return rows for today's games
SELECT game_id, home_team, away_team, market_type, sharp_indicator
FROM public_betting_splits
WHERE captured_at::date = CURRENT_DATE;
```

✅ **Chat works**:
- User asks about ATS → LLM calls tool → Returns formatted answer
- User asks about splits → LLM calls tool → Returns games with percentages
- Sharp action is identified and explained

✅ **Manual scripts work**:
- `npm run ingest:ats` completes without errors
- `npm run ingest:splits` completes without errors
- New data appears in database after each run

---

## Implementation Time

**Estimated**: 2-3 hours

- Create chat-helpers.ts: 45 min
- Update exports and tools: 30 min
- Add tool handlers: 30 min
- Test data ingestion: 30 min
- Test chat integration: 30 min

---

## Next Steps

After manual testing proves successful, future enhancements:
- Automated scheduling (cron jobs)
- Monitoring/alerting
- Historical trend analysis
- Multi-sport support (NFL, MLB, NHL)
