-- Migration: Add Betting Data Tables for Delta Sports
-- Created: 2025-12-12
-- Description: Adds tables for public betting splits, period scores, and opponent-allowed stats.
--              Also extends team_ats_records with additional ATS breakdown columns.

-- =============================================================================
-- 1. Extend team_ats_records with additional ATS breakdown columns
-- =============================================================================
ALTER TABLE team_ats_records ADD COLUMN IF NOT EXISTS home_ats_record TEXT;
ALTER TABLE team_ats_records ADD COLUMN IF NOT EXISTS away_ats_record TEXT;
ALTER TABLE team_ats_records ADD COLUMN IF NOT EXISTS favorite_ats_record TEXT;
ALTER TABLE team_ats_records ADD COLUMN IF NOT EXISTS underdog_ats_record TEXT;
ALTER TABLE team_ats_records ADD COLUMN IF NOT EXISTS over_under_record TEXT;
ALTER TABLE team_ats_records ADD COLUMN IF NOT EXISTS last_10_ats TEXT;
ALTER TABLE team_ats_records ADD COLUMN IF NOT EXISTS ats_streak TEXT;
ALTER TABLE team_ats_records ADD COLUMN IF NOT EXISTS team_name TEXT;
ALTER TABLE team_ats_records ADD COLUMN IF NOT EXISTS covers_slug TEXT;

COMMENT ON COLUMN team_ats_records.home_ats_record IS 'ATS record for home games (e.g., "10-5-1")';
COMMENT ON COLUMN team_ats_records.away_ats_record IS 'ATS record for away games (e.g., "8-7-0")';
COMMENT ON COLUMN team_ats_records.favorite_ats_record IS 'ATS record when team is favored';
COMMENT ON COLUMN team_ats_records.underdog_ats_record IS 'ATS record when team is underdog';
COMMENT ON COLUMN team_ats_records.over_under_record IS 'Over/Under record (e.g., "12-10-2")';
COMMENT ON COLUMN team_ats_records.last_10_ats IS 'ATS record in last 10 games';
COMMENT ON COLUMN team_ats_records.ats_streak IS 'Current ATS streak (e.g., "W3" or "L2")';
COMMENT ON COLUMN team_ats_records.covers_slug IS 'URL slug for Covers.com team page';

