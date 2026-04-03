CREATE TABLE IF NOT EXISTS public.attribution_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  touch_kind TEXT NOT NULL CHECK (touch_kind IN ('first_touch', 'last_touch')),
  channel TEXT NOT NULL,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  term TEXT,
  content TEXT,
  referrer_host TEXT,
  landing_path TEXT,
  affiliate_code TEXT,
  click_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS attribution_touches_session_kind_unique_idx
  ON public.attribution_touches (session_id, touch_kind);

CREATE INDEX IF NOT EXISTS attribution_touches_user_time_idx
  ON public.attribution_touches (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS attribution_touches_channel_source_idx
  ON public.attribution_touches (channel, source, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.trial_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkout_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  subscription_id TEXT,
  trial_started_at TIMESTAMPTZ,
  trial_status TEXT NOT NULL DEFAULT 'pending' CHECK (trial_status IN ('pending', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  touch_model TEXT NOT NULL DEFAULT 'last_non_direct' CHECK (touch_model IN ('first_touch', 'last_touch', 'last_non_direct')),
  channel TEXT NOT NULL,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  term TEXT,
  content TEXT,
  referrer_host TEXT,
  landing_path TEXT,
  affiliate_code TEXT,
  affiliate_attribution_id TEXT,
  first_touch JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_touch JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trial_attributions_subscription_id_unique_idx
  ON public.trial_attributions (subscription_id)
  WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trial_attributions_user_time_idx
  ON public.trial_attributions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS trial_attributions_channel_source_idx
  ON public.trial_attributions (channel, source, created_at DESC);

ALTER TABLE public.attribution_touches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own attribution touches"
  ON public.attribution_touches
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own trial attributions"
  ON public.trial_attributions
  FOR SELECT
  USING (auth.uid() = user_id);

