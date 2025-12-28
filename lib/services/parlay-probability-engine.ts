/**
 * Parlay Probability Engine
 * Calculates combined probabilities for multi-leg parlays with correlation adjustments
 *
 * Handles:
 * - Single player prop probabilities
 * - Combined props for same player (correlated - e.g., points AND threes)
 * - Multi-event parlay probabilities (different players/games - independent)
 * - Comparison to market odds with edge detection
 */

import {
  calculateOverProbability,
  calculateOverProbabilityNormal,
  getConfidenceLevel,
  formatProbability
} from '@/lib/utils/prop-probability'
import { getStaticNbaTeams } from '@/lib/nba-static-team-stats'
import { nbaPlayerPerGame2025_2026Csv } from '@/data/nba_player_per_game_2025_2026'
import { fetchAllLiveScores } from '@/lib/live-scores'
import { fetchSbdGamePropsList, fetchSbdOdds, type SbdLeague } from '@/lib/api/sbd'

// ============================================
// Types
// ============================================

export interface ProbabilityLeg {
  type: 'player_prop' | 'game_spread' | 'game_total' | 'game_moneyline'
  description: string
  probability: number
  source: 'calculated' | 'implied_odds'
  confidence: 'high' | 'medium' | 'low'
}

export interface PlayerPropLeg extends ProbabilityLeg {
  type: 'player_prop'
  playerName: string
  team: string
  propType: string  // points, threes, rebounds, assists, PRA
  threshold: number
  direction: 'over' | 'under'
  seasonAverage: number
  adjustedAverage?: number
  // Market comparison (from SBD live gameprops)
  marketLine?: number           // The actual line from sportsbook
  marketOdds?: number           // American odds for the over/under
  impliedProbability?: number   // Market-implied probability
  edge?: number                 // Model probability - Implied (positive = value)
  book?: string                 // Sportsbook name (e.g., "fanduel", "draftkings")
}

export interface GameOutcomeLeg extends ProbabilityLeg {
  type: 'game_spread' | 'game_total' | 'game_moneyline'
  homeTeam: string
  awayTeam: string
  line?: number           // spread or total
  direction?: 'home' | 'away' | 'over' | 'under'
  marketOdds?: number     // American odds from books
  impliedProbability?: number   // From market odds
  modelProbability?: number     // From our calculations
  edge?: number                 // Model - Implied (positive = value)
}

export interface CorrelationAdjustment {
  description: string
  factor: number
  reason: string
}

export interface ParlayProbabilityResult {
  legs: (PlayerPropLeg | GameOutcomeLeg)[]
  independentProbability: number    // Simple multiplication (no correlation)
  correlatedProbability: number     // Adjusted for correlations
  correlationAdjustments: CorrelationAdjustment[]
  impliedOdds: {
    american: number
    decimal: number
  }
  confidence: 'high' | 'medium' | 'low'
  breakdown: string
  formatted: string
}

// ============================================
// Correlation Coefficients (Empirical)
// ============================================

/**
 * Correlation coefficients between different stat types
 * Based on empirical NBA data analysis
 * Positive = stats tend to increase together
 * Negative = inverse relationship
 */
const PROP_CORRELATIONS: Record<string, Record<string, number>> = {
  points: {
    threes: 0.65,      // 3PM directly contributes to points
    assists: 0.35,     // Playmakers tend to also score
    rebounds: 0.15,    // Weak positive (bigger players)
    pra: 0.85,         // Points is largest component of PRA
    blocks: 0.10,
    steals: 0.15,
  },
  threes: {
    points: 0.65,
    assists: 0.20,
    rebounds: -0.10,   // Shooters often worse rebounders
    pra: 0.45,
    blocks: -0.15,
    steals: 0.10,
  },
  rebounds: {
    points: 0.15,
    threes: -0.10,
    assists: 0.10,
    pra: 0.60,
    blocks: 0.40,      // Bigs block and rebound
    steals: 0.05,
  },
  assists: {
    points: 0.35,
    threes: 0.20,
    rebounds: 0.10,
    pra: 0.55,
    blocks: -0.05,
    steals: 0.25,      // Ball handlers get steals
  },
  pra: {
    points: 0.85,
    threes: 0.45,
    rebounds: 0.60,
    assists: 0.55,
    blocks: 0.20,
    steals: 0.20,
  },
  blocks: {
    points: 0.10,
    threes: -0.15,
    rebounds: 0.40,
    assists: -0.05,
    steals: 0.10,
  },
  steals: {
    points: 0.15,
    threes: 0.10,
    rebounds: 0.05,
    assists: 0.25,
    blocks: 0.10,
  },
}

