-- Migration: Add Line Tracking and CLV Fields
-- Created: 2025-11-10
-- Description: Adds lines table for tracking opening/closing lines and CLV fields to bets table

-- Lines tracking table
CREATE TABLE IF NOT EXISTS lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Game Identification
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_time TIMESTAMP WITH TIME ZONE NOT NULL,
  espn_game_id TEXT,
  odds_api_id TEXT,

  -- Line Data
  market_type TEXT NOT NULL CHECK (market_type IN ('spread', 'total', 'moneyline')),
  bookmaker TEXT NOT NULL,

  -- Spread specific
  spread_home DECIMAL(5,2),
  spread_away DECIMAL(5,2),
  spread_home_odds INTEGER,
  spread_away_odds INTEGER,

  -- Total specific
  total_line DECIMAL(5,2),
  total_over_odds INTEGER,
  total_under_odds INTEGER,

  -- Moneyline specific
  moneyline_home INTEGER,
  moneyline_away INTEGER,

  -- Tracking
  line_type TEXT NOT NULL CHECK (line_type IN ('opening', 'current', 'closing')),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_sharp_move BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lines_game ON lines(sport, home_team, away_team, game_time);
CREATE INDEX IF NOT EXISTS idx_lines_market ON lines(market_type, line_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_lines_sharp ON lines(is_sharp_move, sport) WHERE is_sharp_move = true;
CREATE INDEX IF NOT EXISTS idx_lines_game_id ON lines(odds_api_id, line_type);
CREATE INDEX IF NOT EXISTS idx_lines_recorded_at ON lines(recorded_at DESC);

-- View for opening lines
CREATE OR REPLACE VIEW opening_lines AS
SELECT * FROM lines WHERE line_type = 'opening';

-- View for current lines (most recent for each game/market/bookmaker)
CREATE OR REPLACE VIEW current_lines AS
SELECT DISTINCT ON (odds_api_id, market_type, bookmaker)
  *
FROM lines
WHERE line_type = 'current'
ORDER BY odds_api_id, market_type, bookmaker, recorded_at DESC;

-- View for closing lines
CREATE OR REPLACE VIEW closing_lines AS
SELECT * FROM lines WHERE line_type = 'closing';

-- Add CLV fields to bets table
ALTER TABLE bets ADD COLUMN IF NOT EXISTS opening_line DECIMAL(5,2);
ALTER TABLE bets ADD COLUMN IF NOT EXISTS closing_line DECIMAL(5,2);
ALTER TABLE bets ADD COLUMN IF NOT EXISTS clv_value DECIMAL(5,2);
ALTER TABLE bets ADD COLUMN IF NOT EXISTS clv_percent DECIMAL(5,2);
ALTER TABLE bets ADD COLUMN IF NOT EXISTS line_movement TEXT CHECK (line_movement IN ('sharp', 'public', 'steam', 'neutral'));
ALTER TABLE bets ADD COLUMN IF NOT EXISTS bet_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE bets ADD COLUMN IF NOT EXISTS odds_api_id TEXT;

-- Index for CLV tracking
CREATE INDEX IF NOT EXISTS idx_bets_clv ON bets(clv_value, clv_percent) WHERE clv_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bets_line_movement ON bets(line_movement) WHERE line_movement IS NOT NULL;

-- Enable Row Level Security for lines table
ALTER TABLE lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lines table (read-only for authenticated users, insert for service role)
CREATE POLICY "Anyone can view lines" ON lines
  FOR SELECT USING (true);

CREATE POLICY "Service role can insert lines" ON lines
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update lines" ON lines
  FOR UPDATE USING (true);

-- Comment on tables and columns
COMMENT ON TABLE lines IS 'Stores historical betting lines for tracking sharp money and calculating CLV';
COMMENT ON COLUMN lines.line_type IS 'opening: First line seen, current: Current line, closing: Line when game starts';
COMMENT ON COLUMN lines.is_sharp_move IS 'Flag for significant line movement indicating sharp money';
COMMENT ON COLUMN bets.clv_value IS 'Closing Line Value - difference between opening and closing line';
COMMENT ON COLUMN bets.clv_percent IS 'CLV as percentage of opening line';
COMMENT ON COLUMN bets.line_movement IS 'Type of line movement: sharp (professional), public (casual), steam (rapid), neutral';
