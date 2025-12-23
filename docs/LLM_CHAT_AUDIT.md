# LLM Chat System Audit Report

> NOTE: Betting data sources have since migrated from Covers/Odds-API to SportsBettingDime (SBD). Treat Covers references below as historical.

**Date**: December 15, 2025
**Auditor**: Claude Code
**Scope**: Intent detection, tool capabilities, data sources, and gaps vs app goals

---

## Executive Summary

The Delta Sports LLM chat system has **strong core capabilities** for stats queries and basic betting analysis, but has **significant gaps** in betting intelligence features (line movement, public vs sharp, closing line value) that are central to the app's value proposition. The system uses a dual-pipeline architecture with good intent detection, but lacks critical betting data feeds.

**Overall Grade: B-**

**Key Findings**:
- ✅ Excellent stats query capabilities (30 tools)
- ✅ Strong custom modeling system
- ✅ Good live data integration
- ❌ Missing line movement tracking (infrastructure exists but not integrated)
- ❌ Missing CLV analysis (service exists but not exposed to LLM)
- ❌ Limited betting splits coverage (only 25% of NBA games)
- ❌ No leaderboard implementation (placeholder only)

---

## 1. Current Capabilities ✅

### A. Unified Query Pipeline (StatMuse-like)

**Architecture**:
```
User Query → intent-classifier.ts → data-router.ts → Data Sources → LLM Analysis → Response
```

**Total Tools Available**: 30 unified tools + 11 ESPN tools + 8 betting/model tools = **49 tools**

---

### Tool Inventory

#### Static Data Tools (Fast, No API Call)

1. **`getStaticTeamStats`** - NBA team stats including opponent/defensive stats ✅
   - **What it does**: Returns team offensive/defensive stats from static data files
   - **Opponent stats available**: opponent 3P%, eFG%, TS%, ORB allowed, defensive rating, points allowed
   - **Example queries**:
     - "What 3pt% do opponents shoot vs Thunder?"
     - "What's the Lakers defensive rating?"
   - **Source**: `data/nba_team_2025_26.ts`, `data/nba_team_adv_2025_26.ts`

2. **`getStaticPlayerStats`** - NBA player season averages
   - **What it does**: Returns player PPG, RPG, APG, shooting percentages
   - **Example queries**: "What's Curry's PPG?", "LeBron's shooting percentage?"
   - **Source**: `data/nba_per_game_2025_26.ts`

---

#### ESPN Live Data Tools

3. **`getEspnTeamStats`** - Current team season stats (multi-sport)
   - **Supports**: NBA, NFL, MLB, NHL
   - **When used**: When static data not available or for non-NBA sports

4. **`getEspnPlayerStats`** - Player season stats (multi-sport)
   - **Supports**: NBA, NFL, MLB, NHL
   - **When used**: For non-NBA players or most up-to-date stats

5. **`getEspnPlayerGameLogs`** - Game-by-game stats for season
   - **Use cases**:
     - Recent performance analysis
     - Trend analysis over multiple games
     - Last N games filtering
   - **Example**: "Show me Tatum's last 10 games"

6. **`getLiveScores`** - Real-time scores and game information
   - **Supports**: NBA, NFL, NHL (MLB not in live-scores currently)
   - **Example queries**:
     - "What's the score of the Lakers game?"
     - "Who's winning the Celtics game?"
     - "Are there any games on right now?"

7. **`getInjuries`** - Current injury report
   - **Scope**: Team-specific or league-wide
   - **Example**: "Who's injured on the Lakers?", "NBA injury report"

---

#### Aggregation Tools (Complex Queries)

8. **`getPlayerThresholdGames`** - Count games exceeding stat thresholds ✅
   - **What it does**: Analyzes game logs to count performances above/below threshold
   - **Example queries**:
     - "How many 40-point games has Luka had?"
     - "How many games has Curry made 5+ threes?"
     - "Triple-doubles for Jokic this season?"
   - **Supported stats**: PTS, REB, AST, 3PM, STL, BLK, FGM, FTM
   - **Operators**: >=, >, =

9. **`getPlayerVsOpponent`** - Player stats against specific opponent
   - **Example**: "How does Giannis perform against the Celtics?"
   - **Returns**: Averaged stats across all games vs that opponent this season

10. **`getPlayerRestSplit`** - Performance on back-to-backs vs rested games
    - **What it analyzes**: Back-to-back (0 days rest) vs well-rested (2+ days)
    - **Example**: "How does Embiid play on back-to-backs?"

11. **`getTeamBackToBackSplit`** - Team performance on B2Bs
    - **Focus**: Second game of back-to-back vs well-rested games
    - **Example**: "How do the Lakers do on back-to-backs?"

---

#### Betting/ATS Tools

12. **`getTeamAtsAnalysis`** - ESPN-based ATS records with situational splits
    - **Situations**: overall, home, away, favorite, underdog, home_favorite, away_underdog
    - **Source**: ESPN API
    - **Example**: "What's the Thunder's ATS record as a favorite?"

13. **`getTeamAfterLoss`** - Team performance/record following losses
    - **Example**: "How do the Warriors perform after a loss?"

14. **`getTeamHomeAwayDefense`** - Defensive splits by location
    - **Example**: "Do the Lakers defend better at home?"

15. **`get_team_ats_records`** ✅ - Covers.com season-long ATS records
    - **What it returns**: Overall, home, away, favorite, underdog, last 10, streak
    - **Source**: Covers.com scraper → `team_ats_records` table
    - **Example**: "What's the Celtics ATS record?"
    - **Coverage**: NBA only (30 teams)

16. **`get_betting_splits`** ✅ - Covers.com public betting percentages
    - **What it returns**: Bet %, money %, sharp indicators for today's games
    - **Sharp detection**: 15%+ divergence between money % and bet %
    - **Source**: Covers.com scraper → `public_betting_splits` table
    - **Example**: "Where is the money going tonight?"
    - **⚠️ Current limitation**: Only 25% of games (2 of 8) due to scraper using "Top Consensus" pages

17. **`analyze_game_splits`** ✅ - Deep game-specific betting analysis
    - **What it returns**: Detailed bet %, money %, divergence for specific matchup
    - **Supports**: Team name matching (finds game by team names)
    - **Example**: "Analyze the Warriors game betting"
    - **Source**: Covers.com scraper → `latest_betting_splits` view

---

#### Schedule/Context Tools

18. **`getTeamScheduleContext`** - Analyze travel, rest, back-to-backs
    - **What it analyzes**:
      - Travel distance/timezone changes
      - Rest days between games
      - Back-to-back indicators
    - **Example**: "How will the Trail Blazers road trip affect them?"
    - **Look-ahead/back**: Configurable (default 7 days each direction)

---

#### Leaderboard Tools

