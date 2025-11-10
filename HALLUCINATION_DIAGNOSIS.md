# Hallucination Diagnosis Report
**Date:** November 10, 2025
**Issue:** App providing hallucinated information on live betting odds and other important information

---

## Executive Summary

**PRIMARY CAUSE: LLM HALLUCINATION (GPT-4o)**

The hallucination issue is primarily an **LLM problem**, not an API problem. The app uses legitimate external APIs for all data (The Odds API, ESPN API, sports stats APIs), but GPT-4o was generating fake games and information from its training data instead of using the real API data provided in context.

**STATUS:** Recent fixes were applied (commit `f651a25`) but the issue may still occur due to LLM non-determinism.

---

## Investigation Findings

### 1. Data Sources (All Legitimate ✅)

All betting and game data comes from external APIs - **NO code generates or infers fake data**:

| Data Type | Source | File | Status |
|-----------|--------|------|--------|
| Betting Odds | The Odds API | `/lib/api/odds-api.ts` | ✅ Real-time API |
| Player Props | The Odds API | `/app/api/player-props/route.ts` | ✅ Real-time API |
| Live Scores | ESPN API | `/lib/espn-api.ts` | ✅ Real-time API |
| Team Stats | Sports Stats APIs | `/lib/sports-stats-api.ts` | ✅ Real-time API |
| Win Probability | Calculated from live scores | `/lib/services/probability-engine.ts` | ✅ Legitimate calculations |

**Cache Duration:** 30 seconds revalidation for all APIs

### 2. LLM Implementation

**Model:** OpenAI GPT-4o
**File:** `/app/api/chat/route.ts`
**Lines:** 228-362 (system prompt), 940-979 (context injection)

**Problem Identified:**
- GPT-4o was making up games from its training data (e.g., "Lakers vs Celtics tonight at 7:30 PM") when asked "what games are today/tomorrow?"
- This occurred even when real API data was provided in context
- The AI would sometimes claim "I don't have access to live odds" even when odds data WAS in the context

### 3. Recent Fixes Applied

#### Fix #1: Game Schedule Hallucination (Commit `f651a25`)
**Problem:** AI inventing completely fake games

**Solution Implemented (Lines 257-277):**
```typescript
**CRITICAL - Game Schedule Queries:**
When users ask "what games are today/tonight/tomorrow":
1. YOU MUST ONLY use the live odds data provided in your context
2. NEVER make up games from memory or training data
3. If you see "LIVE ODDS DATA" below, list ONLY those games
4. If NO odds data is provided below, say "I need to fetch the latest schedule"
5. Group games by sport if multiple sports are in the data
6. Show game times in the user's timezone
7. If user asks for "tomorrow" and you only have "today" data, say you only have today's data
```

**Additional Safeguards:**
- Today/tomorrow query detection (lines 619-621)
- Timezone-aware date filtering (lines 793-821)
- Explicit game count in context (line 949)
- Clear "ONLY these games" warnings (lines 948-953)

#### Fix #2: AI Claiming "No Access" (Commits `c59332e`, `8e92162`)
**Problem:** AI saying "I don't have access to live odds" when data was present

**Solution Implemented (Lines 244-255, 945-946):**
```typescript
**IMPORTANT - YOU HAVE ACCESS TO LIVE ODDS:**
You have REAL-TIME access to: [lists data sources]

**CRITICAL**: If you see "LIVE ODDS DATA" in your context below, you MUST use it.
NEVER say you don't have access when data is provided.

// In context injection:
**🔴 LIVE ODDS DATA LOADED 🔴**
YOU HAVE REAL-TIME ODDS DATA. USE IT. DO NOT SAY YOU DON'T HAVE ACCESS.
```

#### Fix #3: Odds Comparison Logic (Commit `af3f804`)
**Problem:** AI recommending worse lines based solely on better juice/odds

**Solution:** Value-based comparison rules (lines 301-326)
- For spreads: Better line value > better odds
- Example: Team -4.5 at -110 is BETTER than Team -5 at -105

---

## Root Cause Analysis

### Primary Cause: LLM Non-Determinism

**Why This Happens:**
1. Large Language Models (LLMs) can occasionally ignore even emphatic instructions
2. GPT-4o has extensive sports knowledge in its training data
3. When asked "what games are tonight?", the LLM may default to generating plausible-sounding games from memory
4. This is a known limitation of LLMs - they can "hallucinate" information that seems reasonable

**Evidence:**
- All data sources are legitimate external APIs
- No code generates fake data
- System prompt has extensive anti-hallucination measures
- Context clearly provides real data with emphatic warnings
- Yet hallucination can still occur

### Contributing Factors