/**
 * Same-game correlations between team outcomes
 */
const GAME_CORRELATIONS = {
  // If a team covers spread, slightly more likely game goes over (blowouts)
  spreadToTotal: 0.15,
  // If a team is winning (ML), more likely to cover spread
  moneylineToSpread: 0.70,
}

// ============================================
// Player Data Helpers
// ============================================

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

interface ParsedPlayer {
  name: string
  team: string
  mpg: number
  points: number
  rebounds: number
  assists: number
  threes: number
  pra: number
}

let playerCache: Map<string, ParsedPlayer> | null = null

function getAllPlayers(): Map<string, ParsedPlayer> {
  if (playerCache) return playerCache

  const map = new Map<string, ParsedPlayer>()
  const lines = nbaPlayerPerGame2025_2026Csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && /^\d+,/.test(l))

  for (const line of lines) {
    const cells = line.split(',')
    if (cells.length < 30) continue

    const player = cells[1].trim()
    const key = normalize(player)
    const team = cells[5]?.trim() || ''
    const points = parseFloat(cells[26]) || 0
    const rebounds = parseFloat(cells[20]) || 0
    const assists = parseFloat(cells[21]) || 0
    const threes = parseFloat(cells[14]) || 0

    map.set(key, {
      name: player,
      team,
      mpg: parseFloat(cells[2]) || 0,
      points,
      rebounds,
      assists,
      threes,
      pra: points + rebounds + assists,
    })
  }

  playerCache = map
  return map
}

function findPlayer(playerName: string): ParsedPlayer | null {
  const players = getAllPlayers()
  const normalized = normalize(playerName)

  // Exact match first
  if (players.has(normalized)) return players.get(normalized)!

  // Partial match
  for (const [key, player] of players) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return player
    }
  }

  // Try by last name
  const lastName = playerName.split(' ').pop()?.toLowerCase() || ''
  for (const [key, player] of players) {
    if (key.endsWith(normalize(lastName))) {
      return player
    }
  }

  return null
}

function getStatValue(player: ParsedPlayer, propType: string): number {
  const type = propType.toLowerCase()
  switch (type) {
    case 'threes':
    case '3pm':
    case 'three_pointers':
    case '3-pointers':
      return player.threes
    case 'points':
    case 'pts':
      return player.points
    case 'rebounds':
    case 'reb':
    case 'trb':
      return player.rebounds
    case 'assists':
    case 'ast':
      return player.assists
    case 'pra':
    case 'pts_reb_ast':
      return player.pra
    default:
      return player.points
  }
}

function usePoissonDistribution(propType: string): boolean {
  const type = propType.toLowerCase()
  if (type.includes('three') || type === '3pm' || type === 'threes') return true
  if (type.includes('block') || type.includes('steal')) return true
  return false
}

// ============================================
// SBD Market Data (Live Player Props)
// ============================================

interface MarketPropLine {
  playerName: string
  propType: string  // normalized: 'points', 'threes', 'rebounds', 'assists', 'pra'
  line: number
  overOdds: number
  underOdds: number
  book: string
}

// Cache for player props - expires after 2 minutes for live updates
let propLinesCache: Map<string, MarketPropLine[]> | null = null
let propLinesCacheTime: number = 0
const PROP_CACHE_TTL = 2 * 60 * 1000 // 2 minutes

/**
 * Normalize SBD prop market name to our internal format
 */
