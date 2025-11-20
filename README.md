# Delta AI - Intelligent Sports Betting Assistant

<div align="center">

AI betting mate for odds discovery, bankroll tracking, custom models, and live market research.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/)

</div>

---

## Overview

Delta AI is a Next.js 14 + Supabase application that blends a streaming OpenAI copilot with a full betting toolkit: odds aggregation (Odds-API.io), bankroll + bet lifecycle tracking, parlay math, player props, custom/research models, and market ingestion pipelines. Most APIs require a Supabase-authenticated session; automation endpoints are protected with secrets for cron jobs.

---

## Recent Updates

- Single-game odds replies now auto-include team insights from live scores (streak, last 10, PPG/PAPG, FG%/3P%, REB/AST/BLK/STL) with season snapshots as fallback.
- NCAAB odds filtering tightened using live-slate matching to avoid cross-sport noise.
- Pricing toggle defaults to Annual (50% off): Pro $15/mo billed annually, Unlimited $99/mo billed annually.
- Live scores layout widened on desktop (four cards per row, larger cards, centered header/controls).

---

## What It Does

- **AI copilot & chat**: Supabase-authenticated chat at `/chat` with streaming GPT-4o responses, auto-titling, and function-calling tools for bets, parlays, bankroll stats, odds, player props, injuries, game context, and custom/research models. Voice input is supported via `/api/transcribe` (ElevenLabs).
- **Bankroll + bet tracking**: Bet logging (single or batch), manual settlement, deposits/withdrawals, parlay creation, and daily bankroll snapshots. Auto-settlement checks ESPN live scores (`/api/bets/auto-settle`), while `/api/bankroll/stats` surfaces ROI, units, per-sport splits, CLV rollups, and live prop deltas. CLV recompute is available at `/api/bankroll/recalc-clv`.
- **Odds + market data**: Odds-API.io client with best-price summaries (`/api/odds/best`), arbitrage scans (`/api/arbitrage` and `/api/odds/arbitrage`), game odds (`/api/odds/games`, `/api/odds/event`, `/api/odds/multi`, `/api/odds/updated`, `/api/odds/movements`), and bookmaker selection (`/api/bookmakers/select`). Line recorder/history/sharp-move endpoints track spreads/totals/moneylines for CLV and movement analysis. Player props are aggregated with best over/under books via `/api/player-props`. Schedules (`/api/events/*`), sports/leagues, injuries, live scores, and market trend snapshots (`/api/markets/trends`) ship alongside a probability/EV engine at `/api/probability`. A `/live-scores` experience shows NBA/NFL/NHL/CFB/NCAAB games with lineups, box scores, and player detail drawers; single-game odds replies embed the same team insight stats when available.
- **Live data access for AI/models**: ESPN snapshots are cached via `npm run cache:live` and exposed through `/api/live-scores/cache` plus LLM-friendly endpoints under `/api/llm/live/*`. Helpers in `lib/live-data-service.ts` and tool descriptors in `lib/llm/tools/live-tools.ts` let the chat assistant or custom models fetch live scores, starters, player stats, and team snapshots on demand without touching the base prompt. Documentation in `docs/llm-live-data.md` / `docs/model-live-data.md` outlines how to plug these tools into the LLM runtime and prediction pipelines.
- **Custom & research models**: `/models` lists saved models; `/models/new` builds prediction or research models with weighted stats, optional data hints, and file uploads (CSV/Excel/PDF/TXT via `/api/models/upload` stored in Supabase Storage). The model runner powers chat tools to save/list/apply models, and the research runner scans markets for user-defined opportunities.
- **Onboarding & pricing flows**: Multi-step onboarding collects username, favorite sports, experience, risk tolerance, bankroll, unit size, feature interest, and subscription intent before unlocking chat. Auth pages and a pricing showcase live under `auth/` and `/pricing`.
- **Automation & ingestion**: Cron-guarded ingestors for team stats (`/api/stats/ingest-team`), line recording (`/api/lines/record`), and sharp-move detection (`/api/lines/sharp-moves`). Scripts in `package.json` cover injuries, recent form, market trends, player props, team stats, and reset helpers, all expecting service-role Supabase credentials and `CRON_SECRET`.

---

## Selected API Surface

