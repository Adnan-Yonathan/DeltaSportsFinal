import { NextRequest, NextResponse } from "next/server"
import { fetchAllLiveScores, type LiveScoreGame } from "@/lib/live-scores"
import { getRoster, type RosterPlayer } from "@/lib/sports-stats-api"
import { getNbaPropProjectionsForPlayer } from "@/lib/services/nba-player-prop-model"
import { getNflPropProjectionsForPlayer } from "@/lib/services/nfl-player-prop-model"
import { fetchSbdGamePropsList, fetchSbdPlayerProps, resolveSbdLeague } from "@/lib/api/sbd"

export const dynamic = "force-dynamic"

type SportKey = "basketball_nba" | "americanfootball_nfl"

interface GameInfo {
  gameId: string
  matchup: string
  startTime: string
  status: "upcoming" | "live" | "completed"
}

interface MarketLine {
  line: number
  overOdds?: number
  underOdds?: number
  bestBook?: string
}

interface PlayerProjection {
  id: string
  name: string
  team: string
  teamAbbr: string
  position: string
  game: string
  projections: Record<string, number | null>
  marketLines?: Record<string, MarketLine>
  delta?: Record<string, number | null>
  edge?: Record<string, number | null>
}

interface DailyProjectionsResponse {
  sport: string
  date: string
  updatedAt: string
  games: GameInfo[]
  players: PlayerProjection[]
  positions: string[]
  count: number
}

const NBA_MARKETS = ["points", "rebounds", "assists"] as const
const NFL_MARKETS = ["passing_yards", "passing_tds", "rushing_yards", "rushing_tds", "receiving_yards", "receptions"] as const

// Position-specific markets for NFL
const NFL_POSITION_MARKETS: Record<string, readonly string[]> = {
  QB: ["passing_yards", "passing_tds", "rushing_yards"],
  RB: ["rushing_yards", "rushing_tds", "receptions", "receiving_yards"],
  WR: ["receiving_yards", "receptions", "rushing_yards"],
  TE: ["receiving_yards", "receptions"],
  K: ["passing_yards"], // placeholder - kickers don't have prop markets we track
  FB: ["rushing_yards", "receiving_yards", "receptions"],
}

// Get primary stat for sorting by position
const getPrimaryStat = (position: string): string => {
  switch (position) {
    case "QB": return "passing_yards"
    case "RB": return "rushing_yards"
    case "WR": return "receiving_yards"
    case "TE": return "receiving_yards"
    default: return "rushing_yards"
  }
}

const NFL_POSITIONS = ["QB", "RB", "WR", "TE", "K"] as const
const NBA_POSITIONS = ["G", "F", "C", "G-F", "F-C", "F-G", "C-F"] as const

const normalizeTeam = (value?: string | null) =>
  (value ?? "").replace(/[^a-zA-Z]/g, "").toUpperCase()

