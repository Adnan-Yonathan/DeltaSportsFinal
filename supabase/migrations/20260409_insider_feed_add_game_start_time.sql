-- Persist market start timestamps so Insider Feed can enforce strict pregame-only rows.
ALTER TABLE insider_feed_cache
  ADD COLUMN IF NOT EXISTS game_start_time TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS insider_feed_cache_game_start_idx
  ON insider_feed_cache (game_start_time);

CREATE INDEX IF NOT EXISTS insider_feed_cache_pregame_idx
  ON insider_feed_cache (cached_date, game_start_time, insider_score DESC);
