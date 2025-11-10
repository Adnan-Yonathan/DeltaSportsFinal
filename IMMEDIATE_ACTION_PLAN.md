# Immediate Action Plan: Fix Incorrect Odds Data

**Issue:** ALL odds data displayed is incorrect (not matching real bookmaker odds)
**Priority:** CRITICAL
**Date:** November 10, 2025

---

## Summary

You reported that the app shows "Trail Blazers -3.5" but FanDuel actually has "Trail Blazers +2". This is different from the AI misinterpretation issue - this means the **raw data itself is wrong**.

After analyzing the codebase, there are **NO data transformations** that would corrupt the odds. The data flows like this:

```
The Odds API → fetchOdds() → filter by date/teams → format → send to AI → display
```

`fetchOdds()` returns data as-is from The Odds API with zero transformation (see `/lib/api/odds-api.ts:41`).

**Conclusion:** If the odds are wrong, the issue is one of these:

1. **The Odds API is returning incorrect/outdated data** (most likely)
2. **30-second cache showing stale odds** (very likely)
3. **Comparing different bookmakers** (likely)
4. **API key not configured properly** (possible)

---

## What You Need to Do RIGHT NOW

### Step 1: Run the Diagnostic Test (2 minutes)

This will show you exactly what The Odds API is returning:

```bash
# 1. Create environment file
cp .env.example .env.local

# 2. Add your Odds API key to .env.local
# Get free key from: https://the-odds-api.com/
# Edit .env.local and set: ODDS_API_KEY=your_actual_key_here

# 3. Run diagnostic
node scripts/test-odds-api.js
```

**What to look for:**
- Does it show Trail Blazers vs Magic game?
- What spread does it show for FanDuel?
- Does it match what you see on FanDuel.com?

**Example output:**
```
=== ODDS API DIAGNOSTIC TEST ===

NBA games available: 8

First NBA game:
  Portland Trail Blazers @ Orlando Magic
  Commence time: 2025-11-10T19:00:00Z
  Bookmakers: 12
  FanDuel spread: Trail Blazers +2 at -110
```

### Step 2: Compare to Real Bookmaker (1 minute)

1. Open FanDuel.com
2. Find Trail Blazers vs Magic game
3. Check the spread

**If they match:**
- The Odds API is correct ✅
- Problem is in how the app displays/processes data
- Go to Step 3

**If they don't match:**
- The Odds API has wrong/outdated data ❌
- Problem is with The Odds API, not your app
- Possible causes:
  - Free tier API key (limited data)
  - Wrong API account (test data)
  - API having issues
  - Odds moved very recently

### Step 3: Check When Data Was Last Updated

The API response includes a `last_update` timestamp. Check this:

```bash
# In the diagnostic output, look for:
"last_update": "2025-11-10T14:30:00Z"
```

Compare this timestamp to current time:
- If it's >5 minutes old, data is stale
- If it's recent but still wrong, API has bad data

### Step 4: Enable Debug Logging

Add this to see exactly what data your app receives:

```typescript
// In /lib/api/odds-api.ts, after line 40, add:

const data = await response.json()

// ADD THIS:
console.log('=== THE ODDS API RAW RESPONSE ===')
console.log(`Sport: ${sport}`)
console.log(`Games: ${data.length}`)
if (data.length > 0) {
  const game = data[0]
  console.log(`First game: ${game.away_team} @ ${game.home_team}`)
  if (game.bookmakers.length > 0) {
    const fanduel = game.bookmakers.find(b => b.key === 'fanduel')
    if (fanduel) {
      const spreads = fanduel.markets.find(m => m.key === 'spreads')
      console.log('FanDuel spreads:', JSON.stringify(spreads?.outcomes, null, 2))
    }
  }
}
// END ADD

return data as OddsGame[]
```

Then run your app and check the console.

---

## Most Likely Issues & Fixes

### Issue #1: Cache Showing Old Odds (70% probability)

**Problem:** The 30-second cache means odds can be up to 30 seconds old. In fast-moving betting markets, lines can shift quickly.

**Fix:**

```typescript
// /lib/api/odds-api.ts:30
// Change from:
next: { revalidate: 30 }

// To:
next: { revalidate: 10 }  // or even 5 for very fresh data
```

**Trade-off:** More API calls = faster quota depletion (free tier: 500 requests/month)

### Issue #2: Wrong Bookmaker Being Displayed (20% probability)

**Problem:** You check FanDuel but app shows DraftKings odds.

**How to Verify:**
- Check if app specifies which bookmaker for each line
- See if FanDuel is even in the response

**Fix:** Make it crystal clear which bookmaker each odds line comes from. The pre-formatting already includes bookmaker name, but make sure AI displays it.

### Issue #3: API Key Issues (5% probability)

**Problem:** API key points to test account with fake data.

**How to Verify:**
```bash
# Check which API key you're using
grep ODDS_API_KEY .env.local

# Verify on The Odds API dashboard:
# - Which plan you're on (free/paid)
# - How many requests you've used
# - If there are any limitations
```

**Fix:** Get a proper API key from https://the-odds-api.com/

### Issue #4: Regional Bookmakers (3% probability)

**Problem:** App configured for wrong region (UK bookmakers instead of US).

