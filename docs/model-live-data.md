## Prediction Model Data Hooks

Custom models should import the helpers in `lib/live-data-service.ts` (or call the `/api/llm/live/*` endpoints) before running projections. Recommended flow:

1. **Prefetch**
   - Call `getLiveScoresData({ league })` to grab context about scheduled/live games.
   - For each relevant event, call `getGameDetailsData({ league, eventId })` to capture current lineups and box scores.

2. **Augment**
   - Use `getTeamSnapshot` for season-long numbers (record, efficiency, injuries).
   - Use `getPlayerSeasonStats` to seed player form data or injury status.

3. **Cache & Share**
   - Store the payload alongside model outputs so analysts know exactly which data snapshot was used.

4. **Fallback**
   - If ESPN endpoints error, the model should either pause or clearly mark the output as “data unavailable” instead of proceeding with stale assumptions.
