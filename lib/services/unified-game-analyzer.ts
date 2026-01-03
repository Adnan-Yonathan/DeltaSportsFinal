/**
 * Unified Game Analyzer
 * Provides comprehensive betting analysis for a single game by
 * fetching all relevant data in parallel with graceful degradation.
 *
 * Returns: odds, ATS records, betting splits, injuries, matchup stats,
 * model projections, and edge detection signals.
 */

import { fetchOdds } from '@/lib/api/odds-api'
import { analyzeMatchup } from './matchup-analyzer'
import { getGameRecommendations } from './recommendation-engine'
import { detectEdgeForGame } from './edge-detection'
import { evaluateLineEdge, type EdgeAssessment, type MarketType } from '@/lib/analysis/bet-tools'
import { getTeamATSData } from '@/lib/providers/covers/chat-helpers'
import { getCurrentBettingSplits } from '@/lib/providers/covers'
import { resolveSportKey } from '@/lib/identity/sport'

// Local type for SBD League (matches lib/api/sbd.ts)
type SbdLeague = 'nba' | 'nfl' | 'mlb' | 'nhl' | 'ncaamb' | 'ncaafb'

// Helper to run a promise with a timeout
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback?: T): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((resolve, reject) =>
      setTimeout(() => (fallback !== undefined ? resolve(fallback) : reject(new Error('timeout'))), ms)
    ),
  ])

// Normalize team name for matching
const normalizeTeamKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()

// SBD League mapping
const SPORT_TO_SBD_LEAGUE: Record<string, SbdLeague> = {
  basketball_nba: 'nba',
  basketball_ncaab: 'ncaamb',  // SBD uses 'ncaamb' for college basketball
  americanfootball_nfl: 'nfl',
  americanfootball_ncaaf: 'ncaafb',  // SBD uses 'ncaafb' for college football
  icehockey_nhl: 'nhl',
  baseball_mlb: 'mlb',
}

export interface UnifiedOdds {
  spread: number | null
  spreadOdds: number | null
  total: number | null
  totalOdds: number | null
  homeML: number | null
  awayML: number | null
  book: string | null
  gameTime: string | null
}

export interface UnifiedATS {
  home: {
    overall: string | null
    last10: string | null
    streak: string | null
    homeRecord: string | null
    favoriteRecord: string | null
  } | null
  away: {
    overall: string | null
    last10: string | null
    streak: string | null
    awayRecord: string | null
    underdogRecord: string | null
  } | null
}

export interface UnifiedSplits {
  spread: {
    homeBetPct: number | null
    awayBetPct: number | null
    homeMoneyPct: number | null
    awayMoneyPct: number | null
    divergence: number | null
  } | null
  total: {
    overBetPct: number | null
    underBetPct: number | null
    overMoneyPct: number | null
    underMoneyPct: number | null
  } | null
}

export interface UnifiedProjection {
  targetSpread: number | null
  targetTotal: number | null
  spreadEdge: number | null
  totalEdge: number | null
  confidence: 'low' | 'medium' | 'high'
  recommendation: string | null
}

export interface UnifiedSharpSignals {
  hasRLM: boolean
  hasSteam: boolean
  hasSharpDivergence: boolean
  signals: string[]
  summary: string | null
}

export interface UnifiedGameAnalysis {
  homeTeam: string
  awayTeam: string
  sportKey: string
  gameTime: string | null
  odds: UnifiedOdds | null
  ats: UnifiedATS | null
  splits: UnifiedSplits | null
  injuries: string[]
  matchupContext: string[]
  projection: UnifiedProjection | null
  sharpSignals: UnifiedSharpSignals | null
  edgeAssessment: EdgeAssessment | null
  dataAvailability: {
    odds: boolean
    ats: boolean
    splits: boolean
    matchup: boolean
    projection: boolean
    sharpSignals: boolean
  }
}

/**
 * Analyze a single game with all betting-relevant data
 */
