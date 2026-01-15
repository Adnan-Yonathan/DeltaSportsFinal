import { fetchGameDetails } from "@/lib/live-scores"
import type { PregameSpreadContext, LiveGameState } from "@/lib/services/live-game-analyzer"
import { analyzeLiveGame } from "@/lib/services/live-game-analyzer"
import { calculateLiveSpread } from "@/lib/services/live-line-calculator"
import type { TeamStats } from "@/lib/services/pregame-value-calculator"
import { getTeamStats } from "@/lib/services/matchup-analyzer"
import { buildTeamLabel, fetchSbdOdds, resolveSbdLeague, type SbdLeague } from "@/lib/api/sbd"
import {
  buildSharpSignalsFromSplits,
  calculateSharpBiasFromSignals,
} from "@/lib/services/sharp-bias"
import { detectEdgeForGame, type SharpSignal } from "@/lib/services/edge-detection"

export interface LiveSpreadProjection {
  eventId: string
  matchup: string
  generatedAt: string
  gameState: {
    homeTeam: string
    awayTeam: string
    homeScore: number
    awayScore: number
    period: number
    displayClock: string
    isLive: boolean
  }
  projection: {
    fairLine: number
    confidence: "low" | "medium" | "high"
    confidenceInterval: {
      lower: number
      upper: number
      range: number
    }
    recommendation: string
    factors: string[]
  }
}

const LIVE_PROJECTION_TIMEOUT_MS = 4800

const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Live projection timed out."))
    }, ms)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer))
  })

const isLiveState = (state?: string) => {
  if (!state) return false
  const normalized = state.toLowerCase()
  return normalized === "in" || normalized === "mid" || normalized === "halftime"
}

const ensureTeamStats = (stats: unknown, label: string): TeamStats => {
  const typed = stats as TeamStats
  if (typeof typed?.ortg !== "number" || typeof typed?.drtg !== "number") {
    throw new Error(`Invalid ${label} stats for live projection`)
  }
  return typed
}

