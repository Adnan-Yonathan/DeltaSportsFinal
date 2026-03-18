-- Add event_slug column to insider_feed_cache for correct Polymarket deep links.
-- The trades API returns a market slug, but the website uses event slugs.
ALTER TABLE insider_feed_cache
  ADD COLUMN IF NOT EXISTS event_slug TEXT;
