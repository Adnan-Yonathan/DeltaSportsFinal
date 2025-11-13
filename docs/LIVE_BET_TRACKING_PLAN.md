# Live Bet Tracking Implementation Plan

## Problem Statement

Users want to:
1. **See live progress** of their active bets as games happen in real-time
2. **Track player prop bets** with live player statistics
3. **Understand their chances** of winning based on current game state
4. **Get visual indicators** showing how close they are to winning/losing
5. **Track line movements** to see where sharp money is going and calculate CLV (Closing Line Value)
6. **Get accurate game schedules** - AI currently gives wrong games when asked "what games are tomorrow?"
7. **Get consistent odds data** - AI sometimes says "I don't have access to odds" when it actually does

---

## Current State Analysis

### ✅ What We Have

1. **Live Scores Integration** (`lib/espn-api.ts`)
   - ESPN API integration for NBA, NFL, MLB, NHL, NCAAF, NCAAB
   - Fetches live scores every 30 seconds
   - Provides: score, period, time remaining, game status

2. **Bets Database** (`lib/supabase/schema.sql:36-67`)
   - Fields: sport, league, game_description, bet_type, bet_side, odds, stake
   - Status: pending, won, lost, push, cancelled
   - Missing: live tracking data, player prop details

3. **Player Props API** (`app/api/player-props/route.ts`)
   - Fetches player prop odds from the odds provider (Odds-API.io)
   - Supports: NBA, NFL, MLB, NHL
   - Markets: points, rebounds, assists, passing yards, etc.

### ❌ What's Missing

1. **Database fields** for tracking live progress
2. **Player prop bet storage** (player name, stat type, line)
3. **Live progress calculation** logic
4. **Real-time player stats** integration
5. **Progress visualization** components
6. **Probability calculations** based on game state
7. **Line storage system** - No historical line data stored (opening lines, line movements)
8. **CLV tracking** - Cannot calculate Closing Line Value without stored lines
9. **AI inconsistency** - Says "no access to odds" when data IS available
10. **Incorrect game schedules** - AI hallucinates games instead of showing actual upcoming games

---

## Solution Architecture

### Phase 0: Fix Critical AI Issues & Line Storage (HIGH PRIORITY)

This phase must be completed FIRST as it fixes fundamental problems with the app.

#### 0.1 Fix AI "No Access to Odds Data" Issue

**Problem:**
AI says: "I currently don't have access to live odds data to calculate potential arbitrage opportunities for the NBA games on November 10..."

**Root Cause:**
The system prompt doesn't clearly indicate that odds data IS BEING PROVIDED. The AI doesn't understand it should use the data in its context.

**Solution:**

Update system prompt in `app/api/chat/route.ts` (line 271-278):

```typescript
**When Live Odds Data is Provided:**
- YOU HAVE REAL-TIME ODDS DATA IN YOUR CONTEXT BELOW
- DO NOT SAY "I don't have access" - THE DATA IS PROVIDED
- If you see "LIVE ODDS DATA LOADED" below, YOU MUST USE IT
- Extract and display the data in an easy-to-read table format
- **CRITICAL**: Display ALL sportsbooks that have odds for each game
- Compare moneyline, spreads, and totals across ALL available sportsbooks
- Highlight which sportsbook has the best VALUE for each market
- If a user asks about a specific game and you have the data, show it immediately
- If a user asks for arbitrage and you have multi-sport data, CALCULATE IT using the provided odds
```

Add to arbitrage section:

```typescript
**Arbitrage Opportunities:**
When users ask for arbitrage opportunities:
1. CHECK IF ODDS DATA IS PROVIDED BELOW (look for "LIVE ODDS DATA")
2. If YES: Calculate actual arbitrage from the provided data
3. If NO data below: THEN say you don't have access
4. NEVER say you don't have access when data IS provided
5. Use the formula: For an arbitrage to exist, (1/decimal_odds_A) + (1/decimal_odds_B) < 1
```

**File to change:** `app/api/chat/route.ts:271-305`

#### 0.2 Fix AI Hallucinating Game Schedules

**Problem:**
User asks: "What NBA games are tomorrow?"
AI responds with completely incorrect games that aren't happening

**Example of Wrong Response:**
```
Brooklyn Nets vs. Detroit Pistons
Miami Heat vs. Philadelphia 76ers
Orlando Magic vs. Boston Celtics
[...none of these games are actually happening tomorrow]
```

**Root Cause:**
1. AI is making up games from memory/training data
2. System doesn't fetch actual upcoming games for the requested date
3. No date filtering in odds fetching logic

**Solution:**

**Step 1: Update system prompt with strict instructions**

Add to `app/api/chat/route.ts` system prompt:

```typescript
**CRITICAL - Game Schedule Queries:**
When users ask "what games are today/tonight/tomorrow":
1. YOU MUST ONLY use the live odds data provided in your context
2. NEVER make up games from memory or training data
3. If you see "LIVE ODDS DATA" below, list ONLY those games with their commence times
4. If NO odds data is provided below:
   - Say: "I need to fetch the latest schedule. One moment..."
   - DO NOT make up games
5. Group games by sport if multiple sports are in the data
6. Show game times in the user's timezone
7. If user asks for "tomorrow" and you only have "today" data, say you only have today's data

**Example correct response:**
"Here are the NBA games for today (November 10, 2025):
- Lakers vs Celtics (7:30 PM EST)
- Warriors vs Nets (10:00 PM EST)
[Only games from the provided data]"

**NEVER respond with:**
"Here are the games..." then list games NOT in the provided data.
```

