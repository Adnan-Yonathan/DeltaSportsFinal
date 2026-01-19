-- Migration: Add Daily Recap Tables and Columns
-- Created: 2026-01-17
-- Description: Adds result tracking to market_projection_clv and creates daily_recaps table.

-- Add result columns to market_projection_clv
ALTER TABLE market_projection_clv
ADD COLUMN IF NOT EXISTS home_score INTEGER,
ADD COLUMN IF NOT EXISTS away_score INTEGER,
ADD COLUMN IF NOT EXISTS result TEXT CHECK (result IN ('win', 'loss', 'push', 'pending')),
ADD COLUMN IF NOT EXISTS result_settled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_market_projection_clv_result
  ON market_projection_clv (result, commence_time DESC);

-- Create daily_recaps table
CREATE TABLE IF NOT EXISTS daily_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recap_date DATE NOT NULL UNIQUE,
  sports JSONB NOT NULL DEFAULT '[]',
  total_picks INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  pushes INTEGER NOT NULL DEFAULT 0,
  roi_percent NUMERIC(6,2),
  avg_clv_points NUMERIC(6,2),
  clv_tier TEXT CHECK (clv_tier IN ('negligible', 'good', 'elite', 'godlike')),
  hypothetical_100_profit NUMERIC(10,2),
  picks JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_recaps_date ON daily_recaps (recap_date DESC);

ALTER TABLE daily_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily_recaps" ON daily_recaps
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage daily_recaps" ON daily_recaps
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE daily_recaps IS
  'Stores aggregated daily performance recaps for market projections.';
