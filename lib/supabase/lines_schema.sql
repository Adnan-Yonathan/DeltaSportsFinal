-- Line tracking schema (create if not present)

CREATE TABLE IF NOT EXISTS public.lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_time TIMESTAMP WITH TIME ZONE NOT NULL,
  odds_api_id TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market_type TEXT NOT NULL CHECK (market_type IN ('spread', 'total', 'moneyline')),
  line_type TEXT NOT NULL CHECK (line_type IN ('opening', 'current', 'closing')),
  spread_home NUMERIC,
  spread_away NUMERIC,
  spread_home_odds INTEGER,
  spread_away_odds INTEGER,
  total_line NUMERIC,
  total_over_odds INTEGER,
  total_under_odds INTEGER,
  moneyline_home INTEGER,
  moneyline_away INTEGER,
  is_sharp_move BOOLEAN DEFAULT false,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_lines_odds_market_type
  ON public.lines (odds_api_id, market_type, line_type);

CREATE INDEX IF NOT EXISTS idx_lines_sport_time
  ON public.lines (sport, line_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_lines_sharp_move
  ON public.lines (is_sharp_move, recorded_at DESC);

-- Enable row level security and allow service-role writes while keeping reads open
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lines_read_auth"
  ON public.lines
  FOR SELECT
  USING (true);

CREATE POLICY "lines_write_service_role"
  ON public.lines
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
