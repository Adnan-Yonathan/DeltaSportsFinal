import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { fetchAllLiveScores } from "@/lib/live-scores"
import { getRoster, type RosterPlayer } from "@/lib/sports-stats-api"
import { getNbaPropProjectionsForPlayer } from "@/lib/services/nba-player-prop-model"
import { getNflPropProjectionsForPlayer } from "@/lib/services/nfl-player-prop-model"

/**
 * GET /api/cron/refresh-player-projections
 * Refreshes player projections cache for NBA and NFL
 * Triggered by Vercel cron job
 */

type SportKey = "basketball_nba" | "americanfootball_nfl"

const NBA_MARKETS = ["points", "rebounds", "assists"] as const
const NFL_MARKETS = [
  "passing_yards",
  "passing_tds",
  "rushing_yards",
  "rushing_tds",
  "receiving_yards",
  "receptions",
] as const

const normalizeTeam = (value?: string | null) =>
  (value ?? "").replace(/[^a-zA-Z]/g, "").toUpperCase()

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = []
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }).map(
    async () => {
      while (index < items.length) {
        const current = items[index]
        index += 1
        results.push(await handler(current))
      }
    }
  )
  await Promise.all(workers)
  return results
}

const getDateWithOffset = (offsetDays: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

interface PlayerProjection {
  id: string
  name: string
  team: string
  teamAbbr: string
  position: string
  game: string
  projections: Record<string, number | null>
}

const buildNbaProjections = async (date: string): Promise<PlayerProjection[]> => {
  const scores = await fetchAllLiveScores({ date })
  const nbaGames = (scores.games || []).filter(
    (game) => game.league === "nba" && game.bucket !== "completed"
  )

  const teamSet = new Set<string>()
  const matchupByTeam = new Map<string, string>()

  nbaGames.forEach((game) => {
    const home =
      game.competitors.find((c) => c.homeAway === "home") ?? game.competitors[0]
    const away =
      game.competitors.find((c) => c.homeAway === "away") ?? game.competitors[1]
    if (!home || !away) return
    const homeKey = normalizeTeam(home.abbreviation || home.name)
    const awayKey = normalizeTeam(away.abbreviation || away.name)
    if (homeKey) teamSet.add(homeKey)
    if (awayKey) teamSet.add(awayKey)
    const matchup = `${away.abbreviation || away.shortName} @ ${home.abbreviation || home.shortName}`
    if (homeKey) matchupByTeam.set(homeKey, matchup)
    if (awayKey) matchupByTeam.set(awayKey, matchup)
  })

  if (!teamSet.size) return []

  const roster = await getRoster("basketball_nba")
  const unique = new Map<string, RosterPlayer>()
  roster.forEach((player) => {
    const id = player.id || `${player.fullName}-${player.teamAbbr}`
    if (!unique.has(id)) unique.set(id, player)
  })

  const activeRoster = Array.from(unique.values()).filter((player) =>
    teamSet.has(normalizeTeam(player.teamAbbr || player.team))
  )

  const players = await mapWithConcurrency(
    activeRoster,
    6,
    async (player): Promise<PlayerProjection> => {
      let projections: Record<string, number | null> = {}
      try {
        const result = await getNbaPropProjectionsForPlayer(
          player.fullName || player.name
        )
        NBA_MARKETS.forEach((market) => {
          const entry = result[market]
          projections[market] =
            entry && Number.isFinite(entry.projection) && entry.projection > 0
              ? Number(entry.projection.toFixed(1))
              : null
        })
      } catch {
        projections = {}
      }

      return {
        id: player.id || `${player.fullName}-${player.teamAbbr}`,
        name: player.fullName || player.name,
        team: player.team || player.teamAbbr || "",
        teamAbbr: player.teamAbbr || "",
        position: player.position || "Unknown",
        game: matchupByTeam.get(normalizeTeam(player.teamAbbr || player.team)) || "",
        projections,
      }
    }
  )

  return players.sort((a, b) => a.name.localeCompare(b.name))
}

const buildNflProjections = async (date: string): Promise<PlayerProjection[]> => {
  // For NFL, fetch games for the next 7 days to capture full weekend slate
  const datesToFetch = Array.from({ length: 7 }, (_, i) => getDateWithOffset(i))

  const allScoresPromises = datesToFetch.map((d) => fetchAllLiveScores({ date: d }))
  const allScoresResults = await Promise.all(allScoresPromises)

  const seenGameIds = new Set<string>()
  const nflGames: typeof allScoresResults[0]["games"] = []

  for (const scores of allScoresResults) {
    for (const game of scores.games || []) {
      if (
        game.league === "nfl" &&
        game.bucket !== "completed" &&
        !seenGameIds.has(game.eventId)
      ) {
        seenGameIds.add(game.eventId)
        nflGames.push(game)
      }
    }
  }

  const teamSet = new Set<string>()
  const matchupByTeam = new Map<string, string>()

  nflGames.forEach((game) => {
    const home =
      game.competitors.find((c) => c.homeAway === "home") ?? game.competitors[0]
    const away =
      game.competitors.find((c) => c.homeAway === "away") ?? game.competitors[1]
    if (!home || !away) return
    const homeKey = normalizeTeam(home.abbreviation || home.name)
    const awayKey = normalizeTeam(away.abbreviation || away.name)
    if (homeKey) teamSet.add(homeKey)
    if (awayKey) teamSet.add(awayKey)
    const matchup = `${away.abbreviation || away.shortName} @ ${home.abbreviation || home.shortName}`
    if (homeKey) matchupByTeam.set(homeKey, matchup)
    if (awayKey) matchupByTeam.set(awayKey, matchup)
  })

  if (!teamSet.size) return []

  const roster = await getRoster("americanfootball_nfl")
  const unique = new Map<string, RosterPlayer>()
  roster.forEach((player) => {
    const id = player.id || `${player.fullName}-${player.teamAbbr}`
    if (!unique.has(id)) unique.set(id, player)
  })

  // Filter to teams playing and relevant positions
  const relevantPositions = new Set(["QB", "RB", "WR", "TE", "K", "FB"])
  const activeRoster = Array.from(unique.values()).filter((player) => {
    if (!teamSet.has(normalizeTeam(player.teamAbbr || player.team))) return false
    const pos = (player.position || "").toUpperCase()
    return relevantPositions.has(pos)
  })

  const players = await mapWithConcurrency(
    activeRoster,
    6,
    async (player): Promise<PlayerProjection> => {
      let projections: Record<string, number | null> = {}
      try {
        const result = await getNflPropProjectionsForPlayer(
          player.fullName || player.name
        )
        NFL_MARKETS.forEach((market) => {
          const entry = result[market]
          projections[market] =
            entry && Number.isFinite(entry.projection) && entry.projection > 0
              ? Number(entry.projection.toFixed(1))
              : null
        })
      } catch {
        projections = {}
      }

      return {
        id: player.id || `${player.fullName}-${player.teamAbbr}`,
        name: player.fullName || player.name,
        team: player.team || player.teamAbbr || "",
        teamAbbr: player.teamAbbr || "",
        position: (player.position || "Unknown").toUpperCase(),
        game: matchupByTeam.get(normalizeTeam(player.teamAbbr || player.team)) || "",
        projections,
      }
    }
  )

  return players.sort((a, b) => a.name.localeCompare(b.name))
}

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for production security
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const supabase = createServiceClient()

    console.log("[Cron: Player Projections] Starting refresh for NBA and NFL")

    const results: Array<{
      sport: string
      success: boolean
      playerCount?: number
      error?: string
    }> = []

    // Process NBA
    try {
      const nbaPlayers = await buildNbaProjections(today)
      const nbaPayload = {
        sport: "basketball_nba",
        date: today,
        updated_at: new Date().toISOString(),
        players: nbaPlayers,
        count: nbaPlayers.length,
      }

      const { error: nbaError } = (await supabase
        .from("player_projections_cache" as any)
        .upsert(nbaPayload as any, { onConflict: "sport" })) as unknown as {
        error: any
      }

      if (nbaError) {
        console.error("[Cron: Player Projections] NBA cache write failed:", nbaError)
        results.push({ sport: "basketball_nba", success: false, error: nbaError.message })
      } else {
        console.log(
          `[Cron: Player Projections] Cached ${nbaPlayers.length} NBA players`
        )
        results.push({
          sport: "basketball_nba",
          success: true,
          playerCount: nbaPlayers.length,
        })
      }
    } catch (error: any) {
      console.error("[Cron: Player Projections] NBA error:", error)
      results.push({ sport: "basketball_nba", success: false, error: error.message })
    }

    // Process NFL
    try {
      const nflPlayers = await buildNflProjections(today)
      const nflPayload = {
        sport: "americanfootball_nfl",
        date: today,
        updated_at: new Date().toISOString(),
        players: nflPlayers,
        count: nflPlayers.length,
      }

      const { error: nflError } = (await supabase
        .from("player_projections_cache" as any)
        .upsert(nflPayload as any, { onConflict: "sport" })) as unknown as {
        error: any
      }

      if (nflError) {
        console.error("[Cron: Player Projections] NFL cache write failed:", nflError)
        results.push({ sport: "americanfootball_nfl", success: false, error: nflError.message })
      } else {
        console.log(
          `[Cron: Player Projections] Cached ${nflPlayers.length} NFL players`
        )
        results.push({
          sport: "americanfootball_nfl",
          success: true,
          playerCount: nflPlayers.length,
        })
      }
    } catch (error: any) {
      console.error("[Cron: Player Projections] NFL error:", error)
      results.push({ sport: "americanfootball_nfl", success: false, error: error.message })
    }

    const successCount = results.filter((r) => r.success).length
    const totalPlayers = results.reduce((sum, r) => sum + (r.playerCount ?? 0), 0)

    console.log(
      `[Cron: Player Projections] Completed: ${successCount}/2 sports, ${totalPlayers} total players`
    )

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        successCount,
        totalSports: 2,
        totalPlayers,
      },
    })
  } catch (error: any) {
    console.error("[Cron: Player Projections] Fatal error:", error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
