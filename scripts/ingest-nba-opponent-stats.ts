/**
 * Ingest NBA Opponent-Allowed Stats (ESPN aggregate data).
 *
 * Run: npm run ingest:opponent-stats
 */
import "dotenv/config"
import { createServiceClient } from "@/lib/supabase/service"
import { getNbaOpponentStats } from "@/lib/services/espn-opponent-stats"
import { getNBATeamStats } from "@/lib/sports-stats-api"

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

const normalizeTeamKey = (value?: string) =>
  (value || "").toLowerCase().replace(/[^a-z0-9]/g, "")

async function main() {
  console.log("=".repeat(60))
  console.log("NBA Opponent-Allowed Stats Ingestion (ESPN)")
  console.log("=".repeat(60))
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log()

  const supabase = createServiceClient()
  const [opponentEntries, teams] = await Promise.all([
    getNbaOpponentStats(),
    getNBATeamStats(),
  ])
  const seasonLabel = buildSeasonLabel()

  if (!opponentEntries.length) {
    console.error("No opponent stats data returned from ESPN.")
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
  ranked.forEach((team, idx) => {
    const key = normalizeTeamKey(team.team)
    if (key) rankMap.set(key, idx + 1)
  })

  const teamMap = new Map<string, (typeof teams)[number]>()
  teams.forEach((team) => {
    const nameKey = normalizeTeamKey(team.team)
    const abbrKey = normalizeTeamKey(team.teamAbbr || "")
    if (nameKey) teamMap.set(nameKey, team)
    if (abbrKey) teamMap.set(abbrKey, team)
  })

  const rows = opponentEntries.map((entry) => {
    const stats = entry.stats || {}
    const match =
      teamMap.get(normalizeTeamKey(entry.teamName)) ||
      teamMap.get(normalizeTeamKey(entry.teamAbbr))
    const oppFgPct =
      toNumber(stats.opponentFieldGoalPct) ??
      calcPct(
        toNumber(stats.opponentFieldGoalsMadePerGame),
        toNumber(stats.opponentFieldGoalsAttemptedPerGame)
      )
    const oppFg3Pct =
      toNumber(stats.opponentThreePointPct) ??
      calcPct(
        toNumber(stats.opponentThreeMadePerGame),
        toNumber(stats.opponentThreeAttemptedPerGame)
      )

    return {
      sport_key: "basketball_nba",
      team_name: entry.teamName,
      team_abbr: entry.teamAbbr || null,
      team_id: entry.teamId || null,
      season: String(seasonLabel),

      opp_fg_pct: oppFgPct,
      opp_fg3_pct: oppFg3Pct,
      opp_efg_pct: toNumber(stats.opponentEffectiveFgPct),
      opp_ts_pct: toNumber(stats.opponentTrueShootingPct),

      opp_paint_pts_per_game: null,
      opp_fastbreak_pts_per_game: null,
      opp_second_chance_pts_per_game: null,
      opp_pts_off_to_per_game: null,

      opp_pace: toNumber(match?.stats?.pace),
      opp_possessions_per_game: null,

      opp_orb_pct: toNumber(stats.opponentOffensiveReboundPct),
      opp_drb_pct: toNumber(stats.opponentDefensiveReboundPct),

      opp_pts_per_game: toNumber(stats.opponentPointsPerGame),
      opp_ast_per_game: toNumber(stats.opponentAssistsPerGame),
      opp_reb_per_game: toNumber(stats.opponentReboundsPerGame),
      opp_tov_per_game: toNumber(stats.opponentTurnoversPerGame),

      defensive_rating: toNumber(match?.stats?.defensiveRating),
      defensive_rank:
        rankMap.get(normalizeTeamKey(entry.teamName)) ||
        rankMap.get(normalizeTeamKey(entry.teamAbbr)) ||
        null,

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
