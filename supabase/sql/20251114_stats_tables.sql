-- Player season stats table
CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_key TEXT NOT NULL,
  league TEXT,
  team_name TEXT,
  player_name TEXT NOT NULL,
  position TEXT,
  season TEXT,
  games_played INTEGER,
  minutes_per_game NUMERIC,
  points_per_game NUMERIC,
  rebounds_per_game NUMERIC,
  assists_per_game NUMERIC,
  steals_per_game NUMERIC,
  blocks_per_game NUMERIC,
  turnovers_per_game NUMERIC,
  usage_rate NUMERIC,
  efficiency_rating NUMERIC,
  recent_form JSONB,      -- e.g., {"points_last5": 24.2, "rebounds_last5": 9.8}
  trend_tags TEXT[],
  provider_player_id TEXT,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_stats_lookup ON player_stats (sport_key, player_name);
CREATE INDEX IF NOT EXISTS idx_player_stats_team ON player_stats (sport_key, team_name);

-- Player game logs (per matchup)
CREATE TABLE IF NOT EXISTS player_game_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_key TEXT NOT NULL,
  league TEXT,
  team_name TEXT,
  opponent TEXT,
  player_name TEXT NOT NULL,
  game_date DATE NOT NULL,
  is_home BOOLEAN,
  points NUMERIC,
  rebounds NUMERIC,
  assists NUMERIC,
  threes_made NUMERIC,
  steals NUMERIC,
  blocks NUMERIC,
  turnovers NUMERIC,
  minutes NUMERIC,
  outcome TEXT, -- W/L
  provider_game_id TEXT,
  provider_player_id TEXT,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_game_logs_lookup ON player_game_logs (sport_key, player_name, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_player_game_logs_team ON player_game_logs (sport_key, team_name, game_date DESC);

-- Team season stats / records
CREATE TABLE IF NOT EXISTS team_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_key TEXT NOT NULL,
  league TEXT,
  team_name TEXT NOT NULL,
  season TEXT,
  wins INTEGER,
  losses INTEGER,
  home_record TEXT,
  away_record TEXT,
  ats_record TEXT,
  over_under_record TEXT,
  points_per_game NUMERIC,
  points_allowed_per_game NUMERIC,
  pace NUMERIC,
  offensive_rating NUMERIC,
  defensive_rating NUMERIC,
  net_rating NUMERIC,
  recent_streak TEXT,
  trend_tags TEXT[],
  provider_team_id TEXT,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_stats_lookup ON team_stats (sport_key, team_name);

-- Team trend snapshots (derived)
CREATE TABLE IF NOT EXISTS team_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_key TEXT NOT NULL,
  league TEXT,
  team_name TEXT NOT NULL,
  trend_type TEXT NOT NULL,          -- e.g., 'ATS', 'Totals', 'Scoring'
  trend_window TEXT,                 -- e.g., 'last5', 'season', 'since_all_star'
  trend_summary TEXT,                -- human-readable summary
  metrics JSONB,                     -- e.g., {"ats_record":"8-2","avg_margin":+6.2}
  provider_team_id TEXT,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_trends_lookup ON team_trends (sport_key, team_name, trend_type);
