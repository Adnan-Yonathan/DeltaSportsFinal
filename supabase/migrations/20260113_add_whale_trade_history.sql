-- Migration: Add Whale Trade History Table
-- Created: 2026-01-13
-- Description: Stores whale trades over time for matchup-level aggregation.

-- =============================================================================
-- 1. Whale Trade History Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS whale_trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('kalshi', 'polymarket')),
  trade_id TEXT NOT NULL,
  sport_key TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  event_date DATE NOT NULL,
  trade_time TIMESTAMPTZ NOT NULL,
  market_type TEXT NOT NULL CHECK (market_type IN ('spread', 'moneyline', 'total', 'player_prop')),
  side TEXT,
  home_team TEXT,
  away_team TEXT,
  matchup_key TEXT,
  player_name TEXT,
  prop_type TEXT,
  prop_line NUMERIC(8,2),
  market_title TEXT,
  outcome TEXT,
  notional NUMERIC(12,2),
  contracts NUMERIC(12,2),
  price_cents INT,
  american_odds INT,
  is_pregame BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, trade_id)
);

CREATE INDEX IF NOT EXISTS idx_whale_trade_history_matchup ON whale_trade_history (sport_key, matchup_key, market_type);
CREATE INDEX IF NOT EXISTS idx_whale_trade_history_player ON whale_trade_history (sport_key, player_name, prop_type);
CREATE INDEX IF NOT EXISTS idx_whale_trade_history_event ON whale_trade_history (event_time);
CREATE INDEX IF NOT EXISTS idx_whale_trade_history_event_date ON whale_trade_history (event_date);
CREATE INDEX IF NOT EXISTS idx_whale_trade_history_trade_time ON whale_trade_history (trade_time DESC);

COMMENT ON TABLE whale_trade_history IS 'Historical whale trades for matchup-level aggregation and projections';
COMMENT ON COLUMN whale_trade_history.matchup_key IS 'Normalized key for away@home matchup';
COMMENT ON COLUMN whale_trade_history.market_type IS 'Market type: spread, moneyline, or total';
COMMENT ON COLUMN whale_trade_history.side IS 'Team name or total side (Over/Under)';

-- =============================================================================
-- 2. Enable Row Level Security
-- =============================================================================
ALTER TABLE whale_trade_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - read-only for all, insert/update for service role
CREATE POLICY "Anyone can view whale_trade_history" ON whale_trade_history
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage whale_trade_history" ON whale_trade_history
  FOR ALL USING (true) WITH CHECK (true);
