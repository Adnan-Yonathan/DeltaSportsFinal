# Delta AI - The First Conversational Sports Betting Copilot

<div align="center">

Your AI-powered sports betting assistant for odds discovery, advanced analytics, and intelligent market research.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/)

</div>

---

## Overview

Delta AI is a Next.js 14 + Supabase application that combines a streaming AI copilot with comprehensive sports betting intelligence. Get real-time odds from every major US sportsbook, advanced player and team analytics, live betting projections, edge factors analysis, and betting trends - all through natural language conversation.

---

## Recent Updates

- **Collapsible UI**: Chat history and live scores sidebars start collapsed on desktop for maximum focus
- **Capability Cards**: 6 interactive capability cards replace traditional prompts (Player Profiles, Team Profiles, Line Shopping, Edge Factors, Live Betting, Betting Trends)
- **News Ticker**: Continuous scrolling news strip with quadrant league selector (NBA, NFL, MLB, NHL)
- **Centered Chat Layout**: Improved layout with full-width navbar and centered chat interface
- **Enhanced Live Scores**: Wider desktop layout with four cards per row, larger cards, and centered controls
- **Betting Splits**: Chat can answer "what % of bets/money is on each side" with public vs sharp indicators
- **Team Insights**: Single-game odds replies include live team stats (streak, last 10, PPG/PAPG, shooting %, rebounds, assists)

---

## Core Capabilities

### 🏀 Player Profiles
Access comprehensive player statistics, advanced metrics, and projections versus specific teams. Ask about player performance, shooting splits, recent trends, and matchup history.

### 🏈 Team Profiles
Get detailed team statistics, offensive/defensive ratings, pace of play, clutch performance, and situational splits. Understand how teams perform at home vs away, after rest, and in different scenarios.

### 📊 Line Shopping
Compare lines from every major US sportsbook for any sporting event. Find the best spreads, moneylines, and totals across FanDuel, DraftKings, BetMGM, Caesars, and more.

### 🎯 Edge Factors
Analyze advanced factors with high impact on game outcomes: travel distance, rest advantage, back-to-back performance, player matchups, and historical situational records.

### ⚡ Live Betting
Get AI-projected live spreads based on real-time game flow, momentum shifts, timeout situations, player performance, and team execution relative to expectations.

### 📈 Betting Trends
Track recent records against the spread, prop covering percentages, and public vs sharp money splits. See where the smart money is moving and identify line value.

---

## What It Does

- **Conversational AI Chat**: Natural language interface at `/chat` with streaming GPT-4o responses, conversation history, and voice input support via ElevenLabs
- **Odds Aggregation**: Real-time odds from Odds-API.io covering all major sportsbooks with best-price summaries, arbitrage detection, and line movement tracking
- **Live Scores & Stats**: Real-time game scores, player stats, lineups, and box scores for NBA, NFL, NHL, CFB, and NCAAB at `/live-scores`
- **Player Props**: Aggregated player prop markets with best over/under books across multiple sportsbooks
- **Betting Splits**: Public vs sharp money indicators showing ticket% and handle% for spreads, moneylines, and totals
- **Injuries & News**: Latest injury reports, team news, and game context integrated into AI responses
- **Custom Models**: Build and save prediction models with weighted stats, research parameters, and data uploads
- **Market Trends**: Track line movements, sharp action, and market inefficiencies across sports

---

## Selected API Surface

### Odds & Markets
- `/api/odds/games` - Get odds for upcoming games
- `/api/odds/event` - Single event odds with all books
- `/api/odds/multi` - Batch odds requests
- `/api/odds/best` - Best available lines per market
- `/api/odds/arbitrage` - Arbitrage opportunities
- `/api/player-props` - Player prop markets

### Live Data
- `/api/live-scores` - Real-time game scores
- `/api/live-scores/cache` - Cached ESPN data
- `/api/llm/live/*` - LLM-optimized live endpoints

### Events & Schedules
- `/api/events` - Upcoming events by sport
- `/api/events/live` - Live games
- `/api/events/search` - Search events
- `/api/sports` - Available sports/leagues

### Lines & Trends
- `/api/lines/record` - Record line snapshots
- `/api/lines/history` - Historical line data
- `/api/lines/sharp-moves` - Sharp money detection

### Models & Research
- `/api/models/upload` - Upload model data files
- Chat tools for saving/listing/applying custom models

### Utilities
- `/api/probability` - Probability & EV calculations
- `/api/transcribe` - Voice to text (ElevenLabs)
- `/api/chat` - AI assistant endpoint
- `/api/injuries` - Injury reports
- `/api/stats` - Team statistics

Most endpoints require Supabase authentication. Cron-style automation routes require `CRON_SECRET` or API key headers.

---

## Tech Stack

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 14 App Router, React, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Next.js API Routes (Node runtime for chat/models; Edge for odds/props) |
| Database | Supabase Postgres with Row Level Security |
| Storage | Supabase Storage for model files |
| Auth | Supabase Auth (email/password, OAuth) |
| AI | OpenAI GPT-4o / GPT-4o-mini |
| Sports Data | Odds-API.io (odds/props), ESPN (live scores), Sports-Stats API |
| Voice | ElevenLabs Speech-to-Text |
| Charts | Recharts for data visualization |

---

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

### Required Variables

| Variable | Purpose |
| --- | --- |
| `ODDS_API_KEY` | Odds-API.io API key for odds data |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server operations |
| `OPENAI_API_KEY` | OpenAI API key for chat assistant |