**Step 2: Enhance odds fetching to respect date queries**

Modify `app/api/chat/route.ts` (line ~545-700) to detect "tomorrow" queries:

```typescript
// Detect if user is asking about tomorrow
const isTomorrowQuery = messageLower.match(/(tomorrow|tmrw|next day)/i)
const todayQuery = messageLower.match(/(today|tonight|this evening)/i)

// Determine if we need to fetch odds data
const needsOdds = message.toLowerCase().match(
  /(odds|lines|spread|moneyline|total|over|under|bet|game|match|tonight|today|tomorrow|arbitrage|arb)/i
)

if (needsOdds) {
  // ... existing odds fetching logic

  // AFTER fetching odds, filter by date if user asked about tomorrow
  if (isTomorrowQuery && oddsData.length > 0) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0))
    const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999))

    oddsData = oddsData.filter(game => {
      const gameTime = new Date(game.commence_time)
      const gameInUserTZ = new Date(gameTime.toLocaleString('en-US', { timeZone: timezone }))
      return gameInUserTZ >= tomorrowStart && gameInUserTZ <= tomorrowEnd
    })

    if (oddsData.length === 0) {
      oddsContext = '\n\n**NO GAMES TOMORROW**: There are no games scheduled for tomorrow based on current data.\n'
    }
  }
}
```

**Step 3: Add game count validation in AI context**

Update the odds context message to be more explicit:

```typescript
oddsContext = `\n\n**🔴 LIVE ODDS DATA LOADED 🔴**
YOU HAVE REAL-TIME ODDS DATA. USE IT. DO NOT SAY YOU DON'T HAVE ACCESS.

**CRITICAL INSTRUCTIONS:**
- Below are the ONLY games you should mention
- DO NOT make up or invent games not in this data
- DO NOT use games from your training data/memory
- If user asks for games not in this data, say data is not available yet

**Data Available:**
- ${formattedOdds.length} sport(s): ${formattedOdds.map(s => s.sport).join(', ')}
- ${totalGames} game(s) ${isTomorrowQuery ? 'tomorrow' : 'today/upcoming'}
- Multiple bookmakers per game
- Current as of ${new Date().toLocaleString()}

**LIVE ODDS DATA:**
${JSON.stringify(formattedOdds, null, 2)}
`
```

#### 0.3 Create Line Storage System

**Problem:**
- Cannot track opening lines vs closing lines
- Cannot identify sharp money movement
- Cannot calculate CLV (Closing Line Value)
- No historical line data for analysis

**Solution: Create `lines` table**

```sql
-- Lines tracking table
CREATE TABLE IF NOT EXISTS lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Game Identification
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_time TIMESTAMP WITH TIME ZONE NOT NULL,
  espn_game_id TEXT, -- Link to ESPN if available
  odds_provider_id TEXT, -- Provider game ID (Odds-API.io)

  -- Line Data
  market_type TEXT NOT NULL, -- 'spread', 'total', 'moneyline'
  bookmaker TEXT NOT NULL,

  -- Spread specific
  spread_home DECIMAL(5,2), -- e.g., -5.5
  spread_away DECIMAL(5,2), -- e.g., +5.5
  spread_home_odds INTEGER, -- e.g., -110
  spread_away_odds INTEGER, -- e.g., -110

  -- Total specific
  total_line DECIMAL(5,2), -- e.g., 215.5
  total_over_odds INTEGER, -- e.g., -110
  total_under_odds INTEGER, -- e.g., -110

  -- Moneyline specific
  moneyline_home INTEGER, -- e.g., -150
  moneyline_away INTEGER, -- e.g., +130

  -- Tracking
  line_type TEXT CHECK (line_type IN ('opening', 'current', 'closing')),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_sharp_move BOOLEAN DEFAULT false, -- Flag for significant line movement

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_lines_game ON lines(sport, home_team, away_team, game_time);
CREATE INDEX idx_lines_market ON lines(market_type, line_type, recorded_at DESC);
CREATE INDEX idx_lines_sharp ON lines(is_sharp_move, sport) WHERE is_sharp_move = true;
CREATE INDEX idx_lines_game_id ON lines(odds_provider_id, line_type);

-- View for opening lines
CREATE VIEW opening_lines AS
SELECT * FROM lines WHERE line_type = 'opening';

-- View for current lines
CREATE VIEW current_lines AS
SELECT DISTINCT ON (odds_provider_id, market_type, bookmaker)
  *
FROM lines
WHERE line_type = 'current'
ORDER BY odds_provider_id, market_type, bookmaker, recorded_at DESC;

-- View for closing lines
CREATE VIEW closing_lines AS
SELECT * FROM lines WHERE line_type = 'closing';
```

**Add CLV fields to bets table:**

