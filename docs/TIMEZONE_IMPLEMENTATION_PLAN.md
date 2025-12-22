# Timezone Implementation Plan

## Problem Statement

**Issue:** When users ask about games "today" or "tonight", the app shows incorrect results because:
1. The system is hardcoded to use America/New_York (EST) timezone
2. All game times are sourced from the odds provider (SportsBettingDime) and converted to user timezone
3. Users in different timezones see wrong game dates
4. A game at 8:30 PM PST on Nov 9 shows as Nov 10 in UTC

**Example:**
- User in PST asks: "What are tonight's games?" (Nov 9, 8:00 PM PST)
- Server thinks it's Nov 10, 1:00 AM UTC
- Shows games from Nov 10 instead of Nov 9
- Pacers vs Nuggets at 8:30 PM PST (Nov 9) is actually 4:30 AM UTC (Nov 10)

---

## Current State Analysis

### 1. **Hardcoded Timezone**
`app/api/chat/route.ts:232`
```typescript
Current time is ${new Date().toLocaleTimeString('en-US', {
  timeZone: 'America/New_York',  // ❌ HARDCODED
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short'
})}
```

### 2. **No Date Filtering**
`app/api/chat/route.ts:723`
```typescript
let oddsData = await fetchOdds(sport)  // ❌ Returns ALL upcoming games
```
No filtering by user's local date!

### 3. **UTC Timestamps**
`lib/types/odds.ts:26`
```typescript
commence_time: string  // ISO 8601 in UTC: "2025-11-10T04:30:00Z"
```

---

## Solution Architecture

### Phase 1: **Frontend - Detect User Timezone**

**Where:** `components/ModernMessageInput.tsx`

**How:**
```typescript
// Get user's IANA timezone (e.g., "America/Los_Angeles")
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

// Send with each message
body: JSON.stringify({
  message: userMessage,
  conversationId,
  userId,
  timezone: userTimezone  // NEW
})
```

**Benefits:**
- Automatic detection
- No user configuration needed
- Works globally (not just US)

---

### Phase 2: **Backend - Accept Timezone Parameter**

**Where:** `app/api/chat/route.ts`

**Changes:**

1. **Extract timezone from request:**
```typescript
const { message, conversationId, userId, timezone = 'America/New_York' } = await req.json()
```

2. **Update system prompt with user's timezone:**
```typescript
const SYSTEM_PROMPT = `You are DELTA...

**CURRENT DATE & TIME (${timezone}):**
Today's date is ${new Date().toLocaleDateString('en-US', {
  timeZone: timezone,  // ✅ USER'S TIMEZONE
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}.
Current time is ${new Date().toLocaleTimeString('en-US', {
  timeZone: timezone,  // ✅ USER'S TIMEZONE
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short'
})}.
`
```

3. **Filter games by user's local date:**
```typescript
// After fetching odds
if (oddsData.length > 0) {
  const userNow = new Date()
  const userToday = new Date(userNow.toLocaleString('en-US', { timeZone: timezone }))
  const userTodayStart = new Date(userToday.setHours(0, 0, 0, 0))
  const userTodayEnd = new Date(userToday.setHours(23, 59, 59, 999))

  oddsData = oddsData.filter(game => {
    const gameTime = new Date(game.commence_time)
    const gameInUserTZ = new Date(gameTime.toLocaleString('en-US', { timeZone: timezone }))

    // Include games happening "today" in user's timezone
    return gameInUserTZ >= userTodayStart && gameInUserTZ <= userTodayEnd
  })
}
```

---

### Phase 3: **Format Game Times in User's Timezone**

**Where:** `app/api/chat/route.ts` (odds context formatting)

**Changes:**
```typescript
const formatGameTime = (commence_time: string, timezone: string) => {
  const gameTime = new Date(commence_time)
  return gameTime.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  })
}

// In odds context
oddsContext += `
LIVE ODDS DATA (as of ${new Date().toLocaleString('en-US', {
  timeZone: timezone,
  timeZoneName: 'short'
})}):

${sport.toUpperCase()}:
${oddsData.map(game => `
  ${game.away_team} @ ${game.home_team}
  Game Time: ${formatGameTime(game.commence_time, timezone)}  // ✅ USER'S TIME
  ...
`).join('\n')}
`
```

---

## Implementation Steps

### Step 1: Frontend Changes
**File:** `components/ModernMessageInput.tsx`

```diff
  const handleSend = async () => {
    if (!message.trim() || sending) return

    const userMessage = message.trim()
    setMessage('')
    setSending(true)

+   // Detect user's timezone
+   const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
          userId,
+         timezone: userTimezone,
        }),
      })
```

**Testing:** Console log the timezone to verify detection works.

---

### Step 2: Backend Parameter Extraction
**File:** `app/api/chat/route.ts` (line ~480)

```diff
  export async function POST(req: Request) {
-   const { message, conversationId, userId } = await req.json()
+   const {
+     message,
+     conversationId,
+     userId,
+     timezone = 'America/New_York'  // Default fallback
+   } = await req.json()
```

---

### Step 3: Dynamic System Prompt
**File:** `app/api/chat/route.ts` (line ~228)

```diff
- const SYSTEM_PROMPT = `You are DELTA...
+ const getSystemPrompt = (timezone: string) => `You are DELTA...

  **CURRENT DATE & TIME:**
- Today's date is ${new Date().toLocaleDateString('en-US', {
-   weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
- })}.
+ Today's date is ${new Date().toLocaleDateString('en-US', {
+   timeZone: timezone,
+   weekday: 'long',
+   year: 'numeric',
+   month: 'long',
+   day: 'numeric'
+ })}.
- Current time is ${new Date().toLocaleTimeString('en-US', {
-   timeZone: 'America/New_York',
-   hour: '2-digit',
-   minute: '2-digit',
-   timeZoneName: 'short'
- })}.
+ Current time is ${new Date().toLocaleString('en-US', {
+   timeZone: timezone,
+   dateStyle: 'short',
+   timeStyle: 'short'
+ })} ${timezone}.
`

