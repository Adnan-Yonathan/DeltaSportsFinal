-- Add consensus count to insider feed cache
ALTER TABLE insider_feed_cache
  ADD COLUMN IF NOT EXISTS consensus_count INT NOT NULL DEFAULT 1;
