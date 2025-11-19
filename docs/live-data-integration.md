# Live Data Integration Plan

This workflow keeps the core LLM prompt untouched while letting tools/models read ESPN data safely.

1. **Cache Service**
   - Run `npm run cache:live` on a schedule (GitHub Action or server cron) while `npm run dev`/`next start` is up.
   - It hits the existing `/api/live-scores` endpoints and writes snapshots to `cache/live`.
   - Files include the master scoreboard and any live-game summaries for box scores.

2. **Read-only APIs**
   - `/api/live-scores/cache` and `/api/live-scores/cache/[eventId]` serve cached payloads first and fall back to live fetches if needed.
   - This allows the LLM/tooling to read data without touching ESPN directly, maintaining deterministic responses.

3. **LLM Tool Hooks**
   - `lib/llm/live-metrics.ts` exposes `getCachedScores` / `getCachedGameDetails`.
   - These functions should be registered as function-calling tools inside the assistant runtime.
   - Responses can be templated with `lib/llm/templates/live-scores.ts` to avoid hallucinated formatting.

4. **Prediction Models**
   - Custom model pipelines should call the same helpers (either through the cache API or by importing the helper file in server-side contexts) before running projections.
   - This ensures projections use identical starters/injuries/live stats as the live score page.

5. **Monitoring**
   - Keep an eye on cache freshness (see `listCacheMeta()` in `lib/live-score-cache.ts`).
   - If cache files are stale, fall back to hitting the live ESPN fetcher or notify ops.