19. **`getLeaderboard`** - League leaders for stat category
    - **⚠️ STATUS**: NOT IMPLEMENTED - Returns placeholder message
    - **Current behavior**: Returns `{ message: 'Leaderboard data - to be implemented with full roster scan' }`
    - **Expected use**: "Who leads the league in steals?", "Top scorers in NBA"
    - **Blocker**: No roster-wide stat scanning infrastructure

20. **`getAtsLeaderboard`** - Best ATS teams by situation
    - **✅ STATUS**: IMPLEMENTED
    - **Situations**: overall, home, away, favorite, underdog
    - **Example**: "Which teams cover the spread most?"
    - **Limit**: Configurable (default 10 teams)

---

#### Fallback Tool

21. **`webSearch`** - Web search for unavailable data
    - **When used**: Last resort when data not in other sources
    - **Use cases**:
      - Very recent news/events
      - Non-major sports
      - Historical data beyond current season

---

### B. ESPN Direct Tools (Low-Level API Access)

**Purpose**: Advanced queries requiring direct ESPN API access

22. **`espnTeamAtsRecord`** - Fetch team ATS record from ESPN
    - **Parameters**: sport, teamId, season, seasonType
    - **When used**: Need ESPN-specific ATS data (different from Covers)

23. **`espnTeamOddsRecord`** - Team odds record (favorite/underdog, open/close)
    - **What it returns**: Favorite/underdog splits, opening/closing line performance

24. **`espnTeamPastPerformances`** - Team betting history against specific book
    - **Default provider**: 1003
    - **Limit**: Configurable

25. **`espnTeamFutures`** - Futures markets for sport/season
    - **Example**: Championship odds, win totals

26. **`espnPredictor`** - ESPN power index/predictions for event
    - **What it returns**: ESPN's algorithmic prediction and confidence

27. **`espnTeamSeasonStats`** - Detailed team season stats (ESPN splits/categories)
    - **More granular than**: `getEspnTeamStats`

28. **`espnPlayerSeasonStats`** - Detailed player season stats
    - **More granular than**: `getEspnPlayerStats`

29. **`espnPlayerGameLogs`** - Player game logs
    - **Similar to**: `getEspnPlayerGameLogs` but direct ESPN access

30. **`espnEventsByDateRange`** - Find event IDs by date range
    - **Format**: YYYY-MM-DD to YYYY-MM-DD
    - **Use case**: Getting all games in a date window

31. **`espnEventSnapshot`** - Full event summary/boxscore/predictor
    - **What it returns**: Complete game data including boxscore, summary, predictor

32. **`espnInjuries`** - League-wide injury list
    - **Supports**: NBA, NFL, MLB, NHL

---

### C. Betting Operations Tools

33. **`log_bet`** - Save user bets to database
    - **What it stores**: Game, market, odds, stake, book, timestamp
    - **Table**: `bets`

34. **`get_bet_history`** - Retrieve user's betting history
    - **Filters**: Date range, sport, settled status
    - **Returns**: Bet details + outcomes

35. **`calculate_kelly`** - Kelly Criterion bet sizing
    - **Inputs**: Odds, win probability, optional bankroll/unit size
    - **Returns**: Recommended stake with fractional Kelly (default 0.25)
    - **Safety**: Max stake percentage cap (default 5% of bankroll)

---

### D. Custom Model Tools

36. **`create_custom_model`** - Build weighted stat models
    - **What it does**: User defines stats, weights, importance, normalization
    - **Model types**: Team, matchup differential, player-focused
    - **Normalization**: z-score, minmax, raw
    - **Storage**: `custom_models` table

37. **`list_custom_models`** - Show user's saved models
    - **Limit**: Configurable (default 5)
    - **Returns**: Model metadata (name, sport, market type, stats)

38. **`apply_custom_model`** - Run saved model on matchups
    - **Modes**:
      - Single matchup
      - Slate scan (today/tomorrow)
    - **Returns**: Weighted score, confidence interval, edge calculation
    - **Max games**: Configurable (default 8 for slate)

39. **`run_research_model`** - Scan entire slate for opportunities
    - **What it does**: Applies model across all games, filters by min confidence
    - **Caches**: Results for quick retrieval
    - **Returns**: Ranked list of opportunities

40. **`list_research_opportunities`** - Get cached research results
    - **What it does**: Returns latest cached results without re-running scan
    - **Limit**: Number of cached result sets (default 1)

---

### E. Odds/Lines Tools

41. **`get_odds`** - Fetch current betting odds
    - **Markets**: Moneyline, spread, totals, player props
    - **Source**: Odds-API.io
    - **Multi-book**: Yes (configurable bookmakers)

42. **`compare_books`** - Find best prices across bookmakers
    - **What it does**: Compares odds/lines across all available books
    - **Returns**: Best odds for each side, book names, differences
    - **Use case**: Line shopping

43. **`check_props`** - Get player prop odds
    - **Props**: Points, rebounds, assists, threes (NBA); passing yards, rushing yards, TDs (NFL); hits, RBIs (MLB); etc.
    - **Returns**: Over/under lines and odds across books

44. **`detect_stale_lines`** - Find outlier odds (arbitrage detection)
    - **What it does**: Compares book odds to consensus/Pinnacle
    - **Flags**: Lines significantly different from market
    - **Use case**: Finding stale lines, arbitrage opportunities

---

## 2. What the System Can Do Well ✅

### Excellent Areas (A Grade)

1. **Stats Queries** - Comprehensive coverage
   - ✅ Season averages (players/teams)
   - ✅ Game logs with filtering
   - ✅ Opponent defensive stats
   - ✅ Threshold counting ("How many 40+ point games?")
   - ✅ Multi-sport support (NBA, NFL, MLB, NHL)

2. **Situational Analysis** - Good contextual understanding
   - ✅ Rest/travel analysis
   - ✅ Back-to-back performance splits
   - ✅ Home/away splits
   - ✅ Player vs opponent history
   - ✅ Schedule density analysis

3. **Real-Time Data** - Timely information
   - ✅ Live scores with game details
   - ✅ Current injuries (league-wide or team-specific)
   - ✅ Today's odds/lines across multiple books
   - ✅ Real-time line comparisons

4. **Custom Modeling** - Powerful user-created models
   - ✅ Flexible stat weighting
   - ✅ Multiple normalization methods
   - ✅ Confidence intervals
   - ✅ Slate scanning
   - ✅ Model persistence and reuse

5. **Intent Detection** - Smart query routing
   - ✅ Correctly identifies stats queries (unified pipeline)
   - ✅ Separates betting line requests from stats requests
   - ✅ Handles betting splits queries (after recent fixes)
   - ✅ Bidirectional pattern matching (e.g., "ATS record" and "record ATS")

---

### Good Areas (B Grade)

