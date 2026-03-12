# Sharp Money Feed Infrastructure Plan

## Goal

Build a bettor-centric sharp money feed that shows recent trades from profitable bettors only.

This should not be a reskinned whale feed. The old whale pipeline is trade-threshold-based and answers a different question: "was this trade big?" The new feed should answer: "did this trade come from a bettor with a proven profitable history, and what context should the user know before following it?"

## Product Rules

1. Only show trades from profitable bettors.
2. Do not require any minimum trade size for feed inclusion.
3. Do not show a `sharp score` or other synthetic product label.
4. Show raw bettor and trade context on every feed item:
   - bettor ROI
   - bettor trade count
   - bettor average bet size
   - this trade's bet size
   - whether this trade is above or below the bettor's average
   - slippage / fill quality
   - freshness and event timing

## Source of Truth

Use the Polymarket wallet pipeline as the foundation:

- `lib/services/polymarket-wallet-ingest.ts`
- `lib/services/polymarket-wallet-rollups.ts`
- `lib/services/polymarket-bettor-feed.ts`
- `app/api/cron/polymarket-bettor-pipeline/route.ts`

Do not build the new feed on top of:

- `lib/services/whale-trade-history.ts`
- `app/api/cron/ingest-whale-trades/route.ts`

Those should remain legacy support code for whale-specific tools only.

## Core Architecture

The new system should have four layers.

### 1. Raw Trade Ingestion

Ingest all tracked bettor fills and normalize them into a trade facts table.

Responsibilities:

- ingest all sports and esports wallet trades for tracked wallets
- normalize market and outcome metadata
- preserve raw trade price, size, notional, side, and timestamps
- attach event date and sport label

### 2. Trade Enrichment

Enrich each trade with bettor-relative and execution-relative context.

Responsibilities:

- compute `bettor_avg_bet_size`
- compute `bettor_median_bet_size`
- compute `bet_size_vs_avg_ratio`
- compute `bet_size_vs_avg_label`
- compute `slippage_bps`
- compute `fill_quality_bps`
- compute `minutes_to_event`
- compute `current_price_cents` and `price_move_since_entry_cents` when available

Sizing is informational here, not part of inclusion logic.

### 3. Bettor Eligibility Rollups

Compute bettor-level profitability and activity status.

Responsibilities:

- calculate lifetime and recent ROI
- calculate realized PnL
- calculate trade counts and settled trade counts
- calculate average and median bet size
- calculate recent activity window
- mark bettor as `eligible`, `watchlist`, or `excluded`

The feed should read from profitable bettors only. `watchlist` can still exist internally for research or QA, but should not leak into the member-facing feed.

### 4. Feed Materialization

Build a feed table or materialized view that contains only recent trades from eligible bettors.

Responsibilities:

- hydrate each row with bettor metrics and trade enrichment
- make feed reads cheap and stable
- avoid expensive on-request recomputation

## Eligibility Model

### Bettor-Level Eligibility

A bettor should be eligible for the feed when all of the following are true:

- positive lifetime ROI
- positive realized PnL
- minimum settled trade sample
- minimum total trade sample
- recent activity within the allowed recency window

Suggested initial thresholds:

- `settled_trade_count >= 20`
- `trade_count >= 30`
- `last_trade_time <= 30 days ago`
- `roi_lifetime > 0`
- `total_realized_pnl > 0`

These thresholds can be tuned later, but they should be applied at the bettor level only.

### Trade-Level Eligibility

A trade should be included when:

- the bettor is eligible
- the trade is recent enough for the feed window
- the event is still upcoming or otherwise relevant

No minimum notional threshold should be used.

## Data Model

### 1. `sharp_bettor_trade_facts`

One row per normalized tracked bettor trade.

Suggested columns:

- `wallet`
- `transaction_hash`
- `trade_time`
- `trade_ts`
- `sport_label`
- `slug`
- `event_slug`
- `title`
- `outcome`
- `outcome_index`
- `side`
- `size`
- `price`
- `notional`
- `event_date`
- `event_start_time`
- `inserted_at`

This can be backed by `polymarket_wallet_trades` if extending that table is simpler than introducing a new physical table.

### 2. `sharp_bettor_trade_enrichment`

One row per trade with derived context fields.

Suggested columns:

- `wallet`
- `transaction_hash`
- `bettor_avg_bet_size`
- `bettor_median_bet_size`
- `bet_size_vs_avg_ratio`
- `bet_size_vs_avg_label`
- `bettor_trade_percentile`
- `slippage_bps`
- `fill_quality_bps`
- `pre_trade_mid_price`
- `post_trade_mid_price`
- `current_price_cents`
- `price_move_since_entry_cents`
- `minutes_to_event`
- `updated_at`

### 3. `sharp_bettor_summary`

Current bettor-level rollup table.

Suggested columns:

- `wallet`
- `display_name`
- `roi_lifetime`
- `roi_30d`
- `total_realized_pnl`
- `trade_count`
- `settled_trade_count`
- `buy_trade_count`
- `sell_trade_count`
- `avg_bet_size`
- `median_bet_size`
- `avg_slippage_bps`
- `avg_fill_quality_bps`
- `last_trade_time`
- `eligibility_status`
- `eligibility_reason`
- `last_computed_at`