```sql
-- Add to bets table
ALTER TABLE bets ADD COLUMN opening_line DECIMAL(5,2); -- Line when bet was placed
ALTER TABLE bets ADD COLUMN closing_line DECIMAL(5,2); -- Line when game started
ALTER TABLE bets ADD COLUMN clv_value DECIMAL(5,2); -- Closing Line Value
ALTER TABLE bets ADD COLUMN clv_percent DECIMAL(5,2); -- CLV as percentage
ALTER TABLE bets ADD COLUMN line_movement TEXT; -- 'sharp', 'public', 'steam', 'neutral'
ALTER TABLE bets ADD COLUMN bet_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

#### 0.4 Create Line Recording Service

**Create:** `lib/services/line-recorder.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { fetchOdds } from '@/lib/api/odds-api'

interface LineSnapshot {
  sport: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  oddsApiId: string
  bookmaker: string
  marketType: 'spread' | 'total' | 'moneyline'
  lineType: 'opening' | 'current' | 'closing'
  spreadHome?: number
  spreadAway?: number
  spreadHomeOdds?: number
  spreadAwayOdds?: number
  totalLine?: number
  totalOverOdds?: number
  totalUnderOdds?: number
  moneylineHome?: number
  moneylineAway?: number
}

export async function recordCurrentLines(sports: string[]) {
  const supabase = createClient()
  const allSnapshots: LineSnapshot[] = []

  for (const sport of sports) {
    const oddsData = await fetchOdds(sport, ['h2h', 'spreads', 'totals'])

    for (const game of oddsData) {
      for (const bookmaker of game.bookmakers) {
        // Record spreads
        const spreadMarket = bookmaker.markets.find(m => m.key === 'spreads')
        if (spreadMarket) {
          const homeOutcome = spreadMarket.outcomes.find(o => o.name === game.home_team)
          const awayOutcome = spreadMarket.outcomes.find(o => o.name === game.away_team)

          allSnapshots.push({
            sport: game.sport_key,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            gameTime: game.commence_time,
            oddsApiId: game.id,
            bookmaker: bookmaker.title,
            marketType: 'spread',
            lineType: 'current',
            spreadHome: homeOutcome?.point,
            spreadAway: awayOutcome?.point,
            spreadHomeOdds: homeOutcome?.price,
            spreadAwayOdds: awayOutcome?.price,
          })
        }

        // Record totals
        const totalMarket = bookmaker.markets.find(m => m.key === 'totals')
        if (totalMarket) {
          const overOutcome = totalMarket.outcomes.find(o => o.name === 'Over')
          const underOutcome = totalMarket.outcomes.find(o => o.name === 'Under')

          allSnapshots.push({
            sport: game.sport_key,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            gameTime: game.commence_time,
            oddsApiId: game.id,
            bookmaker: bookmaker.title,
            marketType: 'total',
            lineType: 'current',
            totalLine: overOutcome?.point,
            totalOverOdds: overOutcome?.price,
            totalUnderOdds: underOutcome?.price,
          })
        }

        // Record moneylines
        const mlMarket = bookmaker.markets.find(m => m.key === 'h2h')
        if (mlMarket) {
          const homeOutcome = mlMarket.outcomes.find(o => o.name === game.home_team)
          const awayOutcome = mlMarket.outcomes.find(o => o.name === game.away_team)

          allSnapshots.push({
            sport: game.sport_key,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            gameTime: game.commence_time,
            oddsApiId: game.id,
            bookmaker: bookmaker.title,
            marketType: 'moneyline',
            lineType: 'current',
            moneylineHome: homeOutcome?.price,
            moneylineAway: awayOutcome?.price,
          })
        }
      }
    }
  }

  // Batch insert all snapshots
  if (allSnapshots.length > 0) {
    const { error } = await supabase.from('lines').insert(
      allSnapshots.map(snap => ({
        sport: snap.sport,
        league: snap.sport.toUpperCase(),
        home_team: snap.homeTeam,
        away_team: snap.awayTeam,
        game_time: snap.gameTime,
        odds_api_id: snap.oddsApiId,
        market_type: snap.marketType,
        bookmaker: snap.bookmaker,
        line_type: snap.lineType,
        spread_home: snap.spreadHome,
        spread_away: snap.spreadAway,
        spread_home_odds: snap.spreadHomeOdds,
        spread_away_odds: snap.spreadAwayOdds,
        total_line: snap.totalLine,
        total_over_odds: snap.totalOverOdds,
        total_under_odds: snap.totalUnderOdds,
        moneyline_home: snap.moneylineHome,
        moneyline_away: snap.moneylineAway,
      }))
    )

    if (error) {
      console.error('Error recording lines:', error)
    } else {
      console.log(`Recorded ${allSnapshots.length} line snapshots`)
    }
  }

  return allSnapshots.length
}

// Detect sharp line movement
export async function detectSharpMoves() {
  const supabase = createClient()

  // Get all games happening in next 24 hours
  const tomorrow = new Date()
  tomorrow.setHours(tomorrow.getHours() + 24)

  const { data: recentLines } = await supabase
    .from('lines')
    .select('*')
    .gte('game_time', new Date().toISOString())
    .lte('game_time', tomorrow.toISOString())
    .eq('line_type', 'current')
    .order('recorded_at', { ascending: false })

  // Logic to detect sharp moves:
  // - Significant line movement (>2 points spread, >3 points total)
  // - Movement against public betting percentage
  // - Simultaneous movement across multiple sharp books
  // - Reverse line movement (line moves opposite to majority of bets)

  // Flag sharp moves in database
  // This would need more sophisticated logic
}

