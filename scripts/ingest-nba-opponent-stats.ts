/**
 * Ingest NBA Opponent-Allowed Stats
 *
 * Fetches defensive/opponent-allowed advanced stats from stats.nba.com
 * including paint points, fastbreak points, and 2nd chance points allowed.
 *
 * Run: npm run ingest:opponent-stats
 * Schedule: Daily at 7 AM (stats update overnight)
 */

import { createClient } from '@supabase/supabase-js'
import {
  getAllTeamOpponentStats,
  calculateDefensiveRankings,
  getCurrentNbaSeason,
  type OpponentAllowedStats,
} from '../lib/providers/nba-stats'

// Load environment
import 'dotenv/config'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function upsertOpponentStats(stats: OpponentAllowedStats[]): Promise<number> {
  if (stats.length === 0) return 0

  const rows = stats.map(s => ({
    sport_key: s.sportKey,
    team_name: s.teamName,
    team_abbr: s.teamAbbr,
    team_id: s.teamId,
    season: s.season,

    // Shooting allowed
    opp_fg_pct: s.oppFgPct,
    opp_fg3_pct: s.oppFg3Pct,
    opp_efg_pct: s.oppEfgPct,
    opp_ts_pct: s.oppTsPct,

    // Points by play type
    opp_paint_pts_per_game: s.oppPaintPtsPerGame,
    opp_fastbreak_pts_per_game: s.oppFastbreakPtsPerGame,
    opp_second_chance_pts_per_game: s.oppSecondChancePtsPerGame,
    opp_pts_off_to_per_game: s.oppPtsOffToPerGame,

    // Pace and possessions
    opp_pace: s.oppPace,
    opp_possessions_per_game: s.oppPossessionsPerGame,

    // Rebounding allowed
    opp_orb_pct: s.oppOrbPct,
    opp_drb_pct: s.oppDrbPct,

    // Per-game defensive metrics
    opp_pts_per_game: s.oppPtsPerGame,
    opp_ast_per_game: s.oppAstPerGame,
    opp_reb_per_game: s.oppRebPerGame,
    opp_tov_per_game: s.oppTovPerGame,

    // Defensive rating
    defensive_rating: s.defensiveRating,

    // League ranking
    defensive_rank: s.defensiveRank,

    captured_at: s.capturedAt.toISOString(),
  }))

  const { error } = await supabase
    .from('opponent_allowed_stats')
    .upsert(rows, { onConflict: 'team_name,season' })

  if (error) {
    console.error('Upsert error:', error)
    return 0
  }

  return rows.length
}

async function main() {
  console.log('='.repeat(60))
  console.log('NBA Stats API Opponent-Allowed Stats Ingestion')
  console.log('='.repeat(60))
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log()

  // Parse command line args
  const args = process.argv.slice(2)
  const specificSeason = args.find(a => a.match(/^\d{4}-\d{2}$/))
  const season = specificSeason || getCurrentNbaSeason()

  console.log(`Fetching opponent-allowed stats for season ${season}...`)
  console.log()

  // Fetch all team stats from NBA Stats API
  const teamStats = await getAllTeamOpponentStats(season)

  if (teamStats.length === 0) {
    console.error('Failed to fetch team stats from NBA Stats API')
    process.exit(1)
  }

  console.log(`✓ Fetched stats for ${teamStats.length} teams`)

  // Calculate defensive rankings
  const rankedStats = calculateDefensiveRankings(teamStats)
  console.log(`✓ Calculated defensive rankings`)

  // Log sample data
  console.log()
  console.log('Sample data (top 5 defenses):')
  rankedStats.slice(0, 5).forEach((team, index) => {
    console.log(`  ${index + 1}. ${team.teamName}`)
    console.log(`     Defensive Rating: ${team.defensiveRating?.toFixed(1) || 'N/A'}`)
    console.log(`     Paint Pts Allowed: ${team.oppPaintPtsPerGame?.toFixed(1) || 'N/A'} ppg`)
    console.log(`     Fastbreak Pts Allowed: ${team.oppFastbreakPtsPerGame?.toFixed(1) || 'N/A'} ppg`)
    console.log(`     2nd Chance Pts Allowed: ${team.oppSecondChancePtsPerGame?.toFixed(1) || 'N/A'} ppg`)
  })

  console.log()
  console.log(`Upserting ${rankedStats.length} team records to opponent_allowed_stats...`)
  const upsertedCount = await upsertOpponentStats(rankedStats)
  console.log(`✓ Upserted ${upsertedCount} records`)

  console.log()
  console.log('Summary:')
  console.log(`  Season: ${season}`)
  console.log(`  Teams processed: ${rankedStats.length}`)
  console.log(`  Records upserted: ${upsertedCount}`)

  console.log()
  console.log('='.repeat(60))
  console.log(`Completed at: ${new Date().toISOString()}`)
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
