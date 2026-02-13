/**
 * Edge Detection Service
 *
 * Analyzes line movement, public betting splits, and sharp money indicators
 * to identify potential betting edges.
 *
 * Key signals:
 * 1. Line Movement - Opening vs current line comparison
 * 2. Reverse Line Movement (RLM) - Line moves opposite to public betting
 * 3. Sharp Money - When money % diverges significantly from bet %
 * 4. Steam Moves - Significant movement within sport-specific thresholds
 */

import { fetchSbdOdds, type SbdLeague, buildTeamLabel } from '@/lib/api/sbd'
import { SPORTS } from '@/lib/types/odds'

// Sport-specific sharp movement thresholds
const SHARP_THRESHOLDS = {
  nfl: {
    spread: { min: 0.5, significant: 1.0 },
    total: { min: 1.0, significant: 1.5 },
    moneyline: { min: 15, significant: 30 }, // cents
    signalStrength: 5, // 🔥🔥🔥🔥🔥
    notes: 'Ultra-efficient. Half-point off key number (3,7) without news = sharp. Sunday morning = syndicate steam.',
  },
  nba: {
    spread: { min: 1.0, significant: 2.0 },
    total: { min: 2.0, significant: 4.0 },
    moneyline: { min: 20, significant: 40 },
    signalStrength: 4,
    notes: 'News-sensitive. Discount injury moves. Sharpest action at open or overnight.',
  },
  ncaamb: {
    spread: { min: 2.0, significant: 4.0 },
    total: { min: 3.0, significant: 6.0 },
    moneyline: { min: 30, significant: 60 },
    signalStrength: 4,
    notes: 'Lower liquidity = bigger moves. Early-week steam that stops = best signal.',
  },
  ncaafb: {
    spread: { min: 1.5, significant: 3.0 },
    total: { min: 3.0, significant: 6.0 },
    moneyline: { min: 30, significant: 50 },
    signalStrength: 4,
    notes: 'Sharp groups dominate openers. Public money shows late, pushes wrong way.',
  },
  nhl: {
    spread: { min: 0.5, significant: 0.5 }, // puck line rarely moves
    total: { min: 0.5, significant: 1.0 },
    moneyline: { min: 15, significant: 30 },
    signalStrength: 3,
    notes: 'Low scoring = small moves matter. 20-cent ML overnight = very meaningful.',
  },
  mlb: {
    spread: { min: 0.5, significant: 0.5 }, // run line
    total: { min: 0.5, significant: 1.0 },
    moneyline: { min: 15, significant: 30 },
    signalStrength: 3,
    notes: 'Pitching matchups dominate. Watch for late scratches.',
  },
} as const

type SportKey = keyof typeof SHARP_THRESHOLDS

// Map league keys to our threshold keys
const LEAGUE_TO_SPORT: Record<string, SportKey> = {
  nba: 'nba',
  nfl: 'nfl',
  ncaamb: 'ncaamb',
  ncaafb: 'ncaafb',
  nhl: 'nhl',
  mlb: 'mlb',
  basketball_nba: 'nba',
  basketball_ncaab: 'ncaamb',
  americanfootball_nfl: 'nfl',
  americanfootball_ncaaf: 'ncaafb',
  icehockey_nhl: 'nhl',
  baseball_mlb: 'mlb',
}

const normalizeTeamName = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildMatchTokens = (value: string) =>
  normalizeTeamName(value)
    .split(' ')
    .filter((token) => token.length > 2)

const scoreGameMatch = (
  homeTeam: string,
  awayTeam: string,
  query: string,
  tokens: string[]
) => {
  let score = 0
  if (homeTeam && query.includes(homeTeam)) score += 4
  if (awayTeam && query.includes(awayTeam)) score += 4
  for (const token of tokens) {
    if (homeTeam.includes(token) || awayTeam.includes(token)) score += 1
  }
  return score
}

export interface LineMovement {
  market: 'spread' | 'total' | 'moneyline'
  side: string // team name or Over/Under
  openingLine: number
  currentLine: number
  movement: number // positive = line moved up
  openingOdds: number
  currentOdds: number
  oddsMovement: number // in cents
  isSharp: boolean
  isSignificant: boolean
  direction: 'toward' | 'away' | 'neutral' // relative to side
}