function normalizePropMarketName(name: string): string | null {
  const cleaned = name.toLowerCase().replace(/\(.*?\)/g, '').trim()
  if (cleaned.includes('points plus assists plus rebounds') || cleaned.includes('pts+rebs+asts')) return 'pra'
  if (cleaned.includes('points plus rebounds')) return 'points_rebounds'
  if (cleaned.includes('points plus assists')) return 'points_assists'
  if (cleaned.includes('rebounds plus assists')) return 'rebounds_assists'
  if (cleaned.includes('3-point') || cleaned.includes('three')) return 'threes'
  if (cleaned.includes('points') && !cleaned.includes('plus')) return 'points'
  if (cleaned.includes('rebounds') && !cleaned.includes('plus')) return 'rebounds'
  if (cleaned.includes('assists') && !cleaned.includes('plus')) return 'assists'
  if (cleaned.includes('steals')) return 'steals'
  if (cleaned.includes('blocks')) return 'blocks'
  return null
}

/**
 * Map our prop types to normalized SBD market names for matching
 */
function mapPropTypeToNormalized(propType: string): string | null {
  const type = propType.toLowerCase()
  if (type.includes('point') || type === 'pts') return 'points'
  if (type.includes('three') || type === '3pm' || type === 'threes') return 'threes'
  if (type.includes('rebound') || type === 'reb' || type === 'trb') return 'rebounds'
  if (type.includes('assist') || type === 'ast') return 'assists'
  if (type === 'pra' || type === 'pts_reb_ast') return 'pra'
  if (type.includes('steal')) return 'steals'
  if (type.includes('block')) return 'blocks'
  return null
}

/**
 * Fetch all player props from SBD gameprops API (live data)
 * Uses cdn-sde.sbdfuel.com/gameprops/nba/list endpoint
 */
async function fetchPlayerPropLines(): Promise<Map<string, MarketPropLine[]>> {
  // Return cache if still valid
  if (propLinesCache && Date.now() - propLinesCacheTime < PROP_CACHE_TTL) {
    return propLinesCache
  }

  const propsMap = new Map<string, MarketPropLine[]>()

  try {
    // Fetch from SBD gameprops endpoint (this is the live data source)
    const data = await fetchSbdGamePropsList('nba' as SbdLeague, {
      limit: 2000,
    })

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log('[PARLAY ENGINE] No player props data from SBD gameprops')
      return propsMap
    }

    // Parse SBD gameprops response format
    for (const prop of data) {
      const playerName = prop.player_name || prop.player?.name
      if (!playerName) continue

      const propType = normalizePropMarketName(prop.name || '')
      if (!propType) continue

      // Get the best sportsbook odds (skip consensus)
      const sportsbooks = prop.sportsbooks || []
      const realBook = sportsbooks.find((sb: any) =>
        sb.name && sb.name.toLowerCase() !== 'consensus'
      ) || sportsbooks[0]

      if (!realBook?.odds) continue

      const line = parseFloat(realBook.odds.over_points || realBook.over_points) || 0
      const overOdds = parseFloat(realBook.odds.over_american) || -110
      const underOdds = parseFloat(realBook.odds.under_american) || -110

      if (line <= 0) continue

      const playerKey = normalize(playerName)
      const propLine: MarketPropLine = {
        playerName,
        propType,
        line,
        overOdds,
        underOdds,
        book: realBook.name || 'unknown',
      }

      if (!propsMap.has(playerKey)) {
        propsMap.set(playerKey, [])
      }
      propsMap.get(playerKey)!.push(propLine)
    }

    propLinesCache = propsMap
    propLinesCacheTime = Date.now()
    console.log(`[PARLAY ENGINE] Cached ${propsMap.size} players with prop lines from SBD gameprops`)
  } catch (error) {
    console.error('[PARLAY ENGINE] Error fetching SBD gameprops:', error)
  }

  return propsMap
}

/**
 * Find market line for a specific player and prop type
 */
async function findMarketLine(
  playerName: string,
  propType: string
): Promise<{ line: number; overOdds: number; underOdds: number; book: string } | null> {
  const propsMap = await fetchPlayerPropLines()
  const playerKey = normalize(playerName)
  const normalizedPropType = mapPropTypeToNormalized(propType)

  if (!normalizedPropType) return null

  // Try exact match first
  let playerProps = propsMap.get(playerKey)

  // Try partial match if no exact match
  if (!playerProps || playerProps.length === 0) {
    for (const [key, props] of propsMap) {
      if (key.includes(playerKey) || playerKey.includes(key)) {
        playerProps = props
        break
      }
    }
  }

  // Try last name match
  if (!playerProps || playerProps.length === 0) {
    const lastName = playerName.split(' ').pop()?.toLowerCase() || ''
    for (const [key, props] of propsMap) {
      if (key.includes(normalize(lastName))) {
        playerProps = props
        break
      }
    }
  }

  if (!playerProps || playerProps.length === 0) return null

  const match = playerProps.find(p => p.propType === normalizedPropType)
  if (!match) return null

  return {
    line: match.line,
    overOdds: match.overOdds,
    underOdds: match.underOdds,
    book: match.book,
  }
}

