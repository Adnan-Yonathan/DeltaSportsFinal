-- Migration: Add Market Projection CLV Tracking
-- Created: 2026-01-15
-- Description: Stores model recommendation lines and closing line comparisons for CLV recaps.

CREATE TABLE IF NOT EXISTS market_projection_clv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  odds_api_id TEXT NOT NULL,
  market_type TEXT NOT NULL CHECK (market_type IN ('spread', 'total', 'moneyline')),
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  pick_side TEXT NOT NULL CHECK (pick_side IN ('home', 'away')),
  pick_line NUMERIC(6,2),
  pick_odds INTEGER,
  pick_implied_prob NUMERIC(6,4),
  pick_book TEXT,
  picked_at TIMESTAMPTZ DEFAULT NOW(),
  closing_line NUMERIC(6,2),
  closing_odds INTEGER,
  closing_implied_prob NUMERIC(6,4),
  closing_book TEXT,
  closing_captured_at TIMESTAMPTZ,
  clv_points NUMERIC(6,2),
  clv_implied_prob NUMERIC(6,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_projection_clv_game
  ON market_projection_clv (sport, odds_api_id, market_type);
CREATE INDEX IF NOT EXISTS idx_market_projection_clv_commence
  ON market_projection_clv (commence_time DESC);
CREATE INDEX IF NOT EXISTS idx_market_projection_clv_clv
  ON market_projection_clv (clv_points);

ALTER TABLE market_projection_clv ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view market_projection_clv" ON market_projection_clv
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage market_projection_clv" ON market_projection_clv
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE market_projection_clv IS
  'Stores model recommendation lines and CLV comparisons for market projections.';
