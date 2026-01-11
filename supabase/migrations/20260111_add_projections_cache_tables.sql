-- Migration: Add Projections Cache Tables for Cron Jobs
-- Created: 2026-01-11
-- Description: Adds cache tables for market projections and player projections
--              used by Vercel cron jobs for automatic refresh.

-- =============================================================================
-- 1. Market Projections Cache Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS market_projections_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL UNIQUE,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_projections_sport ON market_projections_cache (sport);
CREATE INDEX IF NOT EXISTS idx_market_projections_updated ON market_projections_cache (updated_at DESC);

COMMENT ON TABLE market_projections_cache IS 'Cached market edge analysis for each sport, refreshed by cron job';
COMMENT ON COLUMN market_projections_cache.edges IS 'Array of game edges with whale alerts and market analysis';
COMMENT ON COLUMN market_projections_cache.sport IS 'Sport key (e.g., basketball_nba, americanfootball_nfl)';

-- =============================================================================
-- 2. Player Projections Cache Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS player_projections_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_projections_sport ON player_projections_cache (sport);
CREATE INDEX IF NOT EXISTS idx_player_projections_updated ON player_projections_cache (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_projections_date ON player_projections_cache (date);

COMMENT ON TABLE player_projections_cache IS 'Cached player prop projections for each sport, refreshed by cron job';
COMMENT ON COLUMN player_projections_cache.players IS 'Array of player projections with points/rebounds/assists etc.';
COMMENT ON COLUMN player_projections_cache.sport IS 'Sport key (e.g., basketball_nba, americanfootball_nfl)';
COMMENT ON COLUMN player_projections_cache.count IS 'Number of players with projections';

-- =============================================================================
-- 3. Enable Row Level Security
-- =============================================================================
ALTER TABLE market_projections_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_projections_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies - read-only for all, insert/update for service role
CREATE POLICY "Anyone can view market_projections_cache" ON market_projections_cache
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage market_projections_cache" ON market_projections_cache
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view player_projections_cache" ON player_projections_cache
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage player_projections_cache" ON player_projections_cache
  FOR ALL USING (true) WITH CHECK (true);
