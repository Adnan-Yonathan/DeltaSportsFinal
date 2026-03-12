-- Migration: Add Polymarket wallet ROI cache table for whale feed hydration
-- Created: 2026-03-12
-- Description: Stores wallet-level ROI snapshots fetched from Polymarket data API.

CREATE TABLE IF NOT EXISTS polymarket_wallet_roi_cache (
  wallet TEXT PRIMARY KEY,
  roi_lifetime NUMERIC(12,6),
  total_realized_pnl NUMERIC(18,6),
  total_volume NUMERIC(18,6),
  source TEXT NOT NULL DEFAULT 'leaderboard',
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_roi_cache_last_computed
  ON polymarket_wallet_roi_cache (last_computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_polymarket_wallet_roi_cache_roi
  ON polymarket_wallet_roi_cache (roi_lifetime DESC);

ALTER TABLE polymarket_wallet_roi_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'polymarket_wallet_roi_cache'
      AND policyname = 'Anyone can view polymarket_wallet_roi_cache'
  ) THEN
    CREATE POLICY "Anyone can view polymarket_wallet_roi_cache"
      ON polymarket_wallet_roi_cache
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'polymarket_wallet_roi_cache'
      AND policyname = 'Service role can manage polymarket_wallet_roi_cache'
  ) THEN
    CREATE POLICY "Service role can manage polymarket_wallet_roi_cache"
      ON polymarket_wallet_roi_cache
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
