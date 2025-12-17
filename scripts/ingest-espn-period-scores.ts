/**
 * Ingest ESPN NBA Period Scores
 *
 * Fetches boxscores from ESPN for completed games and extracts period-by-period scoring
 * into the period_scores table.
 *
 * Run: npm run ingest:period-scores
 * Run with specific date: npm run ingest:period-scores 2025-12-15
 * Run with backfill: npm run ingest:period-scores --backfill 7
 *
 * Schedule: After game finals (or daily at 7 AM to catch overnight games)
 */

import { createClient } from '@supabase/supabase-js'
import {
  fetchEspnDailyPeriodScores,
  fetchEspnRecentPeriodScores,
  type PeriodScoreRecord,
} from '../lib/providers/espn-period-scores'

// Load environment
import 'dotenv/config'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function upsertPeriodScores(records: PeriodScoreRecord[]): Promise<number> {
  if (records.length === 0) return 0

  const rows = records.map(r => ({
    sport_key: 'basketball_nba',
    game_id: r.gameId,
    home_team: r.homeTeam,
    away_team: r.awayTeam,
    home_team_abbr: r.homeTeamAbbr || null,
    away_team_abbr: r.awayTeamAbbr || null,
    game_date: r.gameDate.toISOString().split('T')[0],
    period_number: r.periodNumber,
    period_type: r.periodType,
    home_points: r.homePoints,
    away_points: r.awayPoints,
    captured_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('period_scores')
    .upsert(rows, { onConflict: 'game_id,period_number' })

  if (error) {
    console.error('Upsert error:', error)
    return 0
  }

  return rows.length
}

async function main() {
  console.log('='.repeat(60))
  console.log('ESPN NBA Period Scores Ingestion')
  console.log('='.repeat(60))
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log()

  // Parse command line args
  const args = process.argv.slice(2)
  const backfillDays = args.includes('--backfill')
    ? parseInt(args[args.indexOf('--backfill') + 1] || '7')
    : 0
  const specificDate = args.find(a => a.match(/^\d{4}-\d{2}-\d{2}$/))

  let records: PeriodScoreRecord[] = []

  if (backfillDays > 0) {
    // Backfill mode: fetch multiple days
    console.log(`Backfill mode: fetching last ${backfillDays} days`)
    records = await fetchEspnRecentPeriodScores(backfillDays)
  } else if (specificDate) {
    // Specific date mode
    console.log(`Fetching period scores for ${specificDate}`)
    const date = new Date(specificDate)
    records = await fetchEspnDailyPeriodScores(date)
  } else {
    // Default: fetch yesterday's games (most likely to be complete)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    console.log(`Fetching period scores for ${yesterday.toISOString().split('T')[0]}`)
    records = await fetchEspnDailyPeriodScores(yesterday)
  }

  console.log()
  console.log(`Fetched ${records.length} period records`)

  if (records.length === 0) {
    console.log('No records to upsert')
    return
  }

  // Upsert to database
  console.log(`Upserting ${records.length} records to period_scores...`)
  const upsertedCount = await upsertPeriodScores(records)
  console.log(`✓ Upserted ${upsertedCount} records`)

  // Log summary by game
  const gameCount = new Set(records.map(r => r.gameId)).size
  console.log()
  console.log('Summary:')
  console.log(`  Games processed: ${gameCount}`)
  console.log(`  Period records: ${records.length}`)

  console.log()
  console.log('='.repeat(60))
  console.log(`Completed at: ${new Date().toISOString()}`)
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
