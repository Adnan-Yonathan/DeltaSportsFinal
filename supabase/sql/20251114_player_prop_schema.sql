ALTER TABLE bets
  ADD COLUMN IF NOT EXISTS is_prop BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS player_name TEXT,
  ADD COLUMN IF NOT EXISTS prop_market TEXT,
  ADD COLUMN IF NOT EXISTS prop_line NUMERIC,
  ADD COLUMN IF NOT EXISTS prop_selection TEXT,
  ADD COLUMN IF NOT EXISTS prop_team TEXT;

CREATE TABLE IF NOT EXISTS player_prop_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team_name TEXT,
  market_key TEXT NOT NULL,
  line NUMERIC,
  over_odds NUMERIC,
  under_odds NUMERIC,
  book TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prop_snapshots_event ON player_prop_snapshots(event_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_snapshots_player ON player_prop_snapshots(player_name, captured_at DESC);