export interface BettingSplits {
  spreadHomeBetPct?: number
  spreadAwayBetPct?: number
  spreadHomeMoneyPct?: number
  spreadAwayMoneyPct?: number
  totalOverBetPct?: number
  totalUnderBetPct?: number
  totalOverMoneyPct?: number
  totalUnderMoneyPct?: number
  mlHomeBetPct?: number
  mlAwayBetPct?: number
  mlHomeMoneyPct?: number
  mlAwayMoneyPct?: number
}

export interface SharpSignal {
  type: 'RLM' | 'STEAM' | 'SHARP_MONEY' | 'STALLED'
  market: 'spread' | 'total' | 'moneyline'
  side: string
  strength: 1 | 2 | 3 | 4 | 5 // 🔥 rating
  description: string
  confidence: 'low' | 'medium' | 'high'
}

export interface EdgeDetectionResult {
  gameId: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  sport: SportKey

  // Line movement data
  lineMovements: LineMovement[]

  // Betting splits
  splits: BettingSplits

  // Sharp signals detected
  sharpSignals: SharpSignal[]

  // Overall edge assessment
  hasEdge: boolean
  edgeSide?: string
  edgeMarket?: 'spread' | 'total' | 'moneyline'
  edgeStrength: number // 0-5
  summary: string
}

/**
 * Parse American odds to number
 */
function parseOdds(value: any): number | null {
  if (value == null) return null
  const str = String(value).replace(/[^0-9.+-]/g, '')
  const num = parseFloat(str)
  return Number.isFinite(num) ? num : null
}

/**
 * Parse line value (spread, total)
 */
function parseLine(value: any): number | null {
  if (value == null) return null
  const num = parseFloat(String(value))
  return Number.isFinite(num) ? num : null
}

/**
 * Calculate odds movement in cents
 */
function calculateOddsMovement(opening: number, current: number): number {
  // Convert to cents movement
  // -110 to -115 = 5 cents toward
  // +150 to +140 = 10 cents toward (less plus)
  if (opening < 0 && current < 0) {
    return Math.abs(current) - Math.abs(opening) // negative = moved toward
  }
  if (opening > 0 && current > 0) {
    return opening - current // positive = moved toward (less plus money)
  }
  // Crossed even - significant move
  return Math.abs(opening) + Math.abs(current)
}

/**
 * Detect if movement meets sharp thresholds
 */
function analyzeMovement(
  market: 'spread' | 'total' | 'moneyline',
  movement: number,
  sport: SportKey
): { isSharp: boolean; isSignificant: boolean } {
  const thresholds = SHARP_THRESHOLDS[sport]?.[market]
  if (!thresholds) return { isSharp: false, isSignificant: false }

  const absMove = Math.abs(movement)
  return {
    isSharp: absMove >= thresholds.min,
    isSignificant: absMove >= thresholds.significant,
  }
}

const resolveRlmStrength = (publicPct: number) =>
  (publicPct >= 75 ? 5 : publicPct >= 70 ? 4 : 3) as 1 | 2 | 3 | 4 | 5

const pickLargestMovement = <T extends { movement: number; oddsMovement: number }>(
  candidates: T[]
): T | null => {
  if (!candidates.length) return null

  let best = candidates[0]
  for (const candidate of candidates.slice(1)) {
    const bestAbs = Math.abs(best.movement)
    const nextAbs = Math.abs(candidate.movement)
    if (nextAbs > bestAbs) {
      best = candidate
      continue
    }
    if (nextAbs === bestAbs && Math.abs(candidate.oddsMovement) > Math.abs(best.oddsMovement)) {
      best = candidate
    }
  }
  return best
}

/**
 * Detect Reverse Line Movement (RLM)
 * Line moves opposite to where public money is going
 */