1. **API Timing Issues:**
   - If The Odds API call fails or times out, no data is provided to context
   - AI then has no real data to work with
   - May fall back to generating plausible-sounding games

2. **Cache Staleness:**
   - 30-second cache could show slightly outdated odds
   - Not hallucination, but could appear incorrect

3. **Tomorrow vs Today Confusion:**
   - The Odds API may not have odds for games far in advance
   - If user asks "what games tomorrow?" but API only has today's games
   - AI might generate tomorrow's games from memory

4. **API Key Configuration:**
   - If `ODDS_API_KEY` or `OPENAI_API_KEY` are not configured
   - API calls fail silently
   - AI has no real data to work with

---

## Types of Potential Hallucination

### 1. Game Schedules (MOST COMMON)
**User Query:** "What games are today/tonight/tomorrow?"

**Hallucination Examples:**
- Made-up game matchups
- Incorrect game times
- Games that don't exist

**Detection:** Compare AI response to actual API data from The Odds API

**Status:** Fixed in `f651a25` but may still occur occasionally

### 2. Betting Odds
**User Query:** "What are the odds for Lakers vs Celtics?"

**Hallucination Examples:**
- Fake odds/lines
- Odds for games that don't exist
- Incorrect bookmaker information

**Detection:** Compare to The Odds API raw response

**Status:** Should be prevented by context injection

### 3. Player Props
**User Query:** "What's the over/under for LeBron points?"

**Hallucination Examples:**
- Made-up prop lines
- Props for players not playing
- Incorrect odds

**Detection:** Compare to `/api/player-props` response

**Status:** Uses same anti-hallucination measures

### 4. Live Scores
**User Query:** "What's the score of the Lakers game?"

**Hallucination Examples:**
- Incorrect scores
- Made-up game states
- Wrong time remaining

**Detection:** Compare to ESPN API data

**Status:** Should be prevented by real-time data

---

## Diagnostic Steps

### Step 1: Verify API Keys Are Configured

```bash
# Check environment variables
grep -E "(ODDS_API_KEY|OPENAI_API_KEY)" .env .env.local
```

**Expected:** Both keys should be present and valid

**If Missing:**
- Get The Odds API key from https://the-odds-api.com/
- Get OpenAI API key from https://platform.openai.com/
- Add to `.env.local` file

### Step 2: Test API Connectivity

**Test The Odds API:**
```bash
curl "https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=YOUR_KEY&regions=us&markets=h2h,spreads,totals&oddsFormat=american"
```

**Expected:** JSON response with current NBA games and odds

**If Error:**
- API key invalid
- API quota exceeded (500 requests/month free tier)
- API service down

### Step 3: Test Odds API Endpoint

```bash
curl "http://localhost:3000/api/odds/games?sport=basketball_nba"
```

**Expected:** JSON with games array

**If Error:** API integration issue

### Step 4: Monitor AI Responses

**Check Server Logs:**
```bash
# Look for these log messages
[ODDS] Odds request detected, fetching data...
[ODDS] Successfully fetched odds for X sport(s)
[ODDS] Total games formatted: X
[ODDS] Context built successfully, length: X characters
```

**If Missing:**
- AI not detecting odds queries
- API calls failing
- Context not being built

### Step 5: Test Specific Hallucination Cases

**Test Game Schedule Query:**
```
User: "What NBA games are today?"
```

**Check:**
1. Does response match actual games from The Odds API?
2. Are game times accurate?
3. Does AI list games NOT in the API response?

**Test Odds Query:**
```
User: "What are the best odds for Lakers spread?"
```

**Check:**
1. Are odds real (match The Odds API)?
2. Are bookmaker names correct?
3. Is the comparison accurate?

---

## Solutions & Recommendations

### Immediate Actions

1. **Verify API Configuration**
   - Ensure `ODDS_API_KEY` is valid
   - Ensure `OPENAI_API_KEY` is valid
   - Check API quotas haven't been exceeded

2. **Add Response Validation Layer**
   - After AI generates response, validate against source data
   - Reject responses that mention games/odds not in API data
   - Implementation: `/app/api/chat/route.ts` lines 1150+

3. **Enable Structured Output Mode**
   - Force AI to return JSON that matches a schema
   - Prevents free-form hallucination
   - OpenAI supports `response_format: { type: "json_object" }`

4. **Add Audit Logging**
   - Log all AI responses to database
   - Flag responses for manual review
   - Track hallucination frequency

### Medium-Term Improvements

1. **Implement Retrieval-Augmented Generation (RAG)**
   - Only allow AI to cite specific data chunks
   - Each response must reference source
   - Prevents generating information from memory

2. **Add Confidence Scores**
   - AI rates its confidence in each statement
   - Low-confidence responses get flagged
   - User sees uncertainty indicators

