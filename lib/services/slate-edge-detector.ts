/**
 * Slate Edge Detector
 * Analyzes all games for a sport on a given day to find betting edges
 *
 * Combines:
 * 1. Model projections (target spread/total from matchup analysis)
 * 2. Sharp money signals (RLM, steam moves, bet%/money% divergence)
 *
 * Sharp confirmation boosts edge confidence when sharps agree with model
 */

import { fetchOdds } from '@/lib/api/odds-api'
import { getGameRecommendations, type GameRecommendation } from './recommendation-engine'
import { analyzeMatchup } from './matchup-analyzer'
import { evaluateLineEdge, type EdgeAssessment } from '@/lib/analysis/bet-tools'
import type { OddsGame } from '@/lib/types/odds'
import { MARKETS } from '@/lib/types/odds'
import {
  analyzeSlatePropEdges,
  formatSlatePropEdgesForChat,
  type PlayerPropEdge,
} from '@/lib/services/slate-prop-edge-detector'
import { findEVOpportunities } from '@/lib/services/cross-market-ev'
import type { EVOpportunity } from '@/lib/utils/ev-calculator'
import {
  detectEdges as detectSharpEdges,
  type SharpSignal,
  type LineMovement,
  type BettingSplits,
  type EdgeDetectionResult as SharpEdgeResult,
} from './edge-detection'

export interface GameEdgeAnalysis {
  matchup: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
  spread?: {
    marketLine: number
    targetLine: number
    edge: EdgeAssessment
    bestBook?: string
    bestOdds?: number
    favoredTeam: string // Which team the model favors
    sharpConfirmed?: boolean // Sharp signals agree with model
  }
  total?: {
    marketLine: number
    targetLine: number
    edge: EdgeAssessment
    bestBook?: string
    bestOdds?: number
    sharpConfirmed?: boolean // Sharp signals agree with model
  }
  confidence: 'low' | 'medium' | 'high'
  factors: string[]
  injuries: string[] // Injury factors
  matchupFactors: string[] // ORtg, DRtg, pace factors
  // Sharp money signals
  sharpSignals: SharpSignal[]
  lineMovements: LineMovement[]
  splits?: BettingSplits
  sharpConfirmation?: {
    agrees: boolean
    signals: string[]
    boost: number // Confidence boost factor (0-2)
  }
  highEv?: {
    spread?: EVOpportunity
    total?: EVOpportunity
  }
}

export interface SlateEdgeResult {
  sport: string
  sportLabel: string
  date: string
  gamesAnalyzed: number
  edges: GameEdgeAnalysis[]
  propEdges?: PlayerPropEdge[]
  propSummary?: {
    strongEdges: number
    softEdges: number
    noEdges: number
    propsAnalyzed: number
  }
  summary: {
    strongEdges: number
    softEdges: number
    noEdges: number
    sharpConfirmed: number // Edges with sharp confirmation
  }
}

const SPORT_LABELS: Record<string, string> = {
  basketball_nba: 'NBA',
  basketball_ncaab: 'NCAAB',
  americanfootball_nfl: 'NFL',
  americanfootball_ncaaf: 'NCAAF',
  baseball_mlb: 'MLB',
  icehockey_nhl: 'NHL',
}

// Map odds-api sport keys to SBD league keys
const ODDS_API_TO_SBD: Record<string, 'nba' | 'nfl' | 'nhl' | 'mlb' | 'ncaamb' | 'ncaafb'> = {
  basketball_nba: 'nba',
  basketball_ncaab: 'ncaamb',
  americanfootball_nfl: 'nfl',
  americanfootball_ncaaf: 'ncaafb',
  baseball_mlb: 'mlb',
  icehockey_nhl: 'nhl',
}

const normalizeSelection = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildTokens = (value: string) =>
  normalizeSelection(value)
    .split(' ')
    .filter((token) => token.length > 2)

const selectionMatchesTeam = (selection: string, team: string) => {
  const selectionTokens = buildTokens(selection)
  const teamTokens = buildTokens(team)
  if (!selectionTokens.length || !teamTokens.length) return false
  const selectionJoined = selectionTokens.join(' ')
  const teamJoined = teamTokens.join(' ')
  if (selectionJoined.includes(teamJoined) || teamJoined.includes(selectionJoined)) {
    return true
  }
  return (
    teamTokens.every((token) => selectionTokens.includes(token)) ||
    selectionTokens.every((token) => teamTokens.includes(token))
  )
}