function detectRLM(
  movement: LineMovement,
  splits: BettingSplits,
  homeTeam: string,
  awayTeam: string
): SharpSignal | null {
  const { market, movement: lineMove } = movement

  if (market === 'spread') {
    // Spread movement is tracked from home-team perspective.
    if (lineMove > 0) {
      const publicPct = splits.spreadHomeBetPct
      if (publicPct != null && publicPct >= 60) {
        return {
          type: 'RLM',
          market,
          side: awayTeam,
          strength: resolveRlmStrength(publicPct),
          description: `${publicPct}% of bets on ${homeTeam} but line moved against them`,
          confidence: publicPct >= 70 ? 'high' : 'medium',
        }
      }
    } else if (lineMove < 0) {
      const publicPct = splits.spreadAwayBetPct
      if (publicPct != null && publicPct >= 60) {
        return {
          type: 'RLM',
          market,
          side: homeTeam,
          strength: resolveRlmStrength(publicPct),
          description: `${publicPct}% of bets on ${awayTeam} but line moved against them`,
          confidence: publicPct >= 70 ? 'high' : 'medium',
        }
      }
    }
    return null
  }

  if (market === 'total') {
    // Total movement is tracked from opening total to current total.
    // Downward movement is against public Over; upward movement is against public Under.
    if (lineMove < 0) {
      const publicPct = splits.totalOverBetPct
      if (publicPct != null && publicPct >= 60) {
        return {
          type: 'RLM',
          market,
          side: 'Under',
          strength: resolveRlmStrength(publicPct),
          description: `${publicPct}% of bets on Over but line moved against them`,
          confidence: publicPct >= 70 ? 'high' : 'medium',
        }
      }
    } else if (lineMove > 0) {
      const publicPct = splits.totalUnderBetPct
      if (publicPct != null && publicPct >= 60) {
        return {
          type: 'RLM',
          market,
          side: 'Over',
          strength: resolveRlmStrength(publicPct),
          description: `${publicPct}% of bets on Under but line moved against them`,
          confidence: publicPct >= 70 ? 'high' : 'medium',
        }
      }
    }
    return null
  }

  if (market === 'moneyline') {
    if (lineMove === 0) return null

    const movedTowardHome = movement.side === homeTeam
    if (movedTowardHome) {
      const publicPct = splits.mlAwayBetPct
      if (publicPct != null && publicPct >= 60) {
        return {
          type: 'RLM',
          market,
          side: homeTeam,
          strength: resolveRlmStrength(publicPct),
          description: `${publicPct}% of bets on ${awayTeam} but line moved against them`,
          confidence: publicPct >= 70 ? 'high' : 'medium',
        }
      }
    } else {
      const publicPct = splits.mlHomeBetPct
      if (publicPct != null && publicPct >= 60) {
        return {
          type: 'RLM',
          market,
          side: awayTeam,
          strength: resolveRlmStrength(publicPct),
          description: `${publicPct}% of bets on ${homeTeam} but line moved against them`,
          confidence: publicPct >= 70 ? 'high' : 'medium',
        }
      }
    }
  }

  return null
}

/**
 * Detect Sharp Money divergence
 * When money % significantly differs from bet %
 */
