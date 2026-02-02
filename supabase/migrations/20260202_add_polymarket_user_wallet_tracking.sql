-- Migration: Add per-user Polymarket wallet tracking
-- Created: 2026-02-02
-- Description: Stores per-user tracked Polymarket wallets.

CREATE TABLE IF NOT EXISTS polymarket_user_tracked_wallets (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, wallet)
);

CREATE INDEX IF NOT EXISTS idx_polymarket_user_tracked_wallets_wallet
  ON polymarket_user_tracked_wallets (wallet);

ALTER TABLE polymarket_user_tracked_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tracked polymarket wallets"
  ON polymarket_user_tracked_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their tracked polymarket wallets"
  ON polymarket_user_tracked_wallets
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