const pickBestEv = (
  opportunities: EVOpportunity[],
  market: string,
  predicate: (opportunity: EVOpportunity) => boolean,
  line?: number
) => {
  const candidates = opportunities.filter(
    (opportunity) => opportunity.market === market && predicate(opportunity)
  )
  if (!candidates.length) return null
  return candidates
    .sort((a, b) => {
      if (b.ev !== a.ev) return b.ev - a.ev
      if (line != null && a.point != null && b.point != null) {
        return Math.abs(a.point - line) - Math.abs(b.point - line)
      }
      return 0
    })
    [0]
}

const formatOdds = (odds: number) => (odds > 0 ? `+${odds}` : `${odds}`)

/**
 * Determine if sharp signals agree with model projection
 */
function analyzeSharpConfirmation(
  sharpResult: SharpEdgeResult | undefined,
  modelFavoredTeam: string,
  modelDirection?: 'over' | 'under'
): { agrees: boolean; signals: string[]; boost: number } {
  if (!sharpResult || sharpResult.sharpSignals.length === 0) {
    return { agrees: false, signals: [], boost: 0 }
  }

  const agreeingSignals: string[] = []
  let totalStrength = 0

  for (const signal of sharpResult.sharpSignals) {
    // Check if signal agrees with model
    const signalAgrees =
      (signal.market === 'spread' && signal.side === modelFavoredTeam) ||
      (signal.market === 'total' && modelDirection && signal.side.toLowerCase() === modelDirection)

    if (signalAgrees) {
      agreeingSignals.push(`${signal.type}: ${signal.description}`)
      totalStrength += signal.strength
    }
  }

  const agrees = agreeingSignals.length > 0
  // Boost: 0-2 based on agreeing signal strength (5 strength = 1.0 boost, 10+ = 2.0)
  const boost = agrees ? Math.min(2, totalStrength / 5) : 0

  return { agrees, signals: agreeingSignals, boost }
}

/**
 * Extract the best spread line from odds game
 */
function getBestSpread(game: OddsGame, side: 'home' | 'away'): { line: number; book: string; odds: number } | null {
  if (!game.bookmakers?.length) return null

  let best: { line: number; book: string; odds: number } | null = null

  for (const book of game.bookmakers) {
    const spreadMarket = book.markets?.find((m) => m.key === 'spreads')
    if (!spreadMarket) continue

    const outcome = spreadMarket.outcomes?.find((o) =>
      side === 'home' ? o.name === game.home_team : o.name === game.away_team
    )
    if (!outcome?.point) continue

    // For spreads, better means more points for the side you're betting
    if (!best || (side === 'home' ? outcome.point > best.line : outcome.point > best.line)) {
      best = { line: outcome.point, book: book.title, odds: outcome.price }
    }
  }

  return best
}

/**
 * Extract the best total line from odds game
 */
function getBestTotal(game: OddsGame): { line: number; book: string; overOdds: number; underOdds: number } | null {
  if (!game.bookmakers?.length) return null

  let best: { line: number; book: string; overOdds: number; underOdds: number } | null = null

  for (const book of game.bookmakers) {
    const totalMarket = book.markets?.find((m) => m.key === 'totals')
    if (!totalMarket) continue

    const over = totalMarket.outcomes?.find((o) => o.name === 'Over')
    const under = totalMarket.outcomes?.find((o) => o.name === 'Under')
    if (!over?.point || !under?.point) continue

    if (!best) {
      best = { line: over.point, book: book.title, overOdds: over.price, underOdds: under.price }
    }
  }

  return best
}

/**
 * Analyze all games for a sport on a given date
 */