// Calculate CLV for a bet
export async function calculateCLV(betId: string) {
  const supabase = createClient()

  // Get bet details
  const { data: bet } = await supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .single()

  if (!bet) return null

  // Get closing line for this game
  const { data: closingLine } = await supabase
    .from('lines')
    .select('*')
    .eq('odds_api_id', bet.espn_game_id)
    .eq('market_type', bet.bet_type)
    .eq('line_type', 'closing')
    .single()

  if (!closingLine) return null

  // Calculate CLV based on bet type
  let clvValue = 0
  let clvPercent = 0

  if (bet.bet_type === 'spread') {
    // CLV = (closing line - opening line) * bet direction
    // Positive CLV = got a better line than closing
    clvValue = Math.abs(closingLine.spread_home - bet.opening_line)
    clvPercent = (clvValue / Math.abs(bet.opening_line)) * 100
  }

  // Update bet with CLV
  await supabase
    .from('bets')
    .update({
      closing_line: closingLine.spread_home || closingLine.total_line,
      clv_value: clvValue,
      clv_percent: clvPercent,
    })
    .eq('id', betId)

  return { clvValue, clvPercent }
}
```

#### 0.5 Create Line Recording API Endpoints

**Create:** `app/api/lines/record/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { recordCurrentLines } from '@/lib/services/line-recorder'

export async function POST(req: Request) {
  try {
    // Verify cron secret or admin auth
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const sports = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl']
    const count = await recordCurrentLines(sports)

    return NextResponse.json({
      success: true,
      linesRecorded: count,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Line recording error:', error)
    return NextResponse.json(
      { error: 'Failed to record lines' },
      { status: 500 }
    )
  }
}

// Allow manual triggering for testing
export async function GET() {
  const sports = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl']
  const count = await recordCurrentLines(sports)

  return NextResponse.json({
    success: true,
    linesRecorded: count,
    timestamp: new Date().toISOString(),
  })
}
```

**Create:** `app/api/lines/history/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const gameId = searchParams.get('gameId')
    const sport = searchParams.get('sport')
    const marketType = searchParams.get('marketType')

    const supabase = createClient()

    let query = supabase
      .from('lines')
      .select('*')
      .order('recorded_at', { ascending: true })

    if (gameId) query = query.eq('odds_api_id', gameId)
    if (sport) query = query.eq('sport', sport)
    if (marketType) query = query.eq('market_type', marketType)

    const { data: lines, error } = await query

    if (error) throw error

    return NextResponse.json({ lines })
  } catch (error) {
    console.error('Line history error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch line history' },
      { status: 500 }
    )
  }
}
```

**Create:** `app/api/lines/sharp-moves/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { detectSharpMoves } from '@/lib/services/line-recorder'

export async function GET() {
  try {
    await detectSharpMoves()

    const supabase = createClient()
    const { data: sharpMoves } = await supabase
      .from('lines')
      .select('*')
      .eq('is_sharp_move', true)
      .order('recorded_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ sharpMoves })
  } catch (error) {
    console.error('Sharp moves error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sharp moves' },
      { status: 500 }
    )
  }
}
```

#### 0.6 Setup Cron Jobs for Line Recording

**Add to `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/lines/record",
      "schedule": "0 * * * *"
    }
  ]
}
```

Or for more frequent updates during game days:

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

**Records lines every 30 minutes to track movements**

#### 0.7 Add Opening Line Capture When Bet is Placed

**Modify:** `app/api/bets/route.ts`

When a bet is created, capture the current line as the "opening line" for that bet:

```typescript
// In POST handler, before inserting bet
const currentLine = await fetchCurrentLine(gameDescription, betType, book)

const { data: bet, error: betError } = await supabase
  .from('bets')
  .insert({
    // ... existing fields
    opening_line: currentLine, // NEW: Store line when bet was placed
    bet_timestamp: new Date().toISOString(), // NEW: Exact time of bet
  })
```

#### 0.8 Display CLV and Line Movement in UI

**Show in bet cards:**
```tsx
<BetCard bet={bet}>
  {/* Existing bet info */}

  {/* NEW: Line movement indicator */}
  {bet.clv_value && (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">CLV:</span>
        <span className={`font-semibold ${bet.clv_value > 0 ? 'text-green-500' : 'text-red-500'}`}>
          {bet.clv_value > 0 ? '+' : ''}{bet.clv_value.toFixed(1)} points
        </span>
        <span className="text-xs text-gray-500">
          ({bet.clv_percent.toFixed(1)}%)
        </span>
      </div>

      {bet.line_movement && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-gray-400">Line Movement:</span>
          <Badge variant={bet.line_movement === 'sharp' ? 'success' : 'default'}>
            {bet.line_movement}
          </Badge>
        </div>
      )}

      <div className="text-xs text-gray-500 mt-1">
        Opening: {bet.opening_line} → Closing: {bet.closing_line}
      </div>
    </div>
  )}
