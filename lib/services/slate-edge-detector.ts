/**
 * Slate Edge Detector
 * Analyzes all games for a sport on a given day to find betting edges
 */

import { fetchOdds } from '@/lib/api/odds-api'
import { getGameRecommendations, type GameRecommendation } from './recommendation-engine'
import { analyzeMatchup } from './matchup-analyzer'
import { evaluateLineEdge, type EdgeAssessment } from '@/lib/analysis/bet-tools'
import type { OddsGame } from '@/lib/types/odds'

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
  }
  total?: {
    marketLine: number
    targetLine: number
    edge: EdgeAssessment
    bestBook?: string
    bestOdds?: number
  }
  confidence: 'low' | 'medium' | 'high'
  factors: string[]
  injuries: string[] // Injury factors
  matchupFactors: string[] // ORtg, DRtg, pace factors
}

export interface SlateEdgeResult {
  sport: string
  sportLabel: string
  date: string
  gamesAnalyzed: number
  edges: GameEdgeAnalysis[]
  summary: {
    strongEdges: number
    softEdges: number
    noEdges: number
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
  } = {}
): Promise<SlateEdgeResult> {
  const { limit = 15, minEdge } = options
  const sportLabel = SPORT_LABELS[sportKey] || sportKey

  console.log(`[SLATE EDGE] Analyzing ${sportLabel} slate...`)

  // Fetch today's odds
  const oddsGames = await fetchOdds(sportKey, ['h2h', 'spreads', 'totals'], { revalidateSeconds: 60 })

  if (!oddsGames?.length) {
    return {
      sport: sportKey,
      sportLabel,
      date: new Date().toISOString().split('T')[0],
      gamesAnalyzed: 0,
      edges: [],
      summary: { strongEdges: 0, softEdges: 0, noEdges: 0 },
    }
  }

  // Filter to games happening today only (not started yet)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const upcomingGames = oddsGames
    .filter((g) => {
      const gameTime = new Date(g.commence_time)
      // Game must be today and not started yet
      return gameTime > now && gameTime >= todayStart && gameTime < todayEnd
    })
    .slice(0, limit)

  const edges: GameEdgeAnalysis[] = []
  let strongEdges = 0
  let softEdges = 0
  let noEdges = 0

  for (const game of upcomingGames) {
    try {
      const matchupLabel = `${game.away_team} @ ${game.home_team}`

      // Get detailed matchup analysis (includes injuries, stats, ATS)
      const matchupAnalysis = await analyzeMatchup(game.home_team, game.away_team)

      // Get model recommendations for this game
      const recommendations = await getGameRecommendations(
        `${game.home_team} ${game.away_team}`,
        'all'
      )

      const spreadRec = recommendations.find((r) => r.type === 'spread')
      const totalRec = recommendations.find((r) => r.type === 'total')

      // Get market lines
      const marketSpread = getBestSpread(game, 'home')
      const marketTotal = getBestTotal(game)

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
        } else if (lowerFactor.includes('ortg') || lowerFactor.includes('drtg') ||
                   lowerFactor.includes('pace') || lowerFactor.includes('ats')) {
          matchupFactors.push(factor)
        }
      }

      // Determine which team the model spread favors
      // In betting convention: negative spread = favorite (that team gives points)
      const modelFavoredTeam = spreadRec && spreadRec.targetLine < 0
        ? game.home_team  // Home is favorite (negative spread)
        : game.away_team  // Away is favorite (home has positive spread)

      const gameAnalysis: GameEdgeAnalysis = {
        matchup: matchupLabel,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        commenceTime: game.commence_time,
        confidence: spreadRec?.confidence || totalRec?.confidence || 'low',
        factors: spreadRec?.factors || totalRec?.factors || [],
        injuries,
        matchupFactors,
      }

      if (spreadRec && marketSpread && spreadEdge) {
        gameAnalysis.spread = {
          marketLine: marketSpread.line,
          targetLine: spreadRec.targetLine,
          edge: spreadEdge,
          bestBook: marketSpread.book,
          bestOdds: marketSpread.odds,
          favoredTeam: modelFavoredTeam,
        }
      }

      if (totalRec && marketTotal && totalEdge) {
        gameAnalysis.total = {
          marketLine: marketTotal.line,
          targetLine: totalRec.targetLine,
          edge: totalEdge,
          bestBook: marketTotal.book,
          bestOdds: marketTotal.overOdds,
        }
      }

      edges.push(gameAnalysis)
    } catch (error) {
      console.error(`[SLATE EDGE] Error analyzing ${game.home_team} vs ${game.away_team}:`, error)
    }
  }

  // Sort by edge strength (strong first, then soft)
  edges.sort((a, b) => {
    const getEdgeScore = (g: GameEdgeAnalysis) => {
      let score = 0
      if (g.spread?.edge.verdict === 'strong') score += 10
      else if (g.spread?.edge.verdict === 'soft') score += 5
      if (g.total?.edge.verdict === 'strong') score += 10
      else if (g.total?.edge.verdict === 'soft') score += 5
      return score
    }
    return getEdgeScore(b) - getEdgeScore(a)
  })

  return {
    sport: sportKey,
    sportLabel,
    date: new Date().toISOString().split('T')[0],
    gamesAnalyzed: upcomingGames.length,
    edges,
    summary: { strongEdges, softEdges, noEdges },
  }
}