// ============================================
// Probability Calculations
// ============================================

/**
 * Calculate probability for a single player prop
 */
export async function calculatePlayerPropProbability(
  playerName: string,
  propType: string,
  threshold: number,
  direction: 'over' | 'under' = 'over'
): Promise<PlayerPropLeg | null> {
  const player = findPlayer(playerName)
  if (!player) return null

  const seasonAverage = getStatValue(player, propType)
  if (seasonAverage <= 0) return null

  // Calculate base probability
  const usePoisson = usePoissonDistribution(propType)
  let probability = usePoisson
    ? calculateOverProbability(seasonAverage, threshold)
    : calculateOverProbabilityNormal(seasonAverage, threshold)

  // Flip for under
  if (direction === 'under') {
    probability = 1 - probability
  }

  const propLabel = propType.toLowerCase().includes('three') ? '3PM' : propType
  const description = `${player.name} ${direction} ${threshold} ${propLabel}`

  // Fetch market line from SBD live gameprops for comparison
  let marketLine: number | undefined
  let marketOdds: number | undefined
  let impliedProbability: number | undefined
  let edge: number | undefined
  let book: string | undefined

  try {
    const market = await findMarketLine(playerName, propType)
    if (market) {
      marketLine = market.line
      marketOdds = direction === 'over' ? market.overOdds : market.underOdds
      impliedProbability = americanToImpliedProbability(marketOdds)
      edge = probability - impliedProbability
      book = market.book
    }
  } catch (error) {
    console.log('[PARLAY ENGINE] Could not fetch market line:', error)
  }

  return {
    type: 'player_prop',
    playerName: player.name,
    team: player.team,
    propType,
    threshold,
    direction,
    seasonAverage,
    probability,
    description,
    source: 'calculated',
    confidence: getConfidenceLevel(probability),
    marketLine,
    marketOdds,
    impliedProbability,
    edge,
    book,
  }
}

/**
 * Get correlation coefficient between two prop types
 */
function getCorrelation(propType1: string, propType2: string): number {
  const type1 = propType1.toLowerCase()
  const type2 = propType2.toLowerCase()

  // Normalize prop types
  const normalize = (t: string) => {
    if (t.includes('three') || t === '3pm') return 'threes'
    if (t.includes('point') || t === 'pts') return 'points'
    if (t.includes('rebound') || t === 'reb' || t === 'trb') return 'rebounds'
    if (t.includes('assist') || t === 'ast') return 'assists'
    if (t === 'pra' || t === 'pts_reb_ast') return 'pra'
    if (t.includes('block')) return 'blocks'
    if (t.includes('steal')) return 'steals'
    return t
  }

  const norm1 = normalize(type1)
  const norm2 = normalize(type2)

  if (norm1 === norm2) return 1.0  // Same stat, perfectly correlated

  return PROP_CORRELATIONS[norm1]?.[norm2] ?? 0
}

/**
 * Calculate combined probability for multiple props on the SAME player
 * Uses Gaussian copula approximation for correlated events
 *
 * Formula: P(A AND B) ≈ P(A) * P(B) * (1 + ρ * (1 - P(A)) * (1 - P(B)))
 * where ρ is the correlation coefficient
 */
