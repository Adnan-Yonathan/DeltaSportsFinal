-- Migration: Add Polymarket Wallet Rollups
-- Created: 2026-01-15
-- Description: Stores wallet market results and daily P/L rollups.

-- =============================================================================
-- 1. Market Results
-- =============================================================================
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

-- =============================================================================
-- 2. Daily PnL Rollups
-- =============================================================================
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

-- =============================================================================
-- 3. Wallet Summary
-- =============================================================================
CREATE TABLE IF NOT EXISTS polymarket_wallet_summary (
  wallet TEXT PRIMARY KEY REFERENCES polymarket_wallets(wallet) ON DELETE CASCADE,
  total_realized_pnl NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_wins INT NOT NULL DEFAULT 0,
  total_losses INT NOT NULL DEFAULT 0,
  total_pushes INT NOT NULL DEFAULT 0,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE polymarket_wallet_summary IS 'Lifetime realized P/L + record for tracked Polymarket wallets';

-- =============================================================================
-- 4. Market Outcomes Updates
-- =============================================================================
ALTER TABLE polymarket_market_outcomes
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_polymarket_market_outcomes_resolved_at
  ON polymarket_market_outcomes (resolved_at);

-- =============================================================================
-- 5. Enable Row Level Security
-- =============================================================================
ALTER TABLE polymarket_wallet_market_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE polymarket_wallet_daily_pnl ENABLE ROW LEVEL SECURITY;
ALTER TABLE polymarket_wallet_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies - read-only for all, insert/update for service role
CREATE POLICY "Anyone can view polymarket_wallet_market_results" ON polymarket_wallet_market_results
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view polymarket_wallet_daily_pnl" ON polymarket_wallet_daily_pnl
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view polymarket_wallet_summary" ON polymarket_wallet_summary
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage polymarket_wallet_market_results" ON polymarket_wallet_market_results
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage polymarket_wallet_daily_pnl" ON polymarket_wallet_daily_pnl
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage polymarket_wallet_summary" ON polymarket_wallet_summary
  FOR ALL USING (true) WITH CHECK (true);
