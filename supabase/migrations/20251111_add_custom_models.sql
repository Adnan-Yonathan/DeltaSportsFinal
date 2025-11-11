-- Migration: add custom_models table for chat-based statistical models

-- Custom statistical models table
CREATE TABLE IF NOT EXISTS public.custom_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  sport_key TEXT NOT NULL,
  market_type TEXT NOT NULL,
  target_metric TEXT NOT NULL,
  confidence_level NUMERIC(3,2) NOT NULL DEFAULT 0.90,
  config JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_models_user_name
  ON public.custom_models (user_id, model_name);

CREATE INDEX IF NOT EXISTS idx_custom_models_last_used
  ON public.custom_models (user_id, last_used_at DESC NULLS LAST);

-- Enable RLS
ALTER TABLE public.custom_models ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own models"
  ON public.custom_models
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own models"
  ON public.custom_models
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own models"
  ON public.custom_models
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own models"
  ON public.custom_models
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to maintain updated_at
CREATE TRIGGER update_custom_models_updated_at
  BEFORE UPDATE ON public.custom_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
