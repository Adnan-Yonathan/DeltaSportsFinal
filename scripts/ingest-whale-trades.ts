/**
 * Trigger whale trade ingestion on production.
 * Run with:
 *   npx ts-node --project tsconfig.scripts.json scripts/ingest-whale-trades.ts
 */

import 'dotenv/config'

const PROD_URL = 'https://deltasports.app/api/cron/ingest-whale-trades'

async function triggerIngestion() {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[WHALE] CRON_SECRET not set in environment')
    process.exit(1)
  }

  console.log('[WHALE] Triggering whale trade ingestion on production...')

  const response = await fetch(PROD_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`[WHALE] Request failed with status ${response.status}: ${text}`)
    process.exit(1)
  }

  const result = await response.json()
  console.log('[WHALE] Ingestion result:', JSON.stringify(result, null, 2))
}

triggerIngestion().catch((error) => {
  console.error('[WHALE] Ingestion failed:', error)
  process.exit(1)
})