1. **ATS/Betting Performance** - Moderate coverage
   - ✅ Season-long ATS records (Covers.com for NBA)
   - ✅ Situational ATS splits (ESPN)
   - ⚠️ Public betting splits (LIMITED - only 25% of NBA games)
   - ✅ Sharp money detection (when data available)

2. **Multi-Sport Coverage**
   - ✅ NBA: Excellent (static data + ESPN + Covers)
   - ⚠️ NFL: Moderate (ESPN only, no Covers)
   - ⚠️ MLB/NHL: Basic (ESPN only)
   - ⚠️ NCAAB/NCAAF: Limited (ESPN recent games only)

---

## 3. Major Gaps vs App Goals ❌

**Based on**: `docs/LLM_IMPLEMENTATION_PLAN.md` and `docs/DATA_GAPS.md`

---

### A. Missing Betting Intelligence (CRITICAL GAPS)

#### 1. Line Movement Analysis ❌ **CRITICAL**

**Goal from docs**: "Detects and narrates line movement (what moved, why, public vs sharp)"

**What's Missing**:
- ❌ No line history tracking (open → current → close)
- ❌ No intraday movement snapshots
- ❌ No timestamp tracking of line changes
- ❌ Cannot answer: "Why did the line move?" or "When did it move?"

**Current State**:
- ✅ Infrastructure EXISTS: `lib/services/line-recorder.ts`
- ✅ Database table EXISTS: `lines` table in Supabase
- ❌ **NOT integrated with chat**: No LLM tool to query line history
- ❌ **No LLM access**: Data exists but unreachable by chat system

**Impact**: Cannot provide core value prop of explaining line movements

**Example Blocked Queries**:
- "Why did the Lakers line move from -5 to -7.5?"
- "When did the Celtics spread change?"
- "Show me line movement for the Warriors game"

---

#### 2. Closing Line Value (CLV) ❌ **CRITICAL**

**Goal from docs**: "Closing lines for CLV/backtesting"

**What's Missing**:
- ❌ No closing line capture at game start
- ❌ CLV not exposed to LLM
- ❌ Cannot calculate if bet beat closing line
- ❌ Cannot answer: "What was the CLV on my Lakers bet?"
- ❌ No backtesting against closing lines

**Current State**:
- ✅ CLV service EXISTS: `lib/services/clv.ts`
- ✅ Calculation logic implemented
- ❌ **Not integrated with chat**: No tool for LLM
- ❌ **No closing line recording**: Line recorder doesn't capture closing lines

**Impact**: Missing THE metric that separates winning from losing bettors

**Example Blocked Queries**:
- "What's my CLV this season?"
- "Did I beat the closing line on my Celtics bet?"
- "Show me my bets with positive CLV"

---

#### 3. Public vs Sharp Analysis ⚠️ **PARTIALLY IMPLEMENTED**

**Goal from docs**: "Public vs sharp splits (bets%/handle%) per market"

**Current State**:
- ✅ Tools exist: `get_betting_splits`, `analyze_game_splits`
- ✅ Sharp detection logic: 15%+ divergence between money % and bet %
- ❌ **Data coverage SEVERELY limited**:
  - Only 2 of 8 NBA games have data (25% coverage)
  - Missing most games, especially less popular matchups
  - Cannot reliably answer: "Where is sharp money going tonight?"

**Root Cause**:
- Scraper uses Covers' "Top Consensus" contest pages
- URLs:
  - `https://contests.covers.com/consensus/topconsensus/nba/overall` (spread)
  - `https://contests.covers.com/consensus/topoverunderconsensus/nba/overall` (totals)
- These pages only show most popular games for betting contests, not full schedule

**Impact**: Major gap in betting intelligence - cannot reliably identify sharp action

**Example Queries**:
- ✅ "Show me betting splits" - Works for 2 games
- ❌ "Where is sharp money going on the Warriors game?" - Often no data
- ❌ "What games have sharp action tonight?" - Only sees 25% of games

---

#### 4. Line Movement Explanations ❌ **CRITICAL**

**Goal from docs**: "List key factors (injuries, rest/travel, pace/efficiency, matchup allowances, splits if live)"

**What's Missing**:
- ❌ No synthesis of injury + line move + public splits
- ❌ Cannot explain: "Why is the Lakers line at -7.5 when it opened at -5?"
- ❌ No correlation between news events and line changes
- ❌ No narrative: "Line moved because..."

