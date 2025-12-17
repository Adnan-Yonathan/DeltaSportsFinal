/**
 * Ingest Multi-Source Public Betting Splits
 *
 * Scrapes public betting percentages and money splits from multiple sources:
 * - Covers.com (primary source)
 * - ScoresAndOdds.com (secondary source)
 *
 * Aggregates all sources to maximize game coverage.
 *
 * Run: npm run ingest:covers-splits
 * Schedule: Every 30 minutes during game days
 */

import { createClient } from '@supabase/supabase-js'
import {
  aggregateBettingSplits,
  mapBettingSplitsToRows,
} from '../lib/providers/betting-splits'

// Load environment
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  console.log('='.repeat(60))
  console.log('Multi-Source Public Betting Splits Ingestion')
  console.log('='.repeat(60))
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log()

  // Aggregate from all sources
  const result = await aggregateBettingSplits('basketball', 'nba')

  console.log()
  console.log('Source Breakdown:')
  for (const source of result.sourceResults) {
    const status = source.success ? '✓' : '✗'
    console.log(`  ${status} ${source.source}: ${source.games} games`)
    if (source.error) {
      console.log(`    Error: ${source.error}`)
    }
  }

  const splits = result.splits
  console.log()
  console.log(`Total coverage: ${splits.length} games (from ${result.totalSources} sources)`)

  if (splits.length === 0) {
    console.log('No games found today')
    return
  }

  // Convert to database rows
  const allRows = mapBettingSplitsToRows(splits)
  console.log(`Generated ${allRows.length} market rows`)

  if (allRows.length === 0) {
    console.log('No rows to insert')
    return
  }

  // Insert to database (not upsert - we want to track history)
  console.log(`Inserting ${allRows.length} rows to public_betting_splits...`)

  // Helper to safely format date
  const formatDate = (d: Date | null | undefined): string | null => {
    if (!d) return null
    try {
      const iso = d.toISOString()
      return iso
    } catch {
      return null
    }
  }

  const { error } = await supabase
    .from('public_betting_splits')
    .insert(
      allRows.map(row => ({
        sport_key: row.sport_key,
        game_id: row.game_id,
        home_team: row.home_team,
        away_team: row.away_team,
        game_time: formatDate(row.game_time),
        market_type: row.market_type,
        home_bets_pct: row.home_bets_pct,
        away_bets_pct: row.away_bets_pct,
        home_money_pct: row.home_money_pct,
        away_money_pct: row.away_money_pct,
        sharp_indicator: row.sharp_indicator,
        source: row.source,
        covers_game_id: row.covers_game_id,
        captured_at: formatDate(row.captured_at) || new Date().toISOString(),
      }))
    )

  if (error) {
    console.error('Insert error:', error)
    // Don't exit on unique constraint violations (expected for duplicate timestamps)
    if (!error.message?.includes('unique')) {
      process.exit(1)
    }
    console.log('Some rows skipped due to duplicates (expected behavior)')
  } else {
    console.log('✓ Insert complete')
  }

  // Log summary
  const sharpGames = allRows.filter(r => 
    r.sharp_indicator?.startsWith('sharp_')
  )
  
  console.log()
  console.log('Summary:')
  console.log(`  Games processed: ${splits.length}`)
  console.log(`  Market rows inserted: ${allRows.length}`)
  console.log(`  Sharp action detected: ${sharpGames.length} markets`)

  console.log()
  console.log('='.repeat(60))
  console.log(`Completed at: ${new Date().toISOString()}`)
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

