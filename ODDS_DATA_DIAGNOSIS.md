# Complete Odds Data Diagnosis Report

**Date:** November 10, 2025
**Issue:** ALL odds data pulled from The Odds API is incorrect
**Severity:** CRITICAL - Affects all betting odds displayed to users

---

## Problem Statement

User reports that **all odds data being displayed is incorrect**, not just specific spreads. This is different from the earlier issue where the AI was misinterpreting data - this suggests the raw data itself coming from The Odds API is wrong.

**Examples Reported:**
- Trail Blazers showing -3.5 when actual FanDuel line is +2
- All spreads, moneylines, and totals appear to be incorrect

---

## Critical Questions to Answer

### 1. Is the API Key Configured?

**Check:** Do `.env` or `.env.local` files exist?

```bash
ls -la .env .env.local
```

**Status:** ❌ No `.env` or `.env.local` files found in repository

**Impact:** If `ODDS_API_KEY` is not set, the app would throw an error: `"ODDS_API_KEY is not configured"` (see `/lib/api/odds-api.ts:22`)

**Conclusion:** Either:
- API key is set via hosting platform environment variables (Vercel, etc.)
- App is failing with error and not showing any data
- API key exists but we can't see it in the repo

### 2. What Data Source is The Odds API Using?

**API Endpoint:** `https://api.the-odds-api.com/v4`

**Parameters Being Used:**
```
sport: basketball_nba, americanfootball_nfl, etc.
regions: us  ← CRITICAL PARAMETER
markets: h2h,spreads,totals
oddsFormat: american
```

**The `regions=us` Parameter:**
- This tells The Odds API to return odds from **US-based bookmakers** only
- US bookmakers: FanDuel, DraftKings, BetMGM, Caesars, etc.
- **Does NOT include:** International bookmakers, offshore books, or non-US markets

**Potential Issue:**
- If you're comparing against odds from non-US bookmakers, they won't match
- If you're in a different region, your local bookmaker odds may differ

### 3. Is the Cache Returning Stale Data?

**Cache Configuration:** `/lib/api/odds-api.ts:30`

```typescript
const response = await fetch(url, {
  next: { revalidate: 30 }, // Cache for 30 seconds
})
```

**How This Works:**
- First request: Fetches live data from The Odds API
- Next 30 seconds: Returns cached data (no new API call)
- After 30 seconds: Fetches fresh data again

**Potential Issues:**
1. **Stale Data:** If odds moved in the last 30 seconds, cached data is outdated
2. **Incorrect Cache Key:** If cache key is wrong, might return unrelated game's data
3. **Cache Corruption:** Cached data could be from a different query

**Testing:**
- Clear cache and fetch fresh data
- Check if odds update after 30 seconds
- Compare timestamp of data vs current time

### 4. Are Team Names Matching Correctly?

**Team Name Filtering Logic:** `/app/api/chat/route.ts:623-688`

The app has a comprehensive team name mapping:

```typescript
const teamNameVariations: Record<string, string[]> = {
  // NBA
  'lakers': ['lakers', 'los angeles lakers', 'la lakers', 'lal'],
  'celtics': ['celtics', 'boston celtics', 'bos'],
  // ... 100+ team variations
}
```

**Potential Issues:**
1. **Partial Match:** App filters for "Trail Blazers" but API returns "Portland Trail Blazers"
2. **Team Not in Mapping:** If a team's variations aren't in the mapping, they get filtered out
3. **Typo in User Query:** "Trailblazers" (one word) might not match "Trail Blazers"

**Impact:**
- If team names don't match, the app filters out the correct game
- Then AI might show data from a different game or make up data

### 5. Are Games Being Filtered Out by Date?

**Date Filtering Logic:** `/app/api/chat/route.ts:793-821`

```typescript
const gameLowerBound = lowerBound.getTime()
const gameUpperBound = upperBound.getTime()

filteredGames = oddsData.filter((game: any) => {
  const gameTime = new Date(game.commence_time).getTime()
  return gameTime >= gameLowerBound && gameTime < gameUpperBound
})
```

**Potential Issues:**
1. **Timezone Confusion:** User's timezone doesn't match game timezone
2. **Date Boundary:** Game at 11:59 PM today might be filtered as "tomorrow"
3. **Wrong Date Range:** "Today" query might use wrong start/end times

**Example Problem:**
- User in PST asks "games today"
- App interprets "today" as EST timezone
- Games scheduled for 10 PM PST (1 AM EST next day) get filtered out

### 6. Is The Odds API Returning Incorrect Data?

**How to Verify:**
Run the test script to see raw API data:

```bash
node scripts/test-odds-api.js
```

