-- Persist snapshot-only odds metadata for Insider Feed cards.
-- These fields are written by cron refresh jobs and read by the feed API.
ALTER TABLE insider_feed_cache
  ADD COLUMN IF NOT EXISTS odds_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS odds_snapshot_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS best_odds_american INT,
  ADD COLUMN IF NOT EXISTS best_odds_book TEXT,
  ADD COLUMN IF NOT EXISTS odds_source_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS odds_is_stale BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS insider_feed_cache_odds_snapshot_at_idx
  ON insider_feed_cache (odds_snapshot_at DESC);
