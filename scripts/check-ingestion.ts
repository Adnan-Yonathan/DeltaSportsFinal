/**
 * Check recent ingestion results
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  console.log('='.repeat(60))
  console.log('Recent Ingestion Data Check')
  console.log('='.repeat(60))

  // Check betting splits
  const { data: splits, error: splitsError } = await supabase
    .from('public_betting_splits')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(5)

  console.log('\n📊 Recent Betting Splits:')
  if (splitsError) {
    console.error('Error:', splitsError.message)
  } else {
    console.log(`Total recent rows: ${splits?.length || 0}`)
    if (splits && splits.length > 0) {
      for (const s of splits) {
        console.log(`\n  ${s.away_team} @ ${s.home_team} (${s.market_type})`)
        console.log(`    Source: ${s.source}`)
        console.log(`    Bets: Away ${s.away_bets_pct}% | Home ${s.home_bets_pct}%`)
        if (s.away_money_pct) {
          console.log(`    Money: Away ${s.away_money_pct}% | Home ${s.home_money_pct}%`)
        }
        if (s.sharp_indicator && s.sharp_indicator !== 'neutral') {
          console.log(`    ⚠️ Sharp: ${s.sharp_indicator}`)
        }
      }
    }
  }

  // Check total splits count
  const { count } = await supabase
    .from('public_betting_splits')
    .select('*', { count: 'exact', head: true })

  console.log(`\n  Total splits in database: ${count}`)

  // Check ATS records
  const { data: ats, error: atsError } = await supabase
    .from('team_ats_records')
    .select('team_name, overall_ats_record, home_ats_record, away_ats_record')
    .order('team_name')
    .limit(10)

  console.log('\n\n🏀 Sample ATS Records (First 10 Teams):')
  if (atsError) {
    console.error('Error:', atsError.message)
  } else if (ats) {
    for (const a of ats) {
      console.log(`  ${a.team_name}: ${a.overall_ats_record} (H: ${a.home_ats_record}, A: ${a.away_ats_record})`)
    }
  }

  // Check total ATS count
  const { count: atsCount } = await supabase
    .from('team_ats_records')
    .select('*', { count: 'exact', head: true })

  console.log(`\n  Total teams with ATS data: ${atsCount}`)

  console.log('\n' + '='.repeat(60))
}

check().catch(console.error)
