-- Purpose: Ensure line history supports opening/closing and efficient lookups (no prior files edited)
-- Usage: Run this script in your SQL editor (e.g., Supabase SQL editor)

-- Add optional columns used by capture/closing logic
ALTER TABLE public.lines
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS closing_source text; -- 'exact' | 'fallback' | NULL

-- Indexes for fast event + book + market scans and time-series charts
CREATE INDEX IF NOT EXISTS idx_lines_event_book_market_type
  ON public.lines (odds_api_id, bookmaker, market_type, line_type);

CREATE INDEX IF NOT EXISTS idx_lines_event_recorded_at
  ON public.lines (odds_api_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_lines_line_type
  ON public.lines (line_type);