export async function analyzeSlateEdges(
  sportKey: string = 'basketball_nba',
  options: {
    limit?: number
    minEdge?: 'soft' | 'strong' // Only return games with at least this edge level
    includeProps?: boolean
    date?: string // YYYY-MM-DD (America/New_York)
  } = {}
): Promise<SlateEdgeResult> {
  const { limit = 15, minEdge, date } = options
  const sportLabel = SPORT_LABELS[sportKey] || sportKey

  console.log(`[SLATE EDGE] Analyzing ${sportLabel} slate...`)

  // Fetch today's odds
  const oddsGames = await fetchOdds(sportKey, ['h2h', 'spreads', 'totals'], { revalidateSeconds: 60 })

  if (!oddsGames?.length) {
    return {
      sport: sportKey,
      sportLabel,
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().split('T')[0],
      gamesAnalyzed: 0,
      edges: [],
      summary: { strongEdges: 0, softEdges: 0, noEdges: 0, sharpConfirmed: 0 },
    }
  }

  // Fetch sharp signals for this sport (line movement, RLM, bet%/money% divergence)
  const sbdLeague = ODDS_API_TO_SBD[sportKey]
  let sharpResults: SharpEdgeResult[] = []
  if (sbdLeague) {
    try {
      console.log(`[SLATE EDGE] Fetching sharp signals for ${sbdLeague}...`)
      sharpResults = await detectSharpEdges([sbdLeague])
      console.log(`[SLATE EDGE] Found ${sharpResults.filter(r => r.hasEdge).length} games with sharp signals`)
    } catch (error) {
      console.error(`[SLATE EDGE] Failed to fetch sharp signals:`, error)
    }
  }

  // Filter to games happening today (including games that may have started recently)
  // Use US Eastern timezone as primary reference for "today's slate"
  const now = new Date()

  // Calculate target date boundaries in US Eastern time
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const resolveTargetDate = () => {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date
    const [month, day, year] = easternFormatter.format(now).split('/')
    return `${year}-${month}-${day}`
  }
  const targetDate = resolveTargetDate()

  // Target start and end in Eastern time (converted to UTC for comparison)
  const todayStartEastern = new Date(`${targetDate}T00:00:00-05:00`)
  const todayEndEastern = new Date(`${targetDate}T23:59:59-05:00`)

  // Allow games that started up to 3 hours ago (still in progress)
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const useDateOverride = Boolean(date)

  const upcomingGames = oddsGames
    .filter((g) => {
      const gameTime = new Date(g.commence_time)
      // Game is today (in Eastern time) and either hasn't started OR started within last 3 hours
      const isToday = gameTime >= todayStartEastern && gameTime <= todayEndEastern
      const notTooOld = useDateOverride ? true : gameTime > threeHoursAgo
      return isToday && notTooOld
    })
    .slice(0, limit)

  console.log(`[SLATE EDGE] Filtered ${oddsGames.length} odds games to ${upcomingGames.length} today's games`)

  const edges: GameEdgeAnalysis[] = []
  let strongEdges = 0
  let softEdges = 0
  let noEdges = 0
  let sharpConfirmedCount = 0
  const evByGameId = new Map<string, EVOpportunity[]>()

  try {
    const evOpps = await findEVOpportunities({
      sports: [sportKey],
      minEV: 3,
      includeProps: false,
      markets: [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS],
      limit: 200,
    })
    for (const opportunity of evOpps) {
      if (!evByGameId.has(opportunity.gameId)) {
        evByGameId.set(opportunity.gameId, [])
      }
      evByGameId.get(opportunity.gameId)!.push(opportunity)
    }
  } catch (error) {
    console.error('[SLATE EDGE] Failed to fetch EV opportunities:', error)
  }

  for (const game of upcomingGames) {
    try {
      const matchupLabel = `${game.away_team} @ ${game.home_team}`

      // Match sharp signals for this game by team name
      const sharpResult = sharpResults.find((r) => {
        const homeMatch = game.home_team.toLowerCase().includes(r.homeTeam.toLowerCase().split(' ').pop() || '') ||
                          r.homeTeam.toLowerCase().includes(game.home_team.toLowerCase().split(' ').pop() || '')
        const awayMatch = game.away_team.toLowerCase().includes(r.awayTeam.toLowerCase().split(' ').pop() || '') ||
                          r.awayTeam.toLowerCase().includes(game.away_team.toLowerCase().split(' ').pop() || '')
        return homeMatch && awayMatch
      })

      // Get market lines (needed for NCAAB market anchoring)
      const marketSpread = getBestSpread(game, 'home')
      const marketTotal = getBestTotal(game)

      // Get detailed matchup analysis (includes injuries, stats, ATS)
      const matchupAnalysis = await analyzeMatchup(
        game.home_team,
        game.away_team,
        undefined,
        undefined,
        sportKey
      )

      const marketContext = {
        marketSpread: marketSpread?.line,
        marketTotal: marketTotal?.line,
        sharpSignals: sharpResult?.sharpSignals,
        sharpSplits: sharpResult?.splits,
      }

      // Get model recommendations for this game
      // Pass home and away team names separately to avoid parsing issues with multi-word names
      const recommendations = await getGameRecommendations(
        game.home_team,
        game.away_team,
        'all',
        sportKey,
        marketContext,
        matchupAnalysis
      )

      const spreadRec = recommendations.find((r) => r.type === 'spread')
      const totalRec = recommendations.find((r) => r.type === 'total')

      let spreadEdge: EdgeAssessment | undefined
      let totalEdge: EdgeAssessment | undefined

      // Evaluate spread edge
      if (spreadRec && marketSpread) {
        spreadEdge = evaluateLineEdge({
          marketType: 'spread',
          line: marketSpread.line,
          targetLine: spreadRec.targetLine,
          supportingSignals: spreadRec.factors.length,
        })
      }

      // Evaluate total edge
      if (totalRec && marketTotal) {
        totalEdge = evaluateLineEdge({
          marketType: 'total',
          line: marketTotal.line,
          targetLine: totalRec.targetLine,
          supportingSignals: totalRec.factors.length,
        })
      }

      // Track edge counts
      const hasStrongEdge = spreadEdge?.verdict === 'strong' || totalEdge?.verdict === 'strong'
      const hasSoftEdge = spreadEdge?.verdict === 'soft' || totalEdge?.verdict === 'soft'

      if (hasStrongEdge) strongEdges++
      else if (hasSoftEdge) softEdges++
      else noEdges++

      // Filter based on minEdge option
      if (minEdge === 'strong' && !hasStrongEdge) continue
      if (minEdge === 'soft' && !hasStrongEdge && !hasSoftEdge) continue

      // Separate injuries from other factors
      const allFactors = matchupAnalysis.context || []
      const injuries: string[] = []
      const matchupFactors: string[] = []

      for (const factor of allFactors) {
        const lowerFactor = factor.toLowerCase()
        if (lowerFactor.includes('injur') || lowerFactor.includes('out)') ||
            lowerFactor.includes('(out') || lowerFactor.includes('(doubtful') ||
            lowerFactor.includes('(questionable')) {
          injuries.push(factor)
        } else if (
          lowerFactor.includes('ortg') ||
          lowerFactor.includes('drtg') ||
          lowerFactor.includes('pace') ||
          lowerFactor.includes('ppg') ||
          lowerFactor.includes('papg') ||
          lowerFactor.includes('yards/play') ||
          lowerFactor.includes('points/drive') ||
          lowerFactor.includes('3rd down') ||
          lowerFactor.includes('red zone') ||
          lowerFactor.includes('explosive') ||
          lowerFactor.includes('sack rate') ||
          lowerFactor.includes('yards allowed') ||
          lowerFactor.includes('turnover') ||
          lowerFactor.includes('gpg') ||
          lowerFactor.includes('gaa') ||
          lowerFactor.includes('goals') ||
          lowerFactor.includes('ats')
        ) {
          matchupFactors.push(factor)
        }
      }

      // Determine which team the model spread favors
      // In betting convention: negative spread = favorite (that team gives points)
      const modelFavoredTeam = spreadRec && spreadRec.targetLine < 0
        ? game.home_team  // Home is favorite (negative spread)
        : game.away_team  // Away is favorite (home has positive spread)

      // Determine model direction for total (over/under)
      const modelTotalDirection: 'over' | 'under' | undefined = totalRec && marketTotal
        ? totalRec.targetLine > marketTotal.line ? 'over' : 'under'
        : undefined

      // Analyze if sharp signals confirm model projection
      const spreadConfirmation = analyzeSharpConfirmation(sharpResult, modelFavoredTeam)
      const totalConfirmation = analyzeSharpConfirmation(sharpResult, '', modelTotalDirection)

      // Combine confirmations
      const hasSharpConfirmation = spreadConfirmation.agrees || totalConfirmation.agrees
      if (hasSharpConfirmation) sharpConfirmedCount++

      // Boost confidence if sharp signals agree
      let adjustedConfidence = spreadRec?.confidence || totalRec?.confidence || 'low'
      const totalBoost = spreadConfirmation.boost + totalConfirmation.boost
      if (totalBoost >= 1.5 && adjustedConfidence === 'medium') {
        adjustedConfidence = 'high'
      } else if (totalBoost >= 1.0 && adjustedConfidence === 'low') {
        adjustedConfidence = 'medium'
      }

      const gameAnalysis: GameEdgeAnalysis = {
        matchup: matchupLabel,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        commenceTime: game.commence_time,
        confidence: adjustedConfidence,
        factors: spreadRec?.factors || totalRec?.factors || [],
        injuries,
        matchupFactors,
        sharpSignals: sharpResult?.sharpSignals || [],
        lineMovements: sharpResult?.lineMovements || [],
        splits: sharpResult?.splits,
        sharpConfirmation: hasSharpConfirmation ? {
          agrees: true,
          signals: [...spreadConfirmation.signals, ...totalConfirmation.signals],
          boost: totalBoost,
        } : undefined,
      }

      const evOpportunities = evByGameId.get(game.id) || []
      const highEv: GameEdgeAnalysis['highEv'] = {}

      if (spreadRec && spreadEdge && spreadEdge.verdict !== 'none') {
        const evPick = pickBestEv(
          evOpportunities,
          'Spread',
          (opportunity) => selectionMatchesTeam(opportunity.selection, modelFavoredTeam),
          marketSpread?.line
        )
        if (evPick) {
          highEv.spread = evPick
        }
      }

      if (totalRec && totalEdge && totalEdge.verdict !== 'none') {
        const direction = modelTotalDirection === 'over' ? 'over' : 'under'
        const evPick = pickBestEv(
          evOpportunities,
          'Total',
          (opportunity) =>
            opportunity.selection.toLowerCase().includes(direction),
          marketTotal?.line
        )
        if (evPick) {
          highEv.total = evPick
        }
      }

      if (highEv.spread || highEv.total) {
        gameAnalysis.highEv = highEv
      }

      if (spreadRec && marketSpread && spreadEdge) {
        gameAnalysis.spread = {
          marketLine: marketSpread.line,
          targetLine: spreadRec.targetLine,
          edge: spreadEdge,
          bestBook: marketSpread.book,
          bestOdds: marketSpread.odds,
          favoredTeam: modelFavoredTeam,
          sharpConfirmed: spreadConfirmation.agrees,
        }
      }

      if (totalRec && marketTotal && totalEdge) {
        gameAnalysis.total = {
          marketLine: marketTotal.line,
          targetLine: totalRec.targetLine,
          edge: totalEdge,
          bestBook: marketTotal.book,
          bestOdds: marketTotal.overOdds,
          sharpConfirmed: totalConfirmation.agrees,
        }
      }

      edges.push(gameAnalysis)
    } catch (error) {
      console.error(`[SLATE EDGE] Error analyzing ${game.home_team} vs ${game.away_team}:`, error)
    }
  }

  // Sort by edge strength (strong first, then soft), with sharp confirmation as tiebreaker
  edges.sort((a, b) => {
    const getEdgeScore = (g: GameEdgeAnalysis) => {
      let score = 0
      if (g.spread?.edge.verdict === 'strong') score += 10
      else if (g.spread?.edge.verdict === 'soft') score += 5
      if (g.total?.edge.verdict === 'strong') score += 10
      else if (g.total?.edge.verdict === 'soft') score += 5
      // Bonus for sharp confirmation
      if (g.sharpConfirmation?.agrees) score += 3
      if (g.spread?.sharpConfirmed) score += 2
      if (g.total?.sharpConfirmed) score += 2
      return score
    }
    return getEdgeScore(b) - getEdgeScore(a)
  })

  const shouldIncludeProps =
    options.includeProps !== false &&
    (sportKey === 'basketball_nba' ||
      sportKey === 'basketball_ncaab' ||
      sportKey === 'americanfootball_nfl' ||
      sportKey === 'americanfootball_ncaaf' ||
      sportKey === 'icehockey_nhl')
  const propResult = shouldIncludeProps
    ? await analyzeSlatePropEdges(sportKey, { limit: 25 })
    : null

  return {
    sport: sportKey,
    sportLabel,
    date: targetDate,
    gamesAnalyzed: upcomingGames.length,
    edges,
    propEdges: propResult?.edges,
    propSummary: propResult
      ? {
          strongEdges: propResult.summary.strongEdges,
          softEdges: propResult.summary.softEdges,
          noEdges: propResult.summary.noEdges,
          propsAnalyzed: propResult.propsAnalyzed,
        }
      : undefined,
    summary: { strongEdges, softEdges, noEdges, sharpConfirmed: sharpConfirmedCount },
  }
}

