-- Migration: Add research models functionality to custom_models

-- Add model_type column to differentiate prediction vs research models
ALTER TABLE public.custom_models
ADD COLUMN IF NOT EXISTS model_type TEXT NOT NULL DEFAULT 'prediction'
CHECK (model_type IN ('prediction', 'research'));

-- Add research_config column for research-specific configuration
ALTER TABLE public.custom_models
ADD COLUMN IF NOT EXISTS research_config JSONB;

-- Create research_results table for caching research findings
CREATE TABLE IF NOT EXISTS public.research_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES public.custom_models(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  results JSONB NOT NULL,
  match_count INTEGER NOT NULL DEFAULT 0,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for research_results
CREATE INDEX IF NOT EXISTS idx_research_results_user_model
  ON public.research_results (user_id, model_id);

CREATE INDEX IF NOT EXISTS idx_research_results_scanned
  ON public.research_results (scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_results_user_recent
  ON public.research_results (user_id, scanned_at DESC);

-- Enable RLS for research_results
ALTER TABLE public.research_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for research_results
CREATE POLICY "Users can view own research results"
  ON public.research_results
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own research results"
  ON public.research_results
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own research results"
  ON public.research_results
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own research results"
  ON public.research_results
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add index on custom_models model_type for filtering
CREATE INDEX IF NOT EXISTS idx_custom_models_type
  ON public.custom_models (user_id, model_type);

-- Comment for documentation
COMMENT ON COLUMN public.custom_models.model_type IS
  'Type of model: prediction (statistical scoring) or research (opportunity scanner)';

COMMENT ON COLUMN public.custom_models.research_config IS
  'Configuration for research models including search scope, filters, and sorting';

COMMENT ON TABLE public.research_results IS
  'Cached results from research model scans for betting opportunities';