function detectSharpMoney(
  splits: BettingSplits,
  homeTeam: string,
  awayTeam: string
): SharpSignal[] {
  const signals: SharpSignal[] = []
  const DIVERGENCE_THRESHOLD = 15 // 15% difference between bet% and money%

  // Check spread
  if (splits.spreadHomeBetPct != null && splits.spreadHomeMoneyPct != null) {
    const divergence = splits.spreadHomeMoneyPct - splits.spreadHomeBetPct
    if (Math.abs(divergence) >= DIVERGENCE_THRESHOLD) {
      const sharpSide = divergence > 0 ? homeTeam : awayTeam
      const strength = Math.abs(divergence) >= 25 ? 5 : Math.abs(divergence) >= 20 ? 4 : 3
      signals.push({
        type: 'SHARP_MONEY',
        market: 'spread',
        side: sharpSide,
        strength: strength as 1 | 2 | 3 | 4 | 5,
        description: `${Math.abs(divergence).toFixed(0)}% money/bet divergence on ${sharpSide} spread`,
        confidence: Math.abs(divergence) >= 20 ? 'high' : 'medium',
      })
    }
  }

  // Check total
  if (splits.totalOverBetPct != null && splits.totalOverMoneyPct != null) {
    const divergence = splits.totalOverMoneyPct - splits.totalOverBetPct
    if (Math.abs(divergence) >= DIVERGENCE_THRESHOLD) {
      const sharpSide = divergence > 0 ? 'Over' : 'Under'
      const strength = Math.abs(divergence) >= 25 ? 5 : Math.abs(divergence) >= 20 ? 4 : 3
      signals.push({
        type: 'SHARP_MONEY',
        market: 'total',
        side: sharpSide,
        strength: strength as 1 | 2 | 3 | 4 | 5,
        description: `${Math.abs(divergence).toFixed(0)}% money/bet divergence on ${sharpSide}`,
        confidence: Math.abs(divergence) >= 20 ? 'high' : 'medium',
      })
    }
  }

  // Check moneyline
  if (splits.mlHomeBetPct != null && splits.mlHomeMoneyPct != null) {
    const divergence = splits.mlHomeMoneyPct - splits.mlHomeBetPct
    if (Math.abs(divergence) >= DIVERGENCE_THRESHOLD) {
      const sharpSide = divergence > 0 ? homeTeam : awayTeam
      const strength = Math.abs(divergence) >= 25 ? 5 : Math.abs(divergence) >= 20 ? 4 : 3
      signals.push({
        type: 'SHARP_MONEY',
        market: 'moneyline',
        side: sharpSide,
        strength: strength as 1 | 2 | 3 | 4 | 5,
        description: `${Math.abs(divergence).toFixed(0)}% money/bet divergence on ${sharpSide} ML`,
        confidence: Math.abs(divergence) >= 20 ? 'high' : 'medium',
      })
    }
  }

  return signals
}

/**
 * Detect Steam Move
 * Significant line movement within sharp thresholds
 */
function detectSteamMove(
  movement: LineMovement,
  sport: SportKey
): SharpSignal | null {
  if (!movement.isSignificant) return null

  const sportThresholds = SHARP_THRESHOLDS[sport]

  return {
    type: 'STEAM',
    market: movement.market,
    side: movement.side,
    strength: sportThresholds.signalStrength as 1 | 2 | 3 | 4 | 5,
    description: `${movement.market} moved ${Math.abs(movement.movement).toFixed(1)} points (${movement.openingLine} → ${movement.currentLine})`,
    confidence: movement.isSignificant ? 'high' : 'medium',
  }
}

/**
 * Extract line movements from SBD game data
 */