-- =============================================================================
-- 2. Public Betting Splits Table (Covers.com data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public_betting_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_key TEXT NOT NULL,
  game_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_time TIMESTAMPTZ,
  
  -- Market identification
  market_type TEXT NOT NULL CHECK (market_type IN ('spread', 'moneyline', 'total')),
  
  -- Percentage of bets
  home_bets_pct DECIMAL(5,2),    -- % of bets on home (spread/ML) or over (total)
  away_bets_pct DECIMAL(5,2),    -- % of bets on away (spread/ML) or under (total)
  
  -- Percentage of money/handle (when available)
  home_money_pct DECIMAL(5,2),   -- % of money on home/over
  away_money_pct DECIMAL(5,2),   -- % of money on away/under
  
  -- Sharp detection
  sharp_indicator TEXT CHECK (sharp_indicator IN ('sharp_home', 'sharp_away', 'public_home', 'public_away', 'neutral')),
  
  -- Source tracking
  source TEXT DEFAULT 'covers',
  covers_game_id TEXT,
  
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (game_id, market_type, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_public_splits_game ON public_betting_splits (game_id, market_type);
CREATE INDEX IF NOT EXISTS idx_public_splits_sport ON public_betting_splits (sport_key, game_time DESC);
CREATE INDEX IF NOT EXISTS idx_public_splits_sharp ON public_betting_splits (sharp_indicator) WHERE sharp_indicator IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_public_splits_captured ON public_betting_splits (captured_at DESC);

COMMENT ON TABLE public_betting_splits IS 'Public betting percentages and sharp money detection from Covers.com';
COMMENT ON COLUMN public_betting_splits.sharp_indicator IS 'Detected sharp action based on money% vs bets% divergence';

-- =============================================================================
-- 3. Period Scores Table (Sportradar NBA boxscore data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS period_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_key TEXT NOT NULL DEFAULT 'basketball_nba',
  game_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_abbr TEXT,
  away_team_abbr TEXT,
  game_date DATE NOT NULL,
  
  -- Period identification
  period_number INT NOT NULL,     -- 1-4 for quarters, 5+ for OT
  period_type TEXT NOT NULL CHECK (period_type IN ('quarter', 'overtime', 'half')),
  
  -- Scoring
  home_points INT NOT NULL,
  away_points INT NOT NULL,
  
  -- Optional: additional period stats
  home_fgm INT,
  home_fga INT,
  away_fgm INT,
  away_fga INT,
  
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (game_id, period_number)
);

CREATE INDEX IF NOT EXISTS idx_period_scores_team ON period_scores (home_team, period_number);
CREATE INDEX IF NOT EXISTS idx_period_scores_away ON period_scores (away_team, period_number);
CREATE INDEX IF NOT EXISTS idx_period_scores_sport ON period_scores (sport_key, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_period_scores_game ON period_scores (game_id);

COMMENT ON TABLE period_scores IS 'Period-by-period scoring from Sportradar NBA boxscores';
COMMENT ON COLUMN period_scores.period_number IS '1-4 for quarters, 5 for OT1, 6 for OT2, etc.';

-- =============================================================================
-- 4. Opponent-Allowed Advanced Stats Table (Sportradar Synergy data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS opponent_allowed_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_key TEXT NOT NULL DEFAULT 'basketball_nba',
  team_name TEXT NOT NULL,
  team_abbr TEXT,
  team_id TEXT,
  season TEXT NOT NULL,
  
  -- Shooting allowed
  opp_fg_pct DECIMAL(5,3),
  opp_fg3_pct DECIMAL(5,3),
  opp_efg_pct DECIMAL(5,3),
  opp_ts_pct DECIMAL(5,3),
  
  -- Points by play type
  opp_paint_pts_per_game DECIMAL(5,2),
  opp_fastbreak_pts_per_game DECIMAL(5,2),
  opp_second_chance_pts_per_game DECIMAL(5,2),
  opp_pts_off_to_per_game DECIMAL(5,2),
  
  -- Pace and possessions
  opp_pace DECIMAL(5,2),
  opp_possessions_per_game DECIMAL(5,2),
  
  -- Rebounding allowed
  opp_orb_pct DECIMAL(5,3),
  opp_drb_pct DECIMAL(5,3),
  
  -- Per-game defensive metrics
  opp_pts_per_game DECIMAL(5,2),
  opp_ast_per_game DECIMAL(5,2),
  opp_reb_per_game DECIMAL(5,2),
  opp_tov_per_game DECIMAL(5,2),
  
  -- Defensive rating
  defensive_rating DECIMAL(6,2),
  
  -- League ranking context
  defensive_rank INT,
  
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (team_name, season)
);

CREATE INDEX IF NOT EXISTS idx_opp_stats_team ON opponent_allowed_stats (team_name, season);
CREATE INDEX IF NOT EXISTS idx_opp_stats_sport ON opponent_allowed_stats (sport_key, season);
CREATE INDEX IF NOT EXISTS idx_opp_stats_abbr ON opponent_allowed_stats (team_abbr);

COMMENT ON TABLE opponent_allowed_stats IS 'Defensive/opponent-allowed advanced stats from Sportradar Synergy';
COMMENT ON COLUMN opponent_allowed_stats.opp_efg_pct IS 'Effective FG% allowed to opponents';
COMMENT ON COLUMN opponent_allowed_stats.opp_ts_pct IS 'True Shooting% allowed to opponents';
COMMENT ON COLUMN opponent_allowed_stats.defensive_rating IS 'Points allowed per 100 possessions';

-- =============================================================================
-- 5. Enable Row Level Security
-- =============================================================================
ALTER TABLE public_betting_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE opponent_allowed_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies - read-only for all, insert/update for service role
CREATE POLICY "Anyone can view public_betting_splits" ON public_betting_splits
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage public_betting_splits" ON public_betting_splits
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view period_scores" ON period_scores
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage period_scores" ON period_scores
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view opponent_allowed_stats" ON opponent_allowed_stats
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage opponent_allowed_stats" ON opponent_allowed_stats
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- 6. Helper Views
-- =============================================================================

-- View for latest betting splits per game/market
CREATE OR REPLACE VIEW latest_betting_splits AS
SELECT DISTINCT ON (game_id, market_type)
  *
FROM public_betting_splits
ORDER BY game_id, market_type, captured_at DESC;

-- View for team quarter averages
CREATE OR REPLACE VIEW team_quarter_averages AS
SELECT 
  home_team AS team,
  sport_key,
  period_number,
  period_type,
  AVG(home_points) AS avg_points,
  COUNT(*) AS games_count
FROM period_scores
GROUP BY home_team, sport_key, period_number, period_type
UNION ALL
SELECT 
  away_team AS team,
  sport_key,
  period_number,
  period_type,
  AVG(away_points) AS avg_points,
  COUNT(*) AS games_count
FROM period_scores
GROUP BY away_team, sport_key, period_number, period_type;

COMMENT ON VIEW latest_betting_splits IS 'Most recent betting splits for each game/market combination';
COMMENT ON VIEW team_quarter_averages IS 'Aggregated quarter scoring averages per team';