</BetCard>
```

**Summary of Phase 0:**

✅ Fixes AI saying "no access to odds" when it does
✅ Fixes AI hallucinating wrong games
✅ Creates comprehensive line storage system
✅ Tracks opening/closing lines for CLV
✅ Identifies sharp money movements
✅ Records line history every 30 minutes
✅ Displays CLV and line movement to users

**Estimated Time for Phase 0:** 8-10 hours

---

### Phase 1: Database Schema Updates

**Add new fields to `bets` table:**

```sql
-- Player prop specific fields
ALTER TABLE bets ADD COLUMN player_name TEXT;
ALTER TABLE bets ADD COLUMN stat_type TEXT; -- 'points', 'rebounds', 'assists', etc.
ALTER TABLE bets ADD COLUMN line_value DECIMAL(10,2); -- The over/under line
ALTER TABLE bets ADD COLUMN bet_direction TEXT CHECK (bet_direction IN ('over', 'under'));

-- Live tracking fields
ALTER TABLE bets ADD COLUMN espn_game_id TEXT; -- Match to ESPN game ID
ALTER TABLE bets ADD COLUMN live_current_value DECIMAL(10,2); -- Current stat value
ALTER TABLE bets ADD COLUMN live_progress_percent INTEGER; -- 0-100%
ALTER TABLE bets ADD COLUMN live_status TEXT; -- 'pre', 'in', 'post'
ALTER TABLE bets ADD COLUMN live_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bets ADD COLUMN win_probability DECIMAL(5,2); -- 0-100%

-- Index for live queries
CREATE INDEX idx_bets_live_tracking ON bets(user_id, status, live_status) WHERE status = 'pending';
```

**Migration file:** `supabase/migrations/add_live_tracking_fields.sql`

---

### Phase 2: Live Tracking Service

**Create:** `lib/services/bet-tracker.ts`

**Functions:**

1. **`matchBetToLiveGame(bet, liveScores)`**
   - Enhanced version of existing `matchBetToGame` in `espn-api.ts`
   - Uses fuzzy matching for team names
   - Returns ESPN game ID and current game state

2. **`calculateSpreadProgress(bet, liveScore)`**
   - For spread bets: calculates current margin
   - Progress = How close to covering the spread (0-100%)
   - Win probability based on score margin + time remaining

3. **`calculateTotalProgress(bet, liveScore)`**
   - For over/under bets: tracks combined score
   - Progress = (current_total / line_value) * 100
   - Adjusts probability based on scoring pace + time remaining

4. **`calculateMoneylineProgress(bet, liveScore)`**
   - For moneyline bets: binary win/loss state
   - Progress based on current lead + time remaining
   - Win probability considers score differential and game situation

5. **`calculatePlayerPropProgress(bet, liveStats)`**
   - For player props: tracks individual player performance
   - Fetches live player stats from ESPN/Stats API
   - Progress = (current_stat / line_value) * 100
   - Probability considers: current pace, time remaining, player's season averages

6. **`updateAllPendingBets(userId)`**
   - Called periodically (every 30 seconds)
   - Fetches all pending bets for user
   - Updates live progress for each
   - Returns updated bets with progress data

**Advanced Probability Logic:**

```typescript
interface WinProbability {
  baseProb: number // Based on current state
  timeFactor: number // Adjusts based on time remaining
  paceFactor: number // Adjusts based on scoring pace
  historicalFactor: number // Based on similar game situations
  finalProb: number // Combined probability
}