function extractLineMovements(
  game: any,
  homeTeam: string,
  awayTeam: string,
  sport: SportKey
): LineMovement[] {
  const movements: LineMovement[] = []
  const markets = game?.markets || {}

  // Process spread
  const spreadBooks = markets?.spread?.books || []
  const spreadCandidates: LineMovement[] = []
  for (const book of spreadBooks) {
    const homeSpread = parseLine(book?.home?.spread)
    const homeOpenSpread = parseLine(book?.home?.opening_spread)
    const homeOdds = parseOdds(book?.home?.odds)
    const homeOpenOdds = parseOdds(book?.home?.opening_odds)

    if (homeSpread != null && homeOpenSpread != null) {
      const movement = homeSpread - homeOpenSpread
      const { isSharp, isSignificant } = analyzeMovement('spread', movement, sport)

      spreadCandidates.push({
        market: 'spread',
        side: homeTeam,
        openingLine: homeOpenSpread,
        currentLine: homeSpread,
        movement,
        openingOdds: homeOpenOdds || -110,
        currentOdds: homeOdds || -110,
        oddsMovement: homeOdds && homeOpenOdds ? calculateOddsMovement(homeOpenOdds, homeOdds) : 0,
        isSharp,
        isSignificant,
        direction: movement > 0 ? 'away' : movement < 0 ? 'toward' : 'neutral',
      })
    }
  }
  const bestSpread = pickLargestMovement(spreadCandidates)
  if (bestSpread) movements.push(bestSpread)

  // Process total
  const totalBooks = markets?.total?.books || []
  const totalCandidates: LineMovement[] = []
  for (const book of totalBooks) {
    const total = parseLine(book?.over?.total ?? book?.total)
    const openTotal = parseLine(book?.over?.opening_total ?? book?.opening_total)
    const overOdds = parseOdds(book?.over?.odds)
    const openOverOdds = parseOdds(book?.over?.opening_odds)

    if (total != null && openTotal != null) {
      const movement = total - openTotal
      const { isSharp, isSignificant } = analyzeMovement('total', movement, sport)

      totalCandidates.push({
        market: 'total',
        side: movement > 0 ? 'Over' : 'Under', // Sharp side is where it moved
        openingLine: openTotal,
        currentLine: total,
        movement,
        openingOdds: openOverOdds || -110,
        currentOdds: overOdds || -110,
        oddsMovement: overOdds && openOverOdds ? calculateOddsMovement(openOverOdds, overOdds) : 0,
        isSharp,
        isSignificant,
        direction: movement === 0 ? 'neutral' : 'toward',
      })
    }
  }
  const bestTotal = pickLargestMovement(totalCandidates)
  if (bestTotal) movements.push(bestTotal)

  // Process moneyline
  const mlBooks = markets?.moneyline?.books || []
  const moneylineCandidates: LineMovement[] = []
  for (const book of mlBooks) {
    const homeOdds = parseOdds(book?.home?.odds)
    const homeOpenOdds = parseOdds(book?.home?.opening_odds)

    if (homeOdds != null && homeOpenOdds != null) {
      const oddsMove = calculateOddsMovement(homeOpenOdds, homeOdds)
      const { isSharp, isSignificant } = analyzeMovement('moneyline', oddsMove, sport)

      // Determine which side the line moved toward
      const movedTowardHome = (homeOpenOdds > 0 && homeOdds < homeOpenOdds) ||
                              (homeOpenOdds < 0 && homeOdds < homeOpenOdds)
      const direction: LineMovement['direction'] =
        oddsMove === 0 ? 'neutral' : movedTowardHome ? 'toward' : 'away'

      moneylineCandidates.push({
        market: 'moneyline',
        side: direction === 'neutral' ? homeTeam : movedTowardHome ? homeTeam : awayTeam,
        openingLine: homeOpenOdds,
        currentLine: homeOdds,
        movement: oddsMove,
        openingOdds: homeOpenOdds,
        currentOdds: homeOdds,
        oddsMovement: oddsMove,
        isSharp,
        isSignificant,
        direction,
      })
    }
  }
  const bestMoneyline = pickLargestMovement(moneylineCandidates)
  if (bestMoneyline) movements.push(bestMoneyline)

  return movements
}

/**
 * Extract betting splits from SBD game data
 */
function extractBettingSplits(game: any): BettingSplits {
  const splits = game?.bettingSplits || {}

  return {
    spreadHomeBetPct: splits?.spread?.home?.betsPercentage,
    spreadAwayBetPct: splits?.spread?.away?.betsPercentage,
    spreadHomeMoneyPct: splits?.spread?.home?.stakePercentage,
    spreadAwayMoneyPct: splits?.spread?.away?.stakePercentage,
    totalOverBetPct: splits?.total?.over?.betsPercentage,
    totalUnderBetPct: splits?.total?.under?.betsPercentage,
    totalOverMoneyPct: splits?.total?.over?.stakePercentage,
    totalUnderMoneyPct: splits?.total?.under?.stakePercentage,
    mlHomeBetPct: splits?.moneyline?.home?.betsPercentage,
    mlAwayBetPct: splits?.moneyline?.away?.betsPercentage,
    mlHomeMoneyPct: splits?.moneyline?.home?.stakePercentage,
    mlAwayMoneyPct: splits?.moneyline?.away?.stakePercentage,
  }
}

/**
 * Analyze a single game for edge detection
 */
