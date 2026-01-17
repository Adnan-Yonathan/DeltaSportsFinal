import {
  fetchPlayerPropWhaleTrades,
  type PlayerPropWhaleTrade,
} from './whale-trade-history'
import { fetchSbdGamePropsList, resolveSbdLeague, type SbdLeague } from '@/lib/api/sbd'
import { oddsToImpliedProbability, probabilityToAmericanOdds } from '@/lib/utils/statistics'

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
  avgPriceCents: number
  avgSharpStrength: number

  // Prediction market odds/probability
  predMarketProbability: number
  predMarketOdds: number | null

  // Best sportsbook line for this prop
  bestOdds: number | null
  bestOddsFormatted: string | null
  sportsbookAvgProbability: number | null
  sportsbookAvgOdds: number | null
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
const DEFAULT_LIMIT = 100

// Weights for composite score (represents "true probability" of bet hitting)
// Edge is NOT included here - edge is calculated AS: compositeScore - sportsbookImpliedProb
const DEFAULT_WEIGHTS: CompositeScoreWeights = {
  notional: 0.40,       // How much money whales put down
  sharpStrength: 0.35,  // How sharp the money is
  volume: 0.25,         // How many bets on this prop
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
}

const fetchSportsbookPlayerProps = async (
  sportKey: string
): Promise<Map<string, SportsbookPropOdds[]>> => {
  const league = resolveSbdLeague(sportKey)
  if (!league) return new Map()

  try {
    // Use game props API which has all prop types (rushing, receiving, etc.)
    const data = await fetchSbdGamePropsList(league, {
      init: { next: { revalidate: 60 } },
    })

    const result = new Map<string, SportsbookPropOdds[]>()

    if (!Array.isArray(data)) return result

    for (const entry of data) {
      // Game props API has player_name directly (in "Last, First" format)
      const playerName = entry?.player_name || entry?.player?.name
      if (!playerName || typeof playerName !== 'string') continue

      // Normalize "Last, First" to "First Last"
      const normalizedPlayer = normalizePlayerName(
        playerName.includes(',')
          ? playerName.split(',').reverse().map(s => s.trim()).join(' ')
          : playerName
      )

      // Market name is in 'name' field, e.g., "total rushing yards"
      const marketName = entry?.name
      if (typeof marketName !== 'string') continue

      const normalizedMarketName = marketName.toLowerCase()
      let propType: string | null = null

      for (const [key, aliases] of Object.entries(PROP_TYPE_TO_SBD)) {
        if (aliases.some((alias) => normalizedMarketName.includes(alias))) {
          propType = key
          break
        }
      }

      if (!propType) continue

      const sportsbooks = entry?.sportsbooks
      if (!Array.isArray(sportsbooks)) continue

      // Find BEST odds across sportsbooks (highest = best for bettor)
      let bestOverOdds: number | null = null
      let bestUnderOdds: number | null = null
      let line: number | null = null

      for (const book of sportsbooks) {
        const odds = book?.odds
        if (!odds) continue

        // Game props API has odds in a flat structure
        const overOddsStr = odds.over_american
        const underOddsStr = odds.under_american
        const overPointsStr = odds.over_points
        const underPointsStr = odds.under_points

        const overOdds = typeof overOddsStr === 'string' ? parseFloat(overOddsStr) :
                        typeof overOddsStr === 'number' ? overOddsStr : null
        const underOdds = typeof underOddsStr === 'string' ? parseFloat(underOddsStr) :
                         typeof underOddsStr === 'number' ? underOddsStr : null
        const overPoints = typeof overPointsStr === 'string' ? parseFloat(overPointsStr) :
                          typeof overPointsStr === 'number' ? overPointsStr : null
        const underPoints = typeof underPointsStr === 'string' ? parseFloat(underPointsStr) :
                           typeof underPointsStr === 'number' ? underPointsStr : null

        // Use either over or under points for the line
        const bookLine = overPoints ?? underPoints
        if (bookLine != null && !isNaN(bookLine)) {
          line = bookLine
        }

        // Track best odds (higher American odds = better for bettor)
        if (overOdds != null && !isNaN(overOdds)) {
          if (bestOverOdds === null || overOdds > bestOverOdds) {
            bestOverOdds = overOdds
          }
        }
        if (underOdds != null && !isNaN(underOdds)) {
          if (bestUnderOdds === null || underOdds > bestUnderOdds) {
            bestUnderOdds = underOdds
          }
        }
      }

      if (line != null && (bestOverOdds !== null || bestUnderOdds !== null)) {
        // Add to player's odds list
        if (!result.has(normalizedPlayer)) {
          result.set(normalizedPlayer, [])
        }
        result.get(normalizedPlayer)!.push({
          playerName: normalizedPlayer,
          propType,
          line,
          bestOverOdds,
          bestUnderOdds,
        })
      }
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
): { bestOdds: number | null } => {
  const normalizedPlayer = normalizePlayerName(playerName)
  const playerOdds = sportsbookData.get(normalizedPlayer)

  if (!playerOdds || playerOdds.length === 0) {
    return { bestOdds: null }
  }

  // Find matching prop type
  const matchingProps = playerOdds.filter(
    (p) => p.propType === propType
  )

  if (matchingProps.length === 0) {
    return { bestOdds: null }
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
    return { bestOdds: null }
  }

  // Get best odds for the relevant side
  const bestOdds = side === 'Under' ? best.bestUnderOdds : best.bestOverOdds

  return { bestOdds }
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

    // Get best sportsbook odds for this prop
    const { bestOdds } = findBestSportsbookOdds(playerName, propType, propLine, side, sportsbookData)

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

    const predMarketProbability = avgPriceCents / 100
    const predMarketOdds =
      predMarketProbability > 0 && predMarketProbability < 1
        ? probabilityToAmericanOdds(predMarketProbability)
        : null
    const sportsbookAvgProbability =
      bestOdds != null ? oddsToImpliedProbability(bestOdds) : null
    const edgePercent =
      sportsbookAvgProbability != null
        ? Math.round((predMarketProbability - sportsbookAvgProbability) * 1000) / 10
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
      bestOdds,
      bestOddsFormatted: formatAmericanOdds(bestOdds),
      sportsbookAvgProbability,
      sportsbookAvgOdds: bestOdds,
      edgePercent,
      isClustered,
      clusterWindowHours,
      earliestTradeTime: earliestTime,
      latestTradeTime: latestTime,
      compositeScore: 0, // Computed below
      trades: propTrades,
      sources,
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
    totalTrades: trades.length,
  }
}