**Blocker**: No line history data (see Gap #1)

**Impact**: Cannot provide "smart bettor" insights

**Example Blocked Queries**:
- "Why did this line move?"
- "What caused the spread to shift?"
- "Explain the line movement on this game"

---

### B. Missing Advanced Stats/Context

#### 1. Team Opponent-Allowed Details ❌ **MEDIUM PRIORITY**

**From DATA_GAPS.md**: "paint points, fast-break points, points off turnovers, second-chance points, bench points, opponent 3PA/3PM/eFG/3P%, opponent ORB/TO/FTA, pace"

**Current State**:
- ✅ Basic opponent stats available:
  - Opponent 3P%, eFG%, TS%
  - Points allowed
  - Defensive rating
  - Opponent offensive rebounds
- ❌ **Missing granular stats**:
  - ❌ Points in paint (allowed)
  - ❌ Fast-break points (allowed)
  - ❌ Points off turnovers (allowed)
  - ❌ Second-chance points (allowed)
  - ❌ Bench scoring (allowed)

**Impact**: Cannot answer nuanced defensive matchup questions

**Example Blocked Queries**:
- "How many fast-break points do the Celtics allow?"
- "What's the Lakers' defense on points in the paint?"
- "How much do opponents score off turnovers vs the Nuggets?"

**Why Missing**: Need detailed box score ingestion and aggregation pipeline

---

#### 2. Quarter/Period Scoring ❌ **MEDIUM PRIORITY**

**From DATA_GAPS.md**: "quarter/OT caches: period-level scoring stored per event"

**What's Missing**:
- ❌ No quarter-by-quarter team performance data
- ❌ No quarter-specific trends
- ❌ Cannot detect 4th quarter strengths/weaknesses
- ❌ No overtime performance tracking

**Impact**: Cannot answer quarter-specific questions

**Example Blocked Queries**:
- "How does LAL perform in the 4th quarter?"
- "What's the Celtics' 1st quarter scoring average?"
- "Do the Warriors start slow?"
- "Best 3rd quarter teams?"

**Implementation Needed**:
- Database table for quarter scores
- ESPN box score parser
- Aggregation/caching logic

---

#### 3. Start Time Data ❌ **LOW PRIORITY**

**From DATA_GAPS.md**: "local tip times for early/late buckets"

**What's Missing**:
- ❌ No early/late game flags
- ❌ Cannot factor in: "How do West Coast teams do in early East Coast games?"
- ❌ No timezone-adjusted performance analysis

**Impact**: Missing situational edge factor

**Example Blocked Queries**:
- "How do the Lakers do in early games?"
- "West Coast teams record in East Coast afternoon games"

---

### C. Missing Leaderboards ❌ **MEDIUM PRIORITY**

#### Stat Leaderboards - NOT IMPLEMENTED

**Tool Status**: `getLeaderboard` exists but returns placeholder:
```json
{
  "stat": "steals",
  "sport": "nba",
  "message": "Leaderboard data - to be implemented with full roster scan"
}
```

**What's Missing**:
- ❌ Cannot answer: "Who leads the league in steals?"
- ❌ Cannot answer: "Top 10 scorers in NBA"
- ❌ No ranking data for any stat category

**Why Missing**: No roster-wide stat scanning infrastructure

**Implementation Needed**:
- Batch script to scan all rosters
- Cache top performers by stat
- Daily cron job to update
- `leaderboards` table in database

---

### D. Missing Multi-Sport Betting Coverage ⚠️ **MEDIUM PRIORITY**

**Current Coverage**:
- ✅ **NBA**: Excellent (static data + ESPN + Covers ATS + Covers splits)
- ⚠️ **NFL**: Moderate (ESPN only, no Covers)
- ⚠️ **MLB/NHL**: Basic (ESPN only)
- ⚠️ **NCAAB/NCAAF**: Limited (ESPN recent games only)

**Gaps**:
- ❌ Covers.com data only supports NBA currently
- ❌ No betting splits for NFL/MLB/NHL
- ❌ No Covers ATS records for non-NBA sports

**Note**: Covers.com DOES support other sports, just not integrated

**Impact**: Limited addressable market beyond NBA bettors

---

## 4. Data Source Analysis

### A. What Data We Have ✅

| Data Type | Source | Quality | Coverage | Notes |
|-----------|--------|---------|----------|-------|
| **NBA Stats** | Static files + ESPN | Excellent | 100% | Multiple fallback sources |
| **Opponent Defense (Basic)** | Static files | Good | Basic metrics only | 3P%, eFG%, TS%, ORB, DRtg |
| **Player Stats** | ESPN + Sports Reference | Good | 4 major sports | Fallback chain works well |
| **Live Scores** | ESPN | Excellent | All major sports | Real-time, reliable |
| **Injuries** | ESPN | Good | All major sports | League-wide or team-specific |
| **Current Odds** | Odds-API.io | Excellent | Multi-sport, multi-book | Primary provider working well |
| **ATS Records** | Covers.com + ESPN | Moderate | NBA (Covers), Limited (ESPN) | Season-long data good |
| **Public Betting Splits** | Covers.com | Poor | 25% of NBA games (2/8) | **MAJOR GAP** |
| **Schedule/Travel** | ESPN | Good | NBA travel matrix exists | Rest/B2B analysis works |
| **Custom Models** | Internal | Excellent | User-created | Full CRUD working |

---

### B. What Data We're Missing ❌

| Data Type | Status | Impact | Blocker | File/Location |
|-----------|--------|--------|---------|---------------|
| **Line History** | Infrastructure exists, not integrated | **CRITICAL** | No chat tool, no LLM access | `lib/services/line-recorder.ts`, `lines` table |
| **Closing Lines** | Not captured | **CRITICAL** | No recording at game start | Need to modify line-recorder.ts |
| **Public vs Sharp (Full)** | Limited to 25% of games | **HIGH** | Scraper uses wrong Covers pages | `lib/providers/covers/splits-scraper.ts` |
| **Quarter/Period Scores** | Not available | **MEDIUM** | No data source, no parser | Need ESPN box score ingestion |
| **Paint/Fast-Break/2nd-Chance** | Not available | **MEDIUM** | Need detailed box scores | Requires box score pipeline |
| **Bench Scoring Allowed** | Not available | **LOW** | Need detailed box scores | Requires box score pipeline |
| **Start Times** | Not captured | **LOW** | Need to extract from schedule | ESPN provides, need to store |
| **Stat Leaderboards** | Not implemented | **MEDIUM** | Need roster-wide scans | No caching infrastructure |
| **Multi-Sport Betting Data** | NBA only | **MEDIUM** | Covers supports but not integrated | Need to expand scraper |

---

## 5. Recommendations (Prioritized)

### Priority 1: Critical Betting Features (High ROI, 2-3 weeks)

#### A. Integrate Line History into Chat ⭐⭐⭐ **CRITICAL**

**Why**: Core differentiator for serious bettors, infrastructure already exists

**Effort**: 2-3 hours
**Impact**: Unlocks "Why did line move?" queries
**ROI**: Very high (quick win)

**Implementation Steps**:

1. **Create tool** in `lib/statmuse/tools.ts`:
```typescript
{
  type: 'function',
  function: {
    name: 'get_line_history',
    description: `Get line movement history (opening, current, closing) for a specific game. Shows how the spread, total, or moneyline changed over time with timestamps. Use when users ask about line movement, line changes, or "why did the line move".`,
    parameters: {
      type: 'object',
      properties: {
        game_id: {
          type: 'string',
          description: 'Game identifier from odds provider'
        },
        market_type: {
          type: 'string',
          enum: ['spreads', 'totals', 'h2h'],
          description: 'Market type: spreads (point spread), totals (over/under), h2h (moneyline)'
        }
      },
      required: ['game_id']
    }
  }
}
```

2. **Add handler** in `lib/statmuse/data-router.ts`:
```typescript
case 'get_line_history': {
  const { game_id, market_type } = args

  const supabase = createClient()
  const { data: lines, error } = await supabase
    .from('lines')
    .select('*')
    .eq('game_id', game_id)
    .order('recorded_at', { ascending: true })

  if (error || !lines || lines.length === 0) {
    result = { error: `No line history found for game ${game_id}` }
  } else {
    // Filter by market type if specified
    const filtered = market_type
      ? lines.filter(l => l.market_type === market_type)
      : lines

    // Format for LLM
    result = {
      game_id,
      market_type: market_type || 'all',
      opening_line: filtered[0],
      current_line: filtered[filtered.length - 1],
      movement_count: filtered.length,
      movements: filtered.map(l => ({
        timestamp: l.recorded_at,
        spread: l.spread,
        total: l.total,
        home_ml: l.home_ml,
        away_ml: l.away_ml,
        book: l.bookmaker
      }))
    }
  }
  break
}
```

3. **Update system prompts** in `lib/statmuse/analysis-engine.ts`:
```typescript
// Add to ANALYSIS_SYSTEM_PROMPT
When analyzing line history:
- Identify opening line and current line
- Calculate total movement (e.g., "moved from -5 to -7.5, a 2.5 point shift")
- Note timestamps to determine when movement occurred
- Correlate with injury reports if available
- Look for public betting splits if available
- Explain likely cause (e.g., "Sharp money came in on favorites" or "Key injury reported at 2pm")
```

**Files to modify**:
- `lib/statmuse/tools.ts` (add tool definition)
- `lib/statmuse/data-router.ts` (add handler)
- `lib/statmuse/analysis-engine.ts` (update prompts)

---

#### B. Add Closing Line Capture & CLV Tool ⭐⭐⭐ **CRITICAL**

**Why**: CLV is THE metric for professional bettors

**Effort**: 4-6 hours
**Impact**: Enables bet quality analysis
**ROI**: Very high (key differentiator)

**Implementation Steps**:

1. **Modify line recorder** to capture closing lines in `lib/services/line-recorder.ts`:
```typescript
// Add function to record closing line when game starts
export async function recordClosingLine(gameId: string) {
  const currentOdds = await fetchOdds({ gameId })

  const supabase = createClient()
  await supabase.from('lines').insert({
    game_id: gameId,
    ...currentOdds,
    is_closing_line: true,
    recorded_at: new Date()
  })
}

// Call this when game status changes to "in progress"
// Can be triggered by:
// - Cron job checking game start times
// - Webhook from odds provider
// - Live score API detecting game started
```

2. **Create CLV tool** in `lib/statmuse/tools.ts`:
```typescript
{
  type: 'function',
  function: {
    name: 'get_clv',
    description: `Calculate Closing Line Value (CLV) for user's bets. CLV measures whether the user got a better price than the closing line, which is the sharpest measure of bet quality. Positive CLV indicates beating the market. Use when users ask about bet quality, CLV, or "did I beat the closing line".`,
    parameters: {
      type: 'object',
      properties: {
        bet_id: {
          type: 'string',
          description: 'Specific bet ID (optional)'
        },
        user_id: {
          type: 'string',
          description: 'User ID to calculate CLV for all their bets (optional)'
        },
        time_range: {
          type: 'string',
          enum: ['week', 'month', 'season', 'all'],
          description: 'Time range for CLV calculation (default: all)'
        }
      }
    }
  }
}
```

3. **Add handler** in `lib/statmuse/data-router.ts`:
```typescript
case 'get_clv': {
  const { bet_id, user_id, time_range } = args

  // Import existing CLV service
  const { calculateClv, getUserClvStats } = await import('@/lib/services/clv')

  if (bet_id) {
    // Single bet CLV
    const clv = await calculateClv(bet_id)
    result = clv
  } else if (user_id) {
    // User's overall CLV
    const stats = await getUserClvStats(user_id, time_range)
    result = {
      total_bets: stats.count,
      average_clv: stats.avg_clv,
      positive_clv_count: stats.positive_count,
      positive_clv_percentage: stats.positive_pct,
      by_market: stats.by_market // Breakdown by spread/total/ml
    }
  } else {
    result = { error: 'Must provide bet_id or user_id' }
  }
  break
}
```

4. **Add cron job** to capture closing lines (optional, can do manual first):
```typescript
// In app/api/cron/closing-lines/route.ts
export async function GET(req: NextRequest) {
  // Check auth
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Get all games starting in next 15 minutes
  const upcomingGames = await getGamesStartingSoon(15)

  // Record closing lines
  for (const game of upcomingGames) {
    await recordClosingLine(game.id)
  }

  return NextResponse.json({ recorded: upcomingGames.length })
}
```

**Files to modify**:
- `lib/services/line-recorder.ts` (add closing line capture)
- `lib/statmuse/tools.ts` (add CLV tool)
- `lib/statmuse/data-router.ts` (add handler)
- `app/api/cron/closing-lines/route.ts` (new file for cron)

---

#### C. Fix Betting Splits Coverage ⭐⭐ **HIGH PRIORITY**

**Why**: Currently only 25% of games have data - major gap

**Effort**: 4-8 hours
**Impact**: Increases coverage from 25% to ~100%
**ROI**: High (fixes broken feature)

**Option 1: Find Full Schedule Page on Covers** (Recommended)

**Investigation Steps**:
1. Navigate to Covers.com and find a page that lists ALL today's games (not just "top consensus")
2. Possible URLs to check:
   - `https://www.covers.com/sport/basketball/nba/matchups`
   - `https://www.covers.com/sport/basketball/nba/odds`
   - `https://www.covers.com/sport/basketball/nba/scores`
