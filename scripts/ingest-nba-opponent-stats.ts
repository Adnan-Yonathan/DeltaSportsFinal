/**
 * Ingest NBA Opponent-Allowed Stats (Basketball Reference static data).
 *
 * Run: npm run ingest:opponent-stats
 */
import "dotenv/config"
import { createServiceClient } from "@/lib/supabase/service"
import { getStaticNbaTeams } from "@/lib/nba-static-team-stats"

const buildSeasonLabel = () => {
  const now = new Date()
  const year = now.getUTCFullYear()
  const startYear = now.getUTCMonth() >= 9 ? year : year - 1
  const endYear = String(startYear + 1).slice(2)
  return `${startYear}-${endYear}`
}

const toNumber = (value: any): number | null => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const calcPct = (made?: number | null, attempts?: number | null) => {
  if (made == null || attempts == null || attempts === 0) return null
  return Number(((made / attempts) * 100).toFixed(3))
}

async function main() {
  console.log("=".repeat(60))
  console.log("NBA Opponent-Allowed Stats Ingestion (Basketball Reference)")
  console.log("=".repeat(60))
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log()

  const supabase = createServiceClient()
  const teams = getStaticNbaTeams()
  const seasonLabel = teams[0]?.season || buildSeasonLabel()

  if (!teams.length) {
    console.error("No static NBA team data loaded. Ensure BRef CSVs are present.")
    process.exit(1)
  }

  const ranked = [...teams]
    .filter((t) => t.stats?.defensiveRating != null)
    .sort(
      (a, b) =>
        (Number(a.stats?.defensiveRating) || 0) -
        (Number(b.stats?.defensiveRating) || 0)
    )

  const rankMap = new Map<string, number>()
  ranked.forEach((team, idx) => rankMap.set(team.team, idx + 1))

  const rows = teams.map((team) => {
    const stats = team.stats || {}
    const oppFgPct = calcPct(
      toNumber(stats.opponentFieldGoalsMadePerGame),
      toNumber(stats.opponentFieldGoalsAttemptedPerGame)
    )
    const oppFg3Pct = calcPct(
      toNumber(stats.opponentThreeMadePerGame),
      toNumber(stats.opponentThreeAttemptedPerGame)
    )

    return {
      sport_key: "basketball_nba",
      team_name: team.team,
      team_abbr: null,
      team_id: null,
      season: String(team.season || seasonLabel),

      opp_fg_pct: oppFgPct,
      opp_fg3_pct: oppFg3Pct,
      opp_efg_pct: toNumber(stats.opponentEffectiveFgPct),
      opp_ts_pct: toNumber(stats.opponentTrueShootingPct),

      opp_paint_pts_per_game: null,
      opp_fastbreak_pts_per_game: null,
      opp_second_chance_pts_per_game: null,
      opp_pts_off_to_per_game: null,

      opp_pace: toNumber(stats.pace),
      opp_possessions_per_game: null,

      opp_orb_pct: toNumber(stats.opponentOffensiveReboundPct),
      opp_drb_pct: toNumber(stats.opponentDefensiveReboundPct),

      opp_pts_per_game: toNumber(stats.pointsAgainstPerGame),
      opp_ast_per_game: toNumber(stats.opponentAssistsPerGame),
      opp_reb_per_game: toNumber(stats.opponentReboundsPerGame),
      opp_tov_per_game: toNumber(stats.opponentTurnoversPerGame),

      defensive_rating: toNumber(stats.defensiveRating),
      defensive_rank: rankMap.get(team.team) || null,

      captured_at: new Date().toISOString(),
    }
  })

  console.log(`Prepared ${rows.length} records for season ${seasonLabel}`)
  console.log(`Upserting ${rows.length} rows into opponent_allowed_stats...`)

  const { error } = await supabase
    .from("opponent_allowed_stats")
    .upsert(rows as any, { onConflict: "team_name,season" })

  if (error) {
    console.error("Upsert error:", error)
    process.exit(1)
  }

  console.log(`? Upserted ${rows.length} records`)
  console.log()
  console.log("=".repeat(60))
  console.log(`Completed at: ${new Date().toISOString()}`)
  console.log("=".repeat(60))
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