### Stripe Configuration (Subscriptions)

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe secret key (starts with `sk_live_` or `sk_test_`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (starts with `whsec_`) |
| `STRIPE_PRICE_PRO_TRIAL` | Price ID for Pro trial plan |
| `STRIPE_PRICE_PRO_MONTHLY` | Price ID for Pro monthly plan |
| `STRIPE_PRICE_PRO_ANNUAL` | Price ID for Pro annual plan |
| `STRIPE_PRICE_UNLIMITED_MONTHLY` | Price ID for Unlimited monthly plan |
| `STRIPE_PRICE_UNLIMITED_ANNUAL` | Price ID for Unlimited annual plan |

**Important**: Stripe price IDs must start with `price_` (e.g., `price_1ABC123xyz`). Product IDs (`prod_*`) will not work. To get price IDs:
1. Go to Stripe Dashboard → Products
2. Select or create a product
3. Add a price (set amount, billing interval, trial period if needed)
4. Copy the price ID from the price details

### Optional Variables

| Variable | Purpose |
| --- | --- |
| `ODDS_PROVIDER` | Odds provider (default: `odds-api-io`) |
| `ODDS_BOOKMAKERS` | Comma-separated bookmaker list |
| `ODDS_REGIONS` | Regional bookmaker filtering |
| `ELEVENLABS_API_KEY` | Voice transcription (required for voice input) |
| `CRON_SECRET` | Protects automation endpoints |
| `NEXT_PUBLIC_APP_URL` | Base URL for link generation |

---

## Development

### Installation & Running

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`

### Build & Production

```bash
npm run build
npm start
```

### Quality Checks

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript validation
npm run verify      # Run all checks
```

### Testing

```bash
npm run test:custom-models    # Model normalization tests
npm run test:odds             # Odds helper tests
ts-node --project tsconfig.test.json tests/dk-splits.spec.ts  # Betting splits
```

### Data Ingestion Scripts

```bash
npm run cache:live              # Cache ESPN live scores
npm run ingest:injuries         # Ingest injury reports
npm run ingest:team-stats       # Ingest team statistics
npm run ingest:player-props     # Ingest player props
```

**Note**: Ingestion scripts require `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`. Betting splits and current market snapshots are populated automatically from SportsBettingDime (SBD) via the live aggregator and the `POST /api/lines/record` cron job, so those datasets no longer need manual scripts.

---

## Troubleshooting

### Odds Rate Limits
- Monitor Odds-API.io headers (`x-ratelimit-*`)
- Reduce `ODDS_BOOKMAKERS` count for fewer books
- Use `/api/odds/multi` for batch requests
- Cache line snapshots when possible

### Empty Data
- Verify sport/league keys match API expectations
- Check timezone filters for schedule queries
- Confirm provider has active events
- Use `live=true` parameter for in-progress games

### Live Data Gaps
- Run ingestion scripts to refresh cached data
- Injury and form data falls back to live fetches when cache is empty
- Set up cron jobs for regular data updates

### Betting Splits Unavailable
- Not all events publish betting splits
- Specify sport or near-term matchups for better results
- Major markets (NFL, NBA) have better coverage

### Voice Input Issues
- Ensure `ELEVENLABS_API_KEY` is configured
- Browser must allow microphone access
- Check browser console for permission errors

---

## Key Features

### Chat Interface
- Natural language queries for all sports data
- Streaming responses with real-time updates
- Conversation history with auto-titling
- Voice input support
- Function calling for complex operations

### Live Scores
- Real-time scores for NBA, NFL, NHL, CFB, NCAAB
- Player statistics and box scores
- Team lineups and rotation tracking
- Game details and play-by-play
- Desktop/mobile optimized layouts

### Odds Shopping
- Compare 10+ major US sportsbooks
- Best available lines highlighted
- Arbitrage opportunity detection
- Line movement tracking
- Historical line data

### Analytics & Insights
- Player performance metrics
- Team efficiency ratings
- Situational splits and trends
- Rest/travel impact analysis
- Public vs sharp money indicators

### Custom Models
- Build prediction models with weighted stats
- Upload CSV/Excel/PDF/TXT data
- Save and reuse model configurations
- Research mode for market scanning

---

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Vercel CLI

```bash
vercel --prod
```

### Environment Variables
All required environment variables must be configured in Vercel project settings.

---

## Architecture

### Frontend Routes
- `/` - Landing page
- `/chat` - AI chat interface
- `/live-scores` - Live scores dashboard
- `/models` - Custom models manager
- `/models/new` - Create new model
- `/pricing` - Pricing page
- `/promos` - Sportsbook promos
- `/auth/*` - Authentication pages

### API Routes
- `/api/chat` - AI chat endpoint (streaming)
- `/api/odds/*` - Odds and betting markets
- `/api/live-scores/*` - Live game data
- `/api/player-props` - Player proposition markets
- `/api/events/*` - Event schedules
- `/api/lines/*` - Line history and movements
- `/api/models/*` - Custom model operations
- `/api/transcribe` - Voice to text

### Database Schema
- `conversations` - Chat conversation metadata
- `messages` - Chat message history
- `users` - User profiles and preferences
- `custom_models` - Saved prediction models
- `research_models` - Market research configurations
- `odds_snapshots` - Cached odds data
- `line_history` - Historical line movements

---

## Notes

- Delta AI surfaces data, analytics, and tooling - not gambling advice
- Use responsibly and within legal jurisdictions
- All odds and data are for informational purposes
- Past performance does not guarantee future results
- Always gamble responsibly

---

## License

Proprietary - All rights reserved

---

## Support

For issues, questions, or feature requests, please contact the development team.