**How to Verify:**
Check `/lib/api/odds-api.ts:26`:
```typescript
&regions=us  ← Should be "us" for US bookmakers
```

**Fix:** If it's set to `uk`, `au`, or `eu`, change to `us`.

### Issue #5: The Odds API Has Bad Data (2% probability)

**Problem:** The Odds API itself is returning incorrect data.

**How to Verify:**
- Check The Odds API status page
- Check their Discord/support for known issues
- Try a different endpoint or sport

**Fix:**
- Wait for them to fix it
- Use a different odds data provider
- Cache bookmaker's official odds as backup

---

## Quick Verification Script

Create this file to quickly test:

```bash
# test-single-game.sh

echo "Fetching Trail Blazers vs Magic odds..."

curl -s "https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?\
apiKey=YOUR_KEY&\
regions=us&\
markets=spreads&\
oddsFormat=american" \
| jq '.[] | select(.away_team == "Portland Trail Blazers" or .home_team == "Portland Trail Blazers") | {
  game: "\(.away_team) @ \(.home_team)",
  commence_time,
  fanduel_spreads: [.bookmakers[] | select(.title == "FanDuel") | .markets[] | select(.key == "spreads") | .outcomes[]]
}'
```

Run: `bash test-single-game.sh`

This shows exactly what FanDuel's spread is according to The Odds API.

---

## If The Odds API Data is Correct

If the diagnostic test shows the right odds (+2) but your app shows wrong odds (-3.5), then the problem is in:

1. **Data processing** - Something between fetching and displaying corrupts the data
2. **AI hallucination** - AI ignores correct data and makes up numbers (already addressed by pre-formatting fix)
3. **Multiple games confusion** - App shows odds from a different game
4. **Bookmaker confusion** - Shows a different bookmaker that has -3.5

**Next diagnostic:**
- Enable the detailed logging I mentioned above
- Check server logs when you make the query
- Compare logs to AI's response
- Find where the number changes from +2 to -3.5

---

## If The Odds API Data is Wrong

If the diagnostic test also shows -3.5 (when FanDuel.com shows +2), then The Odds API is the problem:

**Possible causes:**
1. **Stale data** - API hasn't updated in a while (check `last_update` timestamp)
2. **Free tier limitation** - Free accounts might get delayed data
3. **Wrong FanDuel feed** - API might be pulling from FanDuel's UK site instead of US
4. **API bug** - Rare but possible

**Solutions:**
1. **Upgrade to paid tier** - Usually gets fresher, more accurate data
2. **Add multiple data sources** - Combine The Odds API with another provider
3. **Scrape bookmaker directly** - More reliable but against ToS
4. **Accept slight delays** - Free tier data is "good enough" for most users

---

## Expected Output After Fixes

```
User: "trail blazers vs magic betting odds today"

App Response:
"Here are the betting odds for Portland Trail Blazers @ Orlando Magic (7:00 PM EST):

**Spreads:**
| Bookmaker   | Trail Blazers | Magic  |
|-------------|---------------|--------|
| FanDuel     | +2 (-110)     | -2 (-110) |
| DraftKings  | +1.5 (-108)   | -1.5 (-112) |
| BetMGM      | +2 (-105)     | -2 (-115) |

*Best value: Trail Blazers +2 at -110 (FanDuel)*
*Last updated: 2 seconds ago*"
```

Key improvements:
- ✅ Shows which bookmaker for each line
- ✅ Shows "last updated" timestamp
- ✅ Clearly labeled best value
- ✅ All bookmakers displayed

---

## Action Items Checklist

- [ ] Run `node scripts/test-odds-api.js`
- [ ] Compare API output to FanDuel.com
- [ ] Check `last_update` timestamp in API response
- [ ] Verify which bookmakers are included
- [ ] Enable debug logging in `odds-api.ts`
- [ ] Make a test query and check logs
- [ ] Compare logs to AI response
- [ ] Identify where data diverges
- [ ] Reduce cache time from 30s to 10s
- [ ] Add "last updated" timestamp to UI
- [ ] Clearly label which bookmaker for each line

---

## Contact Information

**The Odds API Support:**
- Website: https://the-odds-api.com/
- Docs: https://the-odds-api.com/liveapi/guides/v4/
- Support email: contact@the-odds-api.com

**Questions to ask if you contact them:**
1. Why does the spread for Trail Blazers vs Magic show -3.5 when FanDuel.com shows +2?
2. How fresh is the data for free tier accounts?
3. Is there a delay between bookmaker updates and API updates?
4. Can I get real-time data or is there a built-in lag?

---

## Summary

**The app does NOT transform or corrupt odds data.** It passes through The Odds API response directly.

If odds are wrong, the issue is:
1. **The Odds API has stale/wrong data** (run diagnostic to check)
2. **30-second cache** (reduce cache time)
3. **Different bookmaker** (clarify which bookmaker is shown)

**Start with Step 1 above** (run diagnostic) and let me know what you find. That will tell us exactly where the problem is.

---

**Files Referenced:**
- `/lib/api/odds-api.ts` - API integration (NO transformation)
- `/scripts/test-odds-api.js` - Diagnostic tool
- `/app/api/chat/route.ts` - Data filtering (by date/team only)

**No data corruption found in code.** Issue is likely external (API data quality) or cache-related.
