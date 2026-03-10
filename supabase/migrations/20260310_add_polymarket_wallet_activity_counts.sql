-- Migration: Add Polymarket wallet activity counts
-- Created: 2026-03-10
-- Description: Persists lifetime and per-sport trade counts for bettor feed eligibility.

ALTER TABLE polymarket_wallet_summary
  ADD COLUMN IF NOT EXISTS trade_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buy_trade_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sell_trade_count INT NOT NULL DEFAULT 0;

ALTER TABLE polymarket_wallet_sport_summary
  ADD COLUMN IF NOT EXISTS trade_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buy_trade_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sell_trade_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_summary_profitable_feed
  ON polymarket_wallet_summary (last_trade_time DESC, roi_lifetime DESC, total_realized_pnl DESC);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_sport_summary_profitable_feed
  ON polymarket_wallet_sport_summary (sport_label, last_trade_time DESC, roi_lifetime DESC, total_realized_pnl DESC);
