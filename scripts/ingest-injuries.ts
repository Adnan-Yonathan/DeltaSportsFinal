/**
 * Ingest injury reports from public feeds into Supabase.
 *
 * Run with:
 *   npx ts-node scripts/ingest-injuries.ts
 */

import 'dotenv/config'
import { createServiceClient } from '@/lib/supabase/service'
import { getInjuryReports } from '@/lib/sports-stats-api'
import { Database } from '@/lib/supabase/types'

const SUPPORTED_SPORTS = [
  'basketball_nba',
  'americanfootball_nfl',
  'baseball_mlb',
  'icehockey_nhl',
] as const

type SupportedSport = (typeof SUPPORTED_SPORTS)[number]

async function ingestSport(supabase: ReturnType<typeof createServiceClient>, sport: SupportedSport) {
  console.log(`\n[INGEST] Fetching injuries for ${sport}...`)
  const injuries = await getInjuryReports(sport)

  if (!injuries?.length) {
    console.warn(`[INGEST] No injuries returned for ${sport}`)
    return
  }

  // Clear existing cache for this sport to avoid stale rows
  await supabase.from('injury_reports').delete().eq('sport_key', sport)

const rows: Database['public']['Tables']['injury_reports']['Insert'][] = injuries.map((injury) => ({
    sport_key: sport,
    team_name: injury.team,
    player_name: injury.player,
    status: injury.status,
    description: injury.injury || null,
    source: 'espn',
    source_updated_at: injury.date ? new Date(injury.date).toISOString() : null,
    captured_at: new Date().toISOString(),
  }))

  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('injury_reports').insert(chunk)
    if (error) {
      console.error(`[INGEST] Failed to insert chunk for ${sport}:`, error.message)
      throw error
    }
  }

  console.log(`[INGEST] Stored ${rows.length} injuries for ${sport}`)
}

async function main() {
  try {
    const supabase = createServiceClient()
    for (const sport of SUPPORTED_SPORTS) {
      await ingestSport(supabase, sport)
    }
    console.log('\n[INGEST] Injury cache updated successfully.')
    process.exit(0)
  } catch (error) {
    console.error('[INGEST] Failed to ingest injuries:', error)
    process.exit(1)
  }
}

main()
