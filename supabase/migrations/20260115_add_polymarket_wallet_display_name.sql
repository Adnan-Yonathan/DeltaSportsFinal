-- Migration: Add Polymarket Wallet Display Names
-- Created: 2026-01-15
-- Description: Adds display_name column for tracked wallets.

ALTER TABLE polymarket_wallets
  ADD COLUMN IF NOT EXISTS display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_polymarket_wallets_display_name
  ON polymarket_wallets (display_name);