export async function calculateCombinedPlayerProps(
  playerName: string,
  props: Array<{ propType: string; threshold: number; direction: 'over' | 'under' }>
): Promise<ParlayProbabilityResult | null> {
  if (props.length === 0) return null

  const legs: PlayerPropLeg[] = []
  const correlationAdjustments: CorrelationAdjustment[] = []

  // Calculate individual probabilities
  for (const prop of props) {
    const leg = await calculatePlayerPropProbability(
      playerName,
      prop.propType,
      prop.threshold,
      prop.direction
    )
    if (!leg) return null
    legs.push(leg)
  }

  // Independent probability (naive multiplication)
  const independentProb = legs.reduce((acc, leg) => acc * leg.probability, 1)

  // Calculate correlated probability
  let correlatedProb = independentProb

  if (legs.length === 2) {
    // Two-leg case with Gaussian copula approximation
    const [leg1, leg2] = legs
    const correlation = getCorrelation(leg1.propType, leg2.propType)

    if (correlation !== 0) {
      // P(A AND B) ≈ P(A) * P(B) * (1 + ρ * (1 - P(A)) * (1 - P(B)))
      const adjustment = 1 + correlation * (1 - leg1.probability) * (1 - leg2.probability)
      correlatedProb = independentProb * adjustment

      const adjustmentPercent = ((adjustment - 1) * 100).toFixed(1)
      correlationAdjustments.push({
        description: `${leg1.propType} ↔ ${leg2.propType}`,
        factor: adjustment,
        reason: correlation > 0
          ? `+${adjustmentPercent}% - these stats tend to rise together`
          : `${adjustmentPercent}% - inverse relationship between stats`,
      })
    }
  } else if (legs.length > 2) {
    // Multi-leg: apply pairwise correlations
    let totalAdjustment = 1

    for (let i = 0; i < legs.length; i++) {
      for (let j = i + 1; j < legs.length; j++) {
        const correlation = getCorrelation(legs[i].propType, legs[j].propType)
        if (correlation !== 0) {
          const pairAdjustment = 1 + correlation * (1 - legs[i].probability) * (1 - legs[j].probability)
          totalAdjustment *= pairAdjustment

          correlationAdjustments.push({
            description: `${legs[i].propType} ↔ ${legs[j].propType}`,
            factor: pairAdjustment,
            reason: correlation > 0 ? 'Positive correlation' : 'Negative correlation',
          })
        }
      }
    }

    correlatedProb = independentProb * totalAdjustment
  }

  // Clamp probability
  correlatedProb = Math.max(0.001, Math.min(0.999, correlatedProb))

  // Calculate implied odds
  const decimalOdds = 1 / correlatedProb
  const americanOdds = decimalOdds >= 2
    ? Math.round((decimalOdds - 1) * 100)
    : Math.round(-100 / (decimalOdds - 1))

  // Determine overall confidence
  const avgConfidence = legs.reduce((acc, leg) => {
    return acc + (leg.confidence === 'high' ? 3 : leg.confidence === 'medium' ? 2 : 1)
  }, 0) / legs.length
  const confidence: 'high' | 'medium' | 'low' =
    avgConfidence >= 2.5 ? 'high' : avgConfidence >= 1.5 ? 'medium' : 'low'

  // Build breakdown string
  const breakdown = legs.map(leg =>
    `${leg.description}: ${formatProbability(leg.probability)}`
  ).join('\n')

  // Build formatted output
  const formatted = formatParlayResult({
    legs,
    independentProbability: independentProb,
    correlatedProbability: correlatedProb,
    correlationAdjustments,
    impliedOdds: { american: americanOdds, decimal: decimalOdds },
    confidence,
    breakdown,
    formatted: '',
  })

  return {
    legs,
    independentProbability: independentProb,
    correlatedProbability: correlatedProb,
    correlationAdjustments,
    impliedOdds: { american: americanOdds, decimal: decimalOdds },
    confidence,
    breakdown,
    formatted,
  }
}

/**
 * Calculate game outcome probability
 * Uses team stats differential for spread/total calculations
 */