3. Inspect HTML structure to find consensus data
4. Update scraper to use new URL

**Implementation**:
```typescript
// In lib/providers/covers/splits-scraper.ts

// OLD (only gets top games):
const SPREAD_URL = 'https://contests.covers.com/consensus/topconsensus/nba/overall'

// NEW (gets all games - URL TBD):
const SPREAD_URL = 'https://www.covers.com/sport/basketball/nba/matchups'
// OR whatever page has full schedule with consensus data

// Update parseConsensusGames() to handle new HTML structure
```

**Testing** (historical):
```bash
# After updating scraper
# `ingest:covers-splits` used to push betting splits into Supabase, but SBD now provides those splits live, so this helper has been retired.

# Should see 8 games instead of 2
# Scraped 8 games with betting splits
```

**Option 2: Add Alternative Splits Provider** (If Option 1 fails)
- Research paid splits APIs (e.g., Action Network API, Don Best)
- Cost: $200-500/month typically
- More reliable but ongoing expense

**Option 3: Accept Limitation & Document**
- Update tool descriptions to mention "data available for most popular games only"
- Update LLM prompts: "Betting splits available for X of Y games today"
- Set user expectations in UI

**Recommended**: Try Option 1 first (free, quick), fall back to Option 3 if needed

**Files to modify**:
- `lib/providers/covers/splits-scraper.ts` (update URLs and parser)
- Legacy test: `npm run ingest:covers-splits` (splits now stream from the live SBD aggregator)

---

### Priority 2: Enhanced Analytics (Medium ROI, 2-3 weeks)

#### D. Add Quarter/Period Scoring ⭐⭐ **MEDIUM PRIORITY**

**Why**: Enables quarter trend analysis, common user question

**Effort**: 12-16 hours
**Impact**: Unlocks quarter-specific queries
**ROI**: Medium

**Implementation Steps**:

1. **Database migration**:
```sql
-- In supabase/migrations/xxx_add_quarter_scores.sql
CREATE TABLE quarter_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT,
  period INT NOT NULL, -- 1, 2, 3, 4, 5+ for OT
  period_type TEXT, -- 'quarter', 'ot1', 'ot2', etc.
  points INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_id, team_id, period)
);

CREATE INDEX idx_quarter_scores_team ON quarter_scores(team_id, period);
CREATE INDEX idx_quarter_scores_game ON quarter_scores(game_id);

-- Aggregate view for team quarter averages
CREATE VIEW team_quarter_averages AS
SELECT
  team_id,
  team_name,
  period,
  AVG(points) as avg_points,
  COUNT(*) as game_count
FROM quarter_scores
WHERE period <= 4 -- Regular quarters only
GROUP BY team_id, team_name, period;
```

