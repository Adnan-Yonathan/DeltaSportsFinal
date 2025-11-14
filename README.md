# Delta AI - Intelligent Sports Betting Assistant

<div align="center">

AI-powered sports betting analytics, live odds tracking, AI coaching, and bankroll intelligence

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/)

</div>

---

## Overview

Delta AI is a full-stack betting intelligence terminal. It blends live market ingestion (Odds-API.io + Supabase line recorder), an OpenAI-powered copilot that understands bankroll context, and a complete bet lifecycle engine. Everything ships inside a modern Next.js 14 application with streaming chat, edge APIs, GitHub Actions automation (optional), and Bloomberg-style visuals built for power users.

Key traits:
- Provider-aware odds client (defaults to Odds-API.io) with live fetches on user request plus cached market snapshots for resilience.
- Clean separation between schedule/events and live odds data.
- No cron requirement by default; all compute can be triggered on demand from the app. Automation via GitHub Actions is optional.

---

## Core Capabilities

### Live Markets & Line Tracking
- Provider-aware odds client (Odds-API.io by default) with batched multi-odds requests to minimize rate usage.
- `/api/lines/record` (optional) captures spreads/totals/moneylines and can record opening/current/closing states for CLV and trend analysis.
- Arbitrage finder surfaces guaranteed-profit legs as soon as price disparities appear.

### AI Betting Copilot
- Streaming GPT-4o assistant with Supabase-authenticated sessions.
- Custom statistical models can be defined, saved, and re-run from the chat interface.
- Context packer stitches bankroll state, injuries, recent form, market snapshots, and live odds into every prompt so answers stay grounded.

### Bankroll & Bet Lifecycle
- Bet logging, bankroll snapshots, CLV calculations, and ROI dashboards.
- On-demand CLV recomputation endpoint for historical and current portfolio analysis.
- Player prop lookups, arbitrage summaries, and bankroll widgets live alongside the chat interface.

### Automation & Tooling (Optional)
- GitHub Actions can be configured for line recording and settlement if you want unattended operation. The app itself does not require cron; all workflows can run on demand from the UI.
- Diagnostics docs (hallucination prevention, timezone handling, line tracking) provide debugging playbooks.

---

## Tech Stack

| Layer | Stack |
| --- | --- |
| UI | Next.js 14 App Router, React, TypeScript, Tailwind CSS, Framer Motion, Recharts |
| APIs | Next.js Route Handlers (Node runtime for chat, Edge runtime for odds/arbitrage/player props) |
| Data | Supabase Postgres with Row-Level Security + Realtime channels |
| Auth | Supabase Auth (email/password or OAuth) |
| AI | OpenAI GPT-4o / GPT-4o-mini (chat, titles, custom model builder) |
| Sports Data | Odds-API.io (multi-book, pre-match/live; ML/Spreads/Totals/Props) |
| Automation | Optional GitHub Actions jobs, ingest scripts |
| Observability | Server-side logging |

---

## Key Endpoints

- `/api/odds/games?sport=basketball_nba&live=true` – Live odds snapshot for a sport.
- `/api/odds/best?sport=basketball_nba&live=false` – Best price per market by game.
- `/api/arbitrage?sport=basketball_nba&minProfit=1&live=false` – Arbitrage scan.
- `/api/bankroll/stats?period=7d` – Bankroll KPIs with CLV summary.
- `POST /api/bankroll/recalc-clv?period=7d` – On-demand CLV recompute.
- `/api/sports` / `/api/leagues?sport=football` – Provider-backed sport and league catalogs for dropdowns.
- `/api/events`, `/api/events/live`, `/api/events/[id]`, `/api/events/search` – Schedule accessors with timezone-aware filtering.
- `/api/odds/event`, `/api/odds/multi`, `/api/odds/updated`, `/api/odds/movements` – Direct odds + movement feeds for widgets and recorders.
- `POST /api/bookmakers/select` – Persist the bookmaker filter used for Odds-API.io requests.

---

## Environment

Minimum env vars (see `.env.local.example` if present):

| Name | Description |
| --- | --- |
| `ODDS_PROVIDER` | Odds data provider. Defaults to `odds-api-io`. |
| `ODDS_API_KEY` | Provider API key (Odds-API.io). |
| `ODDS_BOOKMAKERS` | Comma-separated list of books to request (e.g., `FanDuel,DraftKings,BetMGM,Caesars,Fanatics,Bet365,BetRivers,HardRock,Bovada,Stake,Fliff,Pinnacle,PointsBet`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. |
| `OPENAI_API_KEY` | OpenAI key for chat and utilities. |

Rate limits: Odds-API.io docs indicate 5,000 requests/hour per plan, with response headers `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset` for monitoring.

---

## Schedules and Scores

- Schedules (events) are fetched from the provider (Odds-API.io). The app formats results in the user’s timezone.
- ESPN may be used optionally for live score enrichment.

---

## Development

Install and build:

```bash
npm install
npm run dev
# or
npm run build && npm start
```

Common checks:
- Ensure `ODDS_API_KEY` is set and `ODDS_PROVIDER=odds-api-io` in your environment.
- Sanity test odds: `GET /api/odds/games?sport=basketball_nba`.
- Recompute CLV: `POST /api/bankroll/recalc-clv?period=7d`.
- Validate odds normalization helpers: `npm run test:odds`.

---

## Troubleshooting

| Issue | Tip |
| --- | --- |
| Odds not updating | Confirm provider quota; verify `ODDS_API_KEY`; ensure `ODDS_BOOKMAKERS` is set; hit `/api/odds/games` manually. |
| “No schedule available” | Check provider events `/v3/events` for the sport/league and date window; verify timezone filtering. |
| High rate usage | Use multi-odds batching; cache where possible; avoid unnecessary refreshes. |

---

## Notes

- The assistant is designed not to give picks; it provides data, analysis, and tooling (CLV, line movement, arbitrage math) so users can make informed decisions.
- CLV surfaces in the Bankroll tab. Individual bet cards avoid CLV display by design.

