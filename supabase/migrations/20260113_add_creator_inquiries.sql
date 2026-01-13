CREATE TABLE IF NOT EXISTS public.creator_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  creator_type TEXT NOT NULL CHECK (creator_type IN ('ugc', 'creator')),
  social_accounts TEXT NOT NULL,
  followers_estimate INTEGER,
  views_per_month INTEGER,
  expected_pay TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_inquiries ENABLE ROW LEVEL SECURITY;
