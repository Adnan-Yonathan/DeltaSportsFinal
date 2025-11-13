# Repository Guidelines

## Project Structure & Module Organization
The Next.js App Router lives in `app/`, while reusable UI sits in `components/` and domain logic (Supabase clients, analytics helpers, prompt builders) stays in `lib/`. Reference material and longer-form specs belong in `docs/`. Operational TypeScript scripts live in `scripts/`, data schemas and policies are tracked in `supabase/`, and executable examples plus regression specs are under `tests/`. Copy `.env.example` to `.env.local` before running anything that touches Supabase.

## Build, Test, and Development Commands
Use `npm run dev` for the local server, `npm run build` before deploying, and `npm start` to smoke-test the production bundle. `npm run lint` enforces Next/ESLint rules, `npm run typecheck` runs `tsc --noEmit`, and `npm run verify` chains both. `npm run test:custom-models` executes the current Node-based spec in `tests/custom-models.spec.ts`. Maintenance helpers such as `npm run cleanup:messages` and the `npm run ingest:*` jobs expect valid Supabase credentials and will mutate database tables.

## Coding Style & Naming Conventions
TypeScript is required. Use 2-space indentation, PascalCase for React components, camelCase for hooks/utilities, and SCREAMING_SNAKE_CASE only for environment constants. Keep components server-first; add "use client" explicitly when needed. Styling flows through Tailwind utility classes plus the design tokens in `tailwind.config.ts`. ESLint (via `eslint-config-next`) is the source of truth; run it before every commit.

## Testing Guidelines
Place specs next to the logic they cover inside `tests/` and follow the `*.spec.ts` suffix. Tests currently rely on Node's built-in `assert` helpers run through `ts-node` with `tsconfig.test.json`. Favor deterministic fixtures (see `sampleStats` in `tests/custom-models.spec.ts`) and cover both success paths and failure throws. When adding ingestion scripts, mirror business rules with unit tests or at least a dry-run log assertion.

## Commit & Pull Request Guidelines
Match the existing Git history: short, imperative subjects such as "Remove attachment upload" or "Cast attachment updates". Commits should group by behavior change, not file type. Pull requests need: a concise summary, screenshots or terminal output for UI/data changes, affected tickets, and a checklist of tests/scripts you ran (e.g., `npm run verify`). Call out any new environment variables in the PR description to keep deploys green.

## Configuration & Security Tips
Never commit real Supabase keys; load them through `.env.local` and rely on `middleware.ts` for edge auth enforcement. Keep `supabase/` migrations in sync with production before running ingestion jobs, and rotate service-role keys after sharing logs or artifacts. When reviewing contributions, confirm that observability hooks (PostHog, OpenAI logging) stay wrapped in the helpers inside `lib/` so that secrets never reach the client bundle.