/**
 * Format slate edge results for chat output
 */
export function formatSlateEdgesForChat(result: SlateEdgeResult): string {
  if (result.gamesAnalyzed === 0) {
    return `No ${result.sportLabel} games found for ${result.date}.`
  }

  const lines: string[] = []

  lines.push(`## ${result.sportLabel} Edge Detection - ${result.date}`)
  lines.push('')
  lines.push(`**Games Analyzed:** ${result.gamesAnalyzed}`)
  lines.push(`**Summary:** ${result.summary.strongEdges} strong edges | ${result.summary.softEdges} soft edges | ${result.summary.noEdges} no edge | ${result.summary.sharpConfirmed} sharp-confirmed`)
  if (result.summary.sharpConfirmed > 0) {
    lines.push('Sharp confirmations are highlighted below.')
  }
  lines.push('')

  if (result.edges.length === 0 && (!result.propEdges || result.propEdges.length === 0)) {
    lines.push("No significant edges detected in today's slate.")
    return lines.join('\n')
  }

  if (result.edges.length === 0) {
    lines.push("No significant game edges detected in today's slate.")
    lines.push('')
  }

  const strongEdgeGames = result.edges.filter(
    (g) => g.spread?.edge.verdict === 'strong' || g.total?.edge.verdict === 'strong'
  )
  const softEdgeGames = result.edges.filter(
    (g) =>
      !strongEdgeGames.includes(g) &&
      (g.spread?.edge.verdict === 'soft' || g.total?.edge.verdict === 'soft')
  )

  if (strongEdgeGames.length > 0) {
    lines.push('### Strong Edges')
    lines.push('')
    for (const game of strongEdgeGames) {
      lines.push(formatGameEdge(game))
      lines.push('')
    }
  }

  if (softEdgeGames.length > 0) {
    lines.push('### Soft Edges')
    lines.push('')
    for (const game of softEdgeGames) {
      lines.push(formatGameEdge(game))
      lines.push('')
    }
  }

  if (result.propEdges && result.propEdges.length > 0) {
    lines.push('')
    lines.push(
      formatSlatePropEdgesForChat({
        sport: result.sport,
        sportLabel: result.sportLabel,
        date: result.date,
        propsAnalyzed: result.propSummary?.propsAnalyzed || result.propEdges.length,
        edges: result.propEdges,
        summary: {
          strongEdges: result.propSummary?.strongEdges || 0,
          softEdges: result.propSummary?.softEdges || 0,
          noEdges: result.propSummary?.noEdges || 0,
        },
      })
    )
  }

  return lines.join('\n')
}

