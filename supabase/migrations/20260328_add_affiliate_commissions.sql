ALTER TABLE public.affiliate_attributions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscriber_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attribution_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_invoice_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifetime_revenue_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_commission_cents BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_attributions_referred_user_unique_idx
  ON public.affiliate_attributions (referred_user_id);

CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_code TEXT NOT NULL REFERENCES public.affiliates(code) ON DELETE CASCADE,
  attribution_id UUID REFERENCES public.affiliate_attributions(id) ON DELETE SET NULL,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id TEXT,
  stripe_invoice_id TEXT NOT NULL,
  invoice_amount_cents INTEGER NOT NULL DEFAULT 0,
  commission_rate_bps INTEGER NOT NULL DEFAULT 2500 CHECK (commission_rate_bps BETWEEN 0 AND 10000),
  commission_amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'requested', 'paid', 'blocked', 'reversed')),
  payout_request_id UUID REFERENCES public.affiliate_payout_requests(id) ON DELETE SET NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_commissions_invoice_unique_idx
  ON public.affiliate_commissions (stripe_invoice_id);

CREATE INDEX IF NOT EXISTS affiliate_commissions_code_status_idx
  ON public.affiliate_commissions (affiliate_code, status, earned_at DESC);

ALTER TABLE public.affiliate_payout_requests
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE public.affiliate_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates can read own payout requests" ON public.affiliate_payout_requests;
CREATE POLICY "Affiliates can read own payout requests"
  ON public.affiliate_payout_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.affiliates
      WHERE affiliates.code = affiliate_payout_requests.affiliate_code
        AND affiliates.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Affiliates can insert own payout requests" ON public.affiliate_payout_requests;
CREATE POLICY "Affiliates can insert own payout requests"
  ON public.affiliate_payout_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Affiliates can read own commissions" ON public.affiliate_commissions;
CREATE POLICY "Affiliates can read own commissions"
  ON public.affiliate_commissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.affiliates
      WHERE affiliates.code = affiliate_commissions.affiliate_code
        AND affiliates.user_id = auth.uid()
    )
  );