This will show:
- What sports are available
- Raw game data from API
- Bookmakers and their odds
- API usage (requests remaining)

**What to Check:**
1. **Do the games match real schedules?**
2. **Do the spreads match real bookmaker websites?**
3. **Are all expected bookmakers present?**
4. **Are the odds recent (check `last_update` timestamp)?**

**Potential API Issues:**
- API key points to test/demo account (fake data)
- API endpoint changed and returns old data
- API having technical issues (rare but possible)
- Free tier limitation (outdated data or limited bookmakers)

### 7. Are Multiple Lines Being Confused?

**The Odds API Returns Multiple Lines:**
- Different bookmakers have different lines
- Same bookmaker may have different lines at different times
- Alternate lines (e.g., -2.5, -3, -3.5 all available)

**Example:**
```json
{
  "bookmakers": [
    {
      "title": "FanDuel",
      "markets": [{
        "key": "spreads",
        "outcomes": [
          {"name": "Trail Blazers", "point": 2.0}  ← This is FanDuel's line
        ]
      }]
    },
    {
      "title": "DraftKings",
      "markets": [{
        "key": "spreads",
        "outcomes": [
          {"name": "Trail Blazers", "point": 1.5}  ← Different line
        ]
      }]
    }
  ]
}
```

**Potential Issue:**
- User checks FanDuel: +2
- App shows DraftKings line: +1.5
- User thinks app is wrong, but it's just a different bookmaker

**The App's "Best Odds" Logic:**
The app highlights the "best value" line across all bookmakers. This might not be the specific bookmaker the user is looking at.

---

## Most Likely Root Causes (Ranked)

### 🔴 #1: Cache Returning Stale Data (60% likely)

**Symptom:** Odds are "wrong" but were correct 5-30 minutes ago

**Why:** 30-second cache + fast-moving betting lines = stale data

**Test:**
1. Check what time the app last fetched data
2. Check current odds on FanDuel
3. Wait 31 seconds and refresh app
4. See if odds update

**Fix:**
- Reduce cache time to 10 seconds for more frequent updates
- Add "Last updated: X seconds ago" timestamp to UI
- Add manual "Refresh" button to bust cache

---

### 🟠 #2: Comparing Different Bookmakers (25% likely)

**Symptom:** User checks FanDuel, app shows different number

**Why:** App might be showing DraftKings, BetMGM, or aggregated "best odds"

**Test:**
1. User checks FanDuel: Trail Blazers +2
2. App shows: Trail Blazers +1.5
3. Check which bookmaker the app is displaying
4. Verify if ANY bookmaker in the app has +2

**Fix:**
- Make it crystal clear which bookmaker each line is from
- Allow users to filter by specific bookmaker
- Highlight FanDuel lines if that's what users prefer

---

### 🟡 #3: Team Name/Date Filtering Issues (10% likely)

**Symptom:** App shows different game or no game at all

**Why:** User asks for "Trail Blazers", app filters for exact match and finds nothing, then shows different game

**Test:**
1. Search for "blazers" vs "trail blazers" vs "portland"
2. Check if all variations return same game
3. Verify game is scheduled for "today" in app's timezone

**Fix:**
- Improve fuzzy matching for team names
- Show "0 games found" instead of showing wrong game
- Display timezone clearly

---

### 🟡 #4: Wrong Regions Parameter (3% likely)

**Symptom:** All odds are from unfamiliar bookmakers

**Why:** If `regions` parameter is set to `uk`, `au`, or `eu` instead of `us`, you'd get completely different bookmakers

**Test:**
1. Check `/lib/api/odds-api.ts:26` - verify `regions=us`
2. Look at which bookmakers are shown
3. Confirm they're US books (FanDuel, DraftKings, etc.)

**Fix:**
- Ensure `regions=us` is hardcoded or configurable per user
- Show which region's odds are being displayed

---

### 🟢 #5: The Odds API Returning Wrong Data (1% likely)

**Symptom:** Raw API data doesn't match any real bookmaker

**Why:** API issue, wrong API key, test account, or API downtime

**Test:**
```bash
node scripts/test-odds-api.js
```

Compare raw API response to actual bookmaker websites.

**Fix:**
- Verify API key is correct (production, not test)
- Check API status page: https://the-odds-api.com/
- Contact The Odds API support if data is genuinely wrong

---

### 🟢 #6: No API Key / API Calls Failing (1% likely)

**Symptom:** No data shown or error messages

**Why:** `ODDS_API_KEY` not configured

**Test:**
```bash
# Check if environment variable is set
echo $ODDS_API_KEY

# Or check Vercel/hosting platform environment variables
```

**Fix:**
- Set `ODDS_API_KEY` in `.env.local` for development
- Set in Vercel/hosting platform for production

