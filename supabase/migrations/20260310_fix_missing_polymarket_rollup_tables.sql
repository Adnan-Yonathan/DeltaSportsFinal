-- Migration: Ensure Polymarket rollup tables exist in environments with schema drift
-- Created: 2026-03-10
-- Description: Recreates missing rollup tables/policies that older environments may not have.

CREATE TABLE IF NOT EXISTS polymarket_wallet_market_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL REFERENCES polymarket_wallets(wallet) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  winning_outcome_index INT,
  net_winning_shares NUMERIC(18,6),
  net_losing_shares NUMERIC(18,6),
  result TEXT CHECK (result IN ('win', 'loss', 'push')),
  realized_pnl NUMERIC(18,6),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wallet, slug)
);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_market_results_wallet
  ON polymarket_wallet_market_results (wallet);
CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_market_results_result
  ON polymarket_wallet_market_results (result);

COMMENT ON TABLE polymarket_wallet_market_results IS 'Per-market results for tracked Polymarket wallets';

CREATE TABLE IF NOT EXISTS polymarket_wallet_daily_pnl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL REFERENCES polymarket_wallets(wallet) ON DELETE CASCADE,
  pnl_date DATE NOT NULL,
  realized_pnl NUMERIC(18,6) NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  pushes INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wallet, pnl_date)
);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_daily_pnl_wallet
  ON polymarket_wallet_daily_pnl (wallet, pnl_date DESC);

COMMENT ON TABLE polymarket_wallet_daily_pnl IS 'Daily realized P/L rollups for tracked Polymarket wallets';

ALTER TABLE polymarket_wallet_market_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE polymarket_wallet_daily_pnl ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'polymarket_wallet_market_results'
      AND policyname = 'Anyone can view polymarket_wallet_market_results'
  ) THEN
    CREATE POLICY "Anyone can view polymarket_wallet_market_results"
      ON polymarket_wallet_market_results
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
      AND tablename = 'polymarket_wallet_market_results'
      AND policyname = 'Service role can manage polymarket_wallet_market_results'
  ) THEN
    CREATE POLICY "Service role can manage polymarket_wallet_market_results"
      ON polymarket_wallet_market_results
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'polymarket_wallet_daily_pnl'
      AND policyname = 'Anyone can view polymarket_wallet_daily_pnl'
  ) THEN
    CREATE POLICY "Anyone can view polymarket_wallet_daily_pnl"
      ON polymarket_wallet_daily_pnl
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
      AND tablename = 'polymarket_wallet_daily_pnl'
      AND policyname = 'Service role can manage polymarket_wallet_daily_pnl'
  ) THEN
    CREATE POLICY "Service role can manage polymarket_wallet_daily_pnl"
      ON polymarket_wallet_daily_pnl
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
