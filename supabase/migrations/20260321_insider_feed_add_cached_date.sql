-- Add cached_date column to track which day a bet first appeared.
-- Bets persist for the rest of the calendar day (Eastern) and are
-- cleaned up at the next refresh after midnight.
ALTER TABLE insider_feed_cache
  ADD COLUMN IF NOT EXISTS cached_date TEXT;

-- Backfill existing rows with today's date
UPDATE insider_feed_cache
  SET cached_date = TO_CHAR(NOW() AT TIME ZONE 'America/New_York', 'YYYY-MM-DD')
  WHERE cached_date IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE insider_feed_cache
  ALTER COLUMN cached_date SET NOT NULL;

ALTER TABLE insider_feed_cache
  ALTER COLUMN cached_date SET DEFAULT TO_CHAR(NOW() AT TIME ZONE 'America/New_York', 'YYYY-MM-DD');

CREATE INDEX IF NOT EXISTS insider_feed_cache_date_idx ON insider_feed_cache (cached_date);
