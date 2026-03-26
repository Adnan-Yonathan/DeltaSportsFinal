-- Migration: Add market limit pressure history snapshots
-- Created: 2026-03-25

CREATE TABLE IF NOT EXISTS public.market_limit_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport TEXT NOT NULL,
  odds_api_id TEXT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  commence_time TIMESTAMPTZ,
  market_type TEXT NOT NULL CHECK (market_type IN ('spread', 'total', 'moneyline')),
  projection_side TEXT,
  limit_pressure_score NUMERIC(10,6),
  limit_pressure_label TEXT,
  for_limit NUMERIC(14,2),
  against_limit NUMERIC(14,2),
  net_limit NUMERIC(14,2),
  sample_count INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_limit_history_game_market_time
  ON public.market_limit_history (odds_api_id, market_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_limit_history_matchup_time
  ON public.market_limit_history (home_team, away_team, commence_time, market_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_limit_history_sport_time
  ON public.market_limit_history (sport, recorded_at DESC);

ALTER TABLE public.market_limit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view market_limit_history" ON public.market_limit_history
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage market_limit_history" ON public.market_limit_history
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.market_limit_history IS 'Time-series snapshots of per-game market limit pressure used by sharp projections.';
COMMENT ON COLUMN public.market_limit_history.net_limit IS 'for_limit - against_limit at snapshot time for the projected side.';

