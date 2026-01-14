import {
  fetchPlayerPropWhaleTrades,
  type PlayerPropWhaleTrade,
} from './whale-trade-history'
import { fetchSbdPlayerProps, resolveSbdLeague, type SbdLeague } from '@/lib/api/sbd'
import { impliedProbability } from '@/lib/utils/odds'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CompositeScoreWeights = {
  edge: number
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
  avgPriceCents: number
  avgSharpStrength: number

  // Edge calculation
  predMarketProbability: number
  sportsbookAvgProbability: number | null
  sportsbookAvgOdds: number | null
  edgePercent: number

  // Clustering detection
  isClustered: boolean
  clusterWindowHours: number
  earliestTradeTime: string
  latestTradeTime: string

  // Composite ranking
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
const DEFAULT_LIMIT = 100

const DEFAULT_WEIGHTS: CompositeScoreWeights = {
  edge: 0.35,
  notional: 0.25,
  sharpStrength: 0.25,
  volume: 0.15,
}

// Prop type normalization for SBD API matching
const PROP_TYPE_TO_SBD: Record<string, string[]> = {
  points: ['points', 'pts'],
  rebounds: ['rebounds', 'reb'],
  assists: ['assists', 'ast'],
  threes: ['3-pointers', 'threes', '3pt'],
  blocks: ['blocks', 'blk'],
  steals: ['steals', 'stl'],
  passing_yards: ['passing yards', 'pass yds'],
  passing_tds: ['passing touchdowns', 'pass tds'],
  rushing_yards: ['rushing yards', 'rush yds'],
  rushing_tds: ['rushing touchdowns', 'rush tds'],
  receiving_yards: ['receiving yards', 'rec yds'],
  receptions: ['receptions', 'rec'],
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

const priceCentsToImpliedProbability = (priceCents: number): number => {
  // Prediction market price in cents (0-100) maps directly to probability
  return Math.max(0, Math.min(1, priceCents / 100))
}

const americanOddsToImpliedProbability = (odds: number): number => {
  return impliedProbability(odds)
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
  // Normalize edge to 0-1 (cap at 15% edge)
  const edgeScore = Math.min(1, Math.max(0, Math.abs(prop.edgePercent ?? 0) / 15))

  // Normalize notional to 0-1 using log scale (cap at $50k)
  const notionalRaw = prop.totalNotional ?? 0
  const notionalScore =
    notionalRaw > 0
      ? Math.min(1, Math.log10(notionalRaw / 1000 + 1) / Math.log10(51))
      : 0

  // Sharp strength already 0-100, normalize to 0-1
  const sharpScore = (prop.avgSharpStrength ?? 50) / 100

  // Volume score: 1 bet = 0.2, 2 = 0.5, 3+ = 0.8-1.0
  const betCount = prop.betCount ?? 0
  const volumeScore = Math.min(1, 0.2 + betCount * 0.25)

  const raw =
    weights.edge * edgeScore +
    weights.notional * notionalScore +
    weights.sharpStrength * sharpScore +
    weights.volume * volumeScore

  // Add clustering bonus (+10 points if clustered)
  const clusterBonus = prop.isClustered ? 0.1 : 0

  return Math.min(100, Math.max(0, (raw + clusterBonus) * 100))
}

// ─────────────────────────────────────────────────────────────────────────────
// Sportsbook Odds Fetching
// ─────────────────────────────────────────────────────────────────────────────

type SportsbookPropOdds = {
  playerName: string
  propType: string
  line: number
  overOdds: number | null
  underOdds: number | null
}

const fetchSportsbookPlayerProps = async (
  sportKey: string
): Promise<Map<string, SportsbookPropOdds[]>> => {
  const league = resolveSbdLeague(sportKey)
  if (!league) return new Map()

  try {
    const data = await fetchSbdPlayerProps(league, {
      init: { next: { revalidate: 60 } },
    })

    const result = new Map<string, SportsbookPropOdds[]>()

    if (!data?.data || !Array.isArray(data.data)) return result

    for (const item of data.data) {
      const playerName = item?.player?.name
      if (!playerName || typeof playerName !== 'string') continue

      const normalizedPlayer = normalizePlayerName(playerName)
      const markets = item?.markets

      if (!markets || typeof markets !== 'object') continue

      const playerOdds: SportsbookPropOdds[] = []

      for (const [marketKey, marketData] of Object.entries(markets)) {
        if (!marketData || typeof marketData !== 'object') continue
        const md = marketData as any
        const books = md.books
        if (!Array.isArray(books)) continue

        // Extract prop type from market key
        const normalizedMarketKey = marketKey.toLowerCase()
        let propType: string | null = null

        for (const [key, aliases] of Object.entries(PROP_TYPE_TO_SBD)) {
          if (aliases.some((alias) => normalizedMarketKey.includes(alias))) {
            propType = key
            break
          }
        }

        if (!propType) continue

        // Average across books
        let totalOverOdds = 0
        let totalUnderOdds = 0
        let overCount = 0
        let underCount = 0
        let line: number | null = null

        for (const book of books) {
          const over = book?.over
          const under = book?.under
          const bookLine = book?.line ?? book?.total

          if (typeof bookLine === 'number') {
            line = bookLine
          }

          if (typeof over?.odds === 'number') {
            totalOverOdds += over.odds
            overCount++
          }
          if (typeof under?.odds === 'number') {
            totalUnderOdds += under.odds
            underCount++
          }
        }

        if (line != null && (overCount > 0 || underCount > 0)) {
          playerOdds.push({
            playerName: normalizedPlayer,
            propType,
            line,
            overOdds: overCount > 0 ? totalOverOdds / overCount : null,
            underOdds: underCount > 0 ? totalUnderOdds / underCount : null,
          })
        }
      }

      if (playerOdds.length > 0) {
        result.set(normalizedPlayer, playerOdds)
      }
    }

    return result
  } catch (error) {
    console.warn('[sharp-player-prop-analyzer] Failed to fetch sportsbook props:', error)
    return new Map()
  }
}

const findMatchingSportsbookOdds = (
  playerName: string,
  propType: string,
  propLine: number | null,
  side: 'Over' | 'Under' | null,
  sportsbookData: Map<string, SportsbookPropOdds[]>
): { avgProbability: number | null; avgOdds: number | null } => {
  const normalizedPlayer = normalizePlayerName(playerName)
  const playerOdds = sportsbookData.get(normalizedPlayer)

  if (!playerOdds || playerOdds.length === 0) {
    return { avgProbability: null, avgOdds: null }
  }

  // Find matching prop type
  const matchingProps = playerOdds.filter(
    (p) => p.propType === propType
  )

  if (matchingProps.length === 0) {
    return { avgProbability: null, avgOdds: null }
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
    return { avgProbability: null, avgOdds: null }
  }

  // Get odds for the relevant side
  const relevantOdds = side === 'Under' ? best.underOdds : best.overOdds

  if (relevantOdds == null) {
    return { avgProbability: null, avgOdds: null }
  }

  const avgProbability = americanOddsToImpliedProbability(relevantOdds)

  return { avgProbability, avgOdds: relevantOdds }
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
  const [trades, sportsbookData] = await Promise.all([
    fetchPlayerPropWhaleTrades({ sportKey, limit: limit * 3 }),
    sportKey === 'all'
      ? Promise.resolve(new Map<string, SportsbookPropOdds[]>())
      : fetchSportsbookPlayerProps(sportKey),
  ])

  // Aggregate trades by player/prop/line/side
  const grouped = aggregateTradesByProp(trades, minNotional)

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
    const avgPriceCents =
      propTrades.reduce((sum, t) => sum + (t.priceCents ?? 50), 0) / betCount

    // Prediction market implied probability
    const predMarketProbability = priceCentsToImpliedProbability(avgPriceCents)

    // Get sportsbook odds for comparison
    const { avgProbability: sportsbookAvgProbability, avgOdds: sportsbookAvgOdds } =
      findMatchingSportsbookOdds(playerName, propType, propLine, side, sportsbookData)

    // Calculate edge
    const edgePercent =
      sportsbookAvgProbability != null
        ? (predMarketProbability - sportsbookAvgProbability) * 100
        : predMarketProbability * 100 - 50 // Default to deviation from 50% if no book odds

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
    const sources = Array.from(new Set(propTrades.map((t) => t.source))) as Array<
      'kalshi' | 'polymarket'
    >

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
      sportsbookAvgProbability,
      sportsbookAvgOdds,
      edgePercent,
      isClustered,
      clusterWindowHours,
      earliestTradeTime: earliestTime,
      latestTradeTime: latestTime,
      compositeScore: 0, // Computed below
      trades: propTrades,
      sources,
    }

    // Compute composite score
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
    totalTrades: trades.length,
  }
}