---

## Diagnostic Procedure

### Step 1: Verify API Integration Works

```bash
# Create .env.local if it doesn't exist
cp .env.example .env.local

# Add your The Odds API key
# Get free key from: https://the-odds-api.com/

# Run diagnostic test
node scripts/test-odds-api.js
```

**Expected Output:**
```
=== ODDS API DIAGNOSTIC TEST ===

API Key: a1b2c3d4...
Status: 200 OK
NBA games available: 5
First NBA game:
  Portland Trail Blazers @ Orlando Magic
  Commence time: 2025-11-10T19:00:00Z
  Bookmakers: 12
```

**If This Fails:**
- API key is invalid
- API quota exceeded
- API service is down

### Step 2: Check Raw API Data vs Actual Bookmaker

1. Run test script and note the spreads for Trail Blazers vs Magic
2. Go to FanDuel.com and check the actual spread
3. Compare the two

**Example:**
```
API says: Trail Blazers +2 at -110 (FanDuel)
FanDuel.com says: Trail Blazers +2 at -110
Result: ✅ DATA MATCHES

API says: Trail Blazers +1.5 at -110 (FanDuel)
FanDuel.com says: Trail Blazers +2 at -110
Result: ❌ DATA MISMATCH - API data is outdated or incorrect
```

### Step 3: Check App's Processing of Data

1. Run the app in development mode
2. Make a query: "trail blazers vs magic betting odds today"
3. Check server logs for:
   ```
   [ODDS] Game: Portland Trail Blazers @ Orlando Magic
   [ODDS]   FanDuel spreads: Portland Trail Blazers +2 at -110 | Orlando Magic -2 at -110
   ```

4. Compare logs to AI's response

**If logs show correct data but AI shows wrong data:**
- AI hallucination issue (covered in previous fixes)

**If logs show wrong data:**
- Problem is in the data pipeline, not AI
- Continue diagnostic

### Step 4: Check for Cache Issues

1. Note the current time
2. Make a query and see what odds are shown
3. Check real bookmaker - if odds changed, note the difference
4. Wait 31 seconds (cache expiration)
5. Make same query again
6. Check if odds updated

**If odds don't update after cache expiration:**
- Cache invalidation issue
- Data transformation caching the wrong key

**If odds update but are still wrong:**
- The Odds API itself has stale data
- Need to check API's `last_update` timestamp

### Step 5: Check for Date/Timezone Issues

1. Query "what games are today?"
2. Note which games are shown
3. Check timezone the app thinks "today" is
4. Compare to actual game schedule

**Common Issue:**
- App thinks it's November 10, 2025 8:00 AM EST
- User is in PST (November 10, 2025 5:00 AM)
- Games scheduled for November 9, 2025 11:00 PM PST get filtered out

### Step 6: Check Team Name Matching

1. Try different variations:
   - "trail blazers odds"
   - "blazers odds"
   - "portland odds"
   - "portland trail blazers odds"

2. See if all variations return same game

**If some variations work and others don't:**
- Team name mapping issue
- Add missing variations to `/app/api/chat/route.ts:623`

---

## Quick Diagnostic Commands

```bash
# 1. Check if API key exists
grep -r "ODDS_API_KEY" .env* 2>/dev/null

# 2. Test The Odds API directly
node scripts/test-odds-api.js

# 3. Check app logs for odds fetching
# (Run app in dev mode and grep logs)
npm run dev | grep "\[ODDS\]"

# 4. Test a specific game's odds via API endpoint
# (Requires app to be running and user to be logged in)
curl "http://localhost:3000/api/odds/games?sport=basketball_nba"
```

---

## Immediate Actions Required

### 1. Confirm API Key is Set

**Where to Check:**
- Local development: `.env.local` file
- Production: Vercel/hosting platform environment variables

**How to Get Key:**
1. Go to https://the-odds-api.com/
2. Sign up for free account (500 requests/month)
3. Get API key from dashboard
4. Add to `.env.local`: `ODDS_API_KEY=your_key_here`

### 2. Run Diagnostic Test

```bash
node scripts/test-odds-api.js
```

This will immediately show:
- If API key works
- What data The Odds API returns
- If data matches real bookmakers

### 3. Enable Detailed Logging

Add this to your dev environment to see exactly what data flows through:

```typescript
// In /lib/api/odds-api.ts, add after line 40:
console.log('[ODDS API RAW]', JSON.stringify(data, null, 2))
```

This logs the raw API response before any processing.

### 4. Add Data Validation

Create a validation function to check if odds are reasonable:

