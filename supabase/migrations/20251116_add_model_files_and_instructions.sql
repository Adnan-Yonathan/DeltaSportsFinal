-- Migration: Add custom instructions and file upload support for manual model creation
-- This enables ChatGPT-style custom GPT functionality with uploadable data files

-- Add new columns to custom_models table
ALTER TABLE public.custom_models
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS instructions TEXT,
ADD COLUMN IF NOT EXISTS file_metadata JSONB DEFAULT '[]'::jsonb;

-- Create model_files table for storing uploaded file information and parsed data
CREATE TABLE IF NOT EXISTS public.model_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES public.custom_models(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'pdf', 'txt')),
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  parsed_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for model_files
CREATE INDEX IF NOT EXISTS idx_model_files_model
  ON public.model_files (model_id);

CREATE INDEX IF NOT EXISTS idx_model_files_user
  ON public.model_files (user_id);

CREATE INDEX IF NOT EXISTS idx_model_files_created
  ON public.model_files (created_at DESC);

-- Enable RLS for model_files
ALTER TABLE public.model_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for model_files
CREATE POLICY "Users can view own model files"
  ON public.model_files
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own model files"
  ON public.model_files
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own model files"
  ON public.model_files
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own model files"
  ON public.model_files
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON COLUMN public.custom_models.description IS
  'Short description of what the model does (shown in model cards)';

COMMENT ON COLUMN public.custom_models.instructions IS
  'Custom instructions/system prompt that guides AI behavior when using this model';

COMMENT ON COLUMN public.custom_models.file_metadata IS
  'Array of metadata for uploaded files (name, size, type, storage path, upload timestamp)';

COMMENT ON TABLE public.model_files IS
  'Stores uploaded files (CSV, Excel, PDF, TXT) and their parsed data for use in custom models';

COMMENT ON COLUMN public.model_files.parsed_data IS
  'Extracted/parsed content from the file in JSON format for AI context injection';