export async function calculateGameOutcomeProbability(
  homeTeam: string,
  awayTeam: string,
  betType: 'spread' | 'total' | 'moneyline',
  line?: number,
  direction?: 'home' | 'away' | 'over' | 'under',
  marketOdds?: number
): Promise<GameOutcomeLeg | null> {
  const teams = getStaticNbaTeams()

  // Find teams
  const normalizeTeam = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '')
  const homeNorm = normalizeTeam(homeTeam)
  const awayNorm = normalizeTeam(awayTeam)

  const homeStats = teams.find(t => normalizeTeam(t.team).includes(homeNorm) || homeNorm.includes(normalizeTeam(t.team)))
  const awayStats = teams.find(t => normalizeTeam(t.team).includes(awayNorm) || awayNorm.includes(normalizeTeam(t.team)))

  if (!homeStats || !awayStats) return null

  // Get team stats
  const homeOrtg = (homeStats.stats as any).offensiveRating ?? (homeStats.stats as any).ortg ?? 112
  const homeDrtg = (homeStats.stats as any).defensiveRating ?? (homeStats.stats as any).drtg ?? 112
  const awayOrtg = (awayStats.stats as any).offensiveRating ?? (awayStats.stats as any).ortg ?? 112
  const awayDrtg = (awayStats.stats as any).defensiveRating ?? (awayStats.stats as any).drtg ?? 112
  const homePace = (homeStats.stats as any).pace ?? 100
  const awayPace = (awayStats.stats as any).pace ?? 100

  // Calculate projected scores
  const avgPace = (homePace + awayPace) / 2
  const possessions = avgPace

  // Home team's expected points = average of their offense and opponent's defense
  const homeExpected = (homeOrtg + awayDrtg) / 2 * possessions / 100
  const awayExpected = (awayOrtg + homeDrtg) / 2 * possessions / 100

  // Add home court advantage (~3 points in NBA)
  const homeAdj = homeExpected + 1.5
  const awayAdj = awayExpected - 1.5

  const projectedSpread = awayAdj - homeAdj  // Negative = home favored
  const projectedTotal = homeAdj + awayAdj

  let modelProbability = 0.5
  let description = ''

  // Standard deviation for NBA spreads is ~12 points
  const spreadStdDev = 12
  const totalStdDev = 15

  switch (betType) {
    case 'spread':
      if (line !== undefined && direction) {
        // Z-score: how many standard deviations is the line from projection
        const effectiveSpread = direction === 'home' ? -line : line
        const margin = projectedSpread - effectiveSpread
        const zScore = margin / spreadStdDev

        // Use normal CDF approximation
        modelProbability = normalCDF(zScore)

        const team = direction === 'home' ? homeTeam : awayTeam
        const lineStr = line > 0 ? `+${line}` : `${line}`
        description = `${team} ${lineStr}`
      }
      break

    case 'total':
      if (line !== undefined && direction) {
        const margin = direction === 'over'
          ? projectedTotal - line
          : line - projectedTotal
        const zScore = margin / totalStdDev

        modelProbability = normalCDF(zScore)
        description = `${direction} ${line}`
      }
      break

    case 'moneyline':
      if (direction) {
        const margin = projectedSpread
        const adjustedMargin = direction === 'home' ? -margin : margin
        const zScore = adjustedMargin / spreadStdDev

        modelProbability = normalCDF(zScore)
        const team = direction === 'home' ? homeTeam : awayTeam
        description = `${team} ML`
      }
      break
  }

  // Calculate implied probability from market odds if provided
  let impliedProbability: number | undefined
  let edge: number | undefined

  if (marketOdds !== undefined) {
    impliedProbability = americanToImpliedProbability(marketOdds)
    edge = modelProbability - impliedProbability
  }

  return {
    type: betType === 'spread' ? 'game_spread' : betType === 'total' ? 'game_total' : 'game_moneyline',
    homeTeam,
    awayTeam,
    line,
    direction,
    probability: modelProbability,
    marketOdds,
    impliedProbability,
    modelProbability,
    edge,
    description: `${awayTeam} @ ${homeTeam}: ${description}`,
    source: 'calculated',
    confidence: getConfidenceLevel(modelProbability),
  }
}

/**
 * Calculate full parlay probability for multiple independent events
 * (different players, different games)
 */