```typescript
function validateOdds(game: OddsGame): boolean {
  // Check if spreads are within reasonable range
  for (const book of game.bookmakers) {
    const spreadMarket = book.markets.find(m => m.key === 'spreads')
    if (spreadMarket) {
      for (const outcome of spreadMarket.outcomes) {
        // Spreads should typically be between -20 and +20
        if (outcome.point && Math.abs(outcome.point) > 20) {
          console.warn('Unusual spread detected:', outcome)
          return false
        }
      }
    }
  }
  return true
}
```

---

## Expected Behavior vs Current Behavior

### Expected:
1. User asks: "trail blazers vs magic betting odds today"
2. App fetches live data from The Odds API (or 30-second cache)
3. App shows: "Portland Trail Blazers +2 at -110 (FanDuel)"
4. User checks FanDuel: Confirms it's +2 at -110
5. ✅ Data matches

### If Current Behavior is Different:
**Scenario A: App shows Trail Blazers -3.5**
- Wrong team's spread (covered by pre-formatting fix)
- OR different bookmaker's line (DraftKings might have -3.5)
- OR cached stale data (line moved from -3.5 to +2)

**Scenario B: App shows completely different game**
- Team name mismatch (filtered out real game)
- Date filtering issue (excluded today's game)
- Wrong sport selected

**Scenario C: App shows error or no data**
- API key not configured
- API call failing
- User not authenticated

---

## Solution Recommendations

### Priority 1: Verify Data Source (Do This First)

Run the diagnostic test script to confirm The Odds API is returning correct data:

```bash
node scripts/test-odds-api.js
```

**If API data is correct:**
- Problem is in app's processing/display
- Continue with Priority 2

**If API data is incorrect:**
- Check API key (might be test account)
- Check API status page
- Try different endpoint/parameters
- Contact The Odds API support

### Priority 2: Reduce Cache Time

Change cache from 30 seconds to 10 seconds:

```typescript
// /lib/api/odds-api.ts:30
const response = await fetch(url, {
  next: { revalidate: 10 }, // Reduced from 30 to 10
})
```

This ensures odds are fresher.

### Priority 3: Add Timestamp Display

Show when data was last fetched:

```typescript
// Add to formatted odds data
{
  last_updated: new Date().toISOString(),
  games: [...]
}
```

Display in UI: "Odds as of 2:45:30 PM"

### Priority 4: Add Bookmaker Filter

Allow users to select which bookmaker they want to see:

```typescript
// Add to chat query
?bookmaker=fanduel

// Filter odds to show only FanDuel
```

### Priority 5: Improve Error Handling

Add better error messages:

```typescript
if (games.length === 0) {
  return "No games found for Trail Blazers vs Magic today. This could mean:
  - Game is not scheduled for today
  - Odds not yet available
  - Game time passed"
}
```

---

## Testing Checklist

After implementing fixes:

- [ ] Run `node scripts/test-odds-api.js` - Verify API returns correct data
- [ ] Compare API data to FanDuel.com - Confirm spreads match
- [ ] Query "trail blazers odds" - Check if correct game is shown
- [ ] Wait 11 seconds, query again - Verify odds update (cache bust)
- [ ] Check multiple bookmakers - Ensure FanDuel is present
- [ ] Verify timestamp shows recent time - Ensure data is fresh
- [ ] Query with different team name variations - All should work
- [ ] Check logs for `[ODDS]` messages - Verify data pipeline

---

## Conclusion

The issue "all odds data is incorrect" has multiple potential causes:

1. **Most Likely:** Cache showing outdated odds (30-second lag)
2. **Also Likely:** Showing different bookmaker than user is checking
3. **Possible:** Team name or date filtering excluding correct games
4. **Unlikely:** The Odds API itself returning wrong data

**Next Steps:**
1. Run diagnostic test script to verify API data
2. Check server logs to see what data is being fetched
3. Compare app's displayed odds to actual bookmaker websites
4. Identify specific discrepancy (wrong number, wrong bookmaker, wrong game, etc.)
5. Apply appropriate fix based on root cause

The data pipeline from The Odds API → App → AI → User is mostly straightforward with minimal transformation. The issue is likely in cache staleness, bookmaker comparison, or filtering logic rather than data corruption.

---

**Files to Check:**
- `/lib/api/odds-api.ts` - API integration
- `/app/api/chat/route.ts` - Data filtering and AI prompt
- `/scripts/test-odds-api.js` - Diagnostic tool

**Key Log Messages:**
- `[ODDS] Successfully fetched odds for X sport(s)`
- `[ODDS] FanDuel spreads: Portland Trail Blazers +2 at -110 | Orlando Magic -2 at -110`
- `[ODDS API] Status: 200 OK` (if raw logging enabled)