3. **User Reporting System**
   - "Report Incorrect Info" button
   - Logs flagged responses for analysis
   - Helps identify new hallucination patterns

4. **Automated Testing**
   ```typescript
   // Test that AI doesn't hallucinate
   test('AI should not invent games', async () => {
     const response = await chatAPI({
       message: "What NBA games are today?",
       mockOddsData: [/* specific games */]
     })

     // Assert response only contains games from mockOddsData
     expect(response).not.toContain('Lakers')
     expect(response).toContain('Celtics') // from mock data
   })
   ```

### Long-Term Architecture Changes

1. **Switch to Fact-Checking Pipeline**
   ```
   User Query → LLM (generate) → Fact Checker (validate) → Response
   ```
   - Fact checker compares AI output to source APIs
   - Rejects hallucinated information
   - Returns only verified facts

2. **Use Multiple LLM Providers**
   - Claude (Anthropic) as alternative to GPT-4o
   - Compare responses between models
   - Higher agreement = more reliable

3. **Implement Tool-Only Mode**
   - AI can ONLY use functions (get_odds, get_scores, etc.)
   - Cannot generate free-form text about data
   - Forces AI to fetch real data for every claim

---

## Monitoring & Detection

### Key Metrics to Track

1. **Hallucination Rate:**
   - % of responses that contain made-up information
   - Track by query type (schedule, odds, props, etc.)

2. **API Success Rate:**
   - % of times The Odds API call succeeds
   - % of times data is successfully injected into context

3. **AI Claim Rate:**
   - How often AI says "I don't have access" when data IS present
   - Should be 0% after recent fixes

4. **User Reports:**
   - Number of "Report Incorrect Info" submissions
   - Categories of reported issues

### Automated Alerts

**Set up alerts for:**
- API response time > 5 seconds
- API error rate > 5%
- Cache hit rate < 80%
- Unusual response patterns (e.g., AI listing >50 games)

---

## Testing Protocol

### Manual Testing Checklist

- [ ] Test: "What NBA games are today?" - Verify all games are real
- [ ] Test: "What games are tomorrow?" - Verify date filtering works
- [ ] Test: "Show me Lakers odds" - Verify odds match The Odds API
- [ ] Test: "Find arbitrage opportunities" - Verify calculations are correct
- [ ] Test: "What's LeBron's points over/under?" - Verify props are real
- [ ] Test: "What's the score of [live game]?" - Verify scores match ESPN
- [ ] Test with API down - Verify graceful degradation (no hallucination)
- [ ] Test with empty API response - Verify AI says "no games available"

### Automated Testing

**Create tests in:** `/tests/hallucination.test.ts`

```typescript
describe('Anti-Hallucination Tests', () => {
  it('should not invent games when API returns empty', async () => {
    mockOddsAPI.mockReturnValue([])
    const response = await chat("What games are today?")
    expect(response).toContain("no games")
    expect(response).not.toMatch(/Lakers|Celtics|Warriors/)
  })

  it('should only list games from API data', async () => {
    mockOddsAPI.mockReturnValue([
      { home_team: "Lakers", away_team: "Celtics" }
    ])
    const response = await chat("What games are today?")
    expect(response).toContain("Lakers")
    expect(response).toContain("Celtics")
    expect(response).not.toContain("Warriors") // Not in API data
  })
})
```

---

## Conclusion

**The hallucination issue is primarily an LLM problem, not an API problem.** All data sources are legitimate, but GPT-4o can still generate fake information from its training data despite strong anti-hallucination measures.

**Recent fixes should significantly reduce hallucination frequency**, but cannot eliminate it entirely due to LLM non-determinism.

**Recommended Next Steps:**
1. Verify API keys are configured correctly
2. Test the specific queries that are hallucinating
3. Check server logs to see if data is being fetched and injected
4. Implement response validation layer
5. Add user reporting system
6. Consider switching to structured output mode or fact-checking pipeline

---

## Files Reference

**Core Implementation:**
- `/app/api/chat/route.ts` - Main AI chatbot (lines 228-362: system prompt, 940-979: context injection)
- `/lib/api/odds-api.ts` - The Odds API integration
- `/lib/espn-api.ts` - ESPN live scores
- `/app/api/player-props/route.ts` - Player prop betting lines

**Recent Fixes:**
- Commit `f651a25` - Fix AI hallucinating game schedules
- Commit `c59332e` - Force AI to use live odds data
- Commit `af3f804` - Fix odds comparison logic

**Documentation:**
- `/docs/LIVE_BET_TRACKING_PLAN.md` - Feature documentation

---

**Report Generated:** November 10, 2025
**Investigation Method:** Comprehensive codebase analysis, git history review, API integration review
**Agent:** Claude (Anthropic) via Claude Code CLI