export async function calculateParlayProbability(
  legs: Array<{
    type: 'player_prop' | 'game_spread' | 'game_total' | 'game_moneyline'
    // Player prop params
    playerName?: string
    propType?: string
    threshold?: number
    propDirection?: 'over' | 'under'
    // Game outcome params
    homeTeam?: string
    awayTeam?: string
    line?: number
    direction?: 'home' | 'away' | 'over' | 'under'
    marketOdds?: number
  }>
): Promise<ParlayProbabilityResult | null> {
  if (legs.length === 0) return null

  const calculatedLegs: (PlayerPropLeg | GameOutcomeLeg)[] = []
  const correlationAdjustments: CorrelationAdjustment[] = []

  // Group legs by player to detect same-player correlations
  const playerLegs: Record<string, PlayerPropLeg[]> = {}
  const gameLegs: Record<string, GameOutcomeLeg[]> = {}

  // Calculate each leg
  for (const leg of legs) {
    if (leg.type === 'player_prop') {
      if (!leg.playerName || !leg.propType || leg.threshold === undefined) continue

      const propLeg = await calculatePlayerPropProbability(
        leg.playerName,
        leg.propType,
        leg.threshold,
        leg.propDirection || 'over'
      )
      if (!propLeg) continue

      calculatedLegs.push(propLeg)

      // Group by player
      const playerKey = normalize(leg.playerName)
      if (!playerLegs[playerKey]) playerLegs[playerKey] = []
      playerLegs[playerKey].push(propLeg)
    } else {
      if (!leg.homeTeam || !leg.awayTeam) continue

      const gameLeg = await calculateGameOutcomeProbability(
        leg.homeTeam,
        leg.awayTeam,
        leg.type === 'game_spread' ? 'spread' : leg.type === 'game_total' ? 'total' : 'moneyline',
        leg.line,
        leg.direction,
        leg.marketOdds
      )
      if (!gameLeg) continue

      calculatedLegs.push(gameLeg)

      // Group by game
      const gameKey = `${normalize(leg.homeTeam)}_${normalize(leg.awayTeam)}`
      if (!gameLegs[gameKey]) gameLegs[gameKey] = []
      gameLegs[gameKey].push(gameLeg)
    }
  }

  if (calculatedLegs.length === 0) return null

  // Independent probability (naive multiplication)
  const independentProb = calculatedLegs.reduce((acc, leg) => acc * leg.probability, 1)

  // Apply correlations
  let correlatedProb = independentProb

  // Same-player prop correlations
  for (const [playerKey, legs] of Object.entries(playerLegs)) {
    if (legs.length <= 1) continue

    for (let i = 0; i < legs.length; i++) {
      for (let j = i + 1; j < legs.length; j++) {
        const correlation = getCorrelation(legs[i].propType, legs[j].propType)
        if (correlation !== 0) {
          const adjustment = 1 + correlation * (1 - legs[i].probability) * (1 - legs[j].probability)
          correlatedProb *= adjustment

          correlationAdjustments.push({
            description: `${legs[i].playerName}: ${legs[i].propType} ↔ ${legs[j].propType}`,
            factor: adjustment,
            reason: correlation > 0
              ? 'Same player - stats rise together'
              : 'Same player - inverse relationship',
          })
        }
      }
    }
  }

  // Same-game outcome correlations (e.g., spread + total)
  for (const [gameKey, legs] of Object.entries(gameLegs)) {
    if (legs.length <= 1) continue

    for (let i = 0; i < legs.length; i++) {
      for (let j = i + 1; j < legs.length; j++) {
        // Check for spread-total correlation
        if (
          (legs[i].type === 'game_spread' && legs[j].type === 'game_total') ||
          (legs[i].type === 'game_total' && legs[j].type === 'game_spread')
        ) {
          const correlation = GAME_CORRELATIONS.spreadToTotal
          const adjustment = 1 + correlation * (1 - legs[i].probability) * (1 - legs[j].probability)
          correlatedProb *= adjustment

          correlationAdjustments.push({
            description: 'Same game: spread + total',
            factor: adjustment,
            reason: 'Spread and total outcomes slightly correlated',
          })
        }
      }
    }
  }

  // Clamp
  correlatedProb = Math.max(0.001, Math.min(0.999, correlatedProb))

  // Calculate implied odds
  const decimalOdds = 1 / correlatedProb
  const americanOdds = decimalOdds >= 2
    ? Math.round((decimalOdds - 1) * 100)
    : Math.round(-100 / (decimalOdds - 1))

  // Confidence
  const avgConfidence = calculatedLegs.reduce((acc, leg) => {
    return acc + (leg.confidence === 'high' ? 3 : leg.confidence === 'medium' ? 2 : 1)
  }, 0) / calculatedLegs.length
  const confidence: 'high' | 'medium' | 'low' =
    avgConfidence >= 2.5 ? 'high' : avgConfidence >= 1.5 ? 'medium' : 'low'

  // Breakdown
  const breakdown = calculatedLegs.map(leg =>
    `${leg.description}: ${formatProbability(leg.probability)}`
  ).join('\n')

  const formatted = formatParlayResult({
    legs: calculatedLegs,
    independentProbability: independentProb,
    correlatedProbability: correlatedProb,
    correlationAdjustments,
    impliedOdds: { american: americanOdds, decimal: decimalOdds },
    confidence,
    breakdown,
    formatted: '',
  })

  return {
    legs: calculatedLegs,
    independentProbability: independentProb,
    correlatedProbability: correlatedProb,
    correlationAdjustments,
    impliedOdds: { american: americanOdds, decimal: decimalOdds },
    confidence,
    breakdown,
    formatted,
  }
}

