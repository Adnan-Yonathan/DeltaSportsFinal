-- Migration: Allow users to read their own profile row
-- Created: 2026-02-02
-- Description: Enables RLS and adds a self-read policy for public.users.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);
