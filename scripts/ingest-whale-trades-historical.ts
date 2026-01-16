/**
 * Trigger historical whale trade ingestion on production for specific sports.
 * Run with:
 *   npx ts-node --project tsconfig.scripts.json scripts/ingest-whale-trades-historical.ts
 */

import 'dotenv/config'

const PROD_URL = 'https://deltasports.app/api/cron/ingest-whale-trades-historical'

// Sports to ingest
const SPORT_CONFIGS = [
  // NBA and NHL
  { sports: ['basketball_nba', 'icehockey_nhl'] },
  // NFL and CFB
  { sports: ['americanfootball_nfl', 'americanfootball_ncaaf'] },
]

async function triggerIngestion() {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[WHALE] CRON_SECRET not set in environment')
    process.exit(1)
  }

  for (const config of SPORT_CONFIGS) {
    const sportsParam = config.sports.join(',')
    const url = `${PROD_URL}?sports=${sportsParam}&minNotional=1000&limit=800`

    console.log(`[WHALE] Ingesting: ${config.sports.join(', ')}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[WHALE] Request failed with status ${response.status}: ${text}`)
      continue
    }

    const result = await response.json()
    console.log(`[WHALE] Result:`, JSON.stringify(result, null, 2))
  }

  console.log('[WHALE] Historical ingestion complete')
}

triggerIngestion().catch((error) => {
  console.error('[WHALE] Ingestion failed:', error)
  process.exit(1)
})