// ============================================
// Formatting
// ============================================

function formatParlayResult(result: ParlayProbabilityResult): string {
  let output = '**Parlay Probability Analysis**\n\n'

  output += '**Individual Legs:**\n'
  for (const leg of result.legs) {
    const emoji = leg.confidence === 'high' ? '🔥' : leg.confidence === 'medium' ? '✓' : '⚠️'
    let legLine = `${emoji} ${leg.description}: ${formatProbability(leg.probability)}`

    // Add market comparison for player props
    if (leg.type === 'player_prop') {
      const propLeg = leg as PlayerPropLeg
      if (propLeg.marketLine !== undefined && propLeg.marketOdds !== undefined) {
        const oddsStr = propLeg.marketOdds > 0 ? `+${propLeg.marketOdds}` : `${propLeg.marketOdds}`
        const bookStr = propLeg.book ? ` @ ${propLeg.book}` : ''
        legLine += ` (Line: ${propLeg.marketLine}, Odds: ${oddsStr}${bookStr})`
      }
    }
    output += legLine + '\n'
  }

  output += '\n**Combined Probability:**\n'
  output += `• Independent (naive): ${formatProbability(result.independentProbability)}\n`

  if (result.correlationAdjustments.length > 0) {
    output += `• Correlated (adjusted): ${formatProbability(result.correlatedProbability)}\n`
    output += '\n**Correlation Adjustments:**\n'
    for (const adj of result.correlationAdjustments) {
      const sign = adj.factor >= 1 ? '+' : ''
      const pct = ((adj.factor - 1) * 100).toFixed(1)
      output += `• ${adj.description}: ${sign}${pct}% (${adj.reason})\n`
    }
  } else {
    output += `• Final (no correlations): ${formatProbability(result.correlatedProbability)}\n`
  }

  output += '\n**Implied Fair Odds:**\n'
  output += `• American: ${result.impliedOdds.american > 0 ? '+' : ''}${result.impliedOdds.american}\n`
  output += `• Decimal: ${result.impliedOdds.decimal.toFixed(2)}\n`

  // Add edge analysis for ALL legs with market odds
  const allLegsWithEdge = result.legs.filter(leg => {
    if (leg.type === 'player_prop') {
      return (leg as PlayerPropLeg).edge !== undefined
    }
    return (leg as GameOutcomeLeg).edge !== undefined
  })

  if (allLegsWithEdge.length > 0) {
    output += '\n**Edge Analysis (Model vs Market):**\n'
    for (const leg of allLegsWithEdge) {
      const edgeValue = leg.type === 'player_prop'
        ? (leg as PlayerPropLeg).edge!
        : (leg as GameOutcomeLeg).edge!
      const edgeSign = edgeValue >= 0 ? '+' : ''
      const edgePct = (edgeValue * 100).toFixed(1)
      const verdict = edgeValue > 0.03 ? '✓ Value' : edgeValue < -0.03 ? '✗ No value' : '~ Fair'
      output += `• ${leg.description}: ${edgeSign}${edgePct}% edge (${verdict})\n`
    }
  }

  output += `\n**Confidence:** ${result.confidence.toUpperCase()}`

  return output
}

// ============================================
// Utility Functions
// ============================================

function americanToImpliedProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100)
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100)
  }
}

function normalCDF(z: number): number {
  // Approximation of the normal CDF
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - probability : probability
}

/**
 * Format result for chat/LLM consumption
 */
export function formatParlayResultForChat(result: ParlayProbabilityResult): string {
  return result.formatted
}
