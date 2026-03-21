-- Persistent insider wallet store.
-- Wallets are discovered once and never deleted — only soft-disabled via is_active.
-- The refresh pipeline round-robins through wallets ordered by last_refreshed_at.
CREATE TABLE IF NOT EXISTS insider_wallets (
  wallet              TEXT PRIMARY KEY,
  pseudonym           TEXT,
  profile_image_url   TEXT,
  roi_pct             FLOAT NOT NULL,
  volume_usd          FLOAT NOT NULL,
  buy_trade_count     INT NOT NULL DEFAULT 0,
  avg_bet_size        FLOAT NOT NULL DEFAULT 0,
  discovery_source    TEXT NOT NULL DEFAULT 'leaderboard',
  discovered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_refreshed_at   TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS insider_wallets_refresh_queue_idx
  ON insider_wallets (last_refreshed_at ASC NULLS FIRST)
  WHERE is_active = TRUE;
