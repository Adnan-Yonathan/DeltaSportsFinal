-- Migration: Polymarket bettor intelligence feed schema
-- Created: 2026-03-02
-- Description: Adds ranking/qualification metrics, wallet discovery metadata,
--              open positions table, and sports classification provenance.

-- =============================================================================
-- 1. Wallet metadata + tracking controls
-- =============================================================================
ALTER TABLE polymarket_wallets
  ADD COLUMN IF NOT EXISTS tracking_state TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS last_discovered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_name TEXT,
  ADD COLUMN IF NOT EXISTS pseudonym TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'polymarket_wallets_tracking_state_check'
  ) THEN
    ALTER TABLE polymarket_wallets
      ADD CONSTRAINT polymarket_wallets_tracking_state_check
      CHECK (tracking_state IN ('auto', 'manual_include', 'manual_exclude'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_polymarket_wallets_tracking_state
  ON polymarket_wallets (tracking_state);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallets_last_discovered_at
  ON polymarket_wallets (last_discovered_at DESC);

-- =============================================================================
-- 2. Wallet summary analytics fields
-- =============================================================================
ALTER TABLE polymarket_wallet_summary
  ADD COLUMN IF NOT EXISTS settled_markets INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settled_trades INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_loss NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS roi_lifetime NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS win_rate NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_factor NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_drawdown NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consistency_90d NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sample_quality NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_adjusted_score NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualification_status TEXT NOT NULL DEFAULT 'watchlist',
  ADD COLUMN IF NOT EXISTS qualification_reason TEXT,
  ADD COLUMN IF NOT EXISTS open_positions_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_notional NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_trade_time TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'polymarket_wallet_summary_qualification_status_check'
  ) THEN
    ALTER TABLE polymarket_wallet_summary
      ADD CONSTRAINT polymarket_wallet_summary_qualification_status_check
      CHECK (qualification_status IN ('qualified', 'watchlist', 'excluded'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_summary_qualification
  ON polymarket_wallet_summary (qualification_status, risk_adjusted_score DESC);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_summary_risk_score
  ON polymarket_wallet_summary (risk_adjusted_score DESC, total_realized_pnl DESC);

-- =============================================================================
-- 3. Open positions table
-- =============================================================================
CREATE TABLE IF NOT EXISTS polymarket_wallet_open_positions (
  wallet TEXT NOT NULL REFERENCES polymarket_wallets(wallet) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  event_slug TEXT,
  sport_label TEXT,
  title TEXT,
  outcome TEXT,
  outcome_index INT NOT NULL,
  net_shares NUMERIC(18,6) NOT NULL DEFAULT 0,
  avg_entry_price NUMERIC(12,6),
  avg_entry_american_odds INT,
  stake_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
  potential_payout_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
  last_trade_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet, slug, outcome_index)
);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_open_positions_wallet
  ON polymarket_wallet_open_positions (wallet);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_open_positions_sport_updated
  ON polymarket_wallet_open_positions (sport_label, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_open_positions_updated
  ON polymarket_wallet_open_positions (updated_at DESC);

COMMENT ON TABLE polymarket_wallet_open_positions IS 'Current sports-only open positions per tracked Polymarket wallet';

-- =============================================================================
-- 4. Sports classification provenance
-- =============================================================================
ALTER TABLE polymarket_wallet_trades
  ADD COLUMN IF NOT EXISTS sports_classification_source TEXT,
  ADD COLUMN IF NOT EXISTS sports_classification_confidence NUMERIC(8,6);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_trades_classification
  ON polymarket_wallet_trades (sports_classification_source, trade_time DESC);

-- =============================================================================
-- 5. RLS for new table
-- =============================================================================
ALTER TABLE polymarket_wallet_open_positions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'polymarket_wallet_open_positions'
      AND policyname = 'Anyone can view polymarket_wallet_open_positions'
  ) THEN
    CREATE POLICY "Anyone can view polymarket_wallet_open_positions"
      ON polymarket_wallet_open_positions
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
      AND tablename = 'polymarket_wallet_open_positions'
      AND policyname = 'Service role can manage polymarket_wallet_open_positions'
  ) THEN
    CREATE POLICY "Service role can manage polymarket_wallet_open_positions"
      ON polymarket_wallet_open_positions
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;