// Normalize player name for matching (remove suffixes, punctuation, handle "Last, First" format)
const normalizePlayerName = (name: string): string => {
  let normalized = name.toLowerCase().trim()

  // Handle "LastName, FirstName" format -> "FirstName LastName"
  if (normalized.includes(',')) {
    const parts = normalized.split(',').map(p => p.trim())
    if (parts.length === 2) {
      normalized = `${parts[1]} ${parts[0]}`
    }
  }

  return normalized
    .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, '') // Remove suffixes
    .replace(/['.]/g, '') // Remove apostrophes and periods
    .replace(/\s+/g, ' ') // Normalize whitespace
}

const normalizePosition = (pos?: string | null): string => {
  if (!pos) return "Unknown"
  const upper = pos.toUpperCase().trim()
  // Normalize NBA positions
  if (upper === "PG" || upper === "SG" || upper === "GUARD") return "G"
  if (upper === "SF" || upper === "PF" || upper === "FORWARD") return "F"
  if (upper === "CENTER") return "C"
  // NFL positions are already standard
  return upper
}

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

const fetchMarketLines = async (sport: SportKey): Promise<Map<string, Record<string, MarketLine>>> => {
  const linesByPlayer = new Map<string, Record<string, MarketLine>>()

  try {
    const league = resolveSbdLeague(sport)
    if (!league) return linesByPlayer

    // Try both SBD endpoints and merge results
    const [gamePropsResult, playerPropsResult] = await Promise.allSettled([
      fetchSbdGamePropsList(league, { limit: 2500 }),
      fetchSbdPlayerProps(league, { limit: 500 }),
    ])

    const gameProps = gamePropsResult.status === "fulfilled"
      ? (Array.isArray(gamePropsResult.value) ? gamePropsResult.value : gamePropsResult.value?.data || [])
      : []
    const playerProps = playerPropsResult.status === "fulfilled"
      ? (Array.isArray(playerPropsResult.value) ? playerPropsResult.value : playerPropsResult.value?.data || [])
      : []

    // Merge both sources
    const items = [...gameProps, ...playerProps]

    // Process playerProps with nested structure (SBD wp-json endpoint)
    for (const prop of playerProps) {
      const playerName = prop?.player?.name
      if (!playerName || typeof playerName !== "string") continue

      const normalizedName = normalizePlayerName(playerName)
      if (!linesByPlayer.has(normalizedName)) {
        linesByPlayer.set(normalizedName, {})
      }
      const playerLines = linesByPlayer.get(normalizedName)!

      const markets = prop?.markets || []
      for (const market of markets) {
        const marketName = (market?.name || market?.type || "").toLowerCase()

        // Map market names to our market keys
        // SBD uses formats like "total passing yards (incl. overtime)"
        let marketKey: string | null = null
        if (marketName.includes("passing yards") || marketName.includes("pass yards") || marketName.includes("pass yds")) marketKey = "passing_yards"
        else if (marketName.includes("passing touchdown") || marketName.includes("pass td")) marketKey = "passing_tds"
        else if ((marketName.includes("rushing yards") || marketName.includes("rush yards")) && !marketName.includes("receiving")) marketKey = "rushing_yards"
        else if (marketName.includes("rushing touchdown") || marketName.includes("rush td")) marketKey = "rushing_tds"
        else if (marketName.includes("receiving yards") || marketName.includes("rec yards")) marketKey = "receiving_yards"
        else if (marketName.includes("reception") || marketName.includes("receptions")) marketKey = "receptions"

        if (!marketKey) continue

        // Extract line and odds from market.books[].outcomes[]
        const books = market?.books || []
        let bestOver = { odds: Number.NEGATIVE_INFINITY, book: "", line: 0 }
        let bestUnder = { odds: Number.NEGATIVE_INFINITY, book: "", line: 0 }

        for (const book of books) {
          const bookName = book?.name || ""
          const outcomes = book?.outcomes || []

          for (const outcome of outcomes) {
            const outcomeType = (outcome?.type || "").toLowerCase()
            const line = Number(outcome?.total ?? 0)
            const odds = Number(outcome?.odds_american ?? 0)

            if (!Number.isFinite(line) || line <= 0 || !Number.isFinite(odds)) continue

            if (outcomeType === "over" && odds > bestOver.odds) {
              bestOver = { odds, book: bookName, line }
            } else if (outcomeType === "under" && odds > bestUnder.odds) {
              bestUnder = { odds, book: bookName, line }
            }
          }
        }

        if (bestOver.line > 0 || bestUnder.line > 0) {
          playerLines[marketKey] = {
            line: bestOver.line || bestUnder.line,
            overOdds: Number.isFinite(bestOver.odds) && bestOver.odds > Number.NEGATIVE_INFINITY ? bestOver.odds : undefined,
            underOdds: Number.isFinite(bestUnder.odds) && bestUnder.odds > Number.NEGATIVE_INFINITY ? bestUnder.odds : undefined,
            bestBook: bestOver.book || bestUnder.book,
          }
        }
      }
    }

    for (const entry of items) {
      const playerName = entry.player_name || entry?.player?.name || entry?.player
      if (!playerName || typeof playerName !== "string") continue

      const normalizedName = normalizePlayerName(playerName)
      if (!linesByPlayer.has(normalizedName)) {
        linesByPlayer.set(normalizedName, {})
      }

      const playerLines = linesByPlayer.get(normalizedName)!
      const marketName = (entry.name || entry.market || entry.prop_type || "").toLowerCase()

      // Map SBD market names to our market keys
      // SBD uses various formats: "rushing yards", "total rushing yards", "player rushing yards", etc.
      let marketKey: string | null = null
      if (marketName.includes("points") && !marketName.includes("plus")) marketKey = "points"
      else if (marketName.includes("rebounds") && !marketName.includes("plus")) marketKey = "rebounds"
      else if (marketName.includes("assists") && !marketName.includes("plus")) marketKey = "assists"
      else if (marketName.includes("passing yards") || marketName.includes("pass yards") || marketName.includes("pass yds")) marketKey = "passing_yards"
      else if (marketName.includes("passing touchdown") || marketName.includes("pass td") || marketName.includes("pass tds")) marketKey = "passing_tds"
      else if ((marketName.includes("rushing yards") || marketName.includes("rush yards") || marketName.includes("rush yds")) && !marketName.includes("receiving")) marketKey = "rushing_yards"
      else if (marketName.includes("rushing touchdown") || marketName.includes("rush td") || marketName.includes("rush tds")) marketKey = "rushing_tds"
      else if (marketName.includes("receiving yards") || marketName.includes("rec yards") || marketName.includes("rec yds")) marketKey = "receiving_yards"
      else if (marketName.includes("reception") || marketName.includes("receptions")) marketKey = "receptions"

      if (!marketKey) continue

      const sportsbooks = Array.isArray(entry?.sportsbooks) ? entry.sportsbooks : []
      let bestOver = { odds: Number.NEGATIVE_INFINITY, book: "", line: 0 }
      let bestUnder = { odds: Number.NEGATIVE_INFINITY, book: "", line: 0 }

      for (const book of sportsbooks) {
        const bookName = book?.name || ""
        const odds = book?.odds || {}
        const line = Number(odds?.over_points ?? odds?.under_points ?? book?.over_points ?? book?.under_points ?? 0)
        const overOdds = Number(odds?.over_american ?? odds?.over_decimal ?? book?.over_odds ?? 0)
        const underOdds = Number(odds?.under_american ?? odds?.under_decimal ?? book?.under_odds ?? 0)

        if (Number.isFinite(overOdds) && overOdds > bestOver.odds) {
          bestOver = { odds: overOdds, book: bookName, line }
        }
        if (Number.isFinite(underOdds) && underOdds > bestUnder.odds) {
          bestUnder = { odds: underOdds, book: bookName, line }
        }
      }

      if (bestOver.line > 0 || bestUnder.line > 0) {
        playerLines[marketKey] = {
          line: bestOver.line || bestUnder.line,
          overOdds: Number.isFinite(bestOver.odds) && bestOver.odds > Number.NEGATIVE_INFINITY ? bestOver.odds : undefined,
          underOdds: Number.isFinite(bestUnder.odds) && bestUnder.odds > Number.NEGATIVE_INFINITY ? bestUnder.odds : undefined,
          bestBook: bestOver.book || bestUnder.book,
        }
      }
    }
  } catch (error) {
    console.error("[daily-projections] market lines fetch error:", error)
  }

  return linesByPlayer
}

const buildNbaPayload = async (date: string): Promise<DailyProjectionsResponse> => {
  const scores = await fetchAllLiveScores({ date })
  const nbaGames = (scores.games || []).filter(
    (game) => game.league === "nba" && game.bucket !== "completed"
  )

  const games: GameInfo[] = nbaGames.map((game) => {
    const home = game.competitors.find((c) => c.homeAway === "home") ?? game.competitors[0]
    const away = game.competitors.find((c) => c.homeAway === "away") ?? game.competitors[1]
    return {
      gameId: game.eventId,
      matchup: `${away?.abbreviation || away?.shortName} @ ${home?.abbreviation || home?.shortName}`,
      startTime: game.startTime,
      status: game.bucket,
    }
  })

  const teamSet = new Set<string>()
  const matchupByTeam = new Map<string, string>()

  nbaGames.forEach((game) => {
    const home = game.competitors.find((c) => c.homeAway === "home") ?? game.competitors[0]
    const away = game.competitors.find((c) => c.homeAway === "away") ?? game.competitors[1]
    if (!home || !away) return
    const homeKey = normalizeTeam(home.abbreviation || home.name)
    const awayKey = normalizeTeam(away.abbreviation || away.name)
    if (homeKey) teamSet.add(homeKey)
    if (awayKey) teamSet.add(awayKey)
    const matchup = `${away.abbreviation || away.shortName} @ ${home.abbreviation || home.shortName}`
    if (homeKey) matchupByTeam.set(homeKey, matchup)
    if (awayKey) matchupByTeam.set(awayKey, matchup)
  })

  if (!teamSet.size) {
    return {
      sport: "basketball_nba",
      date,
      updatedAt: new Date().toISOString(),
      games: [],
      players: [],
      positions: [],
      count: 0,
    }
  }

  // Fetch roster and market lines in parallel
  const [roster, marketLines] = await Promise.all([
    getRoster("basketball_nba"),
    fetchMarketLines("basketball_nba"),
  ])

  // Filter to active roster (teams playing today)
  const unique = new Map<string, RosterPlayer>()
  roster.forEach((player) => {
    const id = player.id || `${player.fullName}-${player.teamAbbr}`
    if (!unique.has(id)) unique.set(id, player)
  })

  const activeRoster = Array.from(unique.values()).filter((player) =>
    teamSet.has(normalizeTeam(player.teamAbbr || player.team))
  )

  const positionsSet = new Set<string>()

  const players = await mapWithConcurrency(activeRoster, 8, async (player): Promise<PlayerProjection> => {
    const position = normalizePosition(player.position)
    positionsSet.add(position)

    let projections: Record<string, number | null> = {}
    try {
      const result = await getNbaPropProjectionsForPlayer(player.fullName || player.name)
      NBA_MARKETS.forEach((market) => {
        const entry = result[market]
        projections[market] = entry && Number.isFinite(entry.projection) && entry.projection > 0
          ? Number(entry.projection.toFixed(1))
          : null
      })
    } catch {
      projections = {}
    }

    // Get market lines for this player (use normalized name for matching)
    const playerKey = normalizePlayerName(player.fullName || player.name)
    const lines = marketLines.get(playerKey)

    // Calculate delta and edge
    const delta: Record<string, number | null> = {}
    const edge: Record<string, number | null> = {}

    if (lines) {
      NBA_MARKETS.forEach((market) => {
        const proj = projections[market]
        const line = lines[market]?.line
        if (proj != null && line != null && line > 0) {
          delta[market] = Number((proj - line).toFixed(1))
          edge[market] = Number((Math.abs(proj - line) / line * 100).toFixed(1))
        }
      })
    }

    return {
      id: player.id || `${player.fullName}-${player.teamAbbr}`,
      name: player.fullName || player.name,
      team: player.team || player.teamAbbr || "",
      teamAbbr: player.teamAbbr || "",
      position,
      game: matchupByTeam.get(normalizeTeam(player.teamAbbr || player.team)) || "",
      projections,
      marketLines: lines,
      delta: Object.keys(delta).length > 0 ? delta : undefined,
      edge: Object.keys(edge).length > 0 ? edge : undefined,
    }
  })

  // Sort by team, then by name
  players.sort((a, b) => {
    if (a.game !== b.game) return a.game.localeCompare(b.game)
    if (a.team !== b.team) return a.team.localeCompare(b.team)
    return a.name.localeCompare(b.name)
  })

  return {
    sport: "basketball_nba",
    date,
    updatedAt: new Date().toISOString(),
    games,
    players,
    positions: Array.from(positionsSet).sort(),
    count: players.length,
  }
}

// Helper to get date string for a given offset from today
const getDateWithOffset = (offsetDays: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

const buildNflPayload = async (date: string, positionFilter?: string): Promise<DailyProjectionsResponse> => {
  // For NFL, fetch games for the next 7 days to capture full weekend slate
  // (wildcard weekend, divisional round, etc.)
  const datesToFetch = [
    date, // Today or requested date
    getDateWithOffset(1),
    getDateWithOffset(2),
    getDateWithOffset(3),
    getDateWithOffset(4),
    getDateWithOffset(5),
    getDateWithOffset(6),
  ]

  // Fetch scores for all dates in parallel
  const allScoresPromises = datesToFetch.map((d) => fetchAllLiveScores({ date: d }))
  const allScoresResults = await Promise.all(allScoresPromises)

  // Collect all NFL games that aren't completed, dedupe by eventId
  const seenGameIds = new Set<string>()
  const nflGames: typeof allScoresResults[0]["games"] = []

  for (const scores of allScoresResults) {
    for (const game of scores.games || []) {
      if (game.league === "nfl" && game.bucket !== "completed" && !seenGameIds.has(game.eventId)) {
        seenGameIds.add(game.eventId)
        nflGames.push(game)
      }
    }
  }

  // Sort games by start time
  nflGames.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  // Format game time for display (e.g., "Sat 4:30 PM")
  const formatGameTime = (startTime: string): string => {
    try {
      const date = new Date(startTime)
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      const day = dayNames[date.getDay()]
      const hours = date.getHours()
      const minutes = date.getMinutes()
      const ampm = hours >= 12 ? "PM" : "AM"
      const hour12 = hours % 12 || 12
      const minuteStr = minutes.toString().padStart(2, "0")
      return `${day} ${hour12}:${minuteStr} ${ampm}`
    } catch {
      return ""
    }
  }

  const games: GameInfo[] = nflGames.map((game) => {
    const home = game.competitors.find((c) => c.homeAway === "home") ?? game.competitors[0]
    const away = game.competitors.find((c) => c.homeAway === "away") ?? game.competitors[1]
    const timeStr = formatGameTime(game.startTime)
    return {
      gameId: game.eventId,
      matchup: `${away?.abbreviation || away?.shortName} @ ${home?.abbreviation || home?.shortName}${timeStr ? ` - ${timeStr}` : ""}`,
      startTime: game.startTime,
      status: game.bucket,
    }
  })

  const teamSet = new Set<string>()
  const matchupByTeam = new Map<string, string>()

  nflGames.forEach((game) => {
    const home = game.competitors.find((c) => c.homeAway === "home") ?? game.competitors[0]
    const away = game.competitors.find((c) => c.homeAway === "away") ?? game.competitors[1]
    if (!home || !away) return
    const homeKey = normalizeTeam(home.abbreviation || home.name)
    const awayKey = normalizeTeam(away.abbreviation || away.name)
    if (homeKey) teamSet.add(homeKey)
    if (awayKey) teamSet.add(awayKey)
    const timeStr = formatGameTime(game.startTime)
    const matchup = `${away.abbreviation || away.shortName} @ ${home.abbreviation || home.shortName}${timeStr ? ` - ${timeStr}` : ""}`
    if (homeKey) matchupByTeam.set(homeKey, matchup)
    if (awayKey) matchupByTeam.set(awayKey, matchup)
  })

  if (!teamSet.size) {
    return {
      sport: "americanfootball_nfl",
      date,
      updatedAt: new Date().toISOString(),
      games: [],
      players: [],
      positions: [...NFL_POSITIONS],
      count: 0,
    }
  }

  // Fetch roster and market lines in parallel
  const [roster, marketLines] = await Promise.all([
    getRoster("americanfootball_nfl"),
    fetchMarketLines("americanfootball_nfl"),
  ])

  // Filter to active roster (teams playing today)
  const unique = new Map<string, RosterPlayer>()
  roster.forEach((player) => {
    const id = player.id || `${player.fullName}-${player.teamAbbr}`
    if (!unique.has(id)) unique.set(id, player)
  })

  let activeRoster = Array.from(unique.values()).filter((player) =>
    teamSet.has(normalizeTeam(player.teamAbbr || player.team))
  )

  // Filter by position if specified
  if (positionFilter && positionFilter !== "All") {
    activeRoster = activeRoster.filter((player) => {
      const pos = (player.position || "").toUpperCase()
      return pos === positionFilter || pos.startsWith(positionFilter)
    })
  }

  // Also filter to relevant positions (skip OL, DL, etc. unless they have props)
  const relevantPositions = new Set(["QB", "RB", "WR", "TE", "K", "FB"])
  activeRoster = activeRoster.filter((player) => {
    const pos = (player.position || "").toUpperCase()
    return relevantPositions.has(pos) || marketLines.has((player.fullName || player.name).toLowerCase().trim())
  })

  const positionsSet = new Set<string>()

  const players = await mapWithConcurrency(activeRoster, 8, async (player): Promise<PlayerProjection> => {
    const position = (player.position || "Unknown").toUpperCase()
    positionsSet.add(position)

    let projections: Record<string, number | null> = {}
    try {
      const result = await getNflPropProjectionsForPlayer(player.fullName || player.name)
      NFL_MARKETS.forEach((market) => {
        const entry = result[market]
        projections[market] = entry && Number.isFinite(entry.projection) && entry.projection > 0
          ? Number(entry.projection.toFixed(1))
          : null
      })
    } catch {
      projections = {}
    }

    // Get market lines for this player (use normalized name for matching)
    const playerKey = normalizePlayerName(player.fullName || player.name)
    const lines = marketLines.get(playerKey)

    // Calculate delta and edge
    const delta: Record<string, number | null> = {}
    const edge: Record<string, number | null> = {}

    if (lines) {
      NFL_MARKETS.forEach((market) => {
        const proj = projections[market]
        const line = lines[market]?.line
        if (proj != null && line != null && line > 0) {
          delta[market] = Number((proj - line).toFixed(1))
          edge[market] = Number((Math.abs(proj - line) / line * 100).toFixed(1))
        }
      })
    }

    return {
      id: player.id || `${player.fullName}-${player.teamAbbr}`,
      name: player.fullName || player.name,
      team: player.team || player.teamAbbr || "",
      teamAbbr: player.teamAbbr || "",
      position,
      game: matchupByTeam.get(normalizeTeam(player.teamAbbr || player.team)) || "",
      projections,
      marketLines: lines,
      delta: Object.keys(delta).length > 0 ? delta : undefined,
      edge: Object.keys(edge).length > 0 ? edge : undefined,
    }
  })

  // Filter out backup players without market lines
  // But only filter if their position has lines available (don't filter all QBs if no QB lines exist)
  const hasAnyMarketLines = marketLines.size > 0

  // Check which positions have market lines available
  const positionsWithLines = new Set<string>()
  players.forEach((player) => {
    if (player.marketLines && Object.keys(player.marketLines).length > 0) {
      positionsWithLines.add(player.position)
    }
  })

  // Minimum projection thresholds to filter out backups (when no lines available)
  const MIN_PROJECTION_THRESHOLDS: Record<string, Record<string, number>> = {
    QB: { passing_yards: 150 }, // Starter typically projects 200+
    RB: { rushing_yards: 30 },
    WR: { receiving_yards: 30 },
    TE: { receiving_yards: 20 },
    FB: { rushing_yards: 5, receiving_yards: 5 },
  }

  const playersWithLines = hasAnyMarketLines
    ? players.filter((player) => {
        // If this position has no lines at all, filter by projection threshold
        if (!positionsWithLines.has(player.position)) {
          const thresholds = MIN_PROJECTION_THRESHOLDS[player.position]
          if (!thresholds) return false

          // Check if any projection meets the threshold
          for (const [market, minValue] of Object.entries(thresholds)) {
            const proj = player.projections[market]
            if (proj != null && proj >= minValue) {
              return true
            }
          }
          return false
        }
        // If this position has lines, only show players who have lines
        if (!player.marketLines || Object.keys(player.marketLines).length === 0) {
          return false
        }
        return true
      })
    : players // If no market lines from API, show all players with projections

  // Sort by game, then position priority, then by highest projection for their position
  const positionPriority: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, FB: 6 }
  playersWithLines.sort((a, b) => {
    if (a.game !== b.game) return a.game.localeCompare(b.game)
    const posA = positionPriority[a.position] ?? 99
    const posB = positionPriority[b.position] ?? 99
    if (posA !== posB) return posA - posB

    // Within same position, sort by primary stat projection (highest first)
    const primaryStatA = getPrimaryStat(a.position)
    const primaryStatB = getPrimaryStat(b.position)
    const projA = a.projections[primaryStatA] ?? 0
    const projB = b.projections[primaryStatB] ?? 0
    return projB - projA // Descending order
  })

  return {
    sport: "americanfootball_nfl",
    date,
    updatedAt: new Date().toISOString(),
    games,
    players: playersWithLines,
    positions: [...NFL_POSITIONS],
    count: playersWithLines.length,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get("sport") as SportKey | null
    const dateParam = searchParams.get("date") || undefined
    const positionFilter = searchParams.get("position") || undefined

    const today = new Date().toISOString().slice(0, 10)
    const date = dateParam ?? today

    if (!sport) {
      return NextResponse.json(
        { error: "Sport parameter is required (basketball_nba or americanfootball_nfl)" },
        { status: 400 }
      )
    }

    if (sport !== "basketball_nba" && sport !== "americanfootball_nfl") {
      return NextResponse.json(
        { error: `Unsupported sport: ${sport}. Only basketball_nba and americanfootball_nfl are supported.` },
        { status: 400 }
      )
    }

    const payload = sport === "basketball_nba"
      ? await buildNbaPayload(date)
      : await buildNflPayload(date, positionFilter)

    return NextResponse.json(payload)
  } catch (error: any) {
    console.error("[daily-projections] api error:", error)
    return NextResponse.json(
      { error: "Failed to fetch daily projections", details: error.message },
      { status: 500 }
    )
  }
}
