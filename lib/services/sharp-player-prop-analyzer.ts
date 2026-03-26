import {
  fetchPlayerPropWhaleTrades,
  type PlayerPropWhaleTrade,
} from './whale-trade-history'
import {
  fetchPropLiquiditySignals,
  mapLiquiditySignalsToPlayerPropTrades,
} from './prop-liquidity-detector'
import { fetchTheOddsApiPlayerProps, getSportKey as getTheOddsApiSportKey } from '@/lib/api/the-odds-api'
import { oddsToImpliedProbability, probabilityToAmericanOdds } from '@/lib/utils/statistics'
import { getUsMarketDayKey, resolveEventDayKey } from '@/lib/utils/upcoming-event-filter'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CompositeScoreWeights = {
  notional: number
  sharpStrength: number
  volume: number
}

export type AggregatedPlayerPropBet = {
  id: string
  playerName: string
  propType: string
  propLine: number | null
  side: 'Over' | 'Under' | null
  sportKey: string

  // Aggregated metrics
  totalNotional: number
  betCount: number
  avgPriceCents: number | null
  avgSharpStrength: number

  // Prediction market odds/probability
  predMarketProbability: number | null
  predMarketOdds: number | null
  pinnacleOdds: number | null
  pinnacleProbability: number | null
  sportsbookLabel: 'Pinnacle' | 'Books'

  // Best sportsbook line for this prop
  bestOdds: number | null
  bestOddsFormatted: string | null
  sportsbookAvgProbability: number | null
  sportsbookAvgOdds: number | null
  edgeReferenceProbability: number | null
  edgeReferenceSource: 'kalshi' | 'books' | null
  edgePercent: number

  // Clustering detection
  isClustered: boolean
  clusterWindowHours: number
  earliestTradeTime: string
  latestTradeTime: string

  // Composite score (0-100) - higher = sharper bet
  compositeScore: number

  // Source data
  trades: PlayerPropWhaleTrade[]
  sources: Array<'kalshi' | 'polymarket'>
}

export type SharpPlayerPropAnalysis = {
  sportKey: string
  updatedAt: string
  props: AggregatedPlayerPropBet[]
  topPicks: AggregatedPlayerPropBet[]
  clusterAlerts: AggregatedPlayerPropBet[]
  totalTrades: number
}