2. **Create ingestion script**:
```typescript
// In scripts/ingest-quarter-scores.ts
import { getEventSnapshot } from '@/lib/services/espn-orchestrator'
import { createClient } from '@supabase/supabase-js'

async function ingestQuarterScores(gameId: string, sport: string) {
  const snapshot = await getEventSnapshot(sport, gameId)
  const boxscore = snapshot.boxscore

  // Extract quarter scores from boxscore.teams[].linescores
  const quarterData = []
  for (const team of boxscore.teams) {
    for (let i = 0; i < team.linescores.length; i++) {
      quarterData.push({
        game_id: gameId,
        team_id: team.team.id,
        team_name: team.team.displayName,
        period: i + 1,
        period_type: i < 4 ? 'quarter' : `ot${i - 3}`,
        points: team.linescores[i].value
      })
    }
  }

  // Upsert to database
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase
    .from('quarter_scores')
    .upsert(quarterData, { onConflict: 'game_id,team_id,period' })

  if (error) throw error

  console.log(`✓ Ingested quarter scores for game ${gameId}`)
}

// Run for all completed games
async function main() {
  const today = new Date().toISOString().slice(0, 10)
  const games = await getEventsByDateRange('nba', today, today)

  for (const gameId of games) {
    try {
      await ingestQuarterScores(gameId, 'nba')
    } catch (err) {
      console.error(`✗ Failed for game ${gameId}:`, err)
    }
  }
}

main().catch(console.error)
```

3. **Add cron job** (or manual script initially):
```typescript
// In app/api/cron/quarter-scores/route.ts
// Runs daily after games finish (e.g., 3am ET)
export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Get yesterday's games (they're now complete)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().slice(0, 10)

  // Ingest quarter scores
  const { ingestDailyQuarterScores } = await import('@/lib/services/quarter-scores-ingest')
  const result = await ingestDailyQuarterScores(dateStr)

  return NextResponse.json(result)
}
```

4. **Create LLM tool**:
```typescript
// In lib/statmuse/tools.ts
{
  type: 'function',
  function: {
    name: 'get_quarter_stats',
    description: `Get team performance by quarter. Shows average points scored per quarter, helping identify if a team starts slow, finishes strong, or has specific quarter strengths/weaknesses.`,
    parameters: {
      type: 'object',
      properties: {
        team: { type: 'string', description: 'Team name' },
        quarter: {
          type: 'number',
          enum: [1, 2, 3, 4],
          description: 'Specific quarter (1-4), omit for all quarters'
        },
        sport: { type: 'string', enum: ['nba', 'nfl'], default: 'nba' }
      },
      required: ['team']
    }
  }
}
```

5. **Add handler**:
```typescript
// In lib/statmuse/data-router.ts
case 'get_quarter_stats': {
  const { team, quarter, sport } = args
  const teamId = await findTeamId(team, sport as SportKey)

  if (!teamId) {
    result = { error: `Team "${team}" not found` }
    break
  }

  const supabase = createClient()

  if (quarter) {
    // Specific quarter
    const { data } = await supabase
      .from('team_quarter_averages')
      .select('*')
      .eq('team_id', teamId)
      .eq('period', quarter)
      .single()

    result = {
      team,
      quarter,
      avg_points: data?.avg_points,
      game_count: data?.game_count
    }
  } else {
    // All quarters
    const { data } = await supabase
      .from('team_quarter_averages')
      .select('*')
      .eq('team_id', teamId)
      .order('period')

    result = {
      team,
      quarters: data?.map(d => ({
        quarter: d.period,
        avg_points: d.avg_points,
        game_count: d.game_count
      }))
    }
  }
  break
}
```

**Files to create/modify**:
- `supabase/migrations/xxx_add_quarter_scores.sql` (new)
- `scripts/ingest-quarter-scores.ts` (new)
- `lib/services/quarter-scores-ingest.ts` (new)
- `app/api/cron/quarter-scores/route.ts` (new)
- `lib/statmuse/tools.ts` (add tool)
- `lib/statmuse/data-router.ts` (add handler)

---

#### E. Implement Stat Leaderboards ⭐⭐ **MEDIUM PRIORITY**

**Why**: Basic feature users expect, currently returns placeholder

**Effort**: 8-12 hours
**Impact**: Enables leaderboard queries
**ROI**: Medium

**Implementation Steps**:

1. **Database table**:
```sql
-- In supabase/migrations/xxx_add_leaderboards.sql
CREATE TABLE leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_key TEXT NOT NULL, -- 'PTS', 'REB', 'AST', etc.
  sport TEXT NOT NULL, -- 'nba', 'nfl', 'mlb', 'nhl'
  season INT NOT NULL,
  rankings JSONB NOT NULL, -- [{ player_id, player_name, value, rank }, ...]
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(stat_key, sport, season)
);

CREATE INDEX idx_leaderboards_sport_season ON leaderboards(sport, season);
```

2. **Create caching script**:
```typescript
// In scripts/cache-leaderboards.ts
import { searchAthlete, getPlayerSeasonStats } from '@/lib/services/espn-orchestrator'
import { createClient } from '@supabase/supabase-js'

const STATS_TO_CACHE = ['PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'FG%', 'FT%']

async function cacheNbaLeaderboards(season: number) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  for (const statKey of STATS_TO_CACHE) {
    console.log(`Caching leaderboard for ${statKey}...`)

    // Get all players (would need to implement roster scan)
    // For now, get from existing player stats cache or ESPN roster API
    const players = await getAllActivePlayers('nba', season)

    // Fetch stats for each player
    const playerStats = []
    for (const player of players) {
      const stats = await getPlayerSeasonStats('nba', player.id, season)
      playerStats.push({
        player_id: player.id,
        player_name: player.displayName,
        value: stats[statKey] || 0
      })
    }

    // Sort and rank
    playerStats.sort((a, b) => b.value - a.value)
    const rankings = playerStats.slice(0, 50).map((p, i) => ({
      ...p,
      rank: i + 1
    }))

    // Save to database
    await supabase.from('leaderboards').upsert({
      stat_key: statKey,
      sport: 'nba',
      season,
      rankings
    }, { onConflict: 'stat_key,sport,season' })

    console.log(`✓ Cached top 50 for ${statKey}`)
  }
}

// Run for current season
const currentSeason = 2025 // Would calculate dynamically
cacheNbaLeaderboards(currentSeason).catch(console.error)
```

3. **Add cron job** to refresh daily:
```typescript
// In app/api/cron/leaderboards/route.ts
export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { cacheLeaderboards } = await import('@/lib/services/leaderboard-cache')
  const result = await cacheLeaderboards()

  return NextResponse.json(result)
}
```