function calculateWinProbability(
  bet: Bet,
  gameState: LiveScore,
  historical?: HistoricalData
): WinProbability {
  // Sophisticated probability calculation
  // Considers: current margin, time remaining, typical scoring patterns
}
```

---

### Phase 3: API Endpoints

#### 3.1 `GET /api/bets/live-tracking`

**Purpose:** Get live progress for all pending bets

**Response:**
```json
{
  "bets": [
    {
      "id": "uuid",
      "game_description": "Lakers vs Celtics",
      "bet_type": "spread",
      "bet_side": "Lakers -5.5",
      "stake": 100,
      "odds": -110,
      "live_data": {
        "status": "in", // pre, in, post
        "period": "3rd Quarter",
        "time_remaining": "8:45",
        "current_score": { "away": 78, "home": 82 },
        "current_margin": -4, // Lakers losing by 4
        "progress_percent": 40, // 40% chance of covering
        "win_probability": 35.5,
        "spread_differential": -1.5 // Need 1.5 more points
      }
    },
    {
      "id": "uuid",
      "game_description": "LeBron James - Points",
      "bet_type": "prop",
      "bet_side": "Over 28.5",
      "player_name": "LeBron James",
      "stat_type": "points",
      "line_value": 28.5,
      "stake": 50,
      "odds": -115,
      "live_data": {
        "status": "in",
        "period": "3rd Quarter",
        "time_remaining": "8:45",
        "current_value": 22, // Has 22 points
        "progress_percent": 77, // 22/28.5 = 77%
        "win_probability": 65.5,
        "needed_remaining": 6.5, // Needs 6.5 more points
        "pace_analysis": {
          "points_per_quarter": 7.3,
          "projected_final": 31.2
        }
      }
    }
  ],
  "summary": {
    "total_pending": 2,
    "total_at_risk": 150,
    "total_potential_win": 277.27,
    "live_games": 2,
    "avg_win_probability": 50.5
  }
}
```

#### 3.2 `GET /api/bets/:id/live`

**Purpose:** Get detailed live tracking for a single bet

**Includes:**
- Detailed game situation
- Quarter-by-quarter breakdown
- Historical comparison
- Momentum indicators

#### 3.3 `POST /api/bets/track-player-prop`

**Purpose:** Create a player prop bet with tracking

**Body:**
```json
{
  "player_name": "LeBron James",
  "stat_type": "points",
  "line_value": 28.5,
  "bet_direction": "over",
  "odds": -115,
  "stake": 50,
  "book": "DraftKings",
  "game_id": "espn_game_id",
  "game_description": "Lakers vs Celtics"
}
```

#### 3.4 `GET /api/player-stats/live/:gameId/:playerName`

**Purpose:** Get live player statistics during a game

**Uses:**
- ESPN API for live box scores
- Stats API for detailed player data
- Caches data for 30 seconds

---

### Phase 4: Frontend Components

#### 4.1 `BetTrackingCard.tsx`

**Visual progress indicator for each bet**

```tsx
<BetTrackingCard bet={bet}>
  {/* Header */}
  <div className="flex justify-between">
    <h3>Lakers -5.5 vs Celtics</h3>
    <LiveBadge status="LIVE" />
  </div>

  {/* Current Game State */}
  <GameScore
    away="Lakers" awayScore={78}
    home="Celtics" homeScore={82}
    period="3rd Q" time="8:45"
  />

  {/* Progress Bar */}
  <ProgressBar
    progress={40}
    color={getColorByProgress(40)} // red/yellow/green
    label="40% chance to cover"
  />

  {/* Detailed Analysis */}
  <div className="grid grid-cols-2 gap-4">
    <Stat label="Current Margin" value="-4" />
    <Stat label="Need to Win By" value="5.5" />
    <Stat label="Differential" value="-1.5" trend="needs" />
    <Stat label="Win Probability" value="35.5%" />
  </div>

  {/* Win Probability Meter */}
  <WinProbabilityGauge
    probability={35.5}
    stake={100}
    potentialWin={190.91}
  />
</BetTrackingCard>
```

**Features:**
- Real-time updates every 30 seconds
- Color-coded progress (green = likely win, red = likely loss)
- Pulsing animation for live bets
- Click to expand for detailed breakdown

#### 4.2 `PlayerPropTracker.tsx`

**Specialized component for player props**

```tsx
<PlayerPropTracker bet={bet}>
  {/* Player Info */}
  <PlayerHeader
    name="LeBron James"
    team="LAL"
    position="F"
    image={playerImage}
  />

  {/* Stat Tracker */}
  <StatProgress
    statType="Points"
    current={22}
    line={28.5}
    direction="over"
    progress={77}
  />

  {/* Pace Analysis */}
  <PaceIndicator
    currentPace={7.3} // pts per quarter
    neededPace={8.5}
    timeRemaining="14:45"
    projectedFinal={31.2}
  />

  {/* Quarter Breakdown */}
  <QuarterStats quarters={[
    { quarter: 1, points: 8 },
    { quarter: 2, points: 7 },
    { quarter: 3, points: 7 },
    { quarter: 4, points: 0, projected: 9.2 }
  ]} />
</PlayerPropTracker>
```

#### 4.3 `LiveBetsWidget.tsx`

**Dashboard widget showing all live bets**

- Compact list view
- Quick status indicators
- Total exposure and potential win
- One-click to expand details

#### 4.4 `BetProgressTimeline.tsx`

**Visual timeline showing bet progress throughout game**

- X-axis: Game time
- Y-axis: Win probability
- Line graph showing how probability changed
- Markers for key moments (quarters, big plays)

---

### Phase 5: Real-Time Updates

#### 5.1 Polling Strategy

**Client-side polling** (simple, reliable):
```typescript
// In LiveBetsWidget
useEffect(() => {
  const fetchLiveData = async () => {
    const response = await fetch('/api/bets/live-tracking')
    const data = await response.json()
    setBets(data.bets)
  }

  // Fetch immediately
  fetchLiveData()

  // Poll every 30 seconds
  const interval = setInterval(fetchLiveData, 30000)

  return () => clearInterval(interval)
}, [])
```

**Benefits:**
- Simple to implement
- No WebSocket complexity
- Works with Vercel serverless

**Alternative (Future Enhancement):**
- Supabase Realtime subscriptions
- WebSockets for instant updates
- Server-Sent Events (SSE)

#### 5.2 Background Job (Optional)

**Vercel Cron Job** to update all pending bets:
```typescript
// app/api/cron/update-bets/route.ts
export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Get all users with pending bets
  const { data: users } = await supabase
    .from('bets')
    .select('user_id')
    .eq('status', 'pending')
    .eq('live_status', 'in')

  // Update each user's bets
  for (const user of users) {
    await updateAllPendingBets(user.user_id)
  }

  return NextResponse.json({ updated: users.length })
}
```

**Configure in `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/update-bets",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

---

### Phase 6: Probability Engine

#### 6.1 Statistical Models