export type AnalyzeSharpPlayerPropsOptions = {
  sportKey: string | 'all'
  minNotional?: number
  clusterWindowHours?: number
  weights?: CompositeScoreWeights
  limit?: number
  topPicksCount?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MIN_NOTIONAL = 1000
const DEFAULT_CLUSTER_WINDOW_HOURS = 4
const DEFAULT_TOP_PICKS_COUNT = 5
const DEFAULT_LIMIT = 1000

// Weights for composite score (represents "true probability" of bet hitting)
// Edge is NOT included here - edge is calculated AS: compositeScore - sportsbookImpliedProb
const DEFAULT_WEIGHTS: CompositeScoreWeights = {
  notional: 0.40,       // How much money whales put down
  sharpStrength: 0.35,  // How sharp the money is
  volume: 0.25,         // How many bets on this prop
}

const PROP_TYPE_BY_ODDS_MARKET: Record<string, string> = {
  player_points: 'points',
  player_rebounds: 'rebounds',
  player_assists: 'assists',
  player_threes: 'threes',
  player_blocks: 'blocks',
  player_steals: 'steals',
  player_pass_yds: 'passing_yards',
  player_pass_tds: 'passing_tds',
  player_rush_yds: 'rushing_yards',
  player_rush_tds: 'rushing_tds',
  player_reception_yds: 'receiving_yards',
  player_receptions: 'receptions',
  player_hits: 'hits',
  player_total_bases: 'total_bases',
  player_rbis: 'rbis',
  player_runs_scored: 'runs',
  player_shots_on_goal: 'shots_on_goal',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

const normalizePlayerName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const buildPropKey = (
  playerName: string | null,
  propType: string | null,
  propLine: number | null,
  side: string | null
): string => {
  const player = playerName ? normalizePlayerName(playerName) : 'unknown'
  const prop = propType?.toLowerCase() ?? 'unknown'
  const line = propLine != null ? propLine.toFixed(1) : 'none'
  const sideLabel = side?.toLowerCase() ?? 'unknown'
  return `${player}|${prop}|${line}|${sideLabel}`
}

const parseSide = (side: string | null): 'Over' | 'Under' | null => {
  if (!side) return null
  const lower = side.toLowerCase()
  if (lower.includes('over') || lower === 'o') return 'Over'
  if (lower.includes('under') || lower === 'u') return 'Under'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation Logic
// ─────────────────────────────────────────────────────────────────────────────

const aggregateTradesByProp = (
  trades: PlayerPropWhaleTrade[],
  minNotional: number
): Map<string, PlayerPropWhaleTrade[]> => {
  const grouped = new Map<string, PlayerPropWhaleTrade[]>()

  for (const trade of trades) {
    // Skip trades below threshold
    if ((trade.notional ?? 0) < minNotional) continue
    // Skip trades without player name or prop type
    if (!trade.playerName || !trade.propType) continue

    const key = buildPropKey(
      trade.playerName,
      trade.propType,
      trade.propLine,
      trade.side
    )

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(trade)
  }

  return grouped
}

// ─────────────────────────────────────────────────────────────────────────────
// Clustering Detection
// ─────────────────────────────────────────────────────────────────────────────

const detectClustering = (
  trades: PlayerPropWhaleTrade[],
  windowHours: number
): { isClustered: boolean; earliestTime: string; latestTime: string } => {
  if (trades.length < 2) {
    const time = trades[0]?.tradeTime ?? new Date().toISOString()
    return { isClustered: false, earliestTime: time, latestTime: time }
  }

  const times = trades
    .map((t) => new Date(t.tradeTime).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)

  const earliest = times[0]
  const latest = times[times.length - 1]
  const windowMs = windowHours * 60 * 60 * 1000

  // Clustered if all bets fall within the window
  const isClustered = trades.length >= 2 && latest - earliest <= windowMs

  return {
    isClustered,
    earliestTime: new Date(earliest).toISOString(),
    latestTime: new Date(latest).toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite Score Calculation
// ─────────────────────────────────────────────────────────────────────────────

const computeCompositeScore = (
  prop: Partial<AggregatedPlayerPropBet>,
  weights: CompositeScoreWeights
): number => {
  // Composite score represents our confidence in the bet (0-100, like a probability)
  // Edge is calculated AFTER as: compositeScore - sportsbookImpliedProbability

  // Normalize notional to 0-1 using log scale (cap at $50k)
  // $1k = 0, $5k = ~0.41, $10k = ~0.59, $25k = ~0.81, $50k = 1.0
  const notionalRaw = prop.totalNotional ?? 0
  const notionalScore =
    notionalRaw > 0
      ? Math.min(1, Math.log10(notionalRaw / 1000 + 1) / Math.log10(51))
      : 0

  // Sharp strength already 0-100, normalize to 0-1
  const sharpScore = (prop.avgSharpStrength ?? 50) / 100

  // Volume score grows with bet count (more bets = stronger signal)
  const betCount = prop.betCount ?? 0
  const volumeScore =
    betCount > 0 ? Math.min(1, Math.log10(betCount + 1) / Math.log10(12)) : 0

  const raw =
    weights.notional * notionalScore +
    weights.sharpStrength * sharpScore +
    weights.volume * volumeScore

  // Add clustering bonus (+10 points if clustered within 4h window)
  const clusterBonus = prop.isClustered ? 0.1 : 0

  // Scale to 0-100 range
  // Base of 30 (minimum confidence for any whale bet that passed filters)
  // Plus weighted factors (up to 70 more points)
  // Plus cluster bonus (up to 10 more points)
  const baseScore = 30
  let scaledScore = baseScore + (raw * 70) + (clusterBonus * 100)

  // Penalize heavy favorites (e.g., -200 or shorter)
  const predOdds = prop.predMarketOdds ?? null
  if (predOdds != null && predOdds <= -200) {
    const magnitude = Math.abs(predOdds)
    const penaltySteps = Math.floor((magnitude - 200) / 50)
    const heavyFavoritePenalty = Math.min(20, 5 + penaltySteps * 5)
    scaledScore -= heavyFavoritePenalty
  }

  return Math.min(100, Math.max(0, scaledScore))
}

// ─────────────────────────────────────────────────────────────────────────────
// Sportsbook Odds Fetching
// ─────────────────────────────────────────────────────────────────────────────

type SportsbookPropOdds = {
  playerName: string
  propType: string
  line: number
  bestOverOdds: number | null
  bestUnderOdds: number | null
  pinnacleOverOdds: number | null
  pinnacleUnderOdds: number | null
  overOdds: number[]
  underOdds: number[]
}

const isPinnacleBook = (book: any) => {
  const raw = `${book?.key ?? ""} ${book?.sportsbook ?? ""} ${book?.name ?? ""} ${book?.title ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
  return raw.includes("pinnacle")
}

const isPredictionMarketBookFromOddsApi = (book: { key?: string | null; title?: string | null }) => {
  const normalized = `${book?.key ?? ''} ${book?.title ?? ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return normalized.includes('kalshi') || normalized.includes('polymarket')
}

const fetchSportsbookPlayerProps = async (
  sportKey: string
): Promise<Map<string, SportsbookPropOdds[]>> => {
  const oddsSportKey = getTheOddsApiSportKey(sportKey)
  if (!oddsSportKey) return new Map()

  const sportMarkets: Record<string, string[]> = {
    basketball_nba: ['player_points', 'player_rebounds', 'player_assists', 'player_threes'],
    americanfootball_nfl: [
      'player_pass_tds',
      'player_pass_yds',
      'player_rush_yds',
      'player_rush_tds',
      'player_receptions',
      'player_reception_yds',
    ],
    americanfootball_ncaaf: [
      'player_pass_tds',
      'player_pass_yds',
      'player_rush_yds',
      'player_rush_tds',
      'player_receptions',
      'player_reception_yds',
    ],
    baseball_mlb: ['player_hits', 'player_total_bases', 'player_rbis', 'player_runs_scored'],
    icehockey_nhl: ['player_points', 'player_shots_on_goal'],
  }

  const markets = sportMarkets[oddsSportKey] ?? []
  if (!markets.length) return new Map()

  try {
    const events = await fetchTheOddsApiPlayerProps(oddsSportKey, {
      markets: markets.join(','),
      regions: 'us,us2,eu',
      oddsFormat: 'american',
      includeBetLimits: false,
    })
    const result = new Map<string, SportsbookPropOdds[]>()
    const byPlayer = new Map<string, Map<string, SportsbookPropOdds>>()

    for (const event of events ?? []) {
      for (const book of event.bookmakers ?? []) {
        if (isPredictionMarketBookFromOddsApi(book)) continue
        const pinnacleBook = isPinnacleBook(book)
        for (const market of book.markets ?? []) {
          const propType = PROP_TYPE_BY_ODDS_MARKET[String(market?.key ?? '')]
          if (!propType) continue

          for (const outcome of market.outcomes ?? []) {
            const sideRaw = String(outcome?.name ?? '').toLowerCase()
            const side: 'Over' | 'Under' | null =
              sideRaw === 'over' ? 'Over' : sideRaw === 'under' ? 'Under' : null
            if (!side) continue

            const playerNameRaw = outcome?.description
            if (typeof playerNameRaw !== 'string' || !playerNameRaw.trim()) continue
            const normalizedPlayer = normalizePlayerName(playerNameRaw)
            const line = Number(outcome?.point)
            const odds = Number(outcome?.price)
            if (!Number.isFinite(line) || !Number.isFinite(odds)) continue

            if (!byPlayer.has(normalizedPlayer)) {
              byPlayer.set(normalizedPlayer, new Map())
            }
            const playerMap = byPlayer.get(normalizedPlayer)!
            const key = `${propType}:${line.toFixed(1)}`
            if (!playerMap.has(key)) {
              playerMap.set(key, {
                playerName: normalizedPlayer,
                propType,
                line,
                bestOverOdds: null,
                bestUnderOdds: null,
                pinnacleOverOdds: null,
                pinnacleUnderOdds: null,
                overOdds: [],
                underOdds: [],
              })
            }
            const bucket = playerMap.get(key)!
            if (side === 'Over') {
              bucket.overOdds.push(odds)
              if (bucket.bestOverOdds == null || odds > bucket.bestOverOdds) {
                bucket.bestOverOdds = odds
              }
              if (pinnacleBook) {
                bucket.pinnacleOverOdds = odds
              }
            } else {
              bucket.underOdds.push(odds)
              if (bucket.bestUnderOdds == null || odds > bucket.bestUnderOdds) {
                bucket.bestUnderOdds = odds
              }
              if (pinnacleBook) {
                bucket.pinnacleUnderOdds = odds
              }
            }
          }
        }
      }
    }

    for (const [player, marketsByLine] of byPlayer.entries()) {
      result.set(player, Array.from(marketsByLine.values()))
    }

    return result
  } catch (error) {
    console.warn('[sharp-player-prop-analyzer] Failed to fetch sportsbook props:', error)
    return new Map()
  }
}

const findBestSportsbookOdds = (
  playerName: string,
  propType: string,
  propLine: number | null,
  side: 'Over' | 'Under' | null,
  sportsbookData: Map<string, SportsbookPropOdds[]>
): { bestOdds: number | null; pinnacleOdds: number | null; consensusProbability: number | null } => {
  const normalizedPlayer = normalizePlayerName(playerName)
  const playerOdds = sportsbookData.get(normalizedPlayer)

  if (!playerOdds || playerOdds.length === 0) {
    return { bestOdds: null, pinnacleOdds: null, consensusProbability: null }
  }

  // Find matching prop type
  const matchingProps = playerOdds.filter(
    (p) => p.propType === propType
  )

  if (matchingProps.length === 0) {
    return { bestOdds: null, pinnacleOdds: null, consensusProbability: null }
  }

  // Prefer exact line match, otherwise take closest
  let best: SportsbookPropOdds | null = null
  let bestDiff = Infinity

  for (const prop of matchingProps) {
    if (propLine == null) {
      best = prop
      break
    }
    const diff = Math.abs(prop.line - propLine)
    if (diff < bestDiff) {
      bestDiff = diff
      best = prop
    }
  }

  if (!best) {
    return { bestOdds: null, pinnacleOdds: null, consensusProbability: null }
  }

  // Get best odds for the relevant side
  const bestOdds = side === 'Under' ? best.bestUnderOdds : best.bestOverOdds
  const pinnacleOdds =
    side === 'Under' ? best.pinnacleUnderOdds : best.pinnacleOverOdds
  const consensusOdds = side === 'Under' ? best.underOdds : best.overOdds
  const validConsensus = consensusOdds
    .map((value) => oddsToImpliedProbability(value))
    .filter((value) => Number.isFinite(value))
  const consensusProbability =
    validConsensus.length > 0
      ? validConsensus.reduce((sum, value) => sum + value, 0) / validConsensus.length
      : null

  return { bestOdds, pinnacleOdds, consensusProbability }
}

const formatAmericanOdds = (odds: number | null): string | null => {
  if (odds === null) return null
  return odds >= 0 ? `+${odds}` : `${odds}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Analysis Function
// ─────────────────────────────────────────────────────────────────────────────

export const analyzeSharpPlayerProps = async (
  options: AnalyzeSharpPlayerPropsOptions
): Promise<SharpPlayerPropAnalysis> => {
  const {
    sportKey,
    minNotional = DEFAULT_MIN_NOTIONAL,
    clusterWindowHours = DEFAULT_CLUSTER_WINDOW_HOURS,
    weights = DEFAULT_WEIGHTS,
    limit = DEFAULT_LIMIT,
    topPicksCount = DEFAULT_TOP_PICKS_COUNT,
  } = options

  // Fetch whale trades and sportsbook odds in parallel
  // For "all" sports, we skip sportsbook comparison (too many API calls)
  const [trades, sportsbookData, liquiditySignals] = await Promise.all([
    fetchPlayerPropWhaleTrades({ sportKey, limit: limit * 3 }),
    sportKey === 'all'
      ? Promise.resolve(new Map<string, SportsbookPropOdds[]>())
      : fetchSportsbookPlayerProps(sportKey),
    fetchPropLiquiditySignals({ sportKey }),
  ])

  const liquidityTrades = mapLiquiditySignalsToPlayerPropTrades(liquiditySignals)
  const combinedTrades = [...trades, ...liquidityTrades]
  const todayKey = getUsMarketDayKey()
  const sameDayTrades = combinedTrades.filter((trade) => {
    const eventDay = resolveEventDayKey(trade.eventTime)
    return eventDay != null && eventDay === todayKey
  })

  // Aggregate trades by player/prop/line/side
  const grouped = aggregateTradesByProp(sameDayTrades, minNotional)

  // Build aggregated prop bets
  const props: AggregatedPlayerPropBet[] = []

  for (const [key, propTrades] of grouped.entries()) {
    if (propTrades.length === 0) continue

    const firstTrade = propTrades[0]
    const playerName = firstTrade.playerName ?? 'Unknown'
    const propType = firstTrade.propType ?? 'unknown'
    const propLine = firstTrade.propLine
    const side = parseSide(firstTrade.side)

    // Calculate aggregated metrics
    const totalNotional = propTrades.reduce((sum, t) => sum + (t.notional ?? 0), 0)
    const betCount = propTrades.length

    // Average price cents from prediction market
    const kalshiTrades = propTrades.filter((trade) => trade.source === 'kalshi')
    const avgPriceCents =
      kalshiTrades.length > 0
        ? kalshiTrades.reduce((sum, t) => sum + (t.priceCents ?? 50), 0) /
          kalshiTrades.length
        : null

    // Get best sportsbook odds for this prop
    const { bestOdds, pinnacleOdds, consensusProbability } = findBestSportsbookOdds(
      playerName,
      propType,
      propLine,
      side,
      sportsbookData
    )
    const displaySportsbookOdds = pinnacleOdds ?? bestOdds

    // Detect clustering
    const { isClustered, earliestTime, latestTime } = detectClustering(
      propTrades,
      clusterWindowHours
    )

    // Estimate sharp strength (using notional size as proxy since we don't have full enrichment)
    // Higher notional = higher confidence
    const avgSharpStrength = Math.min(
      100,
      30 + Math.log10(totalNotional / 1000 + 1) * 25 + (isClustered ? 15 : 0)
    )

    // Get unique sources
    const propSources = Array.from(new Set(propTrades.map((t) => t.source))) as Array<
      'kalshi' | 'polymarket'
    >

    const predMarketProbability =
      avgPriceCents != null ? avgPriceCents / 100 : null
    const predMarketOdds =
      predMarketProbability != null &&
      predMarketProbability > 0 &&
      predMarketProbability < 1
        ? probabilityToAmericanOdds(predMarketProbability)
        : null
    const sportsbookAvgProbability =
      displaySportsbookOdds != null
        ? oddsToImpliedProbability(displaySportsbookOdds)
        : null
    const pinnacleProbability =
      pinnacleOdds != null ? oddsToImpliedProbability(pinnacleOdds) : null
    const edgeReferenceProbability =
      predMarketProbability ?? consensusProbability ?? null
    const edgeReferenceSource =
      predMarketProbability != null
        ? 'kalshi'
        : consensusProbability != null
          ? 'books'
          : null
    const edgePercent =
      edgeReferenceProbability != null && sportsbookAvgProbability != null
        ? Math.round((edgeReferenceProbability - sportsbookAvgProbability) * 1000) / 10
        : 0

    const aggregated: AggregatedPlayerPropBet = {
      id: key,
      playerName,
      propType,
      propLine,
      side,
      sportKey,
      totalNotional,
      betCount,
      avgPriceCents,
      avgSharpStrength,
      predMarketProbability,
      predMarketOdds,
      pinnacleOdds: pinnacleOdds ?? null,
      pinnacleProbability,
      sportsbookLabel: pinnacleOdds != null ? 'Pinnacle' : 'Books',
      bestOdds: displaySportsbookOdds,
      bestOddsFormatted: formatAmericanOdds(displaySportsbookOdds),
      sportsbookAvgProbability,
      sportsbookAvgOdds: displaySportsbookOdds,
      edgeReferenceProbability,
      edgeReferenceSource,
      edgePercent,
      isClustered,
      clusterWindowHours,
      earliestTradeTime: earliestTime,
      latestTradeTime: latestTime,
      compositeScore: 0, // Computed below
      trades: propTrades,
      sources: propSources,
    }

    // Compute composite score (0-100, higher = sharper bet)
    aggregated.compositeScore = computeCompositeScore(aggregated, weights)

    props.push(aggregated)
  }

  // Sort by composite score descending
  props.sort((a, b) => b.compositeScore - a.compositeScore)

  // Limit results
  const limitedProps = props.slice(0, limit)

  // Get top picks
  const topPicks = limitedProps.slice(0, topPicksCount)

  // Get cluster alerts (props with clustering, sorted by composite score)
  const clusterAlerts = limitedProps
    .filter((p) => p.isClustered)
    .slice(0, topPicksCount)

  return {
    sportKey,
    updatedAt: new Date().toISOString(),
    props: limitedProps,
    topPicks,
    clusterAlerts,
    totalTrades: sameDayTrades.length,
  }
}
