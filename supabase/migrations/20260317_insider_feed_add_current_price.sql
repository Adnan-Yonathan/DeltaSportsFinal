-- Add current market price columns and drop profit factor from insider feed cache
ALTER TABLE insider_feed_cache
  ADD COLUMN IF NOT EXISTS current_price FLOAT,
  ADD COLUMN IF NOT EXISTS current_american_odds INT;

ALTER TABLE insider_feed_cache
  DROP COLUMN IF EXISTS wallet_profit_factor;