function analyzeGame(game: any, sport: SportKey): EdgeDetectionResult | null {
  const homeTeam = buildTeamLabel(game?.competitors?.home)
  const awayTeam = buildTeamLabel(game?.competitors?.away)

  if (!homeTeam || !awayTeam) return null

  const lineMovements = extractLineMovements(game, homeTeam, awayTeam, sport)
  const splits = extractBettingSplits(game)
  const sharpSignals: SharpSignal[] = []

  // Detect sharp money divergence
  sharpSignals.push(...detectSharpMoney(splits, homeTeam, awayTeam))

  // Analyze each line movement
  for (const movement of lineMovements) {
    // Check for RLM
    const rlm = detectRLM(movement, splits, homeTeam, awayTeam)
    if (rlm) sharpSignals.push(rlm)

    // Check for steam moves
    const steam = detectSteamMove(movement, sport)
    if (steam) sharpSignals.push(steam)
  }

  // Determine overall edge
  const hasEdge = sharpSignals.length > 0
  let edgeSide: string | undefined
  let edgeMarket: 'spread' | 'total' | 'moneyline' | undefined
  let edgeStrength = 0

  if (hasEdge) {
    // Find strongest signal
    const strongestSignal = sharpSignals.reduce((best, current) =>
      current.strength > best.strength ? current : best
    )
    edgeSide = strongestSignal.side
    edgeMarket = strongestSignal.market
    edgeStrength = strongestSignal.strength
  }

  // Build summary
  let summary = ''
  if (!hasEdge) {
    summary = 'No significant sharp signals detected'
  } else if (sharpSignals.length === 1) {
    summary = sharpSignals[0].description
  } else {
    const signalTypes = [...new Set(sharpSignals.map(s => s.type))]
    const sides = [...new Set(sharpSignals.map(s => s.side))]
    if (sides.length === 1) {
      summary = `Multiple signals (${signalTypes.join(', ')}) pointing to ${sides[0]}`
    } else {
      summary = `Mixed signals: ${sharpSignals.map(s => `${s.type} on ${s.side}`).join(', ')}`
    }
  }

  return {
    gameId: game?.id || '',
    homeTeam,
    awayTeam,
    gameTime: game?.scheduled || '',
    sport,
    lineMovements,
    splits,
    sharpSignals,
    hasEdge,
    edgeSide,
    edgeMarket,
    edgeStrength,
    summary,
  }
}

/**
 * Main function: Detect edges for all games in specified sports
 */
export async function detectEdges(
  sports: SbdLeague[] = ['nba', 'nfl', 'nhl']
): Promise<EdgeDetectionResult[]> {
  const results: EdgeDetectionResult[] = []

  for (const league of sports) {
    const sport = LEAGUE_TO_SPORT[league]
    if (!sport) continue

    try {
      console.log(`[EDGE-DETECTION] Fetching ${league} games...`)
      const data = await fetchSbdOdds(league)
      const games = Array.isArray(data?.data) ? data.data : []

      console.log(`[EDGE-DETECTION] Analyzing ${games.length} ${league} games...`)

      for (const game of games) {
        const result = analyzeGame(game, sport)
        if (result) {
          results.push(result)

          if (result.hasEdge) {
            console.log(`[EDGE-DETECTION] Edge found: ${result.awayTeam} @ ${result.homeTeam} - ${result.summary}`)
          }
        }
      }
    } catch (error) {
      console.error(`[EDGE-DETECTION] Failed to process ${league}:`, error)
    }
  }

  // Sort by edge strength
  results.sort((a, b) => b.edgeStrength - a.edgeStrength)

  return results
}

export async function detectEdgeForGame(
  league: SbdLeague,
  gameIdentifier: string
): Promise<EdgeDetectionResult | null> {
  const sport = LEAGUE_TO_SPORT[league]
  if (!sport || !gameIdentifier) return null

  try {
    console.log(`[EDGE-DETECTION] Fetching ${league} games for matchup...`)
    const data = await fetchSbdOdds(league)
    const games = Array.isArray(data?.data) ? data.data : []
    if (!games.length) return null

    const query = normalizeTeamName(gameIdentifier)
    const tokens = buildMatchTokens(gameIdentifier)
    let best: { game: any; score: number } | null = null

    for (const game of games) {
      const home = normalizeTeamName(buildTeamLabel(game?.competitors?.home) || '')
      const away = normalizeTeamName(buildTeamLabel(game?.competitors?.away) || '')
      if (!home || !away) continue
      const score = scoreGameMatch(home, away, query, tokens)
      if (score > 0 && (!best || score > best.score)) {
        best = { game, score }
      }
    }

    if (!best) return null
    return analyzeGame(best.game, sport)
  } catch (error) {
    console.error(`[EDGE-DETECTION] Failed to match ${league} game:`, error)
    return null
  }
}

/**
 * Format edge detection results for display
 */