4. **Update existing tool handler**:
```typescript
// In lib/statmuse/data-router.ts
case 'getLeaderboard': {
  const sport = (args.sport || 'nba') as SportKey
  const season = getCurrentSeason(sport)
  const limit = args.limit || 10

  const supabase = createClient()
  const { data, error } = await supabase
    .from('leaderboards')
    .select('rankings')
    .eq('stat_key', args.stat)
    .eq('sport', sport)
    .eq('season', season)
    .single()

  if (error || !data) {
    result = {
      error: `No leaderboard data available for ${args.stat} in ${sport}. Leaderboards are updated daily.`
    }
  } else {
    result = {
      stat: args.stat,
      sport,
      season,
      leaders: data.rankings.slice(0, limit)
    }
  }
  break
}
```

**Files to create/modify**:
- `supabase/migrations/xxx_add_leaderboards.sql` (new)
- `scripts/cache-leaderboards.ts` (new)
- `lib/services/leaderboard-cache.ts` (new)
- `app/api/cron/leaderboards/route.ts` (new)
- `lib/statmuse/data-router.ts` (update handler)

---

### Priority 3: Advanced Features (Lower ROI, 3+ weeks)

#### F. Add Advanced Opponent Stats (Paint/Fast-Break/etc.) ⭐

**Why**: Enables deeper matchup analysis

**Effort**: 20+ hours (high complexity)
**Impact**: Medium (nice-to-have for power users)
**ROI**: Lower

**Requirements**:
- Detailed box score parser
- Aggregation logic per team/season
- Storage in database or static files

**Not recommended for immediate implementation** - focus on Priority 1-2 first

---

#### G. Expand Multi-Sport Betting Coverage ⭐

**Why**: Covers.com supports NFL/MLB/NHL, just not integrated

**Effort**: 4-6 hours
**Impact**: Medium (expands addressable market)
**ROI**: Medium

**Steps**:
1. Update `lib/providers/covers/ats-scraper.ts` to support NFL/MLB/NHL team slugs
2. Add team name mappings for other sports
3. Run ingestion: `npm run ingest:covers-ats` with sport parameter
4. Test ATS/splits tools with multi-sport data

**Files to modify**:
- `lib/providers/covers/ats-scraper.ts` (add sport support)
- `lib/providers/covers/mapper.ts` (add team mappings)

---

### Priority 4: Intent & UX Improvements

#### H. Improve Intent Detection for Line Questions

**Current Gap**: Questions like "What's the line?" may not trigger correct pipeline

**Effort**: 1 hour
**Impact**: Better UX
**ROI**: Low (polish)

**Fix**: Add patterns to `app/api/chat/route.ts`:
```typescript
const isLineMovementQuery = (
  /\b(line|spread|total)\b.*\b(move|moved|movement|change|shift)\b/i.test(message) ||
  /\bwhy\b.*\b(line|spread|total)\b/i.test(message) ||
  /\bwhen did\b.*\b(line|spread|odds)\b.*\b(move|change)\b/i.test(message) ||
  /\b(opening|open|closing|close)\b.*\b(line|spread|total)\b/i.test(message)
)

// Route to get_line_history tool if available
```

---

#### I. Add Proactive Context Synthesis

**Goal**: Don't just return data, explain WHY it matters

**Effort**: 8-12 hours (prompt engineering + testing)
**Impact**: Much better user experience
**ROI**: High (differentiation)

**Example**:
- **User**: "Warriors vs Trail Blazers betting splits"
- **Current**: Returns bet% and money%
- **Improved**: "65% of bets on Warriors, but 52% of money on Blazers. This 13% divergence suggests sharp money is fading the public on the Warriors. Additionally, Warriors are on a back-to-back (2nd game) while Blazers are rested (3 days), which may explain why sharps like Portland despite being underdogs."

**Implementation**: Update `ANALYSIS_SYSTEM_PROMPT` in `lib/statmuse/analysis-engine.ts`:
```typescript
export const ANALYSIS_SYSTEM_PROMPT = `You are analyzing sports betting data. When responding:

1. ALWAYS SYNTHESIZE CONTEXT:
   - If user asks about betting splits, also check for injuries and rest/travel
   - If user asks about player props, check recent game logs and opponent defense
   - If user asks about team performance, include schedule context

2. EXPLAIN WHY DATA MATTERS:
   - Don't just say "65% of bets on Warriors"
   - Say "65% of bets on Warriors, but only 52% of money - sharp bettors are fading the public"
   - Connect data points: "This line moved 2.5 points after the injury report"

3. PROVIDE ACTIONABLE INSIGHTS:
   - "This could be a fade opportunity"
   - "The public is overvaluing X"
   - "Sharp action suggests Y"

4. CITE SOURCES:
   - "According to Covers.com splits..."
   - "ESPN injury report shows..."
   - "Line opened at X and moved to Y"

5. BE HONEST ABOUT LIMITATIONS:
   - If data is missing, say so
   - If sample size is small, warn user
   - If data is stale, mention when it was last updated
`
```

---

## 6. Technical Debt & Risks

### Identified Issues:

#### 1. Covers Scraper Fragility ⚠️ **MEDIUM RISK**

**Issue**: Web scraping is brittle when Covers changes HTML

**Current State**:
- No validation of scraped data structure
- No fallback if scraping fails
- Silent failures possible

**Mitigation**:
```typescript
// In lib/providers/covers/splits-scraper.ts

// Add structure validation
function validateScrapedGame(game: ConsensusGame): boolean {
  if (!game.homeTeam || !game.awayTeam) {
    console.error('[SCRAPER] Missing team names:', game)
    return false
  }
  if (game.homePct == null || game.awayPct == null) {
    console.error('[SCRAPER] Missing betting percentages:', game)
    return false
  }
  return true
}

// Add alerting on parse failures
if (games.length === 0) {
  // Send alert (email, Slack, etc.)
  console.error('[SCRAPER] ALERT: No games scraped from Covers.com - HTML structure may have changed')
  // Could use Vercel log drains or Sentry for alerts
}
```

**Recommendation**: Add structure validation + alerting on parse failures

---

#### 2. No Line History Tool ❌ **CRITICAL**

**Issue**: Infrastructure exists but not accessible to LLM

**Current State**:
- ✅ `lib/services/line-recorder.ts` exists
- ✅ `lines` table exists in database
- ❌ No LLM tool to query data
- ❌ Data exists but unreachable

**Fix**: See Priority 1A above

---

#### 3. ESPN Tools Not Well-Documented ⚠️ **LOW RISK**

**Issue**: 11 ESPN tools exist but LLM may not know when to use them

**Current State**:
- Tool descriptions are minimal
- No examples in descriptions
- LLM may not choose correct tool

