/**
 * Ingest recent team performance logs into Supabase team_trends.
 *
 * Run with:
 *   npx ts-node scripts/ingest-recent-form.ts
 */
import "dotenv/config"
import { createServiceClient } from "@/lib/supabase/service"
import type { Database } from "@/lib/supabase/types"

const SPORT_CONFIGS = [
  { sportKey: "basketball_nba", path: "basketball/nba" },
  { sportKey: "basketball_ncaab", path: "basketball/mens-college-basketball" },
  { sportKey: "americanfootball_nfl", path: "americanfootball/nfl" },
  { sportKey: "americanfootball_ncaaf", path: "americanfootball/college-football" },
  { sportKey: "baseball_mlb", path: "baseball/mlb" },
  { sportKey: "icehockey_nhl", path: "hockey/nhl" },
]

type RecentFormRow = Database["public"]["Tables"]["team_trends"]["Insert"]

interface RecentGame {
  sportKey: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  date: string
}

async function fetchRecentGames(
  config: { sportKey: string; path: string },
  days = 7
): Promise<RecentGame[]> {
  const games: RecentGame[] = []
  const today = new Date()
  const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${config.path}/scoreboard`

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateParam = date.toISOString().slice(0, 10).replace(/-/g, "")
    const url = `${baseUrl}?dates=${dateParam}`

    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.warn(`[INGEST][${config.sportKey}] Failed to load scoreboard for ${dateParam}`)
        continue
      }

      const data = await response.json()
      for (const event of data.events || []) {
        const competition = event.competitions?.[0]
        const competitors = competition?.competitors
        if (!competition || !competitors) continue

        const home = competitors.find((c: any) => c.homeAway === "home")
        const away = competitors.find((c: any) => c.homeAway === "away")
        if (!home || !away) continue

        games.push({
          sportKey: config.sportKey,
          homeTeam: home.team?.displayName,
          awayTeam: away.team?.displayName,
          homeScore: Number(home.score),
          awayScore: Number(away.score),
          date: competition.date || event.date,
        })
      }
    } catch (error) {
      console.error(`[INGEST][${config.sportKey}] Error fetching games for ${dateParam}:`, error)
    }
  }

  return games
}

function computeEntry(game: RecentGame, team: "home" | "away") {
  const isHome = team === "home"
  const teamName = isHome ? game.homeTeam : game.awayTeam
  const opponent = isHome ? game.awayTeam : game.homeTeam
  const pointsFor = isHome ? game.homeScore : game.awayScore
  const pointsAgainst = isHome ? game.awayScore : game.homeScore
  const result = pointsFor > pointsAgainst ? "W" : pointsFor < pointsAgainst ? "L" : "T"
  const netRating = pointsFor - pointsAgainst

  return {
    sport_key: game.sportKey,
    team_name: teamName,
    opponent,
    result,
    points_for: pointsFor,
    points_against: pointsAgainst,
    net_rating: netRating,
  }
}

async function ingestRecentForm() {
  const supabase = createServiceClient()

  for (const config of SPORT_CONFIGS) {
    const games = await fetchRecentGames(config, 7)
    if (!games.length) {
      console.warn(`[INGEST][FORM] No games fetched for ${config.sportKey}`)
      continue
    }

    const rows = games.flatMap((game) => [
      computeEntry(game, "home"),
      computeEntry(game, "away"),
    ])

    const grouped = new Map<string, typeof rows>()
    for (const row of rows) {
      if (!row.team_name) continue
      const key = `${row.sport_key}::${row.team_name}`
      const entry = grouped.get(key)
      if (entry) entry.push(row)
      else grouped.set(key, [row])
    }

    const payload: RecentFormRow[] = Array.from(grouped.entries()).map(([key, entries]) => {
      const [sportKey, teamName] = key.split("::")
      const gamesPlayed = entries.length
      const wins = entries.filter((e) => e.result === "W").length
      const losses = entries.filter((e) => e.result === "L").length
      const avgFor = gamesPlayed ? entries.reduce((sum, e) => sum + (e.points_for || 0), 0) / gamesPlayed : null
      const avgAgainst = gamesPlayed ? entries.reduce((sum, e) => sum + (e.points_against || 0), 0) / gamesPlayed : null
      const avgNet = gamesPlayed ? entries.reduce((sum, e) => sum + (e.net_rating || 0), 0) / gamesPlayed : null

      const summaryParts: string[] = []
      summaryParts.push(`${wins}-${losses}`)
      if (avgFor != null && avgAgainst != null) {
        summaryParts.push(`avg ${avgFor.toFixed(1)}-${avgAgainst.toFixed(1)}`)
      }

      return {
        sport_key: sportKey,
        team_name: teamName,
        trend_type: "recent_form",
        trend_window: "last7",
        trend_summary: summaryParts.join("; "),
        metrics: {
          games_played: gamesPlayed,
          wins,
          losses,
          avg_points_for: avgFor,
          avg_points_against: avgAgainst,
          avg_net: avgNet,
        },
        captured_at: new Date().toISOString(),
      }
    })

    if (!payload.length) {
      console.warn(`[INGEST][FORM] No recent form rows built for ${config.sportKey}`)
      continue
    }

    const { error: deleteError } = await supabase
      .from("team_trends")
      .delete()
      .eq("sport_key", config.sportKey)
      .eq("trend_type", "recent_form")
      .eq("trend_window", "last7")

    if (deleteError) {
      console.error(`[INGEST][FORM] Failed to clear recent_form for ${config.sportKey}:`, deleteError.message)
      throw deleteError
    }

    const chunkSize = 500
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize)
      const { error } = await supabase.from("team_trends").insert(chunk as any)
      if (error) {
        console.error(`[INGEST][FORM] Failed to insert chunk for ${config.sportKey}:`, error.message)
        throw error
      }
    }

    console.log(`[INGEST][FORM] Stored ${payload.length} team_trends rows for ${config.sportKey}`)
  }
}

ingestRecentForm().catch((error) => {
  console.error("[INGEST][FORM] Failed:", error)
  process.exit(1)
})
