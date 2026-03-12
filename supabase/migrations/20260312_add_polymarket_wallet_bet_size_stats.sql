-- Migration: Add Polymarket wallet bet size stats
-- Created: 2026-03-12
-- Description: Persists average and median bet size for profitable wallet context.

ALTER TABLE polymarket_wallet_summary
  ADD COLUMN IF NOT EXISTS avg_bet_size NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS median_bet_size NUMERIC(18,6) NOT NULL DEFAULT 0;

ALTER TABLE polymarket_wallet_sport_summary
  ADD COLUMN IF NOT EXISTS avg_bet_size NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS median_bet_size NUMERIC(18,6) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_summary_avg_bet_size
  ON polymarket_wallet_summary (avg_bet_size DESC);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_sport_summary_avg_bet_size
  ON polymarket_wallet_sport_summary (sport_label, avg_bet_size DESC);
