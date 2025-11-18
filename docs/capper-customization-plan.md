# Capper Customization Build Plan

This doc captures the implementation plan for a fully customizable capper GPT, focusing on ingestion, rules, backtests, simulations, vetting, and bankroll guardrails. It is structured so we can implement iteratively without breaking existing flows.

## 1) Proprietary Data Ingestion
- **What:** User-scoped projections/edges (player props, team totals, distributions, custom metrics). Store per-user, per-model.
- **How:** Supabase tables:
  - `user_projections` (user_id, model_id, entity_type player/team, entity_id, metric (e.g., pts, rebounds), value, distribution_json, as_of).
  - `user_edges` (user_id, model_id, market, book, odds, edge_value, notes, as_of).
- **API:** `/api/ingest/projections` and `/api/ingest/edges` (POST, GET). Require auth, return upserted rows. Accept batch payloads. Support `as_of` versioning.
- **Chat hooks:** Add tools `ingest_projections`, `ingest_edges`, `get_projections`. Limit payload sizes; chunk uploads.

## 2) Rule Engine (Capper Laws)
- **What:** Encode “laws of value” as condition/action rules attached to a model.
- **Schema:** `model_rules` (model_id, user_id, name, conditions_json, actions_json, priority, enabled). Conditions support thresholds (line_move >= 2.5 in 20m), flags (player_returning_from_injury), book filters, EV/CLV cutoffs. Actions: classify (steam), boost/penalize edges, exclude.
- **Runtime:** Extend research runner to load rules for the model, evaluate per opportunity, and log triggered rules in the result (for audit). Keep a hard cap on rules per model (e.g., 25) and evaluation timeout.

## 3) Backtest Runner
- **What:** Replay historical odds vs. user projections/rules over date ranges; export ROI/CLV/vol stats.
- **Inputs:** model_id, date_range, sports/markets, projections version, ruleset.
- **Engine:** Fetch historical odds snapshots (once we store them) + user projections; run rule engine; compute hit-rate, ROI, CLV bp, drawdown, volatility (stdev of returns).
- **Persistence:** `backtests` (user_id, model_id, status, params, started_at, completed_at, summary_json, metrics_json). Store results for reuse.
- **API:** `/api/backtests` (POST to start, GET to fetch status/results).
- **Chat tool:** `run_backtest` with progress + result summary.

## 4) Scenario Simulation (“What-if”)
- **What:** Toggle inputs (injury status, pace/minutes delta, weather) to reweight projections/edges.
- **Implementation:** Add a lightweight simulator that adjusts user projections by scenario deltas (e.g., minutes *= 0.9, pace +8%). Feed adjusted projections into the rule/edge calculator and return deltas (floor/median/ceiling if provided).
- **API/tool:** `/api/simulate` + chat tool `simulate_scenario` (model_id, scenario overrides, targets list).

## 5) Pick Vetting Pipeline
- **What:** Gate picks using EV/CLV thresholds, variance tolerance, injury volatility, market sentiment alignment, and book availability; classify Green/Yellow/Red.
- **Implementation:** Add a vetting pass that consumes outputs from research runner + rules, then applies thresholds and labels. Include reasons and any triggered rules. Enforce book availability list.
- **Output:** Attach vetting results to research/backtest outputs; expose in chat.

## 6) Bankroll-Aware Decisioning
- **What:** Exposure caps per slate/sport/book, Kelly variants with downside protection, and alerts on over-exposure.
- **Implementation:** Add bankroll profile per user (risk appetite, unit size, Kelly fraction). During vetting, compute suggested stake, check exposure caps, and log warnings. Optional setting to suppress suggestions if caps breached.

## Safeguards & Limits
- Timeouts on all heavy fetches; chunked ingestion; per-user quotas.
- Feature flags to disable ingestion/backtests if upstream/historical odds are unavailable.
- Logging tables for rule triggers, backtest runs, and errors.

## Sequenced Implementation (recommended order)
1) **Ingestion APIs + tables** for projections/edges; chat tools to ingest/fetch.
2) **Rule engine** with schema + evaluation in research runner; log triggered rules.
3) **Backtest runner** using stored odds snapshots + user projections/rules; persist results.
4) **Scenario simulation** layer to adjust projections and rerun rules.
5) **Vetting/classification** step with Green/Yellow/Red and reason codes.
6) **Bankroll guardrails** (exposure caps + Kelly variants) integrated into vetting output.

This plan keeps current flows intact while adding the scaffolding needed for maximum customizability. Appendices (schemas/payloads) can be added as we implement each step.
