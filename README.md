# Delta AI - Intelligent Sports Betting Assistant

<div align="center">

**AI-powered sports betting analytics, live odds tracking, AI coaching, and bankroll intelligence**

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/)

</div>

---

## Overview

Delta AI is a full-stack betting intelligence terminal. It blends live market ingestion (The Odds API + Supabase line recorder), an OpenAI-powered copilot that understands bankroll context, and a complete bet lifecycle engine. Everything ships inside a modern Next.js 14 application with streaming chat, edge APIs, GitHub Actions automation, and Bloomberg-style visuals built for power users.

---

## Core Capabilities

### Live Markets & Line Tracking
- Rotating-key Odds API client with live fetches on every user request plus cached market snapshots for resilience.
- `/api/lines/record` captures spreads/totals/moneylines for NBA, NFL, NHL, and MLB, recording opening/current/closing states for CLV and trend analysis.
- Arbitrage finder surfaces guaranteed-profit legs as soon as price disparities appear.

### AI Betting Copilot
- Streaming GPT-4o chat assistant with Supabase-authenticated sessions and PostHog telemetry.
- Custom statistical models can be defined, saved, and re-run from the chat interface, complete with weighted stat breakdowns and projections.
- Context packer stitches bankroll state, injuries, recent form, market snapshots, and live odds into every prompt so answers stay grounded.

### Bankroll & Bet Lifecycle
- Bet logging, bankroll snapshots, CLV calculations, and ROI dashboards.
- Auto-settlement workflow (GitHub Actions hitting `/api/bets/auto-settle`) resolves pending bets with live scores and updates bankroll history.
- Player prop lookups, arbitrage summaries, and bankroll widgets live alongside the chat interface.

### Automation & Tooling
- GitHub Actions crons keep line recording (every 30m) and bet settlement (every 15m) running, even on Vercel’s free tier.
- CLI ingestion scripts warm Supabase caches for injuries, recent form, and market trends so the LLM rarely needs to hit third-party APIs mid-conversation.
- Diagnostics docs (`HALLUCINATION_DIAGNOSIS.md`, `LINE_TRACKING_GUIDE.md`, etc.) document debugging playbooks for odds freshness, timezone handling, and hallucination prevention.

---

## Tech Stack

| Layer | Stack |
| --- | --- |
| UI | Next.js 14 App Router, React, TypeScript, Tailwind CSS, Framer Motion, Recharts |
| APIs | Next.js Route Handlers (Node runtime for chat, Edge runtime for odds/arbitrage/player props) |
| Data | Supabase Postgres with Row-Level Security + Realtime channels |
| Auth | Supabase Auth (email/password or OAuth) |
| AI | OpenAI GPT-4o / GPT-4o-mini (chat, titles, custom model builder) |
| Sports Data | The Odds API v4 (US books, spreads, totals, props) |
| Automation | GitHub Actions cron jobs, ingest scripts, optional Vercel cron |
| Observability | PostHog (client + server) |

---

## Architecture at a Glance

| Area | Responsibilities |
| --- | --- |
| Ingestion | `recordCurrentLines`, market snapshot script, Supabase service client, GitHub Actions hitting `/api/lines/record` |
| Application API | Odds fetching, arbitrage, chat route tool calls (bet logging, bankroll stats, player props, injuries) |
| AI Orchestration | Prompt builder merges bankroll context, injuries, market data, and custom models for each OpenAI call |
| Data Layer | Supabase tables for conversations, messages, bets, bankroll snapshots, custom models, market_snapshots, lines, injuries, team_recent_form, etc. |
| Presentation | Streaming chat UI, Bento bankroll panel, arbitrage cards, player props search |

---

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Supabase project (free tier works)
- OpenAI API key with GPT-4o access
- The Odds API key (free tier offers 500 calls/month)

---

## Quick Start

1. **Clone & Install**
   ```bash
   git clone <your-repo-url>
   cd DeltaSportsFinal
   npm install # or yarn / pnpm
   ```
2. **Configure Supabase**
   - Create a project
   - Run the SQL in `lib/supabase/schema.sql`
   - Copy the Project URL, anon key, and service_role key
