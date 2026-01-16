-- Migration: Add Polymarket Wallet Tracking Tables
-- Created: 2026-01-15
-- Description: Stores Polymarket wallet trades, outcomes, and tracked wallets.

-- =============================================================================
-- 1. Tracked Wallets
-- =============================================================================
CREATE TABLE IF NOT EXISTS polymarket_wallets (
  wallet TEXT PRIMARY KEY,
  source TEXT DEFAULT 'detector',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  last_trade_ts BIGINT,
  backfill_completed BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE polymarket_wallets IS 'Tracked Polymarket wallets sourced from detector events';

-- =============================================================================
-- 2. Wallet Trades
-- =============================================================================
CREATE TABLE IF NOT EXISTS polymarket_wallet_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL REFERENCES polymarket_wallets(wallet) ON DELETE CASCADE,
  transaction_hash TEXT NOT NULL UNIQUE,
  trade_time TIMESTAMPTZ NOT NULL,
  trade_ts BIGINT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  size NUMERIC(18,6),
  price NUMERIC(10,6),
  notional NUMERIC(18,6),
  slug TEXT NOT NULL,
  event_slug TEXT,
  title TEXT,
  outcome TEXT,
  outcome_index INT,
  condition_id TEXT,
  asset TEXT,
  proxy_wallet TEXT,
  is_sports BOOLEAN NOT NULL DEFAULT false,
  sport_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_trades_wallet_time
  ON polymarket_wallet_trades (wallet, trade_time DESC);
CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_trades_slug
  ON polymarket_wallet_trades (slug);
CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_trades_sports
  ON polymarket_wallet_trades (is_sports, trade_time DESC);

COMMENT ON TABLE polymarket_wallet_trades IS 'Raw Polymarket trades for tracked wallets';

-- =============================================================================
-- 3. Market Outcomes Cache
-- =============================================================================
CREATE TABLE IF NOT EXISTS polymarket_market_outcomes (
  slug TEXT PRIMARY KEY,
  market_id TEXT,
  resolved BOOLEAN,
  winning_outcome_index INT,
  winning_outcome TEXT,
  outcomes JSONB,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polymarket_market_outcomes_resolved
  ON polymarket_market_outcomes (resolved);

COMMENT ON TABLE polymarket_market_outcomes IS 'Cached Polymarket market outcomes by slug';

-- =============================================================================
-- 4. Enable Row Level Security
-- =============================================================================
ALTER TABLE polymarket_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE polymarket_wallet_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE polymarket_market_outcomes ENABLE ROW LEVEL SECURITY;

-- RLS Policies - read-only for all, insert/update for service role
CREATE POLICY "Anyone can view polymarket_wallets" ON polymarket_wallets
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view polymarket_wallet_trades" ON polymarket_wallet_trades
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view polymarket_market_outcomes" ON polymarket_market_outcomes
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage polymarket_wallets" ON polymarket_wallets
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage polymarket_wallet_trades" ON polymarket_wallet_trades
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage polymarket_market_outcomes" ON polymarket_market_outcomes
  FOR ALL USING (true) WITH CHECK (true);
