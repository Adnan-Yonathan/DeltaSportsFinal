-- Attachments table (store uploads + vision output)
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  bet_id UUID REFERENCES public.bets(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'document')),
  storage_path TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  extracted_text TEXT,
  analysis_json JSONB,
  analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'ready', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analyzed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_attachments_conversation ON public.attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user ON public.attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_bet ON public.attachments(bet_id);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_read_own"
  ON public.attachments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "attachments_insert_own"
  ON public.attachments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attachments_update_own"
  ON public.attachments
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Storage bucket policy (replace bucket name if needed)
CREATE POLICY "users_can_upload_attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND auth.role() = 'authenticated'
    AND storage.foldername(name) = auth.uid()::text
  );