3. **Add API Keys**
   ```bash
   cp .env.example .env.local
   ```
   Fill in:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   OPENAI_API_KEY=sk-...
   ODDS_API_KEY=...
   ODDS_API_KEYS=["key1","key2",...]
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
4. **Run Dev Server**
   ```bash
   npm run dev
   ```
5. **Seed Supporting Tables (optional but recommended)**
   ```bash
   npm run ingest:injuries
   npm run ingest:recent-form
   npm run ingest:market-trends
   ```

---

## Automation & Background Jobs

| Workflow | Schedule | Endpoint | Purpose |
| --- | --- | --- | --- |
| `auto-settle.yml` | Every 15 minutes | `POST /api/bets/auto-settle` | Settle finished bets, update bankrolls |
| `line-recording.yml` | Every 30 minutes | `POST /api/lines/record` | Capture line snapshots + mark opening/current |

Both workflows live under `.github/workflows` and authenticate with `CRON_SECRET` + `VERCEL_DOMAIN`. They provide free cron coverage without paying for Vercel Scheduled Functions.

---

## Data Ingestion Scripts

| Command | Description |
| --- | --- |
| `npm run ingest:injuries` | Pulls ESPN injuries into `injury_reports` so the chat can reference availability without leaving Supabase |
| `npm run ingest:recent-form` | Loads recent team performance into `team_recent_form` / splits tables |
| `npm run ingest:market-trends` | Fetches live odds (`live: true`) and stores best moneylines/spreads per game in `market_snapshots` |

These scripts use the Supabase service role key, so keep `.env.local` private.

---

## Environment Variables

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser access to Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side ingestion + cron tasks |
| `OPENAI_API_KEY` | GPT-4o chat + tooling |
| `ODDS_API_KEY` or `ODDS_API_KEYS` | Odds API access (rotation supported) |
| `CRON_SECRET` | Auth token for GitHub Action ? Vercel API calls |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | Analytics |
| `NEXT_PUBLIC_APP_URL` / `VERCEL_URL` | Used for internal API requests |

---

## Responsible Betting & Data Privacy

- Prominent reminders: "All betting involves risk", "Never bet more than you can afford to lose", "Gambling problem? Call 1-800-GAMBLER", and 21+ age gate.
- Supabase RLS ensures users only see their own data; we never sell or share user information.
- GDPR-friendly: users can delete accounts, which cascades their bankroll/bet records.

---

## Roadmap

### Live
- AI chat interface with streaming responses
- Live odds tracking + arbitrage detection
- Bet logging, bankroll snapshots, CLV
- Custom statistical models + projections
- GitHub Actions automation + ingestion scripts

### Next Up
- Advanced backtesting with uploaded CSVs
- Public vs. sharp money overlays
- Mobile-optimized layouts + PWA shell
- Notifications (email/SMS/push) for big line moves
- Voice input + audio answers
- Multi-bankroll support

---

## Troubleshooting

| Issue | Checklist |
| --- | --- |
| "Failed to send message" | Verify `OPENAI_API_KEY`, ensure you restarted the dev server, and confirm Supabase auth cookies exist |
| Odds not updating | Confirm Odds API quota, ensure GitHub Action ran, or run `npm run ingest:market-trends` manually |
| Unauthorized errors | Double-check Supabase credentials + RLS policies; ensure user is logged in |
| Streaming broken | Confirm OpenAI usage limits and that the chat route is deployed on Node runtime (not Edge) |
| Injury data missing | Run `npm run ingest:injuries` or confirm the GitHub Action/cron populating the table |

Before pushing, run `npm run verify` for lint + type safety.

---

## Contributing

<<<<<<< HEAD
This repo serves as a portfolio/demo; feel free to fork and customize. If you submit PRs, include screenshots or Loom links and run `npm run verify` first.
=======
If u modify i will find u. 
>>>>>>> 5e1eaf30690cd272ba896f5db9e0ad5d23c8d677

---

## License

MIT License – see `LICENSE` for details.

---

## Acknowledgments

- The Odds API for real-time prices
- OpenAI for GPT-4o
- Supabase for the backend platform
- Vercel for hosting + previews

---

## Support & Disclaimer

Open an issue for bugs or questions.

**Disclaimer**: Delta AI is for educational and analytical purposes only. It does not place real wagers or hold custody of funds. Users are responsible for complying with local gambling laws.

---

**Built with grit for sports betting enthusiasts.**