This can likely extend `polymarket_wallet_summary` rather than creating a brand new table.

### 4. `sharp_money_feed_items`

Materialized feed rows for the app.

Suggested columns:

- `wallet`
- `transaction_hash`
- `display_name`
- `sport_label`
- `title`
- `outcome`
- `side`
- `trade_time`
- `event_start_time`
- `notional`
- `bettor_avg_bet_size`
- `bet_size_vs_avg_ratio`
- `bet_size_vs_avg_label`
- `roi_lifetime`
- `trade_count`
- `settled_trade_count`
- `slippage_bps`
- `fill_quality_bps`
- `current_price_cents`
- `price_move_since_entry_cents`
- `is_feed_eligible`
- `inserted_at`

## Feed Sorting

The feed should not be ranked by a hidden sharp score.

Recommended default sort:

1. newest eligible trades first
2. upcoming events before stale events
3. optionally break ties by bettor ROI or trade recency

Alternative secondary sorts to support later:

- `recent ROI`
- `largest vs average`
- `lowest slippage`

But the default product should remain simple and transparent.

## API Contracts

### `GET /api/sharp-money-feed`

Purpose:

- return recent trades from profitable bettors only

Query params:

- `sport`
- `limit`
- `cursor`
- `dateWindow`

Response shape:

```ts
type SharpMoneyFeedItem = {
  wallet: string
  display_name: string | null
  sport_label: string | null
  title: string | null
  outcome: string | null
  side: 'BUY' | 'SELL' | null
  trade_time: string
  event_start_time: string | null
  notional: number | null
  bettor_avg_bet_size: number | null
  bet_size_vs_avg_ratio: number | null
  bet_size_vs_avg_label: 'above_average' | 'near_average' | 'below_average' | null
  roi_lifetime: number
  trade_count: number
  settled_trade_count: number
  slippage_bps: number | null
  fill_quality_bps: number | null
  current_price_cents: number | null
  price_move_since_entry_cents: number | null
}
```

### `GET /api/sharp-money-bettors`

Purpose:

- return bettor summaries for leaderboard or filter panels

Response fields:

- display name
- ROI
- trade count
- settled trade count
- average bet size
- median bet size
- recent activity

No sharp score in the response.

### `GET /api/sharp-money-bettors/:wallet`

Purpose:

- bettor detail page or drawer

Response sections:

- profile
- profitability metrics
- bet sizing profile
- recent trades
- open positions

## UI Requirements

### Feed Card

Each feed card should show:

- bettor name
- ROI
- total trades
- average bet size
- this bet size
- above/below average label
- slippage
- market title and outcome
- trade timestamp
- time to event

Examples of acceptable copy:

- `Avg bet size: $184`
- `This bet: $265`
- `44% above average`
- `Slippage: 8 bps`

Examples of copy to avoid:

- `Sharp score: 82`
- `Elite sharp`
- `A+ bettor`

### Filters

Recommended filters:

- sport
- date window
- ROI band
- trade count band
- above/below average

Do not include a minimum bet-size filter as a core gate for the feed itself.

## Jobs and Scheduling

### Job 1. Wallet Discovery

Existing pattern can remain:

- discover candidate sports bettors
- refresh tracked wallet set

### Job 2. Trade Ingestion

Existing pattern can remain:

- ingest new wallet trades incrementally

### Job 3. Trade Enrichment

New job:

- compute trade-relative context and execution fields
- update current price drift where needed

### Job 4. Bettor Rollups

Extend current rollup job:

- compute profitability metrics
- compute sizing metrics
- compute eligibility status

### Job 5. Feed Materialization

New job:

- write recent eligible trades into `sharp_money_feed_items`

## Implementation Phases

### Phase 1. Refactor Existing Bettor Pipeline

- remove any product dependency on qualified/risk score display
- make profitable bettor eligibility explicit
- make watchlist/fallback behavior internal only

### Phase 2. Add Sizing Context

- compute average and median bet size per bettor
- attach trade-vs-average context to feed rows
- expose `above_average` / `below_average` labels

### Phase 3. Add Execution Metrics

- compute slippage and fill quality
- add price drift since entry
- display these in feed cards

### Phase 4. Materialize Feed

- create stable feed output table or cached query path
- replace locked page with real data UI

## Testing Requirements

Add tests for:

- profitable bettor eligibility rules
- no trade-size filter on feed inclusion
- trade-vs-average label logic
- feed payload fields for average bet size and slippage
- exclusion of stale or unqualified bettors

Relevant existing tests to extend:

- `tests/polymarket-wallet-rollups.spec.ts`
- `tests/polymarket-bettor-feed.spec.ts`

## Open Questions

1. Should profitability be lifetime-only, 30-day-only, or both?
2. Should open positions be shown in the first release, or bettor history only?
3. Do we want event filtering to exclude trades that are too close to start to be actionable?
4. Do we want to support esports from day one or only traditional sports first?

## Summary Decision

The feed should be transparent, bettor-centric, and evidence-led.

That means:

- profitable bettors only
- no minimum size requirement for feed inclusion
- no sharp score in the product
- show average bet size and trade-vs-average context on every trade
- add slippage and execution metrics as first-class data points