export function formatEdgeResults(results: EdgeDetectionResult[]): string {
  const edgeGames = results.filter(r => r.hasEdge)

  if (edgeGames.length === 0) {
    return 'No significant sharp edges detected across markets.'
  }

  let output = `## Sharp Edge Detection\n\n`
  output += `Found **${edgeGames.length}** games with sharp signals:\n\n`
  output += `| Game | Edge | Signal | Strength | Details |\n`
  output += `|------|------|--------|----------|----------|\n`

  for (const game of edgeGames.slice(0, 20)) {
    const matchup = `${game.awayTeam} @ ${game.homeTeam}`
    const edge = game.edgeSide ? `${game.edgeSide} ${game.edgeMarket}` : '-'
    const signals = game.sharpSignals.map(s => s.type).join(', ')
    const strength = '🔥'.repeat(game.edgeStrength)
    const details = game.summary.substring(0, 50)

    output += `| ${matchup} | ${edge} | ${signals} | ${strength} | ${details} |\n`
  }

  return output
}

export function formatEdgeResultForGame(
  result: EdgeDetectionResult | null
): string {
  if (!result) {
    return 'No matching game found for edge detection.'
  }

  const lines: string[] = []
  lines.push(`## Sharp Edge Detection - ${result.awayTeam} @ ${result.homeTeam}`)
  lines.push('')
  lines.push(`Summary: ${result.summary}`)

  if (!result.hasEdge) {
    lines.push('No significant sharp signals detected for this game.')
    return lines.join('\n')
  }

  lines.push(
    `Edge: ${result.edgeSide || 'n/a'} ${result.edgeMarket || ''}`.trim()
  )

  if (result.sharpSignals.length) {
    const signals = result.sharpSignals
      .map((signal) => `${signal.type}(${signal.side})`)
      .join(', ')
    lines.push(`Signals: ${signals}`)
  }

  const notableMoves = result.lineMovements.filter(
    (move) => move.isSharp || move.isSignificant
  )
  if (notableMoves.length) {
    const moveSummary = notableMoves
      .slice(0, 2)
      .map((move) => `${move.market} ${move.side}: ${move.openingLine} -> ${move.currentLine}`)
      .join('; ')
    lines.push(`Line movement: ${moveSummary}`)
  }

  return lines.join('\n')
}

/**
 * Quick sharp signal check for a specific game
 * Returns key sharp indicators without full analysis overhead
 */
export async function getSharpSignalsForGame(
  sportKey: string,
  homeTeam: string,
  awayTeam: string
): Promise<{
  hasRLM: boolean
  hasSteam: boolean
  hasSharpMoney: boolean
  signals: { type: string; market: string; side: string; description: string }[]
  summary: string
}> {
  const league = LEAGUE_TO_SPORT[sportKey as keyof typeof LEAGUE_TO_SPORT] as SbdLeague | undefined
  if (!league) {
    return {
      hasRLM: false,
      hasSteam: false,
      hasSharpMoney: false,
      signals: [],
      summary: 'Sport not supported for sharp detection',
    }
  }

  try {
    const gameLabel = `${awayTeam} @ ${homeTeam}`
    const result = await detectEdgeForGame(league, gameLabel)

    if (!result) {
      return {
        hasRLM: false,
        hasSteam: false,
        hasSharpMoney: false,
        signals: [],
        summary: 'No matching game found',
      }
    }

    const hasRLM = result.sharpSignals.some((s) => s.type === 'RLM')
    const hasSteam = result.sharpSignals.some((s) => s.type === 'STEAM')
    const hasSharpMoney = result.sharpSignals.some((s) => s.type === 'SHARP_MONEY')

    return {
      hasRLM,
      hasSteam,
      hasSharpMoney,
      signals: result.sharpSignals.map((s) => ({
        type: s.type,
        market: s.market,
        side: s.side,
        description: s.description,
      })),
      summary: result.summary,
    }
  } catch (error) {
    console.error('[SHARP_SIGNALS] Error detecting signals:', error)
    return {
      hasRLM: false,
      hasSteam: false,
      hasSharpMoney: false,
      signals: [],
      summary: 'Error detecting sharp signals',
    }
  }
}

export { SHARP_THRESHOLDS }
