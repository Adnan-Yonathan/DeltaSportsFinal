-- Migration: Add Whale Trades Daily Table
-- Created: 2026-01-25
-- Description: Persistent daily storage for whale/sharp bets with live game detection.
--              Allows users to see all trades placed throughout the day, even after
--              closing and reopening the app.

-- =============================================================================
-- 1. Whale Trades Daily Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS whale_trades_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Trade identification (for deduplication)
  trade_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('kalshi', 'polymarket')),

  -- Date partitioning
  trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  trade_time TIMESTAMPTZ NOT NULL,

  -- Market info
  market_title TEXT NOT NULL,
  outcome TEXT NOT NULL,
  sport TEXT,
  ticker TEXT,
  slug TEXT,
  outcome_index INT,
  side TEXT,
  event_date DATE,

  -- Trade details
  notional NUMERIC NOT NULL,
  contracts NUMERIC,
  price_cents INT,
  american_odds INT,

  -- Wallet tracking (Polymarket)
  proxy_wallet TEXT,

  -- Sharp analysis
  sharp_strength INT,

  -- Live game detection
  is_live BOOLEAN DEFAULT FALSE,
  game_status TEXT,

  -- Resolution tracking (updated later)
  result TEXT CHECK (result IN ('win', 'loss', 'push', 'pending')),
  pnl NUMERIC,
  current_price_cents INT,
  resolved_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate trades
  UNIQUE (source, trade_id)
);

-- =============================================================================
-- 2. Indexes for efficient queries
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_whale_trades_daily_date ON whale_trades_daily (trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_whale_trades_daily_sport ON whale_trades_daily (sport, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_whale_trades_daily_time ON whale_trades_daily (trade_time DESC);
CREATE INDEX IF NOT EXISTS idx_whale_trades_daily_wallet ON whale_trades_daily (proxy_wallet) WHERE proxy_wallet IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whale_trades_daily_notional ON whale_trades_daily (notional DESC);
CREATE INDEX IF NOT EXISTS idx_whale_trades_daily_live ON whale_trades_daily (is_live) WHERE is_live = TRUE;

-- =============================================================================
-- 3. Enable Row Level Security
-- =============================================================================
ALTER TABLE whale_trades_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read whale trades"
  ON whale_trades_daily FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert/update whale trades"
  ON whale_trades_daily FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 4. Table comments
-- =============================================================================
COMMENT ON TABLE whale_trades_daily IS 'Daily whale trade storage for persistent feed across app sessions';
COMMENT ON COLUMN whale_trades_daily.trade_id IS 'Unique ID from source (Kalshi/Polymarket)';
COMMENT ON COLUMN whale_trades_daily.trade_date IS 'Day the trade was placed (for partitioning)';
COMMENT ON COLUMN whale_trades_daily.is_live IS 'Whether the game was live when trade was placed';
COMMENT ON COLUMN whale_trades_daily.game_status IS 'pregame, live, or final when trade was placed';
