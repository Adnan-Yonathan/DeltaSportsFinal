-- Insider Feed cache table
-- Populated by the direct Polymarket API pipeline (refresh-insider-feed cron).
-- Completely independent of polymarket_wallet_summary / open_positions ETL tables.
CREATE TABLE IF NOT EXISTS insider_feed_cache (
  id                      BIGSERIAL PRIMARY KEY,
  wallet                  TEXT        NOT NULL,
  pseudonym               TEXT,
  profile_image_url       TEXT,
  title                   TEXT        NOT NULL,
  outcome                 TEXT        NOT NULL,
  sport_label             TEXT,
  slug                    TEXT        NOT NULL,
  avg_entry_price         FLOAT       NOT NULL,
  avg_entry_american_odds INT,
  stake_usd               FLOAT       NOT NULL,
  potential_payout_usd    FLOAT       NOT NULL,
  last_trade_time         TIMESTAMPTZ,
  insider_score           INT         NOT NULL,
  size_ratio              FLOAT       NOT NULL,
  wallet_roi_pct          FLOAT       NOT NULL,
  wallet_trade_count      INT         NOT NULL DEFAULT 0,
  wallet_profit_factor    FLOAT       NOT NULL DEFAULT 0,
  refreshed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wallet, slug, outcome)
);

CREATE INDEX IF NOT EXISTS insider_feed_cache_score_idx     ON insider_feed_cache (insider_score DESC);
CREATE INDEX IF NOT EXISTS insider_feed_cache_sport_idx     ON insider_feed_cache (sport_label);
CREATE INDEX IF NOT EXISTS insider_feed_cache_refreshed_idx ON insider_feed_cache (refreshed_at);