- **Odds & data**: `/api/odds/games`, `/api/odds/event`, `/api/odds/multi`, `/api/odds/updated`, `/api/odds/movements`, `/api/odds/best`, `/api/odds/arbitrage`, `/api/arbitrage`, `/api/events`, `/api/events/live`, `/api/events/search`, `/api/events/[id]`, `/api/sports`, `/api/leagues`, `/api/bookmakers/select`, `/api/player-props`, `/api/injuries`, `/api/stats`, `/api/live-scores`, `/api/live-scores/cache`, `/api/llm/live/*`, `/api/markets/trends`.
- **Lines & trends**: `/api/lines/record`, `/api/lines/history`, `/api/lines/sharp-moves`.
- **Bets & bankroll**: `/api/bets`, `/api/bets/auto-settle`, `/api/bets/[id]/settle`, `/api/parlays`, `/api/bankroll/operations`, `/api/bankroll/stats`, `/api/bankroll/recalc-clv`.
- **Models & research**: `/api/models/upload` plus chat-exposed tools to save/list/apply custom and research models.
- **Utilities**: `/api/probability`, `/api/transcribe`, `/api/chat`, `/api/onboarding`, `/api/username/check`.

Most endpoints require a Supabase session; cron-style routes (`lines/*`, `stats/ingest-team`, `auto-settle`) require `CRON_SECRET` or an API key in headers.

---

## Tech Stack

| Layer | Stack |
| --- | --- |
| UI | Next.js 14 App Router, React, TypeScript, Tailwind CSS, Framer Motion, Recharts |
| APIs | Next.js Route Handlers (Node runtime for chat/bankroll/models; Edge for odds/arbitrage/player props/bookmaker selection) |
| Data | Supabase Postgres with RLS + Storage for model files |
| Auth | Supabase Auth |
| AI | OpenAI GPT-4o / GPT-4o-mini (chat, titles, filters, model runner) |
| Sports Data | Odds-API.io (pre-match/live odds, props), ESPN (live scores), sports-stats API (team/advanced stats, injuries) |
| Voice | ElevenLabs speech-to-text (server-side) |

---

## Environment

Copy `.env.example` to `.env.local` and fill at minimum:

| Name | Purpose |
| --- | --- |
| `ODDS_PROVIDER` | Odds provider key (`odds-api-io` default). |
| `ODDS_API_KEY` | Odds-API.io API key. |
| `ODDS_BOOKMAKERS` | Comma-separated books to request (FanDuel, DraftKings, BetMGM, Caesars, etc.). |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for ingestion scripts/cron tasks. |
| `NEXT_PUBLIC_APP_URL` | App base URL for chat links/title generation. |
| `OPENAI_API_KEY` | OpenAI access for chat/models. |
| `ELEVENLABS_API_KEY` | Required for voice transcription via `/api/transcribe`. |
| `CRON_SECRET` | Protects `lines/*` and `stats/ingest-team` ingestors. |
| `AUTO_SETTLE_API_KEY` | Optional key to trigger `/api/bets/auto-settle` without a user session. |
| `ODDS_FANTASY_BOOKS`, `ODDS_REGIONS`, `VERCEL_TOKEN` | Optional provider/runtime tuning. |

---

## Development & Testing

- Install & run: `npm install` then `npm run dev` (or `npm run build && npm start`).
- Quality gates: `npm run lint`, `npm run typecheck`, `npm run verify`.
- Unit/spec helpers: `npm run test:custom-models` (stat weight normalization), `npm run test:odds` (odds helpers).
- Scripts/ingestion: see `npm run ingest:*`, `npm run cache:live` (ESPN snapshot cache), and `npm run reset:tracking`; they require `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` in the environment.

---

## Troubleshooting

- **Odds rate limits**: Watch Odds-API.io headers (`x-ratelimit-*`); trim `ODDS_BOOKMAKERS`, use `/api/odds/multi`, and lean on line snapshots where possible.
- **Empty schedules/props**: Verify sport/league keys and timezone filters; confirm provider has events today; pass `live=true` when appropriate.
- **Live data gaps**: Injuries and recent form fall back to live fetches when the Supabase cache is empty; run `ingest:*` jobs to refresh regularly.
- **Voice input**: Ensure `ELEVENLABS_API_KEY` is set; browsers must allow mic access.

---

## Notes

- The assistant is designed to surface data, math, and tooling - not to give gambling advice.
- CLV and bankroll stats power chat summaries and the `BentoGridBankroll` widget; individual bet cards intentionally avoid displaying CLV directly.
