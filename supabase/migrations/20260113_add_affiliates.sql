CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'flagged', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliates_user_id_idx ON public.affiliates (user_id);

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL REFERENCES public.affiliates(code) ON DELETE CASCADE,
  session_id TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_clicks_code_idx ON public.affiliate_clicks (code);

CREATE TABLE IF NOT EXISTS public.affiliate_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL REFERENCES public.affiliates(code) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id TEXT,
  trial_end_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'earned', 'paid', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_attributions_unique_idx
  ON public.affiliate_attributions (referred_user_id, subscription_id);

CREATE INDEX IF NOT EXISTS affiliate_attributions_code_idx ON public.affiliate_attributions (code);
CREATE INDEX IF NOT EXISTS affiliate_attributions_status_idx ON public.affiliate_attributions (status);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can read own profile"
  ON public.affiliates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Affiliates can insert own profile"
  ON public.affiliates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Affiliates can read own clicks"
  ON public.affiliate_clicks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.affiliates
      WHERE affiliates.code = affiliate_clicks.code
        AND affiliates.user_id = auth.uid()
    )
  );

CREATE POLICY "Affiliates can read own attributions"
  ON public.affiliate_attributions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.affiliates
      WHERE affiliates.code = affiliate_attributions.code
        AND affiliates.user_id = auth.uid()
    )
  );
