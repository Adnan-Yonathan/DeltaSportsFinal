-- Purpose: Add CLV and line snapshot fields to bets without modifying prior migrations
-- Usage: Run this script in your SQL editor (e.g., Supabase SQL editor)

-- Bets: enrich with provider linking, snapshots, and CLV results
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS odds_api_id text,
  ADD COLUMN IF NOT EXISTS sport_key text,
  ADD COLUMN IF NOT EXISTS book text,
  ADD COLUMN IF NOT EXISTS bet_type text,           -- moneyline | spread | total
  ADD COLUMN IF NOT EXISTS side_team text,          -- home | away (for ML/spread)
  ADD COLUMN IF NOT EXISTS total_dir text,          -- over | under (for totals)
  ADD COLUMN IF NOT EXISTS bet_line numeric,        -- spread or total line at placement
  ADD COLUMN IF NOT EXISTS bet_odds integer,        -- American odds at placement
  ADD COLUMN IF NOT EXISTS opening_line numeric,
  ADD COLUMN IF NOT EXISTS opening_odds integer,
  ADD COLUMN IF NOT EXISTS opening_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS closing_line numeric,
  ADD COLUMN IF NOT EXISTS closing_odds integer,
  ADD COLUMN IF NOT EXISTS closing_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS clv_value numeric,       -- points (spread/total) or prob delta (ML)
  ADD COLUMN IF NOT EXISTS clv_percent numeric,     -- optional normalized percent
  ADD COLUMN IF NOT EXISTS clv_method text,         -- 'points' | 'implied_prob'
  ADD COLUMN IF NOT EXISTS clv_source text;         -- 'exact' | 'fallback' | NULL

-- Helpful comments
COMMENT ON COLUMN public.bets.bet_type IS 'moneyline | spread | total';
COMMENT ON COLUMN public.bets.side_team IS 'home | away (for moneyline/spread)';
COMMENT ON COLUMN public.bets.total_dir IS 'over | under (for totals)';
COMMENT ON COLUMN public.bets.clv_method IS 'points for spread/total, implied_prob for moneyline';
COMMENT ON COLUMN public.bets.clv_source IS 'exact if captured at start time; fallback if nearest available';

-- Indexes to speed event and analytics queries
CREATE INDEX IF NOT EXISTS idx_bets_event ON public.bets (odds_api_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_status ON public.bets (user_id, status);
CREATE INDEX IF NOT EXISTS idx_bets_bettype ON public.bets (bet_type);
