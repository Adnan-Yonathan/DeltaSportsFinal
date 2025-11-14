# Custom Statistical Model Chat Plan

## 1. Goals
- Keep all modeling interactions inside the existing DELTA chat (no separate builders).
- Let users define named models (e.g., `NBA over/under v1`) by describing stats, weights, and confidence levels conversationally.
- Persist models per user so future requests like "apply my NFL rushing model for Derrick Henry" automatically run the saved configuration and return a confidence interval for the requested outcome.

## 2. Current Context
- The chat endpoint (`app/api/chat/route.ts`) already orchestrates OpenAI calls with tool/function support plus bankroll/stat helpers.
- Supabase schema (`lib/supabase/schema.sql`) currently manages users, conversations, bets, messages, and bankroll snapshots but has no persistent store for user-defined models.
- Frontend chat UI (`app/chat/page.tsx` + components) renders a single LLM flow; no extra UI is desired beyond inline confirmations.

## 3. Conversational Flow
1. **Detect intent**
   - Expand the system prompt to advertise "Custom Model Builder" abilities and explain that users can create/apply models by name.
   - Teach the LLM to interpret phrases like "build an NBA totals model" or "apply my MLB strikeout model".
2. **Model creation dialogue**
   - LLM asks for: model name, sport/market, target outcome metric, stats to consider, importance (1�5), directionality, normalization hints, desired confidence level (80/90/95), and optional notes/data sources.
   - Once gathered, LLM echoes a summary back to the user for confirmation ("Sound good to save 'NBA Pace Model' with �?").
   - After user confirmation, LLM calls a new `save_custom_model` tool.
3. **Model recall/application**
   - On phrases like "apply my NBA model for over unders", LLM resolves the model name from Supabase context (fetched server-side and included in the system prompt).
   - If ambiguous or missing, prompt the user to clarify.
   - When a model is found, LLM calls `apply_custom_model` with the model identifier plus any user-provided game context ("Celtics vs Bucks tonight").
   - LLM narrates the computed weighted score, the confidence interval bounds, and any caveats.
4. **Maintenance commands** (optional but included in prompt)
   - "List my models" ? call `list_custom_models`.
   - "Update/delete model" can be v2; start with creation and application only, but keep room for future tools.

## 4. Persistence & Assistant Tools
1. **Database** (`lib/supabase/schema.sql`)
   ```sql
   CREATE TABLE custom_models (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
     model_name TEXT NOT NULL,
     sport_key TEXT NOT NULL,
     market_type TEXT NOT NULL,
     target_metric TEXT NOT NULL,
     confidence_level NUMERIC NOT NULL,
     config JSONB NOT NULL,
     notes TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     last_used_at TIMESTAMPTZ
   );
   ```
   - `config` stores structured stat objects:
     ```json
     {
       "stats": [
         {
           "stat_key": "pace",
           "label": "Team pace last 10",
           "scope": "team|matchup_diff|player",
           "weight": 0.3,
           "direction": "higher_better|lower_better",
           "normalization": "zscore|minmax|raw",
           "sample_source": "last_10_games|season|custom"
         }
       ],
       "data_hints": "...",
       "confidence": 0.9
     }
     ```
   - Index on `(user_id, model_name)` and mirror RLS policies (auth.uid = user_id).
2. **Server helpers** (`lib/models/custom-models.ts`)
   - `saveCustomModel`, `listCustomModels`, `getCustomModelByName`, `touchCustomModelUsage` with validation (unique name, weights sum to 1, allowed confidence values).
3. **LLM tools** (`BANKROLL_FUNCTIONS` ? `ASSISTANT_FUNCTIONS` in `app/api/chat/route.ts`)
   - Keep bankroll tools and add `save_custom_model`, `list_custom_models`, `apply_custom_model`.
   - When composing the system prompt, include a concise list of the user�s recent models so the LLM naturally references them.

## 5. Model Execution & Confidence Interval Engine
1. **Data retrieval**
   - Reuse existing odds/stats helpers (`fetchOdds`, `enrichGamesWithStats`, `getTeamStats`, `get_player_props`).
   - Support scopes: `team`, `matchup_diff`, `player`.
2. **Weights**
   - Map importance 1�5 to raw weights (e.g., 0.5, 1, 2, 3, 4) and normalize to sum 1 before persisting.
3. **Stat normalization**
   - `zscore` (needs league average/std from enrichment), `minmax` (bounded by provided or dataset extremes), `raw` (direct values). Use heuristics or fallbacks when data missing.
4. **Score & interval**
   - Weighted score = S weight � normalized_value.
   - Variance = S weight� � variance_i (stat-provided or default). Effective sample size derives from stat sample windows.
   - Confidence interval = score � z(confidence_level) � standard_error (z = 1.28, 1.64, 1.96).
   - Return structured payload (`score`, `lower`, `upper`, stat breakdown) for the LLM to narrate.
5. **Caching & telemetry**
   - Cache per `(model_id, game context)` during the conversation; set `last_used_at` and emit telemetry events (`model_created`, `model_applied`).

## 6. Frontend & UX
- No new UI surfaces; confirmations live inside the chat stream.
- Optionally enhance the sidebar with a "Saved Models" reminder list that just injects canned prompts.
- Ensure message renderer handles tables for stat breakdowns + bullet summaries of intervals.

## 7. Testing & Monitoring
- **Unit**: helpers (CRUD, validation, weight math) and the interval calculator.
- **Integration**: mocked OpenAI flow for creation + application, Supabase RLS tests preventing cross-user access.
- **Observability**: Structured error logs for failed model applications.

## 8. Implementation Steps
1. Ship Supabase migration + RLS for `custom_models`.
2. Add server helpers and wire context enrichment in `app/api/chat/route.ts`.
3. Build `model-runner` utility for weighted scores/intervals.
4. Update system prompt + OpenAI tool configuration.
5. Optional sidebar reminders + telemetry hooks.
6. Tests + documentation updates.
7. Deploy migration, verify end-to-end in staging, then prod.

