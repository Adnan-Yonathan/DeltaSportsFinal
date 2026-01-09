import { NextRequest, NextResponse } from "next/server"
import { mkdir, readFile, writeFile } from "fs/promises"
import { join } from "path"
import { fetchAllLiveScores } from "@/lib/live-scores"
import { getRoster } from "@/lib/sports-stats-api"
import { getNbaPropProjectionsForPlayer } from "@/lib/services/nba-player-prop-model"

export const dynamic = "force-dynamic"

const CACHE_DIR = join(process.cwd(), "cache")
const CACHE_PATH = join(CACHE_DIR, "player-projections-nba.json")
const CACHE_TTL_MS = 1000 * 60 * 15

const TARGET_MARKETS = ["points", "rebounds", "assists"] as const

const normalizeTeam = (value?: string | null) =>
  (value ?? "").replace(/[^a-zA-Z]/g, "").toUpperCase()

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<R>
) => {
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

const readCache = async () => {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8")
    const parsed = JSON.parse(raw)
    if (!parsed?.updatedAt || !Array.isArray(parsed?.data)) return null
    return parsed
  } catch (error) {
    return null
  }
}

const writeCache = async (payload: {
  updatedAt: string
  date: string
  count: number
  data: Array<{
    id?: string
    player: string
    team?: string
    teamAbbr?: string
    game?: string
    projections: Record<string, number | null>
  }>
}) => {
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(CACHE_PATH, JSON.stringify(payload, null, 2), "utf-8")
}

const buildPayload = async (date: string) => {
  const scores = await fetchAllLiveScores({ date })
  // Use bucket instead of status.completed for more reliable filtering
  // bucket is 'upcoming', 'live', or 'completed'
  const nbaGames = (scores.games || []).filter(
    (game) => game.league === "nba" && game.bucket !== "completed"
  )

  const teamSet = new Set<string>()
  const matchupByTeam = new Map<string, string>()

  nbaGames.forEach((game) => {
    const home =
      game.competitors.find((c) => c.homeAway === "home") ??
      game.competitors[0]
    const away =
      game.competitors.find((c) => c.homeAway === "away") ??
      game.competitors[1]
    if (!home || !away) return
    const homeKey = normalizeTeam(home.abbreviation || home.name)
    const awayKey = normalizeTeam(away.abbreviation || away.name)
    if (homeKey) teamSet.add(homeKey)
    if (awayKey) teamSet.add(awayKey)
    const homeLabel = home.abbreviation || home.shortName || home.name
    const awayLabel = away.abbreviation || away.shortName || away.name
    const matchup = `${awayLabel} @ ${homeLabel}`
    if (homeKey) matchupByTeam.set(homeKey, matchup)
    if (awayKey) matchupByTeam.set(awayKey, matchup)
  })

  if (!teamSet.size) {
    return {
      updatedAt: new Date().toISOString(),
      date,
      count: 0,
      data: [],
    }
  }

  const roster = await getRoster("basketball_nba")
  const unique = new Map<string, (typeof roster)[number]>()
  roster.forEach((player) => {
    const id = player.id || `${player.fullName}-${player.teamAbbr}`
    if (!unique.has(id)) unique.set(id, player)
  })

  const activeRoster = Array.from(unique.values()).filter((player) =>
    teamSet.has(normalizeTeam(player.teamAbbr || player.team))
  )

  const data = await mapWithConcurrency(activeRoster, 6, async (player) => {
    let projections: Record<string, number | null> = {}
    try {
      const result = await getNbaPropProjectionsForPlayer(
        player.fullName || player.name
      )
      TARGET_MARKETS.forEach((market) => {
        const entry = result[market]
        projections[market] =
          entry && Number.isFinite(entry.projection)
            ? Number(entry.projection.toFixed(1))
            : null
      })
    } catch (error) {
      projections = {}
    }

    return {
      id: player.id,
      player: player.fullName || player.name,
      team: player.team || player.teamAbbr,
      teamAbbr: player.teamAbbr,
      game: matchupByTeam.get(normalizeTeam(player.teamAbbr || player.team)),
      projections,
    }
  })

  data.sort((a, b) => a.player.localeCompare(b.player))

  return {
    updatedAt: new Date().toISOString(),
    date,
    count: data.length,
    data,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get("date") || undefined
    const forceRefresh = searchParams.get("refresh") === "1"
    const today = new Date().toISOString().slice(0, 10)
    const date = dateParam ?? today

    const cached = await readCache()
    if (cached && !forceRefresh) {
      const updatedAt = Date.parse(cached.updatedAt)
      if (Number.isFinite(updatedAt) && Date.now() - updatedAt < CACHE_TTL_MS) {
        return NextResponse.json({ ...cached, fromCache: true })
      }

      void buildPayload(date)
        .then((payload) => writeCache(payload))
        .catch((error) =>
          console.error("[player-projections] refresh failed", error)
        )

      return NextResponse.json({ ...cached, refreshing: true, fromCache: true })
    }

    const payload = await buildPayload(date)
    await writeCache(payload)
    return NextResponse.json({ ...payload, fromCache: false })
  } catch (error: any) {
    console.error("[player-projections] api error", error)
    return NextResponse.json(
      { error: "Unable to fetch player projections." },
      { status: 500 }
    )
  }
}
