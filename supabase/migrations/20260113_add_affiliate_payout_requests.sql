CREATE TABLE IF NOT EXISTS public.affiliate_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_code TEXT NOT NULL REFERENCES public.affiliates(code) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_payout_requests_code_idx
  ON public.affiliate_payout_requests (affiliate_code);

CREATE INDEX IF NOT EXISTS affiliate_payout_requests_user_idx
  ON public.affiliate_payout_requests (user_id);