// Update all usages:
- const openaiMessages = [{ role: 'system', content: SYSTEM_PROMPT + ... }]
+ const openaiMessages = [{ role: 'system', content: getSystemPrompt(timezone) + ... }]
```

---

### Step 4: Game Filtering by Date
**File:** `app/api/chat/route.ts` (line ~720-740)

```diff
  let oddsData = await fetchOdds(sport)

+ // Filter games to user's "today"
+ if (oddsData.length > 0) {
+   const now = new Date()
+   const todayInUserTZ = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
+   const startOfDay = new Date(todayInUserTZ)
+   startOfDay.setHours(0, 0, 0, 0)
+   const endOfDay = new Date(todayInUserTZ)
+   endOfDay.setHours(23, 59, 59, 999)
+
+   oddsData = oddsData.filter(game => {
+     const gameTime = new Date(game.commence_time)
+     const gameInUserTZ = new Date(gameTime.toLocaleString('en-US', { timeZone: timezone }))
+     return gameInUserTZ >= startOfDay && gameInUserTZ <= endOfDay
+   })
+ }

  // Filter NCAAF to only Top 25 matchups
  if (sport === 'americanfootball_ncaaf' && oddsData.length > 0) {
```

---

### Step 5: Format Game Times
**File:** `app/api/chat/route.ts` (line ~820-840)

```diff
+ // Helper to format game time in user's timezone
+ const formatGameTime = (commence_time: string) => {
+   return new Date(commence_time).toLocaleString('en-US', {
+     timeZone: timezone,
+     weekday: 'short',
+     month: 'short',
+     day: 'numeric',
+     hour: 'numeric',
+     minute: '2-digit',
+     hour12: true,
+     timeZoneName: 'short'
+   })
+ }

  const oddsContext = `
  LIVE ODDS DATA:

  ${formattedOdds.map(sportOdds => `
  **${sportOdds.sport}:**
  ${sportOdds.games.map(game => `
-   ${game.away_team} @ ${game.home_team}
+   ${game.away_team} @ ${game.home_team} (${formatGameTime(game.commence_time)})
    ...
  `).join('\n')}
  `).join('\n')}
- - Current as of ${new Date().toLocaleTimeString('en-US', {
-     timeZone: 'America/New_York',
-     timeZoneName: 'short'
-   })}
+ - Current as of ${new Date().toLocaleString('en-US', {
+     timeZone: timezone,
+     dateStyle: 'short',
+     timeStyle: 'short'
+   })} ${timezone}
  `
```

---

## Testing Checklist

### Test Cases:

1. **Basic Detection**
   - [ ] Console log shows correct timezone
   - [ ] Request includes timezone parameter

2. **Date Boundary Cases**
   - [ ] User in PST at 11:00 PM asks about "tonight's games"
   - [ ] Should show games happening before midnight PST
   - [ ] Should NOT show tomorrow's games

3. **Cross-Timezone**
   - [ ] User in EST sees games at 8:00 PM EST
   - [ ] User in PST sees same games at 5:00 PM PST
   - [ ] Both see games as "today" when appropriate

4. **Edge Cases**
   - [ ] Game starting at 11:59 PM shows as "today"
   - [ ] Game starting at 12:01 AM shows as "tomorrow"
   - [ ] Past games are filtered out

5. **Fallback**
   - [ ] Old clients without timezone default to EST
   - [ ] Invalid timezone falls back to EST

---

## Migration Strategy

### Backwards Compatibility:
- Default timezone to `'America/New_York'` if not provided
- Old frontend versions continue to work
- No database changes required
- No breaking changes

### Rollout Plan:
1. Deploy backend changes first (backwards compatible)
2. Deploy frontend changes
3. Monitor logs for timezone distribution
4. Add timezone to analytics/tracking

---

## Future Enhancements

1. **User Preference Storage**
   - Save timezone in user profile
   - Allow manual timezone override
   - Handle users traveling across timezones

2. **Smart Date Range**
   - "Tonight" = After 5 PM today
   - "This weekend" = Sat-Sun in user's TZ
   - "Next week" = Monday-Sunday next week

3. **Relative Time Display**
   - "Starts in 2 hours"
   - "Started 30 minutes ago"
   - "Tomorrow at 7:00 PM"

4. **Multiple Timezone Support**
   - Show game times in multiple timezones
   - Useful for international users
   - "8:00 PM EST / 5:00 PM PST / 1:00 AM GMT"

---

## Dependencies

### NPM Packages:
- `date-fns` (already installed) ✅
- No additional dependencies needed!

### Browser APIs:
- `Intl.DateTimeFormat()` - Supported in all modern browsers ✅

---

## Estimated Effort

- **Frontend Changes:** 15 minutes
- **Backend Changes:** 1-2 hours
- **Testing:** 30 minutes
- **Total:** ~3 hours

---

## Priority: HIGH 🔴

This affects core functionality and user experience. Users are getting incorrect game information based on timezone assumptions.

---

## Next Steps

1. Review this plan with team
2. Create feature branch: `feature/timezone-support`
3. Implement frontend changes
4. Implement backend changes
5. Test with different timezones
6. Deploy to staging
7. User acceptance testing
8. Deploy to production
9. Monitor for issues
10. Document in user guide

---

**Created:** November 9, 2025
**Author:** Claude Code
**Status:** Ready for Implementation