**Fix**: Improve tool descriptions with examples:
```typescript
// Before:
{
  name: 'espnTeamAtsRecord',
  description: 'Fetch a team ATS record for a given sport/season/seasonType directly from ESPN.',
  ...
}

// After:
{
  name: 'espnTeamAtsRecord',
  description: `Fetch a team's Against The Spread (ATS) record from ESPN with detailed splits.

  Use when you need ESPN-specific ATS data (different methodology than Covers.com).
  Returns: ATS record by situation (overall, home, away, favorite, underdog, last 10).

  Example queries:
  - "Get Lakers ATS record from ESPN"
  - "What's the Celtics ATS as favorites according to ESPN?"

  Note: This uses ESPN's betting data which may differ from Covers.com in timing and methodology.`,
  ...
}
```

---

#### 4. Leaderboard Placeholder ❌ **MEDIUM RISK**

**Issue**: Returns "to be implemented" message - bad UX

**Current State**:
```typescript
result = {
  stat: args.stat,
  sport: args.sport || 'nba',
  message: 'Leaderboard data - to be implemented with full roster scan',
}
```

**Options**:
1. Implement leaderboards (see Priority 2E)
2. Remove tool entirely from available tools
3. Update to return more helpful message

**Recommendation**: Either implement or remove - current state is confusing

---

#### 5. Limited Error Handling in Unified Pipeline ⚠️ **MEDIUM RISK**

**Issue**: When tool returns error, LLM may not handle gracefully

**Current State**:
```typescript
// In data-router.ts
if (!teamId) {
  result = { error: `Team "${args.team}" not found` }
}
// LLM receives raw error, may not format well for user
```

**Fix**: Add fallback logic in `intent-classifier.ts`:
```typescript
// In lib/statmuse/intent-classifier.ts

// After tool execution
if (toolResults.some(r => r.error)) {
  // Add context to help LLM provide better error message
  analysisMessages.push({
    role: 'system',
    content: `Some tools returned errors. Provide a helpful explanation to the user about what went wrong and suggest alternatives. Be specific about which data is missing.`
  })
}
```

---

## 7. Summary Scorecard

| Category | Grade | Strengths | Weaknesses |
|----------|-------|-----------|------------|
| **Stats Queries** | A | Excellent coverage, multiple data sources, good fallbacks | Missing quarter stats, no leaderboards |
| **Live Data** | A | Real-time scores, injuries, odds - all working well | - |
| **Betting Splits** | C | Tools exist, sharp detection works | Only 25% game coverage - MAJOR GAP |
| **ATS Records** | B | Good for NBA (Covers + ESPN), season-long data reliable | Missing other sports from Covers |
| **Line Movement** | F | Infrastructure exists in codebase | NOT integrated with chat - CRITICAL GAP |
| **CLV Tracking** | F | Service exists, calculation logic implemented | Not exposed to chat - CRITICAL GAP |
| **Advanced Stats** | B | Good basics (opponent 3P%, eFG%, DRtg) | Missing granular metrics (paint, fast-break, etc.) |
| **Multi-Sport** | B | Good for NBA, moderate for NFL/MLB/NHL | Betting data (Covers) only for NBA |
| **Custom Models** | A | Well-implemented, powerful, flexible | - |
| **Intent Detection** | B+ | Good patterns, handles most queries, recent fixes working | Could improve line movement detection |

**Overall Grade: B-**

---

## 8. Next Steps - Quick Start Guide

### If you have 1 week:
**Focus**: Priority 1A-C (Critical Betting Features)
1. Add line history tool (2-3 hours)
2. Add CLV tool (4-6 hours)
3. Fix betting splits coverage (4-8 hours)

**Total**: ~15 hours of work
**Impact**: Fixes 3 critical gaps, unlocks core betting intelligence features

---

### If you have 2-3 weeks:
**Focus**: Priority 1 + Priority 2D-E (Add Analytics)
1. Week 1: Priority 1A-C (betting features)
2. Week 2: Quarter scoring (12-16 hours)
3. Week 3: Leaderboards (8-12 hours)

**Total**: ~40 hours of work
**Impact**: Adds major betting features + popular analytics

---

### If you have 4+ weeks:
**Focus**: Full implementation
1. Weeks 1-2: Priority 1 + Priority 2
2. Week 3: Multi-sport expansion
3. Week 4: Context synthesis improvements

**Total**: ~60 hours of work
**Impact**: Reaches 85-90% of planned features

---

## 9. Files Reference

### Core LLM Files:
- **`app/api/chat/route.ts`** - Main chat API endpoint (2100+ lines)
- **`lib/statmuse/intent-classifier.ts`** - Unified query pipeline with OpenAI function calling
- **`lib/statmuse/data-router.ts`** - Tool execution and routing (556 lines)
- **`lib/statmuse/tools.ts`** - Unified tool definitions (499 lines)
- **`lib/statmuse/analysis-engine.ts`** - System prompts for LLM
- **`lib/llm/tools/espn-tools.ts`** - ESPN direct tool definitions (148 lines)

### Betting Data Files:
- **`lib/providers/covers/ats-scraper.ts`** - Covers.com ATS scraper
- **`lib/providers/covers/splits-scraper.ts`** - Covers.com betting splits scraper
- **`lib/providers/covers/chat-helpers.ts`** - LLM-friendly betting data wrappers
- **`lib/services/line-recorder.ts`** - Line history recording (NOT integrated with chat)
- **`lib/services/clv.ts`** - CLV calculation (NOT integrated with chat)

### Documentation:
- **`docs/LLM_IMPLEMENTATION_PLAN.md`** - Original implementation goals
- **`docs/DATA_GAPS.md`** - Known data gaps
- **`docs/DATA_SOURCES.md`** - Data source mapping
- **`docs/COVERS_IMPLEMENTATION_COMPLETE.md`** - Covers integration details

---

## Conclusion

The LLM chat system has a **solid foundation** with excellent stats capabilities and good intent detection. However, it's **missing critical betting intelligence features** that would differentiate it for serious bettors:

1. **Line movement tracking** (infrastructure exists but not integrated) ← **Highest priority**
2. **CLV analysis** (service exists but not exposed) ← **Highest priority**
3. **Full betting splits coverage** (only 25% of games) ← **High priority**

**Quickest wins** are Priority 1A-C (line history, CLV, splits fix) - these are **high-impact, moderate-effort** improvements that leverage existing infrastructure.

The system is currently **60-70% complete** relative to the goals in `LLM_IMPLEMENTATION_PLAN.md`. With 2-4 weeks of focused work on Priority 1 and Priority 2 features, it could reach **85-90%** completion and become a genuinely differentiated product for sports bettors.

The good news: Most of the hard infrastructure work is done. The gaps are primarily in **integration and data coverage**, not fundamental architecture.

---

**Report compiled**: December 15, 2024
**Next review**: After Priority 1 implementation