function formatGameEdge(game: GameEdgeAnalysis): string {
  const lines: string[] = []
  const time = new Date(game.commenceTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  const sharpTag = game.sharpConfirmation?.agrees ? ' [SHARP CONFIRMED]' : ''
  lines.push(`**${game.matchup}** (${time})${sharpTag}`)

  if (game.sharpSignals.length > 0) {
    const signalSummary = game.sharpSignals
      .slice(0, 3)
      .map(
        (signal) =>
          `${signal.type} ${signal.market} ${signal.side} (${signal.strength}/5)`
      )
      .join('; ')
    const notes = game.sharpSignals
      .slice(0, 2)
      .map((signal) => signal.description)
      .join(' | ')
    lines.push(`- SHARP LEAN: ${signalSummary}`)
    if (notes) {
      lines.push(`- Sharp notes: ${notes}`)
    }
  }

  if (game.spread) {
    const edgeEmoji = game.spread.edge.verdict === 'strong' ? '🔥' : game.spread.edge.verdict === 'soft' ? '✓' : '—'
    const sharpEmoji = game.spread.sharpConfirmed ? ' ⚡' : ''
    const gap = Math.abs(game.spread.marketLine - game.spread.targetLine).toFixed(1)

    // Format spreads from HOME team's perspective for consistency
    // Positive = home is underdog, Negative = home is favorite
    const homeTeamShort = game.homeTeam.split(' ').pop() || game.homeTeam
    const marketLineFormatted = game.spread.marketLine > 0 ? `+${game.spread.marketLine}` : `${game.spread.marketLine}`
    const modelLineFormatted = game.spread.targetLine > 0 ? `+${game.spread.targetLine.toFixed(1)}` : game.spread.targetLine.toFixed(1)

    lines.push(
      `- ${edgeEmoji} **Spread:** Market ${marketLineFormatted} ${homeTeamShort} | Model ${modelLineFormatted} ${homeTeamShort} | Gap: ${gap} pts${sharpEmoji}`
    )
    if (game.spread.edge.flag) {
      lines.push(`  - ⚠️ ${game.spread.edge.flag}`)
    }
    if (game.highEv?.spread) {
      const ev = game.highEv.spread
      const point = ev.point != null ? ` ${ev.point > 0 ? '+' : ''}${ev.point}` : ''
      lines.push(
        `- HIGH EV + EDGE: Spread ${ev.selection}${point} at ${ev.bestBook} ${formatOdds(
          ev.bestOdds
        )} (EV ${ev.ev.toFixed(1)}%)`
      )
    }
  }

  if (game.total) {
    const edgeEmoji = game.total.edge.verdict === 'strong' ? '🔥' : game.total.edge.verdict === 'soft' ? '✓' : '—'
    const sharpEmoji = game.total.sharpConfirmed ? ' ⚡' : ''
    const gap = Math.abs(game.total.marketLine - game.total.targetLine).toFixed(1)
    const direction = game.total.targetLine > game.total.marketLine ? 'OVER' : 'UNDER'
    lines.push(
      `- ${edgeEmoji} **Total:** Market ${game.total.marketLine} | Model ${game.total.targetLine.toFixed(1)} | Gap: ${gap} pts → ${direction}${sharpEmoji}`
    )
    if (game.total.edge.flag) {
      lines.push(`  - ⚠️ ${game.total.edge.flag}`)
    }
    if (game.highEv?.total) {
      const ev = game.highEv.total
      const point = ev.point != null ? ` ${ev.point > 0 ? '+' : ''}${ev.point}` : ''
      lines.push(
        `- HIGH EV + EDGE: Total ${ev.selection}${point} at ${ev.bestBook} ${formatOdds(
          ev.bestOdds
        )} (EV ${ev.ev.toFixed(1)}%)`
      )
    }
  }

  // Show injuries prominently if present
  if (game.injuries.length > 0) {
    lines.push(`- 🏥 **Injuries:** ${game.injuries.slice(0, 3).join('; ')}`)
  }

  // Show key matchup factors (ORtg, DRtg, pace, ATS)
  if (game.matchupFactors.length > 0) {
    const keyFactors = game.matchupFactors.slice(0, 2)
    lines.push(`- 📊 **Matchup:** ${keyFactors.join(' | ')}`)
  }

  // Show line movement if significant
  const significantMoves = game.lineMovements.filter((m) => m.isSharp || m.isSignificant)
  if (significantMoves.length > 0) {
    const moveSummary = significantMoves
      .slice(0, 2)
      .map((m) => `${m.market}: ${m.openingLine}→${m.currentLine}`)
      .join(', ')
    lines.push(`- 📈 **Line Movement:** ${moveSummary}`)
  }

  return lines.join('\n')
}