export async function analyzeGame(opts: {
  homeTeam: string
  awayTeam: string
  sportKey: string
  marketType?: MarketType
  timeoutMs?: number
}): Promise<UnifiedGameAnalysis> {
  const { homeTeam, awayTeam, marketType = 'spread' } = opts
  const sportKey = resolveSportKey(opts.sportKey) ?? 'basketball_nba'
  const sbdLeague = SPORT_TO_SBD_LEAGUE[sportKey]
  const gameLabel = `${awayTeam} @ ${homeTeam}`

  console.log(`[UNIFIED_ANALYZER] Starting analysis for ${gameLabel} (${sportKey})`)

  // Initialize result structure
  const result: UnifiedGameAnalysis = {
    homeTeam,
    awayTeam,
    sportKey,
    gameTime: null,
    odds: null,
    ats: null,
    splits: null,
    injuries: [],
    matchupContext: [],
    projection: null,
    sharpSignals: null,
    edgeAssessment: null,
    dataAvailability: {
      odds: false,
      ats: false,
      splits: false,
      matchup: false,
      projection: false,
      sharpSignals: false,
    },
  }

  // Parallel fetch all data sources with individual timeouts
  const [oddsResult, homeAtsResult, awayAtsResult, splitsResult, matchupResult, edgeResult] =
    await Promise.allSettled([
      // 1. Odds (8s timeout)
      withTimeout(
        fetchOdds(sportKey, ['spreads', 'totals', 'h2h'], { teamFilter: [homeTeam, awayTeam] }),
        8000,
        [] as any[]
      ),
      // 2. Home team ATS (4s timeout)
      withTimeout(getTeamATSData(homeTeam, sportKey), 4000, null as any),
      // 3. Away team ATS (4s timeout)
      withTimeout(getTeamATSData(awayTeam, sportKey), 4000, null as any),
      // 4. Betting splits (4s timeout)
      withTimeout(getCurrentBettingSplits(sportKey), 4000, { success: false, data: [] } as any),
      // 5. Matchup analysis (10s timeout)
      withTimeout(analyzeMatchup(homeTeam, awayTeam, undefined, undefined, sportKey), 10000, null as any),
      // 6. Sharp signal detection (5s timeout)
      sbdLeague
        ? withTimeout(detectEdgeForGame(sbdLeague, gameLabel), 5000, null as any)
        : Promise.resolve(null),
    ])

  // Process odds
  if (oddsResult.status === 'fulfilled' && oddsResult.value?.length) {
    const matchingGame = findMatchingGame(oddsResult.value, homeTeam, awayTeam)
    if (matchingGame) {
      result.odds = extractOdds(matchingGame, homeTeam)
      result.gameTime = result.odds.gameTime
      result.dataAvailability.odds = true
    }
  }

  // Process ATS
  if (homeAtsResult.status === 'fulfilled' && homeAtsResult.value?.success) {
    const homeAts = homeAtsResult.value.data
    if (!result.ats) result.ats = { home: null, away: null }
    result.ats.home = {
      overall: homeAts?.overallATS ?? null,
      last10: homeAts?.last10 ?? null,
      streak: homeAts?.streak ?? null,
      homeRecord: homeAts?.homeATS ?? null,
      favoriteRecord: homeAts?.favoriteATS ?? null,
    }
    result.dataAvailability.ats = true
  }

  if (awayAtsResult.status === 'fulfilled' && awayAtsResult.value?.success) {
    const awayAts = awayAtsResult.value.data
    if (!result.ats) result.ats = { home: null, away: null }
    result.ats.away = {
      overall: awayAts?.overallATS ?? null,
      last10: awayAts?.last10 ?? null,
      streak: awayAts?.streak ?? null,
      awayRecord: awayAts?.awayATS ?? null,
      underdogRecord: awayAts?.underdogATS ?? null,
    }
    result.dataAvailability.ats = true
  }

  // Process betting splits
  if (splitsResult.status === 'fulfilled' && splitsResult.value?.success) {
    const matchingSplit = findMatchingSplit(splitsResult.value.data || [], homeTeam, awayTeam)
    if (matchingSplit) {
      result.splits = extractSplits(matchingSplit)
      result.dataAvailability.splits = true
    }
  }

  // Process matchup analysis
  if (matchupResult.status === 'fulfilled' && matchupResult.value) {
    const matchup = matchupResult.value
    result.matchupContext = matchup.context || []
    if (matchup.homeTeam?.injuries?.length || matchup.awayTeam?.injuries?.length) {
      const homeInjuries = matchup.homeTeam?.injuries || []
      const awayInjuries = matchup.awayTeam?.injuries || []
      result.injuries = [
        ...homeInjuries.map((i: any) => `${homeTeam}: ${i.player} (${i.status})`),
        ...awayInjuries.map((i: any) => `${awayTeam}: ${i.player} (${i.status})`),
      ].slice(0, 6)
    }
    result.dataAvailability.matchup = true
  }

  // Process sharp signals
  if (edgeResult.status === 'fulfilled' && edgeResult.value) {
    const edge = edgeResult.value as any
    result.sharpSignals = {
      hasRLM: edge.sharpSignals?.some((s: any) => s.type === 'RLM') ?? false,
      hasSteam: edge.sharpSignals?.some((s: any) => s.type === 'STEAM') ?? false,
      hasSharpDivergence: edge.sharpSignals?.some((s: any) => s.type === 'SHARP_MONEY') ?? false,
      signals: edge.sharpSignals?.map((s: any) => `${s.type}: ${s.description}`) ?? [],
      summary: edge.summary ?? null,
    }
    result.dataAvailability.sharpSignals = true
  }

  // Get model projections using matchup data
  try {
    const marketContext = {
      marketSpread: result.odds?.spread ?? undefined,
      marketTotal: result.odds?.total ?? undefined,
    }

    const projections = await withTimeout(
      getGameRecommendations(
        homeTeam,
        awayTeam,
        'all',
        sportKey,
        marketContext,
        matchupResult.status === 'fulfilled' ? matchupResult.value || undefined : undefined
      ),
      8000,
      []
    )

    if (projections.length > 0) {
      const spreadRec = projections.find((p) => p.type === 'spread')
      const totalRec = projections.find((p) => p.type === 'total')

      result.projection = {
        targetSpread: spreadRec?.targetLine ?? null,
        targetTotal: totalRec?.targetLine ?? null,
        spreadEdge:
          spreadRec?.targetLine && result.odds?.spread
            ? spreadRec.targetLine - result.odds.spread
            : null,
        totalEdge:
          totalRec?.targetLine && result.odds?.total
            ? totalRec.targetLine - result.odds.total
            : null,
        confidence: spreadRec?.confidence ?? 'low',
        recommendation: spreadRec?.recommendation ?? null,
      }
      result.dataAvailability.projection = true
    }
  } catch (err) {
    console.log('[UNIFIED_ANALYZER] Projection fetch failed, continuing without')
  }

  // Calculate edge assessment
  if (result.odds?.spread && result.projection?.targetSpread) {
    result.edgeAssessment = evaluateLineEdge({
      marketType,
      line: result.odds.spread,
      targetLine: result.projection.targetSpread,
      supportingSignals: result.sharpSignals?.signals.length ?? 0,
    })
  }

  return result
}

