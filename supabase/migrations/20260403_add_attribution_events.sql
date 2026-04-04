CREATE TABLE IF NOT EXISTS public.attribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  stripe_customer_id TEXT,
  channel TEXT NOT NULL,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  term TEXT,
  content TEXT,
  referrer_host TEXT,
  landing_path TEXT,
  affiliate_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attribution_events_session_time_idx
  ON public.attribution_events (session_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS attribution_events_event_time_idx
  ON public.attribution_events (event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS attribution_events_customer_time_idx
  ON public.attribution_events (stripe_customer_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS attribution_events_channel_source_idx
  ON public.attribution_events (channel, source, occurred_at DESC);

ALTER TABLE public.attribution_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own attribution events"
  ON public.attribution_events
  FOR SELECT
  USING (auth.uid() = user_id);