async function fetchPregameSpread(
  homeTeam: string,
  awayTeam: string,
  league: string
): Promise<PregameSpreadContext | undefined> {
  try {
    const sportKeyByLeague: Record<string, string> = {
      nba: "basketball_nba",
      ncaab: "basketball_ncaab",
      nfl: "americanfootball_nfl",
      ncaaf: "americanfootball_ncaaf",
      cfb: "americanfootball_ncaaf",
      nhl: "icehockey_nhl",
      mlb: "baseball_mlb",
    }
    const sportKey = sportKeyByLeague[league] || league
    const sbdLeague = resolveSbdLeague(sportKey) || "nba"
    const sbdData = await fetchSbdOdds(sbdLeague, { init: { cache: "no-store" } })
    const sbdGames = Array.isArray(sbdData?.data)
      ? sbdData.data
      : Array.isArray(sbdData)
        ? sbdData
        : []

    if (!sbdGames.length) return undefined

    const normalize = (value: string) => {
      const cleaned = (value || "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
      if (!cleaned) return ""
      const tokens = cleaned
        .split(" ")
        .map((token) => {
          if (token === "state" || token === "st" || token === "saint") return "st"
          if (token === "university" || token === "college" || token === "the") {
            return ""
          }
          return token
        })
        .filter(Boolean)
      return tokens.join("")
    }

    const homeNorm = normalize(homeTeam)
    const awayNorm = normalize(awayTeam)

    const matchingGame = sbdGames.find((game: any) => {
      const rawHome =
        game?.home_team ||
        game?.homeTeam ||
        buildTeamLabel(game?.competitors?.home) ||
        game?.competitors?.home?.name ||
        game?.competitors?.home?.displayName ||
        ""
      const rawAway =
        game?.away_team ||
        game?.awayTeam ||
        buildTeamLabel(game?.competitors?.away) ||
        game?.competitors?.away?.name ||
        game?.competitors?.away?.displayName ||
        ""
      const gameHome = normalize(rawHome)
      const gameAway = normalize(rawAway)
      if (!gameHome || !gameAway) return false
      const homeMatch = gameHome.includes(homeNorm) || homeNorm.includes(gameHome)
      const awayMatch = gameAway.includes(awayNorm) || awayNorm.includes(gameAway)
      const reverseHomeMatch = gameHome.includes(awayNorm) || awayNorm.includes(gameHome)
      const reverseAwayMatch = gameAway.includes(homeNorm) || homeNorm.includes(gameAway)
      return (homeMatch && awayMatch) || (reverseHomeMatch && reverseAwayMatch)
    })

    if (!matchingGame) return undefined

    const matchedHome =
      matchingGame?.home_team ||
      matchingGame?.homeTeam ||
      buildTeamLabel(matchingGame?.competitors?.home) ||
      matchingGame?.competitors?.home?.name ||
      matchingGame?.competitors?.home?.displayName
    const matchedAway =
      matchingGame?.away_team ||
      matchingGame?.awayTeam ||
      buildTeamLabel(matchingGame?.competitors?.away) ||
      matchingGame?.competitors?.away?.name ||
      matchingGame?.competitors?.away?.displayName

    const markets = matchingGame?.markets || matchingGame?.marketsByPeriod || {}
    const spreadBooks = markets?.spread?.books || []
    const totalBooks = markets?.total?.books || []

    let openingSpread: number | null = null
    let currentSpread: number | null = null
    let openingTotal: number | null = null
    let currentTotal: number | null = null

    for (const book of spreadBooks) {
      const homeOpenSpread = parseFloat(book?.home?.opening_spread)
      const homeSpread = parseFloat(book?.home?.spread)
      if (!Number.isNaN(homeOpenSpread)) {
        openingSpread = homeOpenSpread
        currentSpread = !Number.isNaN(homeSpread) ? homeSpread : null
        break
      }
    }

    for (const book of totalBooks) {
      const openTotal = parseFloat(book?.over?.opening_total ?? book?.opening_total)
      const total = parseFloat(book?.over?.total ?? book?.total)
      if (!Number.isNaN(openTotal)) {
        openingTotal = openTotal
        currentTotal = !Number.isNaN(total) ? total : null
        break
      }
    }

    if (openingSpread === null) return undefined

    const splits = matchingGame?.bettingSplits
    const sharpSignals: SharpSignal[] = []
    if (sbdLeague) {
      const sharpResult = await detectEdgeForGame(
        sbdLeague as SbdLeague,
        `${awayTeam} @ ${homeTeam}`
      )
      if (sharpResult?.sharpSignals?.length) {
        sharpSignals.push(...sharpResult.sharpSignals)
      }
    }
    if (!sharpSignals.length) {
      sharpSignals.push(
        ...buildSharpSignalsFromSplits({
          splits: {
            spreadHomeBetPct: splits?.spread?.home?.betsPercentage,
            spreadHomeMoneyPct: splits?.spread?.home?.stakePercentage,
            totalOverBetPct: splits?.total?.over?.betsPercentage,
            totalOverMoneyPct: splits?.total?.over?.stakePercentage,
          },
          homeTeam: matchedHome || homeTeam,
          awayTeam: matchedAway || awayTeam,
        })
      )
    }

    const sharpBias = calculateSharpBiasFromSignals({
      sharpSignals,
      homeTeam: matchedHome || homeTeam,
      awayTeam: matchedAway || awayTeam,
      sport: sportKey,
    })

    const sharpNotes = [...sharpBias.spreadNotes, ...sharpBias.totalNotes]
    return {
      openingSpread,
      currentSpread: currentSpread ?? undefined,
      openingTotal: openingTotal ?? 0,
      currentTotal: currentTotal ?? undefined,
      source: "SBD",
      sharpSpreadBias: sharpBias.spreadBias || undefined,
      sharpTotalBias: sharpBias.totalBias || undefined,
      sharpNotes: sharpNotes.length ? sharpNotes : undefined,
    }
  } catch (error) {
    console.error("[LIVE_PROJECTION] Failed to fetch pregame spread", error)
    return undefined
  }
}

const runLiveSpreadProjection = async (eventId: string): Promise<LiveSpreadProjection> => {
  const liveDetails = await fetchGameDetails("nba", eventId)
  const homeTeam = liveDetails.teams.find((team) => team.homeAway === "home")
  const awayTeam = liveDetails.teams.find((team) => team.homeAway === "away")

  if (!homeTeam || !awayTeam) {
    throw new Error("Unable to resolve home/away teams for this game.")
  }

  const state = liveDetails.status?.type?.state
  const liveGame = await analyzeLiveGame(liveDetails)

  const [pregameSpread, homeStatsRaw, awayStatsRaw] = await Promise.all([
    fetchPregameSpread(homeTeam.name || "", awayTeam.name || "", "nba"),
    getTeamStats(homeTeam.name || ""),
    getTeamStats(awayTeam.name || ""),
  ])

  if (pregameSpread) {
    liveGame.pregameSpread = pregameSpread
  }

  const homeStats = ensureTeamStats(homeStatsRaw, "home")
  const awayStats = ensureTeamStats(awayStatsRaw, "away")

  const spreadRec = calculateLiveSpread(liveGame, { homeStats, awayStats })

  return {
    eventId,
    matchup: `${awayTeam.name} @ ${homeTeam.name}`,
    generatedAt: new Date().toISOString(),
    gameState: {
      homeTeam: liveGame.homeTeam,
      awayTeam: liveGame.awayTeam,
      homeScore: liveGame.homeScore,
      awayScore: liveGame.awayScore,
      period: liveGame.period,
      displayClock: liveGame.displayClock,
      isLive: isLiveState(state),
    },
    projection: {
      fairLine: spreadRec.fairLine,
      confidence: spreadRec.confidence,
      confidenceInterval: spreadRec.confidenceInterval,
      recommendation: spreadRec.recommendation,
      factors: spreadRec.factors,
    },
  }
}

export const projectLiveNbaSpread = async (
  eventId: string
): Promise<LiveSpreadProjection> => {
  return withTimeout(runLiveSpreadProjection(eventId), LIVE_PROJECTION_TIMEOUT_MS)
}
