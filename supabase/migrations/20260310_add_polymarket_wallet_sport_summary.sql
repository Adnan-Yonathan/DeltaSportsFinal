-- Migration: Polymarket wallet sport summary
-- Created: 2026-03-10
-- Description: Stores strict sports/esports rollups per wallet + sport label.

CREATE TABLE IF NOT EXISTS polymarket_wallet_sport_summary (
  wallet TEXT NOT NULL REFERENCES polymarket_wallets(wallet) ON DELETE CASCADE,
  sport_label TEXT NOT NULL,
  total_realized_pnl NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_wins INT NOT NULL DEFAULT 0,
  total_losses INT NOT NULL DEFAULT 0,
  total_pushes INT NOT NULL DEFAULT 0,
  settled_markets INT NOT NULL DEFAULT 0,
  settled_trades INT NOT NULL DEFAULT 0,
  gross_profit NUMERIC(18,6) NOT NULL DEFAULT 0,
  gross_loss NUMERIC(18,6) NOT NULL DEFAULT 0,
  roi_lifetime NUMERIC(12,6) NOT NULL DEFAULT 0,
  win_rate NUMERIC(12,6) NOT NULL DEFAULT 0,
  profit_factor NUMERIC(12,6) NOT NULL DEFAULT 0,
  max_drawdown NUMERIC(18,6) NOT NULL DEFAULT 0,
  consistency_90d NUMERIC(12,6) NOT NULL DEFAULT 0,
  sample_quality NUMERIC(12,6) NOT NULL DEFAULT 0,
  risk_adjusted_score NUMERIC(12,6) NOT NULL DEFAULT 0,
  qualification_status TEXT NOT NULL DEFAULT 'watchlist',
  qualification_reason TEXT,
  open_positions_count INT NOT NULL DEFAULT 0,
  open_notional NUMERIC(18,6) NOT NULL DEFAULT 0,
  last_trade_time TIMESTAMPTZ,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet, sport_label)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'polymarket_wallet_sport_summary_qualification_status_check'
  ) THEN
    ALTER TABLE polymarket_wallet_sport_summary
      ADD CONSTRAINT polymarket_wallet_sport_summary_qualification_status_check
      CHECK (qualification_status IN ('qualified', 'watchlist', 'excluded'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_sport_summary_sport
  ON polymarket_wallet_sport_summary (sport_label, risk_adjusted_score DESC);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_sport_summary_wallet
  ON polymarket_wallet_sport_summary (wallet, sport_label);

ALTER TABLE polymarket_wallet_sport_summary ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'polymarket_wallet_sport_summary'
      AND policyname = 'Anyone can view polymarket_wallet_sport_summary'
  ) THEN
    CREATE POLICY "Anyone can view polymarket_wallet_sport_summary"
      ON polymarket_wallet_sport_summary
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'polymarket_wallet_sport_summary'
      AND policyname = 'Service role can manage polymarket_wallet_sport_summary'
  ) THEN
    CREATE POLICY "Service role can manage polymarket_wallet_sport_summary"
      ON polymarket_wallet_sport_summary
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
