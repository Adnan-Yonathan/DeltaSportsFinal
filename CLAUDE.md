# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev           # Start development server (localhost:3000)
npm run build         # Production build
npm run lint          # ESLint
npm run typecheck     # TypeScript validation
npm run verify        # Run both lint and typecheck
```

### Testing

```bash
npm run test:custom-models    # Model normalization tests
npm run test:odds             # Odds helper tests
npm run test:prompts          # Run prompt verification suite
npm run test:prompts:dry      # Dry run prompts (no API calls)

# Single test file
ts-node --project tsconfig.test.json tests/<test-file>.spec.ts
```

### Data Ingestion Scripts

```bash
npm run cache:live              # Cache ESPN live scores
npm run ingest:injuries         # Ingest injury reports
npm run ingest:team-stats       # Ingest team statistics
npm run ingest:player-props     # Ingest player props
npm run ingest:covers-ats       # Ingest ATS records from Covers
npm run ingest:period-scores    # Ingest ESPN period scores
npm run ingest:opponent-stats   # Ingest NBA opponent stats
```

Ingestion scripts require `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`.

## Architecture Overview

### Directory Structure

- **`/app`** - Next.js 14 App Router pages and API routes
- **`/lib`** - Core business logic organized by domain:
  - `api/` - External API integrations (odds-api.io, ESPN)
  - `services/` - Complex domain operations (analysis, aggregations)
  - `llm/` - LLM tooling and prompt templates
  - `statmuse/` - Intent classification and unified query system
  - `models/` - Custom betting model framework
  - `providers/` - Sport-specific data providers (ESPN, Covers, SportsReference)
  - `analysis/` - Betting analytics and edge detection
  - `supabase/` - Database client and auth
  - `utils/` - Odds math, Kelly criterion, props normalization
  - `types/` - Shared TypeScript definitions
- **`/components`** - React UI components (Radix UI based)
- **`/data`** - Static CSV datasets (NBA team/player stats)
- **`/scripts`** - Data ingestion and testing scripts
- **`/tests`** - Test suites

### AI/LLM Integration

The `/api/chat` route implements a multi-layered function calling system:

1. **Intent Classification** (`lib/statmuse/intent-classifier.ts`) - Preprocesses queries, extracts entities, routes simple queries directly to tools (bypasses OpenAI for efficiency)

2. **Unified Tool System** (`lib/statmuse/tools.ts`) - 24 tools covering:
   - Static data (team/player stats from CSV)
   - ESPN live data (scores, injuries, game logs)
   - Aggregations (threshold analysis, rest splits, opponent matchups)
   - Betting analysis (ATS records, defensive splits)

3. **ESPN Tools** (`lib/llm/espn-tools.ts`) - 11 additional tools for ATS, futures, predictors

4. **Function Call Loop** - Up to 3 iterations, full message history passed each time

### Odds Integration

Dual provider strategy with `odds-api.io` (primary) and `the-odds-api.com` (fallback).

Key file: `lib/api/odds-api.ts` handles:
- League normalization
- Bookmaker filtering (default: FanDuel, DraftKings, BetMGM, Caesars, Bet365)
- Market types (H2H, spreads, totals, quarter-specific)
- 30-second cache via Next.js ISR

### Database (Supabase)

Core tables: `users`, `conversations`, `messages`, `bets`, `bankroll_snapshots`, `custom_models`, `lines`

Pattern: Server component client with Row Level Security. Typed via auto-generated `Database` type.

### Custom Betting Models

`lib/models/` implements a statistical model framework:
- Stat normalization with z-scores
- Hierarchy tiers (primary/secondary/tertiary)
- Kelly Criterion calculation
- Confidence intervals via Z-table lookups

## Key Patterns

### Data Flow

```
User Message → Intent Classification
  ├─ Simple Query → Direct Tool Execution (bypass LLM)
  └─ Complex Query → OpenAI Function Calling → Tool Resolution → Response
```

### Service Orchestration

`lib/services/espn-orchestrator.ts` centralizes ESPN data fetching with:
- Cross-endpoint normalization
- Season year calculations (varies by sport)
- Error handling

### Response Formatting

Formatter layer (`lib/llm/response-formatter.ts`, `team-formatter.ts`, `player-formatter.ts`) standardizes outputs for UI consumption.

### Static Data Fallback

CSV files in `/data` contain pre-computed NBA stats. Intent classifier routes these queries directly to static data tools, avoiding API calls.

## Environment Variables

Required: `ODDS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`

Optional: `ELEVENLABS_API_KEY` (voice), `CRON_SECRET` (automation), `ODDS_BOOKMAKERS` (comma-separated list)