/**
 * Format unified analysis for chat response
 */
export function formatUnifiedAnalysis(analysis: UnifiedGameAnalysis): string {
  const lines: string[] = []
  const { homeTeam, awayTeam, gameTime, odds, ats, splits, injuries, matchupContext, projection, sharpSignals, edgeAssessment } = analysis

  // Header
  lines.push(`## ${awayTeam} @ ${homeTeam}`)
  if (gameTime) lines.push(`*${gameTime} ET*\n`)

  // Current Lines
  if (odds) {
    lines.push('### Current Lines')
    if (odds.spread !== null) {
      const spreadLabel = odds.spread > 0 ? `${awayTeam} ${odds.spread}` : `${homeTeam} ${odds.spread}`
      lines.push(`- **Spread:** ${spreadLabel} (${formatOdds(odds.spreadOdds)})`)
    }
    if (odds.total !== null) {
      lines.push(`- **Total:** ${odds.total} (${formatOdds(odds.totalOdds)})`)
    }
    if (odds.homeML !== null && odds.awayML !== null) {
      lines.push(`- **Moneyline:** ${homeTeam} ${formatOdds(odds.homeML)} / ${awayTeam} ${formatOdds(odds.awayML)}`)
    }
    if (odds.book) lines.push(`- *via ${odds.book}*`)
    lines.push('')
  }

  // Model Projections
  if (projection && (projection.targetSpread !== null || projection.targetTotal !== null)) {
    lines.push('### Model Projections')
    if (projection.targetSpread !== null) {
      const edge = projection.spreadEdge !== null ? ` (edge: ${projection.spreadEdge > 0 ? '+' : ''}${projection.spreadEdge.toFixed(1)})` : ''
      lines.push(`- **Target Spread:** ${homeTeam} ${projection.targetSpread.toFixed(1)}${edge}`)
    }
    if (projection.targetTotal !== null) {
      const edge = projection.totalEdge !== null ? ` (edge: ${projection.totalEdge > 0 ? '+' : ''}${projection.totalEdge.toFixed(1)})` : ''
      lines.push(`- **Target Total:** ${projection.targetTotal.toFixed(1)}${edge}`)
    }
    lines.push(`- **Confidence:** ${projection.confidence}`)
    lines.push('')
  }

  // Edge Assessment
  if (edgeAssessment) {
    lines.push('### Edge Assessment')
    lines.push(`- **Verdict:** ${edgeAssessment.verdict.toUpperCase()}`)
    lines.push(`- **Reason:** ${edgeAssessment.reason}`)
    if (edgeAssessment.flag) lines.push(`- **Flag:** ${edgeAssessment.flag}`)
    lines.push('')
  }

  // ATS Records
  if (ats && (ats.home || ats.away)) {
    lines.push('### ATS Records')
    if (ats.home?.overall) {
      const parts = [`Overall: ${ats.home.overall}`]
      if (ats.home.last10) parts.push(`L10: ${ats.home.last10}`)
      if (ats.home.streak) parts.push(`Streak: ${ats.home.streak}`)
      lines.push(`- **${homeTeam}:** ${parts.join(' | ')}`)
    }
    if (ats.away?.overall) {
      const parts = [`Overall: ${ats.away.overall}`]
      if (ats.away.last10) parts.push(`L10: ${ats.away.last10}`)
      if (ats.away.streak) parts.push(`Streak: ${ats.away.streak}`)
      lines.push(`- **${awayTeam}:** ${parts.join(' | ')}`)
    }
    lines.push('')
  }

  // Betting Splits
  if (splits?.spread) {
    lines.push('### Public vs Sharp')
    const s = splits.spread
    if (s.homeBetPct !== null && s.awayBetPct !== null) {
      const publicSide = s.homeBetPct >= s.awayBetPct ? homeTeam : awayTeam
      const publicPct = Math.max(s.homeBetPct, s.awayBetPct)
      lines.push(`- **Public:** ${publicSide} (${Math.round(publicPct)}%)`)
    }
    if (s.homeMoneyPct !== null && s.awayMoneyPct !== null) {
      const sharpSide = s.homeMoneyPct >= s.awayMoneyPct ? homeTeam : awayTeam
      const sharpPct = Math.max(s.homeMoneyPct, s.awayMoneyPct)
      lines.push(`- **Sharp Money:** ${sharpSide} (${Math.round(sharpPct)}%)`)
    }
    if (s.divergence !== null && s.divergence >= 10) {
      lines.push(`- **Divergence:** ${Math.round(s.divergence)}% (potential RLM)`)
    }
    lines.push('')
  }

  // Sharp Signals
  if (sharpSignals?.signals.length) {
    lines.push('### Sharp Signals')
    for (const signal of sharpSignals.signals.slice(0, 3)) {
      lines.push(`- ${signal}`)
    }
    lines.push('')
  }

  // Injuries
  if (injuries.length) {
    lines.push('### Key Injuries')
    for (const injury of injuries.slice(0, 4)) {
      lines.push(`- ${injury}`)
    }
    lines.push('')
  }

  // Matchup Context
  if (matchupContext.length) {
    lines.push('### Matchup Context')
    for (const ctx of matchupContext.slice(0, 4)) {
      lines.push(`- ${ctx}`)
    }
    lines.push('')
  }

  // Data availability warning if incomplete
  const missing: string[] = []
  if (!analysis.dataAvailability.odds) missing.push('odds')
  if (!analysis.dataAvailability.ats) missing.push('ATS')
  if (!analysis.dataAvailability.splits) missing.push('splits')
  if (!analysis.dataAvailability.projection) missing.push('projections')
  if (missing.length) {
    lines.push(`*Note: Some data unavailable (${missing.join(', ')})*`)
  }

  return lines.join('\n')
}

