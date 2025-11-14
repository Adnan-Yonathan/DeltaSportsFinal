ALTER TABLE market_snapshots
  ADD COLUMN IF NOT EXISTS total_line NUMERIC,
  ADD COLUMN IF NOT EXISTS total_over_odds NUMERIC,
  ADD COLUMN IF NOT EXISTS total_over_book TEXT,
  ADD COLUMN IF NOT EXISTS total_under_odds NUMERIC,
  ADD COLUMN IF NOT EXISTS total_under_book TEXT;
