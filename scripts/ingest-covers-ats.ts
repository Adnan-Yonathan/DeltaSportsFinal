/**
 * Ingest Covers.com ATS Records
 * 
 * Scrapes ATS (Against The Spread) records for all NBA teams from Covers.com
 * and upserts them into the team_ats_records table.
 * 
 * Run: npm run ingest:covers-ats
 * Schedule: Daily at 6 AM
 */

import { createClient } from '@supabase/supabase-js'
import {
  scrapeAllNBAATSTrends,
  mapATSRecordToRow,
  getCurrentNBASeason,
} from '../lib/providers/covers'

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
  console.log('Covers.com ATS Records Ingestion')
  console.log('='.repeat(60))
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log(`Season: ${getCurrentNBASeason()}`)
  console.log()

  // Scrape all NBA teams
  const results = await scrapeAllNBAATSTrends()

  // Collect successful records
  const rows: any[] = []
  let successCount = 0
  let errorCount = 0

  for (const [slug, result] of results.entries()) {
    if (result.success && result.data) {
      const row = mapATSRecordToRow(result.data)
      rows.push(row)
      successCount++
    } else {
      console.error(`Failed to scrape ${slug}: ${result.error}`)
      errorCount++
    }
  }

  console.log()
  console.log(`Scraped ${successCount} teams successfully, ${errorCount} failures`)

  if (rows.length === 0) {
    console.log('No records to upsert')
    return
  }

  // Upsert to database
  console.log(`Upserting ${rows.length} records to team_ats_records...`)

  const { error } = await supabase
    .from('team_ats_records')
    .upsert(
      rows.map(row => ({
        team_provider_id: row.team_provider_id,
        sport_key: row.sport_key,
        season: row.season,
        season_type: row.season_type,
        record: row.record,
        team_name: row.team_name,
        covers_slug: row.covers_slug,
        home_ats_record: row.home_ats_record,
        away_ats_record: row.away_ats_record,
        favorite_ats_record: row.favorite_ats_record,
        underdog_ats_record: row.underdog_ats_record,
        over_under_record: row.over_under_record,
        last_10_ats: row.last_10_ats,
        ats_streak: row.ats_streak,
        captured_at: row.captured_at.toISOString(),
      })),
      { onConflict: 'team_provider_id,sport_key,season,season_type' }
    )

  if (error) {
    console.error('Upsert error:', error)
    process.exit(1)
  }

  console.log('✓ Upsert complete')
  console.log()
  console.log('='.repeat(60))
  console.log(`Completed at: ${new Date().toISOString()}`)
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