// Helper functions

function findMatchingGame(games: any[], homeTeam: string, awayTeam: string): any | undefined {
  const homeNorm = normalizeTeamKey(homeTeam)
  const awayNorm = normalizeTeamKey(awayTeam)

  return games.find((g) => {
    const gHomeNorm = normalizeTeamKey(g.home_team)
    const gAwayNorm = normalizeTeamKey(g.away_team)
    const matchesHome = gHomeNorm.includes(homeNorm) || homeNorm.includes(gHomeNorm)
    const matchesAway = gAwayNorm.includes(awayNorm) || awayNorm.includes(gAwayNorm)
    return matchesHome && matchesAway
  })
}

function extractOdds(game: any, homeTeam: string): UnifiedOdds {
  const result: UnifiedOdds = {
    spread: null,
    spreadOdds: null,
    total: null,
    totalOdds: null,
    homeML: null,
    awayML: null,
    book: null,
    gameTime: null,
  }

  if (game.commence_time) {
    result.gameTime = new Date(game.commence_time).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const book = game.bookmakers?.[0]
  if (!book) return result

  result.book = book.title || book.key || 'Book'
  const homeNorm = normalizeTeamKey(homeTeam)

  // Extract spread
  const spreadMarket = book.markets?.find((m: any) => m.key === 'spreads')
  if (spreadMarket?.outcomes) {
    const homeOutcome = spreadMarket.outcomes.find((o: any) =>
      normalizeTeamKey(o?.name || '').includes(homeNorm)
    )
    if (homeOutcome) {
      result.spread = homeOutcome.point ?? null
      result.spreadOdds = homeOutcome.price ?? null
    }
  }

  // Extract total
  const totalMarket = book.markets?.find((m: any) => m.key === 'totals')
  if (totalMarket?.outcomes) {
    const overOutcome = totalMarket.outcomes.find((o: any) => o?.name === 'Over')
    if (overOutcome) {
      result.total = overOutcome.point ?? null
      result.totalOdds = overOutcome.price ?? null
    }
  }

  // Extract moneyline
  const mlMarket = book.markets?.find((m: any) => m.key === 'h2h')
  if (mlMarket?.outcomes) {
    const homeMLOutcome = mlMarket.outcomes.find((o: any) =>
      normalizeTeamKey(o?.name || '').includes(homeNorm)
    )
    const awayMLOutcome = mlMarket.outcomes.find((o: any) =>
      !normalizeTeamKey(o?.name || '').includes(homeNorm)
    )
    result.homeML = homeMLOutcome?.price ?? null
    result.awayML = awayMLOutcome?.price ?? null
  }

  return result
}

function findMatchingSplit(splits: any[], homeTeam: string, awayTeam: string): any | undefined {
  const homeNorm = normalizeTeamKey(homeTeam)
  const awayNorm = normalizeTeamKey(awayTeam)

  return splits.find((s) => {
    const sHomeNorm = normalizeTeamKey(s.homeTeam || '')
    const sAwayNorm = normalizeTeamKey(s.awayTeam || '')
    const matchesHome = sHomeNorm.includes(homeNorm) || homeNorm.includes(sHomeNorm)
    const matchesAway = sAwayNorm.includes(awayNorm) || awayNorm.includes(sAwayNorm)
    return matchesHome && matchesAway
  })
}

function extractSplits(split: any): UnifiedSplits {
  const toPct = (v: any): number | null => {
    if (v == null || !Number.isFinite(v)) return null
    return v > 1 ? v : v * 100
  }

  const spreadSplits = split.spread || {}
  const totalSplits = split.total || {}

  const homeBetPct = toPct(spreadSplits.homeBetPct ?? spreadSplits.home_bet_pct)
  const awayBetPct = toPct(spreadSplits.awayBetPct ?? spreadSplits.away_bet_pct)
  const homeMoneyPct = toPct(spreadSplits.homeMoneyPct ?? spreadSplits.home_money_pct)
  const awayMoneyPct = toPct(spreadSplits.awayMoneyPct ?? spreadSplits.away_money_pct)

  let divergence: number | null = null
  if (homeBetPct !== null && homeMoneyPct !== null) {
    divergence = Math.abs(homeMoneyPct - homeBetPct)
  }

  return {
    spread: {
      homeBetPct,
      awayBetPct,
      homeMoneyPct,
      awayMoneyPct,
      divergence,
    },
    total: {
      overBetPct: toPct(totalSplits.overBetPct ?? totalSplits.over_bet_pct),
      underBetPct: toPct(totalSplits.underBetPct ?? totalSplits.under_bet_pct),
      overMoneyPct: toPct(totalSplits.overMoneyPct ?? totalSplits.over_money_pct),
      underMoneyPct: toPct(totalSplits.underMoneyPct ?? totalSplits.under_money_pct),
    },
  }
}

function formatOdds(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  return value > 0 ? `+${value}` : `${value}`
}