/**
 * Format slate edge results for chat output
 */
export function formatSlateEdgesForChat(result: SlateEdgeResult): string {
  if (result.gamesAnalyzed === 0) {
    return `No ${result.sportLabel} games found for today.`
  }

  const lines: string[] = []

  lines.push(`## ${result.sportLabel} Edge Detection - ${result.date}`)
  lines.push('')
  lines.push(`**Games Analyzed:** ${result.gamesAnalyzed}`)
  lines.push(`**Summary:** ${result.summary.strongEdges} strong edges | ${result.summary.softEdges} soft edges | ${result.summary.noEdges} no edge`)
  lines.push('')

  if (result.edges.length === 0) {
    lines.push('No significant edges detected in today\'s slate.')
    return lines.join('\n')
  }

  // Group by edge strength
  const strongEdgeGames = result.edges.filter(
    (g) => g.spread?.edge.verdict === 'strong' || g.total?.edge.verdict === 'strong'
  )
  const softEdgeGames = result.edges.filter(
    (g) =>
      !strongEdgeGames.includes(g) &&
      (g.spread?.edge.verdict === 'soft' || g.total?.edge.verdict === 'soft')
  )

  if (strongEdgeGames.length > 0) {
    lines.push('### 🔥 Strong Edges')
    lines.push('')
    for (const game of strongEdgeGames) {
      lines.push(formatGameEdge(game))
      lines.push('')
    }
  }

  if (softEdgeGames.length > 0) {
    lines.push('### ✓ Soft Edges')
    lines.push('')
    for (const game of softEdgeGames) {
      lines.push(formatGameEdge(game))
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Format a single game's edge analysis
 */
function formatGameEdge(game: GameEdgeAnalysis): string {
  const lines: string[] = []
  const time = new Date(game.commenceTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  lines.push(`**${game.matchup}** (${time})`)

  if (game.spread) {
    const edgeEmoji = game.spread.edge.verdict === 'strong' ? '🔥' : game.spread.edge.verdict === 'soft' ? '✓' : '—'
    const gap = Math.abs(game.spread.marketLine - game.spread.targetLine).toFixed(1)

    // Format with team name for clarity
    const marketLineFormatted = game.spread.marketLine > 0 ? `+${game.spread.marketLine}` : `${game.spread.marketLine}`
    const modelLineFormatted = game.spread.targetLine > 0 ? `+${game.spread.targetLine.toFixed(1)}` : game.spread.targetLine.toFixed(1)

    // Get short team name for model line
    const favoredTeamShort = game.spread.favoredTeam.split(' ').pop() || game.spread.favoredTeam

    lines.push(
      `- ${edgeEmoji} **Spread:** Market ${marketLineFormatted} ${game.homeTeam.split(' ').pop()} | Model ${modelLineFormatted} ${favoredTeamShort} | Gap: ${gap} pts`
    )
    if (game.spread.edge.flag) {
      lines.push(`  - ⚠️ ${game.spread.edge.flag}`)
    }
  }

  if (game.total) {
    const edgeEmoji = game.total.edge.verdict === 'strong' ? '🔥' : game.total.edge.verdict === 'soft' ? '✓' : '—'
    const gap = Math.abs(game.total.marketLine - game.total.targetLine).toFixed(1)
    const direction = game.total.targetLine > game.total.marketLine ? 'OVER' : 'UNDER'
    lines.push(
      `- ${edgeEmoji} **Total:** Market ${game.total.marketLine} | Model ${game.total.targetLine.toFixed(1)} | Gap: ${gap} pts → ${direction}`
    )
    if (game.total.edge.flag) {
      lines.push(`  - ⚠️ ${game.total.edge.flag}`)
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

  return lines.join('\n')
}