**For Spreads:**
```typescript
function calculateSpreadWinProbability(
  currentMargin: number,
  spread: number,
  timeRemaining: number, // in seconds
  sport: string
): number {
  // Sport-specific scoring rates
  const avgPointsPerMinute = getSportScoringRate(sport)

  // Calculate remaining expected points
  const expectedPointsRemaining = (timeRemaining / 60) * avgPointsPerMinute

  // Calculate z-score based on current differential
  const differential = currentMargin - spread
  const standardDeviation = Math.sqrt(expectedPointsRemaining)
  const zScore = differential / standardDeviation

  // Convert to probability using normal distribution
  return normalCDF(zScore)
}
```

**For Totals:**
```typescript
function calculateTotalWinProbability(
  currentTotal: number,
  line: number,
  direction: 'over' | 'under',
  timeRemaining: number,
  currentPace: number
): number {
  // Project final total based on current pace
  const projectedFinal = projectFinalTotal(currentTotal, timeRemaining, currentPace)

  // Calculate standard deviation based on time remaining
  const stdDev = calculateTotalStdDev(timeRemaining)

  // Calculate probability
  const zScore = (projectedFinal - line) / stdDev
  const prob = normalCDF(zScore)

  return direction === 'over' ? prob : 1 - prob
}
```

**For Player Props:**
```typescript
function calculatePlayerPropProbability(
  currentStat: number,
  line: number,
  direction: 'over' | 'under',
  gameTimeRemaining: number,
  playerSeasonAvg: number,
  playerMinutesPlayed: number,
  playerProjectedMinutes: number
): number {
  // Adjust for player's pace this game
  const paceThisGame = currentStat / playerMinutesPlayed

  // Project final stat based on remaining minutes
  const minutesRemaining = playerProjectedMinutes - playerMinutesPlayed
  const projectedRemaining = paceThisGame * minutesRemaining
  const projectedFinal = currentStat + projectedRemaining

  // Compare to historical variance
  const variance = getPlayerStatVariance(playerSeasonAvg)
  const stdDev = Math.sqrt(variance)

  const zScore = (projectedFinal - line) / stdDev
  const prob = normalCDF(zScore)

  return direction === 'over' ? prob : 1 - prob
}
```

#### 6.2 Machine Learning (Future)

**Train models on historical data:**
- Features: current score, time remaining, team stats, player stats
- Target: final game outcome
- Models: Gradient Boosting, Neural Networks
- Update models weekly with new data

---

## Implementation Steps

### Step 0: Fix Critical Issues (Phase 0) - DO THIS FIRST (8-10 hours)

**0.1 Fix AI Responses (2-3 hours)**
1. Update system prompt in `app/api/chat/route.ts` - "no access to odds" fix
2. Add strict instructions about not making up games
3. Add detection for "tomorrow" queries
4. Implement date filtering for tomorrow's games
5. Test AI responses thoroughly

**0.2 Create Line Storage System (4-5 hours)**
1. Create migration SQL for `lines` table
2. Add CLV fields to `bets` table
3. Create `lib/services/line-recorder.ts`
4. Implement `recordCurrentLines()` function
5. Implement `detectSharpMoves()` function
6. Implement `calculateCLV()` function
7. Test line recording

**0.3 Create Line API Endpoints (1-2 hours)**
1. Create `app/api/lines/record/route.ts`
2. Create `app/api/lines/history/route.ts`
3. Create `app/api/lines/sharp-moves/route.ts`
4. Test endpoints

**0.4 Setup Cron Job (1 hour)**
1. Create/update `vercel.json` with cron config
2. Deploy and test cron job
3. Verify lines are being recorded

---

### Step 1: Database Migration (1 hour)
1. Create migration SQL file for live tracking fields
2. Add new columns to bets table (player_name, stat_type, etc.)
3. Create indexes for performance
4. Test migration on development DB
5. Run migration on production

### Step 2: Core Tracking Service (3-4 hours)
1. Create `lib/services/bet-tracker.ts`
2. Implement bet-to-game matching logic
3. Implement progress calculation for spreads
4. Implement progress calculation for totals
5. Implement progress calculation for moneylines
6. Add win probability calculations
7. Write unit tests

### Step 3: Player Prop Tracking (3-4 hours)
1. Enhance ESPN API integration for player stats
2. Create player stats fetching functions
3. Implement player prop progress calculation
4. Add player stat projection logic
5. Test with live games

### Step 4: API Endpoints (2-3 hours)
1. Create `GET /api/bets/live-tracking`
2. Create `GET /api/bets/:id/live`
3. Create `GET /api/player-stats/live/:gameId/:player`
4. Add proper error handling
5. Add caching (30 second TTL)
6. Test all endpoints

### Step 5: Frontend Components (4-6 hours)
1. Create `BetTrackingCard` component
2. Create `PlayerPropTracker` component
3. Create `ProgressBar` component
4. Create `WinProbabilityGauge` component
5. Create `LiveBetsWidget` for dashboard
6. Add animations and transitions
7. Make responsive for mobile

### Step 6: Integration (2-3 hours)
1. Add live tracking to chat page
2. Add live tracking to bets history page
3. Implement polling for real-time updates
4. Add loading states
5. Add error handling
6. Test full user flow

