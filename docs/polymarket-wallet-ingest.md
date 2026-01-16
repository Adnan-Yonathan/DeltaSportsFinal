# Polymarket wallet ingest (direct)

This endpoint ingests trades for an explicit wallet list without relying on
whale-detector seeding.

Endpoint:
- `/api/cron/ingest-polymarket-wallets-direct`

Auth:
- `Authorization: Bearer $CRON_SECRET`

Query params:
- `wallet`: single wallet address
- `wallets`: comma-separated list of wallets
- `mode`: `incremental` (default) or `backfill`
- `limit`: trades per page (default `1000`)
- `maxPages`: pages per wallet (default `10`)
- `sportsOnly`: `true` (default) or `false`
- `source`: stored in `polymarket_wallets.source` (default `manual`)

Env fallback:
- `POLYMARKET_WALLET_LIST`: comma-separated wallet list used when no query wallets are provided.

Examples:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR_DOMAIN/api/cron/ingest-polymarket-wallets-direct?wallet=0xABC&mode=backfill"
```

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR_DOMAIN/api/cron/ingest-polymarket-wallets-direct?wallets=0xABC,0xDEF&maxPages=3"
```