### Step 7: Testing & Polish (2-3 hours)
1. Test with various bet types
2. Test probability calculations
3. Test with different game states
4. Optimize performance
5. Add analytics tracking
6. User acceptance testing

### Step 8: Documentation (1 hour)
1. Update user guide
2. Document API endpoints
3. Add component documentation
4. Create troubleshooting guide

---

## Total Estimated Time

- **Phase 0 (Critical Fixes & Line Storage):** 8-10 hours
- **Backend (Live Tracking):** 10-13 hours
- **Frontend:** 6-9 hours
- **Testing:** 2-3 hours
- **Documentation:** 1 hour

**Total: 27-36 hours** (~4-5 days of focused work)

### Breakdown by Priority:

**HIGH PRIORITY (Phase 0):** 8-10 hours
- Fixes critical AI issues
- Adds line storage for CLV tracking
- Should be done FIRST

**MEDIUM PRIORITY (Live Tracking):** 16-22 hours
- Live bet progress
- Win probability
- Player props tracking

**Total: 24-32 hours** for full implementation

---

## Technical Challenges & Solutions

### Challenge 1: Matching Bets to Live Games

**Problem:** Team names in bet descriptions may not match ESPN's team names exactly
- Bet: "Lakers -5.5"
- ESPN: "Los Angeles Lakers vs Boston Celtics"

**Solution:**
- Team name normalization dictionary
- Fuzzy string matching (Levenshtein distance)
- Store ESPN game ID when bet is placed

### Challenge 2: Player Name Matching

**Problem:** Player names can vary (LeBron vs LeBron James vs L. James)

**Solution:**
- Player name normalization
- Use player IDs when available
- Fallback to fuzzy matching

### Challenge 3: Live Stats Accuracy

**Problem:** ESPN API may have delays or inconsistencies

**Solution:**
- Cross-reference multiple sources when possible
- Add "Last updated" timestamp
- Show confidence level in probability

### Challenge 4: Performance

**Problem:** Updating many bets frequently is expensive

**Solution:**
- Only update bets for live games
- Batch updates per user
- Cache live scores (30 second TTL)
- Use efficient database queries with indexes

### Challenge 5: Probability Accuracy

**Problem:** Simple models may not be accurate

**Solution:**
- Start with simple models, iterate based on data
- Compare predictions to actual outcomes
- Calibrate models over time
- Show "This is an estimate" disclaimer

---

## Future Enhancements

### Phase 7: Auto-Settlement
- Automatically settle bets when games end
- Verify final scores from multiple sources
- Update bankroll instantly
- Send notifications

### Phase 8: Bet Insights
- Show historical win rate for similar bets
- Compare to closing line
- Show "sharp" vs "public" money
- Recommend hedging opportunities

### Phase 9: Mobile Push Notifications
- Notify when bet is winning
- Alert when probability drops
- Game start reminders
- Cash-out opportunities

### Phase 10: Advanced Analytics
- Machine learning models
- Historical performance tracking
- Bet clustering and patterns
- ROI by bet type, sport, time, etc.

---

## Dependencies

### NPM Packages (Already Installed)
- ✅ `date-fns` - Date manipulation
- ✅ `@supabase/supabase-js` - Database
- ✅ Next.js 14 - Framework

### New Dependencies Needed
- `fuse.js` - Fuzzy string matching (~40KB)
- `chart.js` or `recharts` - For probability charts (recharts already installed ✅)
- `simple-statistics` - Statistical functions (~10KB)

### External APIs
- ✅ ESPN Scoreboard API (free, unofficial)
- ✅ Odds-API.io (already integrated)
- Optional: ESPN Player Stats API
- Optional: Sports Reference API for historical data

---

## Success Metrics

1. **User Engagement**
   - % of users who view live tracking
   - Time spent on bet tracking page
   - Number of live bets tracked per user

2. **Accuracy**
   - Win probability accuracy (calibration)
   - Player prop projection accuracy
   - Spread prediction accuracy

3. **Performance**
   - API response time < 500ms
   - Page load time < 2s
   - Real-time update latency < 30s

4. **Business**
   - Increased user retention
   - More bets logged
   - Higher user satisfaction (NPS)

---

## Risk Mitigation

### Risk 1: ESPN API Changes
**Mitigation:**
- Abstract ESPN API calls into service layer
- Add multiple data sources
- Monitor API health
- Have fallback to manual updates

### Risk 2: High API Costs
**Mitigation:**
- Aggressive caching (30-60 second TTL)
- Only fetch for active games
- Batch requests
- Consider rate limiting per user

### Risk 3: Inaccurate Probabilities
**Mitigation:**
- Clear disclaimers
- "This is an estimate" messaging
- Allow users to report inaccuracies
- Continuously calibrate models

### Risk 4: Performance Issues
**Mitigation:**
- Database indexes
- Query optimization
- Consider Redis for caching
- CDN for static assets
- Lazy load components

---

## Next Steps

1. **Review this plan** with team
2. **User feedback:** Would users actually use this?
3. **Prioritize features:** MVP vs Nice-to-have
4. **Timeline:** When to start?
5. **Resources:** Who will build it?

---

**Created:** November 10, 2025
**Author:** Claude Code
**Status:** Ready for Review
**Priority:** HIGH 🔴
