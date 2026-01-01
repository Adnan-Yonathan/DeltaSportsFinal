/**
 * Live Game State Analyzer
 * Extracts momentum factors from live game data for betting recommendations
 * Analyzes: scoring runs, pace changes, foul trouble, comeback probability, quarter trends
 */

import type {
  LiveScoreGameDetails,
  PlayByPlayEntry,
  GameDetailsTeam,
  LeagueId,
} from '@/lib/live-scores'
import { getPlayerStats, getRestFactors } from './matchup-analyzer'
import { getPlayerImpactScore } from './player-impact'
import { analyzeFatigue, type FatigueAnalysis } from './fatigue-analyzer'
import { analyzeTimeoutImpact, type TimeoutImpactAnalysis } from './timeout-analyzer'
import { analyzeBonusSituation, type BonusSituationAnalysis } from './bonus-tracker'
import { analyzePlayerAvailability, type PlayerAvailabilityAnalysis } from './player-availability-analyzer'
import {
  getDefaultPaceForLeague,
  getLiveTeamStats,
  getLiveTeamThreePointPct,
  getLiveTeamFreeThrowPct,
} from './live-team-stats'

// Forward declaration for rotation analyzer (created separately)
export interface RotationAnalysis {
  homeAnomalies: Array<{
    playerName: string
    anomalyType: 'starter_benched_early' | 'bench_extended_run'
    minutesInQuarter: number
    typicalMinutesInQuarter: number
    impactScore: number
  }>
  awayAnomalies: Array<{
    playerName: string
    anomalyType: 'starter_benched_early' | 'bench_extended_run'
    minutesInQuarter: number
    typicalMinutesInQuarter: number
    impactScore: number
  }>
  lineupQualityDelta: number
  lineAdjustment: number
  factors: string[]
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface PregameSpreadContext {
  openingSpread: number // Home team spread (negative = favorite)
  currentSpread?: number // Current live spread from books (if available)
  openingTotal: number
  currentTotal?: number
  source: string // e.g., 'SBD', 'consensus'
  sharpSpreadBias?: number // Home perspective (+ favors away)
  sharpTotalBias?: number // Positive favors over
  sharpNotes?: string[]
}

export interface LiveGameState {
  eventId: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  timeRemaining: number // seconds
  timeElapsed: number // seconds
  period: number
  displayClock: string
  sport: string

  momentum: {
    scoringRun: ScoringRunAnalysis
    paceChange: PaceAnalysis
    foulTrouble: FoulTroubleAnalysis
    comebackProbability: ComebackAnalysis
    quarterTrends: QuarterTrendsAnalysis
    garbageTime: GarbageTimeAnalysis
    foulingStrategy: FoulingStrategyAnalysis
    threePointVariance: ThreePointVarianceAnalysis
    killshot: KillshotAnalysis
    fatigue: FatigueAnalysis
    timeoutImpact: TimeoutImpactAnalysis
    footballEfficiency?: FootballEfficiencyAnalysis
    bonusSituation?: BonusSituationAnalysis
    playerAvailability?: PlayerAvailabilityAnalysis
    rotation?: RotationAnalysis
  }

  pregameEdges?: PregameEdgeContext
  pregameSpread?: PregameSpreadContext // Pre-game spread from sportsbooks      
  driveState?: FootballDriveState
}

// ============================================================================
// PRE-GAME EDGE INTERFACES
// ============================================================================

export interface PregameEdgeRelevance {
  edge: string                    // "Rest edge", "Depth edge", "ATS momentum"
  team: 'home' | 'away'
  applicableQuarters: number[]    // [3, 4] = relevant in Q3/Q4
  currentRelevance: 'high' | 'medium' | 'low'
  explanation: string             // "B2B fatigue compounds in Q4"
  lineImpact: number              // +/- points
}

export interface PregameEdgeContext {
  restAdvantage: { home: number; away: number }
  injuryImpact: { home: number; away: number }
  depthAdvantage: 'home' | 'away' | 'neutral'
  relevantEdges: PregameEdgeRelevance[]
  totalLineImpact: number
}

export interface ScoringRunAnalysis {
  last5Minutes: {
    homePoints: number
    awayPoints: number
    netMargin: number // positive = home on run
  }
  lastQuarter: {
    homePoints: number
    awayPoints: number
    netMargin: number
  }
  currentRun: {
    team: 'home' | 'away'
    points: number // unanswered points
    duration: string // e.g., "8-0 run in last 3:24"
    isStatisticallyNormal: boolean // True if run size is common variance
    runFrequencyContext: string // e.g., "8-0 runs occur ~5x per game"
    confidenceDampening: number // 0-1 factor to reduce line adjustment weight
  } | null
}

export interface PaceAnalysis {
  currentPace: number // Possessions or plays per regulation at current rate
  seasonPace: number // Team's season average pace
  deviation: number // Current - season (positive = faster)
  impactOnTotal: number // Projected impact on final score
}

export interface FoulTroubleAnalysis {
  homePlayers: Array<{
    name: string
    fouls: number
    isStarter: boolean
    impactOnSpread: number // -2.5 if star in foul trouble
  }>
  awayPlayers: Array<{
    name: string
    fouls: number
    isStarter: boolean
    impactOnSpread: number
  }>
  totalImpact: {
    homeAdjustment: number
    awayAdjustment: number
  }
}

export interface ComebackAnalysis {
  currentDeficit: number
  historicalComebackRate: number // % of similar deficits overcome
  requiredPace: number // Points per minute needed
  probability: number // Win probability for trailing team
}

export interface GarbageTimeAnalysis {
  isGarbageTime: boolean
  reason: string
  recommendationAdjustment: 'avoid' | 'low_confidence' | 'monitor'
  marginalLineImpact: number // Reduce line movement in garbage time
}

export interface FoulingStrategyAnalysis {
  isFouling: boolean
  reason: string
  expectedFouls: number // Fouls per minute
  impactOnPace: number // Additional possessions
  impactOnTotal: number // Expected point swing
  factors: string[]
}

export interface ThreePointVarianceAnalysis {
  homeThreePointInfo: {
    currentMade: number
    currentAttempted: number
    currentPercentage: number
    seasonPercentage: number
    deviation: number // current - season
    isOutlier: boolean
  }
  awayThreePointInfo: {
    currentMade: number
    currentAttempted: number
    currentPercentage: number
    seasonPercentage: number
    deviation: number
    isOutlier: boolean
  }
  expectedRegression: {
    homePtsAdjustment: number
    awayPtsAdjustment: number
    totalAdjustment: number
  }
  factors: string[]
}

export interface FootballDriveState {
  possession: 'home' | 'away' | null
  down?: number
  distance?: number
  yardLine?: number
  yardLineSide?: 'home' | 'away' | null
  isRedZone?: boolean
  summary?: string
}

export interface FootballEfficiencyAnalysis {
  homeYardsPerPlay?: number
  awayYardsPerPlay?: number
  combinedYardsPerPlay?: number
  netYardsPerPlay?: number
  impactOnSpread?: number
  impactOnTotal?: number
  factors: string[]
}

export interface KillshotAnalysis {
  isKillshot: boolean
  team?: 'home' | 'away'
  points?: number
  duration?: string
  expectedFrequency?: number
  paceIndex?: number
  offenseIndex?: number
  isComebackAttempt?: boolean
  factors?: string[]
}

const isBasketballLeague = (league: string) =>
  league === 'nba' || league === 'ncaab'

const isFootballLeague = (league: string) =>
  league === 'nfl' || league === 'cfb'

const buildEmptyScoringRun = (): ScoringRunAnalysis => ({
  last5Minutes: { homePoints: 0, awayPoints: 0, netMargin: 0 },
  lastQuarter: { homePoints: 0, awayPoints: 0, netMargin: 0 },
  currentRun: null,
})

const buildEmptyFoulTrouble = (): FoulTroubleAnalysis => ({
  homePlayers: [],
  awayPlayers: [],
  totalImpact: {
    homeAdjustment: 0,
    awayAdjustment: 0,
  },
})

const buildEmptyFoulingStrategy = (): FoulingStrategyAnalysis => ({
  isFouling: false,
  reason: '',
  expectedFouls: 0,
  impactOnPace: 0,
  impactOnTotal: 0,
  factors: [],
})

const buildEmptyThreePointVariance = (): ThreePointVarianceAnalysis => ({
  homeThreePointInfo: {
    currentMade: 0,
    currentAttempted: 0,
    currentPercentage: 0,
    seasonPercentage: 0,
    deviation: 0,
    isOutlier: false,
  },
  awayThreePointInfo: {
    currentMade: 0,
    currentAttempted: 0,
    currentPercentage: 0,
    seasonPercentage: 0,
    deviation: 0,
    isOutlier: false,
  },
  expectedRegression: {
    homePtsAdjustment: 0,
    awayPtsAdjustment: 0,
    totalAdjustment: 0,
  },
  factors: [],
})

const buildEmptyKillshot = (): KillshotAnalysis => ({
  isKillshot: false,
})

const buildEmptyFatigue = (): FatigueAnalysis => ({
  homeFatigued: [],
  awayFatigued: [],
  teamFatigueImpact: {
    home: 0,
    away: 0,
  },
  lineAdjustment: 0,
  factors: [],
})

const buildEmptyTimeoutImpact = (): TimeoutImpactAnalysis => ({
  homeCoach: null,
  awayCoach: null,
  recentTimeouts: {
    home: 0,
    away: 0,
  },
  lineAdjustment: 0,
  factors: [],
})

const buildEmptyGarbageTime = (): GarbageTimeAnalysis => ({
  isGarbageTime: false,
  reason: '',
  recommendationAdjustment: 'monitor',
  marginalLineImpact: 0,
})

// ============================================================================
// MAIN FUNCTION: Analyze Live Game
// ============================================================================

export async function analyzeLiveGame(
  liveGame: LiveScoreGameDetails
): Promise<LiveGameState> {
  const homeTeam = liveGame.teams.find((t) => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find((t) => t.homeAway === 'away')

  if (!homeTeam || !awayTeam) {
    throw new Error('Could not find home/away teams in live game data')
  }

  const homeScore = homeTeam.score || 0
  const awayScore = awayTeam.score || 0

  // Calculate clock state from linescore (sum of completed quarters)
  const clockState = calculateClockState(
    homeTeam,
    awayTeam,
    liveGame.league,
    liveGame.status
  )

  // Extract current clock from status text (format: "5:24 - 2nd Quarter")
  const currentClock =
    liveGame.status?.displayClock ||
    extractClockFromStatus(liveGame.statusText || '')

  const isBasketball = isBasketballLeague(liveGame.league)
  const isFootball = isFootballLeague(liveGame.league)

  // Analyze all momentum factors
  const scoringRun = isBasketball
    ? analyzeScoringRun(
        liveGame.plays || [],
        clockState.elapsedSeconds,
        clockState.periodIndex,
        currentClock
      )
    : buildEmptyScoringRun()
  const paceChange = await analyzePaceChange(liveGame, clockState)
  const foulTrouble = isBasketball
    ? await analyzeFoulTrouble(liveGame, liveGame.league)
    : buildEmptyFoulTrouble()
  const comebackProbability = analyzeComebackProbability(
    homeScore,
    awayScore,
    clockState.remainingSeconds,
    liveGame.league
  )
  const quarterTrends = await analyzeQuarterTrends(
    clockState.periodIndex,
    homeTeam.name || 'Home',
    awayTeam.name || 'Away',
    homeTeam.linescore,
    awayTeam.linescore,
    liveGame.league
  )
  const garbageTime = isBasketball
    ? detectGarbageTime(
        homeScore,
        awayScore,
        clockState.remainingSeconds,
        clockState.periodIndex,
        liveGame.league
      )
    : buildEmptyGarbageTime()
  const recentFouls = isBasketball ? countRecentFouls(liveGame.plays || [], 2) : 0
  const foulingStrategy = isBasketball
    ? await detectFoulingStrategy(
        homeScore,
        awayScore,
        clockState.remainingSeconds,
        clockState.periodIndex,
        liveGame.league,
        recentFouls,
        homeTeam,
        awayTeam
      )
    : buildEmptyFoulingStrategy()
  const threePointVariance = isBasketball
    ? await analyzeThreePointVariance(liveGame, clockState.remainingSeconds)
    : buildEmptyThreePointVariance()
  const killshot = isBasketball
    ? await analyzeKillshot(liveGame, scoringRun, homeScore, awayScore)
    : buildEmptyKillshot()
  const fatigue = isBasketball
    ? await analyzeFatigue(liveGame, clockState.periodIndex)
    : buildEmptyFatigue()
  const timeoutImpact = isBasketball
    ? analyzeTimeoutImpact(liveGame, homeTeam.name || 'Home', awayTeam.name || 'Away')
    : buildEmptyTimeoutImpact()
  const driveState = isFootball
    ? extractFootballDriveState(liveGame, homeTeam, awayTeam)
    : null
  const footballEfficiency = isFootball
    ? analyzeFootballEfficiency(liveGame, homeTeam, awayTeam)
    : undefined

  // New analyzers for gap patches (basketball only)
  // Calculate period seconds elapsed for player availability and bonus
  const periodSeconds = liveGame.league === 'ncaab' ? 20 * 60 : 12 * 60
  const periodSecondsElapsed = Math.min(
    clockState.elapsedSeconds % periodSeconds,
    periodSeconds
  )
  const periodSecondsRemaining = periodSeconds - periodSecondsElapsed

  const bonusSituation = isBasketball
    ? analyzeBonusSituation(
        liveGame,
        clockState.periodIndex,
        periodSecondsRemaining,
        liveGame.league
      )
    : undefined

  const playerAvailability = isBasketball
    ? await analyzePlayerAvailability(
        liveGame,
        clockState.periodIndex,
        periodSecondsElapsed
      )
    : undefined

  // Import rotation analyzer dynamically to avoid circular deps
  const rotation = isBasketball
    ? await (await import('./rotation-analyzer')).analyzeRotation(
        liveGame,
        clockState.periodIndex
      )
    : undefined

  // Pre-game edge analysis
  const pregameEdges = await analyzePregameEdges(
    homeTeam.name || 'Home',
    awayTeam.name || 'Away',
    clockState.periodIndex,
    liveGame.eventId,
    liveGame.league
  )

  return {
    eventId: liveGame.eventId,
    homeTeam: homeTeam.name || 'Home',
    awayTeam: awayTeam.name || 'Away',
    homeScore,
    awayScore,
    timeRemaining: clockState.remainingSeconds,
    timeElapsed: clockState.elapsedSeconds,
    period: clockState.periodIndex,
    displayClock: currentClock || liveGame.statusText || '',
    sport: liveGame.league,

    momentum: {
      scoringRun,
      paceChange,
      foulTrouble,
      comebackProbability,
      quarterTrends,
      garbageTime,
      foulingStrategy,
      threePointVariance,
      killshot,
      fatigue,
      timeoutImpact,
      footballEfficiency,
      bonusSituation,
      playerAvailability,
      rotation,
    },

    pregameEdges,
    driveState: driveState ?? undefined,
  }
}

// Helper function to extract clock time from status text
function extractClockFromStatus(statusText: string): string {
  // Status text format examples:
  // "5:24 - 2nd Quarter"
  // "11:45 - 3rd Quarter"
  // "Final"
  const match = statusText.match(/(\d+:\d{2})/);
  return match ? match[1] : '0:00';
}

const parseClockToSeconds = (clock: string): number => {
  const match = clock.match(/^(\d+):(\d{2})$/)
  if (!match) return 0
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0
  return minutes * 60 + seconds
}

// Helper function to calculate clock state from linescore
function calculateClockState(
  homeTeam: GameDetailsTeam,
  awayTeam: GameDetailsTeam,
  league: string,
  status?: LiveScoreGameDetails['status']
) {
  const PERIOD_MINUTES: Record<string, number> = {
    nba: 12,
    nfl: 15,
    nhl: 20,
    ncaab: 20, // 2 halves
    cfb: 15,
  }

  const REGULATION_PERIODS: Record<string, number> = {
    nba: 4,
    nfl: 4,
    nhl: 3,
    ncaab: 2,
    cfb: 4,
  }

  const OVERTIME_MINUTES: Record<string, number> = {
    nba: 5,
    nfl: 10,
    nhl: 5,
    ncaab: 5,
    cfb: 10,
  }

  const periodMinutes = PERIOD_MINUTES[league] || 12
  const regulationPeriods = REGULATION_PERIODS[league] || 4
  const overtimeMinutes = OVERTIME_MINUTES[league] || 5
  const regulationPeriodSeconds = periodMinutes * 60
  const regulationSeconds = regulationPeriods * regulationPeriodSeconds

  const period =
    status?.period ??
    Math.max(homeTeam.linescore.length, awayTeam.linescore.length)
  const clock = status?.displayClock
  const remainingInPeriod = clock ? parseClockToSeconds(clock) : null

  if (period && remainingInPeriod != null) {
    const inOvertime = period > regulationPeriods
    const currentPeriodSeconds =
      (inOvertime ? overtimeMinutes : periodMinutes) * 60
    const elapsedInPeriod = Math.max(currentPeriodSeconds - remainingInPeriod, 0)
    const completedOvertimePeriods = Math.max(period - regulationPeriods - 1, 0)
    const elapsedSeconds = inOvertime
      ? regulationSeconds +
        completedOvertimePeriods * overtimeMinutes * 60 +
        elapsedInPeriod
      : Math.min(
          (period - 1) * regulationPeriodSeconds + elapsedInPeriod,
          regulationSeconds
        )
    const remainingSeconds = inOvertime
      ? remainingInPeriod
      : Math.max(
          (regulationPeriods - period) * regulationPeriodSeconds +
            remainingInPeriod,
          0
        )
    const totalSeconds = inOvertime
      ? regulationSeconds + (completedOvertimePeriods + 1) * overtimeMinutes * 60
      : regulationSeconds

    return {
      elapsedSeconds,
      remainingSeconds,
      totalSeconds,
      periodIndex: period,
    }
  }

  // Fallback to linescore counts when clock is missing
  const completedPeriods = Math.max(
    homeTeam.linescore.length,
    awayTeam.linescore.length
  )
  const elapsedSeconds = Math.min(
    completedPeriods * regulationPeriodSeconds,
    regulationSeconds
  )
  const remainingSeconds = Math.max(regulationSeconds - elapsedSeconds, 0)

  return {
    elapsedSeconds,
    remainingSeconds,
    totalSeconds: regulationSeconds,
    periodIndex: completedPeriods,
  }
}

type BasketballBoxStats = {
  fieldGoalsMade?: number
  fieldGoalsAttempted?: number
  threePointMade?: number
  threePointAttempts?: number
  freeThrowsMade?: number
  freeThrowAttempts?: number
  offensiveRebounds?: number
  turnovers?: number
}

type FootballBoxStats = {
  totalPlays?: number
  possessionTimeSeconds?: number
  yardsPerPlay?: number
}

const normalizeStatKey = (value?: string) =>
  (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')

const parseStatNumber = (value?: string) => {
  if (!value) return null
  const cleaned = value.replace(/%/g, '').replace(/[^0-9.-]/g, '')
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}

const parseTimeToSeconds = (value?: string) => {
  if (!value) return null
  const match = value.match(/(\d+):(\d{2})/)
  if (!match) return null
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null
  return minutes * 60 + seconds
}

const parseFootballDownDistance = (text: string) => {
  const match = text.match(/([1-4])(st|nd|rd|th)\s*(?:and|&)\s*(\d+)/i)
  if (!match) return null
  return {
    down: Number(match[1]),
    distance: Number(match[3]),
  }
}

const parseFootballFieldPosition = (
  text: string,
  homeAbbrev?: string,
  awayAbbrev?: string
) => {
  const match = text.match(/(?:at|ball on)\s+([A-Za-z]{2,4})\s*(\d{1,2})/i)
  if (!match) return null
  const side = match[1]?.toLowerCase()
  const yardLine = Number(match[2])
  if (!Number.isFinite(yardLine)) return null
  const homeKey = (homeAbbrev || '').toLowerCase()
  const awayKey = (awayAbbrev || '').toLowerCase()
  let yardLineSide: 'home' | 'away' | null = null
  if (side && homeKey && side.includes(homeKey)) yardLineSide = 'home'
  if (side && awayKey && side.includes(awayKey)) yardLineSide = 'away'
  return { yardLine, yardLineSide }
}

const resolveFootballPossession = (
  plays: PlayByPlayEntry[],
  homeTeam: GameDetailsTeam,
  awayTeam: GameDetailsTeam
) => {
  if (!plays.length) return null
  const last = plays[plays.length - 1]
  if (last.teamId) {
    if (last.teamId === homeTeam.id) return 'home'
    if (last.teamId === awayTeam.id) return 'away'
  }
  const text = (last.text || '').toLowerCase()
  const homeAbbrev = (homeTeam.abbreviation || '').toLowerCase()
  const awayAbbrev = (awayTeam.abbreviation || '').toLowerCase()
  if (homeAbbrev && text.includes(homeAbbrev)) return 'home'
  if (awayAbbrev && text.includes(awayAbbrev)) return 'away'
  return null
}

const extractFootballDriveState = (
  liveGame: LiveScoreGameDetails,
  homeTeam: GameDetailsTeam,
  awayTeam: GameDetailsTeam
): FootballDriveState | null => {
  const plays = liveGame.plays || []
  if (!plays.length) return null
  const last = plays[plays.length - 1]
  const possession = resolveFootballPossession(plays, homeTeam, awayTeam)
  const downDistance = last.text ? parseFootballDownDistance(last.text) : null
  const fieldPos = last.text
    ? parseFootballFieldPosition(
        last.text,
        homeTeam.abbreviation,
        awayTeam.abbreviation
      )
    : null

  let isRedZone = false
  if (fieldPos?.yardLine != null && possession) {
    const distanceToGoal =
      fieldPos.yardLineSide && fieldPos.yardLineSide === possession
        ? 100 - fieldPos.yardLine
        : fieldPos.yardLine
    isRedZone = distanceToGoal <= 20
  }

  const summaryParts: string[] = []
  if (possession) summaryParts.push(`Possession: ${possession}`)
  if (downDistance) {
    summaryParts.push(`${downDistance.down} & ${downDistance.distance}`)
  }
  if (fieldPos?.yardLine != null) {
    const sideLabel =
      fieldPos.yardLineSide === 'home'
        ? homeTeam.abbreviation
        : fieldPos.yardLineSide === 'away'
          ? awayTeam.abbreviation
          : null
    summaryParts.push(`at ${sideLabel ?? ''} ${fieldPos.yardLine}`.trim())
  }
  if (isRedZone) summaryParts.push('red zone')

  return {
    possession,
    down: downDistance?.down,
    distance: downDistance?.distance,
    yardLine: fieldPos?.yardLine,
    yardLineSide: fieldPos?.yardLineSide ?? null,
    isRedZone,
    summary: summaryParts.length ? summaryParts.join(' ') : undefined,
  }
}

const analyzeFootballEfficiency = (
  liveGame: LiveScoreGameDetails,
  homeTeam: GameDetailsTeam,
  awayTeam: GameDetailsTeam
): FootballEfficiencyAnalysis => {
  const homeBox = extractFootballTeamBoxStats(homeTeam)
  const awayBox = extractFootballTeamBoxStats(awayTeam)
  const homeYpp = homeBox.yardsPerPlay ?? null
  const awayYpp = awayBox.yardsPerPlay ?? null

  if (homeYpp == null && awayYpp == null) {
    return { factors: [] }
  }

  const leagueAvg = liveGame.league === 'cfb' ? 6.0 : 5.5
  const combined =
    homeYpp != null && awayYpp != null ? (homeYpp + awayYpp) / 2 : homeYpp ?? awayYpp ?? leagueAvg
  const net = homeYpp != null && awayYpp != null ? homeYpp - awayYpp : null

  const impactOnTotal =
    combined != null ? (combined - leagueAvg) * 3.0 : undefined
  const impactOnSpread = net != null ? net * 0.9 : undefined

  const factors: string[] = []
  if (homeYpp != null && awayYpp != null) {
    factors.push(
      `Live YPP: ${homeTeam.name} ${homeYpp.toFixed(2)}, ${awayTeam.name} ${awayYpp.toFixed(2)}`
    )
  }
  if (impactOnTotal != null && Math.abs(impactOnTotal) >= 1) {
    factors.push(
      `Efficiency impact: ${impactOnTotal > 0 ? '+' : ''}${impactOnTotal.toFixed(1)} pts total`
    )
  }

  return {
    homeYardsPerPlay: homeYpp ?? undefined,
    awayYardsPerPlay: awayYpp ?? undefined,
    combinedYardsPerPlay: combined ?? undefined,
    netYardsPerPlay: net ?? undefined,
    impactOnSpread,
    impactOnTotal,
    factors,
  }
}

const parseMadeAttempt = (value?: string) => {
  if (!value) return null
  const match = value.match(/(-?\d+)\s*-\s*(-?\d+)/)
  if (!match) return null
  const made = Number(match[1])
  const attempted = Number(match[2])
  if (!Number.isFinite(made) || !Number.isFinite(attempted)) return null
  return { made, attempted }
}

const extractBasketballTeamBoxStats = (team?: GameDetailsTeam): BasketballBoxStats => {
  const stats: BasketballBoxStats = {}
  const entries = team?.statistics ?? []

  for (const entry of entries) {
    const key = normalizeStatKey(entry.name || entry.abbreviation || entry.label)
    if (!key) continue

    if (key === 'fg' || key.includes('fieldgoalsmadefieldgoalsattempted')) {
      const line = parseMadeAttempt(entry.value)
      if (line) {
        stats.fieldGoalsMade = line.made
        stats.fieldGoalsAttempted = line.attempted
      }
      continue
    }

    if (key === '3pt' || key.startsWith('3pt') || key.includes('threepointfieldgoalsmade')) {
      const line = parseMadeAttempt(entry.value)
      if (line) {
        stats.threePointMade = line.made
        stats.threePointAttempts = line.attempted
      }
      continue
    }

    if (key === 'ft' || key.includes('freethrowsmade')) {
      const line = parseMadeAttempt(entry.value)
      if (line) {
        stats.freeThrowsMade = line.made
        stats.freeThrowAttempts = line.attempted
      }
      continue
    }

    if (key === 'or' || key.includes('offensiverebounds')) {
      const value = parseStatNumber(entry.value)
      if (value != null) stats.offensiveRebounds = value
      continue
    }

    if (key === 'turnovers' || key === 'totalturnovers' || key === 'toto' || key === 'to') {
      const value = parseStatNumber(entry.value)
      if (value != null) stats.turnovers = value
    }
  }

  return stats
}

const estimatePossessions = (stats: BasketballBoxStats): number | null => {
  const fga = stats.fieldGoalsAttempted
  const fta = stats.freeThrowAttempts
  const tov = stats.turnovers
  const orb = stats.offensiveRebounds

  if (fga == null || fta == null || tov == null || orb == null) return null
  return fga + 0.44 * fta + tov - orb
}

const extractFootballTeamBoxStats = (team?: GameDetailsTeam): FootballBoxStats => {
  const stats: FootballBoxStats = {}
  const entries = team?.statistics ?? []

  for (const entry of entries) {
    const key = normalizeStatKey(entry.name || entry.abbreviation || entry.label)
    if (!key) continue

    if (
      key.includes('totalplays') ||
      key === 'plays' ||
      key.includes('playsrun') ||
      key.includes('offensiveplays')
    ) {
      const value = parseStatNumber(entry.value)
      if (value != null) stats.totalPlays = value
      continue
    }

    if (key.includes('possessiontime') || key.includes('timeofpossession')) {
      const seconds = parseTimeToSeconds(entry.value)
      if (seconds != null) stats.possessionTimeSeconds = seconds
      continue
    }

    if (key.includes('yardsperplay')) {
      const value = parseStatNumber(entry.value)
      if (value != null) stats.yardsPerPlay = value
    }
  }

  return stats
}

// ============================================================================
// SCORING RUN ANALYSIS
// ============================================================================

/**
 * Assess the statistical significance of a scoring run
 * NBA games typically have multiple runs of various sizes - this helps
 * identify when a run is normal variance vs. a meaningful momentum shift
 *
 * Statistical context (based on NBA averages):
 * - 6-0 runs: ~8-10 per game (very common)
 * - 8-0 runs: ~4-6 per game (common)
 * - 10-0 runs: ~2-3 per game (notable)
 * - 12-0 runs: ~1-1.5 per game (significant)
 * - 15-0+ runs: ~0.3-0.5 per game (rare)
 */
function assessRunSignificance(
  runPoints: number,
  durationSeconds: number
): { isNormal: boolean; dampening: number; context: string } {
  // Run frequency data (approximate occurrences per game)
  const runFrequency: Record<number, { perGame: number; isNormal: boolean }> = {
    6: { perGame: 9, isNormal: true },
    7: { perGame: 7, isNormal: true },
    8: { perGame: 5, isNormal: true },
    9: { perGame: 4, isNormal: true },
    10: { perGame: 2.5, isNormal: true },
    11: { perGame: 2, isNormal: true },
    12: { perGame: 1.2, isNormal: false },
    13: { perGame: 0.8, isNormal: false },
    14: { perGame: 0.5, isNormal: false },
    15: { perGame: 0.3, isNormal: false },
  }

  // Get frequency data for this run size (cap at 15 for lookup)
  const lookupPoints = Math.min(runPoints, 15)
  const freqData = runFrequency[lookupPoints] || { perGame: 0.2, isNormal: false }

  // Calculate dampening factor
  // Higher frequency = more dampening (less weight in line adjustment)
  // Range: 0.3 (rare, high weight) to 0.9 (common, low weight)
  let dampening: number

  if (freqData.perGame >= 5) {
    dampening = 0.85 // Very common, heavily dampen
  } else if (freqData.perGame >= 3) {
    dampening = 0.7 // Common, moderate dampening
  } else if (freqData.perGame >= 1.5) {
    dampening = 0.5 // Notable, some dampening
  } else if (freqData.perGame >= 0.5) {
    dampening = 0.35 // Significant, light dampening
  } else {
    dampening = 0.2 // Rare, minimal dampening
  }

  // Duration factor: quick runs (< 2 min) are more volatile
  if (durationSeconds < 120) {
    dampening = Math.min(dampening + 0.1, 0.95) // Quick runs = more dampening
  }

  // Build context string
  const context = `${runPoints}-0 runs occur ~${freqData.perGame.toFixed(1)}x per game${freqData.isNormal ? ' (normal variance)' : ''}`

  return {
    isNormal: freqData.isNormal,
    dampening,
    context,
  }
}

const LEAGUE_AVG_ORTG: Record<string, number> = {
  nba: 115,
  ncaab: 105,
}

const estimateKillshotFrequency = (
  teamOrtg: number,
  teamPace: number,
  league: string
) => {
  const leagueOrtg = LEAGUE_AVG_ORTG[league] ?? 110
  const leaguePace = getDefaultPaceForLeague(league as any)
  const paceIndex = leaguePace > 0 ? teamPace / leaguePace : 1
  const offenseIndex = leagueOrtg > 0 ? teamOrtg / leagueOrtg : 1
  const expectedFrequency = Number((1.0 * paceIndex * offenseIndex).toFixed(2))
  return { expectedFrequency, paceIndex, offenseIndex }
}

const analyzeKillshot = async (
  liveGame: LiveScoreGameDetails,
  scoringRun: ScoringRunAnalysis,
  homeScore: number,
  awayScore: number
): Promise<KillshotAnalysis> => {
  const currentRun = scoringRun.currentRun
  if (!currentRun || currentRun.points < 10) {
    return { isKillshot: false }
  }

  const team = currentRun.team
  const league = liveGame.league
  const homeTeam = liveGame.teams.find((t) => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find((t) => t.homeAway === 'away')

  const [homeStats, awayStats] = await Promise.all([
    getLiveTeamStats(homeTeam?.name || '', league),
    getLiveTeamStats(awayTeam?.name || '', league),
  ])

  const runTeamStats = team === 'home' ? homeStats : awayStats
  const teamOrtg = runTeamStats?.ortg ?? LEAGUE_AVG_ORTG[league] ?? 110
  const teamPace = runTeamStats?.pace ?? getDefaultPaceForLeague(league)

  const { expectedFrequency, paceIndex, offenseIndex } =
    estimateKillshotFrequency(teamOrtg, teamPace, league)

  const margin = homeScore - awayScore
  const isComebackAttempt =
    (team === 'home' && margin < 0) || (team === 'away' && margin > 0)

  const teamName =
    team === 'home' ? homeTeam?.name || 'Home' : awayTeam?.name || 'Away'
  const factors = [
    `Killshot: ${teamName} ${currentRun.points}-0 run (${currentRun.duration})`,
    `Killshot profile: pace index ${paceIndex.toFixed(2)}, offense index ${offenseIndex.toFixed(2)}`,
  ]

  return {
    isKillshot: true,
    team,
    points: currentRun.points,
    duration: currentRun.duration,
    expectedFrequency,
    paceIndex,
    offenseIndex,
    isComebackAttempt,
    factors,
  }
}

export function analyzeScoringRun(
  plays: PlayByPlayEntry[],
  elapsedSeconds: number,
  currentPeriod: number = 0,
  currentClock: string = '0:00'
): ScoringRunAnalysis {
  // Default empty analysis if no plays available
  if (!plays || plays.length === 0) {
    return {
      last5Minutes: { homePoints: 0, awayPoints: 0, netMargin: 0 },
      lastQuarter: { homePoints: 0, awayPoints: 0, netMargin: 0 },
      currentRun: null,
    }
  }

  // Import parser utilities
  const { filterPlaysLastNMinutes, filterPlaysByPeriod, detectScoreChange, parseClockToSeconds } =
    require('./play-by-play-parser')

  // ============================================================================
  // LAST 5 MINUTES CALCULATION
  // ============================================================================

  const last5MinPlays = filterPlaysLastNMinutes(plays, currentPeriod, currentClock, 5)

  let last5MinHomePoints = 0
  let last5MinAwayPoints = 0

  for (let i = 1; i < last5MinPlays.length; i++) {
    const current = last5MinPlays[i]
    const previous = last5MinPlays[i - 1]
    const change = detectScoreChange(current, previous)

    last5MinHomePoints += change.homeChange
    last5MinAwayPoints += change.awayChange
  }

  const last5Minutes = {
    homePoints: last5MinHomePoints,
    awayPoints: last5MinAwayPoints,
    netMargin: last5MinHomePoints - last5MinAwayPoints,
  }

  // ============================================================================
  // LAST QUARTER CALCULATION
  // ============================================================================

  let lastQuarterHomePoints = 0
  let lastQuarterAwayPoints = 0

  if (currentPeriod > 1) {
    const lastQuarterPlays = filterPlaysByPeriod(plays, currentPeriod - 1)

    for (let i = 1; i < lastQuarterPlays.length; i++) {
      const current = lastQuarterPlays[i]
      const previous = lastQuarterPlays[i - 1]
      const change = detectScoreChange(current, previous)

      lastQuarterHomePoints += change.homeChange
      lastQuarterAwayPoints += change.awayChange
    }
  }

  const lastQuarter = {
    homePoints: lastQuarterHomePoints,
    awayPoints: lastQuarterAwayPoints,
    netMargin: lastQuarterHomePoints - lastQuarterAwayPoints,
  }

  // ============================================================================
  // CURRENT RUN DETECTION
  // ============================================================================

  interface RunState {
    team: 'home' | 'away'
    points: number
    startIndex: number
    endIndex: number
    startClock: string
    endClock: string
  }

  let currentRun: RunState | null = null

  // Walk plays backward from most recent
  for (let i = plays.length - 1; i > 0; i--) {
    const current = plays[i]
    const previous = plays[i - 1]
    const change = detectScoreChange(current, previous)

    if (change.scoringTeam) {
      // A team scored
      if (currentRun && currentRun.team === change.scoringTeam) {
        // Continue current run
        currentRun.points += change.homeChange + change.awayChange
        currentRun.startIndex = i
        currentRun.startClock = current.clock || '0:00'
      } else {
        // End previous run if significant (8+ points)
        if (currentRun && currentRun.points >= 8) {
          break // Stop, we found the run
        }

        // Start new run
        currentRun = {
          team: change.scoringTeam,
          points: change.homeChange + change.awayChange,
          startIndex: i,
          endIndex: i,
          startClock: current.clock || '0:00',
          endClock: current.clock || '0:00',
        }
      }
    } else if (currentRun) {
      // Opponent scored or non-scoring play, end current run
      if (currentRun.points >= 8) {
        break // Stop, we found the run
      }
      currentRun = null
    }
  }

  // Calculate run duration if we have a valid run
  let currentRunResult: ScoringRunAnalysis['currentRun'] = null

  if (currentRun && currentRun.points >= 8) {
    const startSeconds = parseClockToSeconds(currentRun.startClock) || 0
    const endSeconds = parseClockToSeconds(currentRun.endClock) || 0
    const durationSeconds = Math.abs(startSeconds - endSeconds)

    const minutes = Math.floor(durationSeconds / 60)
    const seconds = durationSeconds % 60

    // Assess run significance for recency bias discounting
    const runSignificance = assessRunSignificance(currentRun.points, durationSeconds)

    currentRunResult = {
      team: currentRun.team,
      points: currentRun.points,
      duration: `${minutes}:${seconds.toString().padStart(2, '0')}`,
      isStatisticallyNormal: runSignificance.isNormal,
      runFrequencyContext: runSignificance.context,
      confidenceDampening: runSignificance.dampening,
    }
  }

  return {
    last5Minutes,
    lastQuarter,
    currentRun: currentRunResult,
  }
}

// ============================================================================
// PACE ANALYSIS
// ============================================================================

export async function analyzePaceChange(
  liveGame: LiveScoreGameDetails,
  clockState: { elapsedSeconds: number; totalSeconds: number }
): Promise<PaceAnalysis> {
  const homeTeam = liveGame.teams.find((t) => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find((t) => t.homeAway === 'away')

  if (!homeTeam || !awayTeam) {
    const fallbackPace = getDefaultPaceForLeague(liveGame.league)
    return {
      currentPace: fallbackPace,
      seasonPace: fallbackPace,
      deviation: 0,
      impactOnTotal: 0,
    }
  }

  const league = liveGame.league

  // Get season pace from team stats
  const [homeStats, awayStats] = await Promise.all([
    getLiveTeamStats(homeTeam.name || '', league),
    getLiveTeamStats(awayTeam.name || '', league),
  ])

  const seasonPace =
    homeStats && awayStats
      ? (homeStats.pace + awayStats.pace) / 2
      : getDefaultPaceForLeague(league)

  const elapsedMinutes = clockState.elapsedSeconds / 60
  let currentPace = seasonPace

  if (isBasketballLeague(league)) {
    // Calculate current pace from box score (possessions per regulation minutes)
    // Possessions = FGA + 0.44 * FTA + TOV - ORB
    const homeBox = extractBasketballTeamBoxStats(homeTeam)
    const awayBox = extractBasketballTeamBoxStats(awayTeam)
    const homePossessions = estimatePossessions(homeBox)
    const awayPossessions = estimatePossessions(awayBox)
    const totalPossessions =
      homePossessions != null && awayPossessions != null
        ? (homePossessions + awayPossessions) / 2
        : homePossessions ?? awayPossessions
    const regulationMinutes = league === 'ncaab' ? 40 : 48
    currentPace =
      elapsedMinutes > 0 && totalPossessions != null
        ? (totalPossessions / elapsedMinutes) * regulationMinutes
        : seasonPace
  } else if (isFootballLeague(league)) {
    // Football pace uses total plays per regulation minutes
    const homeBox = extractFootballTeamBoxStats(homeTeam)
    const awayBox = extractFootballTeamBoxStats(awayTeam)
    const homePlays = homeBox.totalPlays
    const awayPlays = awayBox.totalPlays
    const totalPlays =
      homePlays != null && awayPlays != null
        ? (homePlays + awayPlays) / 2
        : homePlays ?? awayPlays
    const regulationMinutes = 60
    currentPace =
      elapsedMinutes > 0 && totalPlays != null
        ? (totalPlays / elapsedMinutes) * regulationMinutes
        : seasonPace
  }

  const deviation = currentPace - seasonPace

  // Estimate impact on final total
  // If pace is 5% faster, final total will be ~5% higher
  const paceMultiplier = seasonPace > 0 ? currentPace / seasonPace : 1
  const baselineTotals: Record<string, number> = {
    nba: 110,
    ncaab: 70,
    nfl: 44,
    cfb: 56,
    nhl: 6,
  }
  const expectedBaseline = baselineTotals[league] ?? 110
  const impactOnTotal = expectedBaseline * (paceMultiplier - 1)

  return {
    currentPace,
    seasonPace,
    deviation,
    impactOnTotal,
  }
}

// ============================================================================
// FOUL TROUBLE ANALYSIS
// ============================================================================

export async function analyzeFoulTrouble(
  liveGame: LiveScoreGameDetails,
  league: string
): Promise<FoulTroubleAnalysis> {
  const homeTeam = liveGame.teams.find((t) => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find((t) => t.homeAway === 'away')

  const foulThreshold = league === 'ncaab' ? 4 : 4

  const analyzePlayers = async (team: GameDetailsTeam | undefined) => {
    const players: any[] = []

    if (!team) return players

    // Check both starters and bench players for foul trouble (4+ fouls)
    const allPlayers = [...team.starters, ...team.bench]

    for (const player of allPlayers) {
      // Get fouls from statMap if available
      const fouls = parseInt(player.statMap?.PF || player.statMap?.fouls || '0', 10)

      if (fouls >= foulThreshold) {
        // Get player impact from BPM data
        const playerStats =
          league === 'nba' ? await getPlayerStats(player.name || '', 'points') : null
        const isStarter = team.starters.some((s) => s.id === player.id)
        const impactScore = getPlayerImpactScore(playerStats)

        const impactOnSpread =
          isStarter && impactScore > 2.5 ? -2.5 : impactScore > 0.5 ? -1.5 : -0.5

        players.push({
          name: player.name || 'Unknown',
          fouls,
          isStarter,
          impactOnSpread,
        })
      }
    }

    return players
  }

  const [homePlayers, awayPlayers] = await Promise.all([
    analyzePlayers(homeTeam),
    analyzePlayers(awayTeam),
  ])

  const homeAdjustment = homePlayers.reduce((sum, p) => sum + p.impactOnSpread, 0)
  const awayAdjustment = awayPlayers.reduce((sum, p) => sum + p.impactOnSpread, 0)

  return {
    homePlayers,
    awayPlayers,
    totalImpact: {
      homeAdjustment,
      awayAdjustment,
    },
  }
}

// ============================================================================
// COMEBACK PROBABILITY ANALYSIS
// ============================================================================

export function analyzeComebackProbability(
  homeScore: number,
  awayScore: number,
  remainingSeconds: number,
  sport: string
): ComebackAnalysis {
  const deficit = Math.abs(homeScore - awayScore)
  const remainingMinutes = remainingSeconds / 60

  // Historical comeback rates (simplified - would ideally use actual historical data)
  let historicalComebackRate = 0

  if (sport === 'nba') {
    // NBA comeback rates by deficit and time
    if (remainingMinutes > 30) {
      // Lots of time
      if (deficit < 10) historicalComebackRate = 0.45
      else if (deficit < 20) historicalComebackRate = 0.25
      else historicalComebackRate = 0.05
    } else if (remainingMinutes > 15) {
      // Mid-game
      if (deficit < 10) historicalComebackRate = 0.35
      else if (deficit < 20) historicalComebackRate = 0.15
      else historicalComebackRate = 0.02
    } else if (remainingMinutes > 5) {
      // Late game
      if (deficit < 10) historicalComebackRate = 0.25
      else if (deficit < 15) historicalComebackRate = 0.08
      else historicalComebackRate = 0.01
    } else {
      // Final minutes
      if (deficit < 5) historicalComebackRate = 0.18
      else if (deficit < 10) historicalComebackRate = 0.03
      else historicalComebackRate = 0.001
    }
  } else if (sport === 'ncaab') {
    // College pace: fewer minutes, slightly lower comeback rates
    if (remainingMinutes > 20) {
      if (deficit < 8) historicalComebackRate = 0.4
      else if (deficit < 15) historicalComebackRate = 0.2
      else historicalComebackRate = 0.05
    } else if (remainingMinutes > 10) {
      if (deficit < 8) historicalComebackRate = 0.3
      else if (deficit < 12) historicalComebackRate = 0.12
      else historicalComebackRate = 0.02
    } else if (remainingMinutes > 4) {
      if (deficit < 6) historicalComebackRate = 0.2
      else if (deficit < 10) historicalComebackRate = 0.05
      else historicalComebackRate = 0.01
    } else {
      if (deficit < 4) historicalComebackRate = 0.12
      else if (deficit < 8) historicalComebackRate = 0.02
      else historicalComebackRate = 0.001
    }
  }

  // Required scoring pace to come back
  const requiredPace = remainingMinutes > 0 ? deficit / remainingMinutes : 0

  // Win probability for trailing team (very rough estimate)
  const probability = Math.min(historicalComebackRate, 0.5)

  return {
    currentDeficit: deficit,
    historicalComebackRate,
    requiredPace,
    probability,
  }
}

// ============================================================================
// GARBAGE TIME DETECTION
// ============================================================================

export function detectGarbageTime(
  homeScore: number,
  awayScore: number,
  timeRemaining: number, // seconds
  period: number,
  league: string
): GarbageTimeAnalysis {
  const margin = Math.abs(homeScore - awayScore)
  const minutesRemaining = timeRemaining / 60
  const regulationPeriods = league === 'ncaab' ? 2 : 4

  // Garbage time thresholds by time remaining
  const thresholds: Array<{ minMinutes: number; maxMinutes: number; margin: number }> = [
    { minMinutes: 0, maxMinutes: 3, margin: 15 },   // Last 3 min: 15+ point lead
    { minMinutes: 3, maxMinutes: 6, margin: 20 },   // 3-6 min: 20+ point lead
    { minMinutes: 6, maxMinutes: 9, margin: 25 },   // 6-9 min: 25+ point lead
    { minMinutes: 9, maxMinutes: 12, margin: 30 },  // Full Q4: 30+ point lead
  ]

  // Only check final period and overtime
  if (period < regulationPeriods) {
    return {
      isGarbageTime: false,
      reason: '',
      recommendationAdjustment: 'monitor',
      marginalLineImpact: 0
    }
  }

  for (const threshold of thresholds) {
    if (minutesRemaining >= threshold.minMinutes &&
        minutesRemaining < threshold.maxMinutes &&
        margin >= threshold.margin) {

      return {
        isGarbageTime: true,
        reason: `${margin}-point lead with ${minutesRemaining.toFixed(1)} minutes remaining`,
        recommendationAdjustment: 'avoid',
        marginalLineImpact: -0.5 // Reduce confidence in projections
      }
    }
  }

  return {
    isGarbageTime: false,
    reason: '',
    recommendationAdjustment: 'monitor',
    marginalLineImpact: 0
  }
}

// ============================================================================
// LATE-GAME FOULING DETECTION
// ============================================================================

/**
 * Count recent fouls from play-by-play
 */
function countRecentFouls(plays: PlayByPlayEntry[], lastNMinutes: number = 2): number {
  // Filter plays from last N minutes (approximate by taking last 50 plays)
  const recentPlays = plays.slice(-50)

  let foulCount = 0
  for (const play of recentPlays) {
    const text = play.text.toLowerCase()
    if (text.includes('foul') && !text.includes('shooting foul on made')) {
      foulCount++
    }
  }

  return foulCount
}

type LiveFreeThrowSample = {
  pct: number
  attempts: number
}

const DEFAULT_FT_PCT_BY_LEAGUE: Record<string, number> = {
  nba: 0.78,
  ncaab: 0.70,
}

const clampPct = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

const getLiveFreeThrowSample = (
  team?: GameDetailsTeam
): LiveFreeThrowSample | null => {
  const box = extractBasketballTeamBoxStats(team)
  const attempts = box.freeThrowAttempts ?? 0
  const made = box.freeThrowsMade ?? 0
  if (attempts <= 0) return null
  const pct = clampPct(made / attempts)
  return { pct, attempts }
}

const blendFreeThrowPct = (
  seasonPct: number,
  liveSample: LiveFreeThrowSample | null,
  league: LeagueId
): {
  pct: number
  livePct: number | null
  liveAttempts: number
  liveWeight: number
} => {
  const normalizedSeason = clampPct(seasonPct)
  if (!liveSample) {
    return {
      pct: normalizedSeason,
      livePct: null,
      liveAttempts: 0,
      liveWeight: 0,
    }
  }

  const maxWeight = league === 'ncaab' ? 0.55 : 0.65
  const liveWeight = Math.min(liveSample.attempts / 8, maxWeight)
  const blended =
    normalizedSeason * (1 - liveWeight) + liveSample.pct * liveWeight

  return {
    pct: clampPct(blended),
    livePct: liveSample.pct,
    liveAttempts: liveSample.attempts,
    liveWeight,
  }
}

/**
 * Detect if trailing team is in "must foul" mode
 */
export async function detectFoulingStrategy(
  homeScore: number,
  awayScore: number,
  timeRemaining: number, // seconds
  period: number,
  league: string,
  recentFouls: number, // Fouls in last 2 minutes (from play-by-play)
  homeTeam?: GameDetailsTeam,
  awayTeam?: GameDetailsTeam
): Promise<FoulingStrategyAnalysis> {
  const margin = Math.abs(homeScore - awayScore)
  const minutesRemaining = timeRemaining / 60
  const secondsRemaining = timeRemaining
  const regulationPeriods = league === 'ncaab' ? 2 : 4

  // Not in fouling time yet
  if (period < regulationPeriods || minutesRemaining > 3) {
    return {
      isFouling: false,
      reason: '',
      expectedFouls: 0,
      impactOnPace: 0,
      impactOnTotal: 0,
      factors: []
    }
  }

  const factors: string[] = []

  // Fouling criteria
  const foulingThresholds = [
    { maxTime: 120, minMargin: 3, maxMargin: 10 },  // Last 2 min: 3-10 pt deficit
    { maxTime: 180, minMargin: 4, maxMargin: 12 },  // Last 3 min: 4-12 pt deficit
  ]

  let isFouling = false
  let reason = ''

  for (const threshold of foulingThresholds) {
    if (secondsRemaining <= threshold.maxTime &&
        margin >= threshold.minMargin &&
        margin <= threshold.maxMargin) {

      // Check if foul rate is elevated
      if (recentFouls >= 3) { // 3+ fouls in last 2 min = intentional
        isFouling = true
        reason = `${margin}-point game, ${minutesRemaining.toFixed(1)} min left, ${recentFouls} fouls in last 2 min`
        break
      }
    }
  }

  if (!isFouling) {
    return {
      isFouling: false,
      reason: '',
      expectedFouls: 0,
      impactOnPace: 0,
      impactOnTotal: 0,
      factors: []
    }
  }

  const leagueId = (league === 'ncaab' ? 'ncaab' : 'nba') as LeagueId
  const defaultFtPct = DEFAULT_FT_PCT_BY_LEAGUE[leagueId] ?? 0.74
  const homeName = homeTeam?.name || 'Home'
  const awayName = awayTeam?.name || 'Away'

  const [homeSeasonFt, awaySeasonFt] = await Promise.all([
    getLiveTeamFreeThrowPct(homeName, leagueId),
    getLiveTeamFreeThrowPct(awayName, leagueId),
  ])

  const homeLiveSample = getLiveFreeThrowSample(homeTeam)
  const awayLiveSample = getLiveFreeThrowSample(awayTeam)

  const homeFtBlend = blendFreeThrowPct(
    homeSeasonFt ?? defaultFtPct,
    homeLiveSample,
    leagueId
  )
  const awayFtBlend = blendFreeThrowPct(
    awaySeasonFt ?? defaultFtPct,
    awayLiveSample,
    leagueId
  )

  const leadingSide = homeScore >= awayScore ? 'home' : 'away'
  const leadingTeamName = leadingSide === 'home' ? homeName : awayName
  const leadingFtBlend = leadingSide === 'home' ? homeFtBlend : awayFtBlend

  // Calculate impact on pace and total
  // Each foul = 2 FT + change of possession
  // Expected: ~5-8 fouls per minute in fouling situations
  const expectedFoulsPerMin = 6
  const expectedFouls = expectedFoulsPerMin * minutesRemaining

  // Impact on possessions: each foul = 1 extra possession
  const paceScale = league === 'ncaab' ? 40 / 48 : 1
  const impactOnPace = expectedFouls * 10 * paceScale // Scaled to per-48 pace

  // Impact on total:
  // - Leading team: points per foul scaled by blended FT%
  // - Trailing team: gets ball back, lower-efficiency quick shots
  const trailingQuickShotPoints = leagueId === 'ncaab' ? 0.45 : 0.5
  const leadingTeamPoints = expectedFouls * (2 * leadingFtBlend.pct)
  const trailingTeamPoints = expectedFouls * trailingQuickShotPoints
  const impactOnTotal = leadingTeamPoints + trailingTeamPoints

  factors.push(`INTENTIONAL FOULING DETECTED: ${reason}`)
  factors.push(`Expected ${expectedFouls.toFixed(0)} fouls in final ${minutesRemaining.toFixed(1)} minutes`)
  factors.push(
    `Leading FT% blend (${leadingTeamName}): ${(leadingFtBlend.pct * 100).toFixed(1)}%`
  )
  if (leadingFtBlend.livePct != null && leadingFtBlend.liveAttempts > 0) {
    factors.push(
      `Live FT% sample: ${(leadingFtBlend.livePct * 100).toFixed(1)}% on ${leadingFtBlend.liveAttempts} FTAs`
    )
  }
  if (leagueId === 'ncaab' && leadingFtBlend.pct < 0.67) {
    factors.push('Low FT% reduces foul value in college late-game')
  }
  factors.push(`Projected total impact: +${impactOnTotal.toFixed(1)} points`)

  return {
    isFouling: true,
    reason,
    expectedFouls,
    impactOnPace,
    impactOnTotal,
    factors
  }
}

// ============================================================================
// THREE-POINT VARIANCE REGRESSION
// ============================================================================

const DEFAULT_THREE_POINT_PCT: Record<string, number> = {
  nba: 0.355,
  ncaab: 0.335,
}

async function getSeasonThreePointPct(
  teamName: string,
  league: string
): Promise<number> {
  if (league === 'ncaab') {
    const pct = await getLiveTeamThreePointPct(teamName, 'ncaab')
    return pct ?? DEFAULT_THREE_POINT_PCT.ncaab
  }
  if (league === 'nba') {
    const pct = await getLiveTeamThreePointPct(teamName, 'nba')
    return pct ?? DEFAULT_THREE_POINT_PCT.nba
  }
  return DEFAULT_THREE_POINT_PCT.nba
}

/**
 * Analyze three-point shooting variance and expected regression
 */
export async function analyzeThreePointVariance(
  liveGame: LiveScoreGameDetails,
  timeRemaining: number
): Promise<ThreePointVarianceAnalysis> {
  const homeTeam = liveGame.teams.find(t => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find(t => t.homeAway === 'away')
  const league = liveGame.league

  // Get current 3PT stats from box score
  const homeBox = extractBasketballTeamBoxStats(homeTeam)
  const awayBox = extractBasketballTeamBoxStats(awayTeam)
  const home3PM = homeBox.threePointMade || 0
  const home3PA = homeBox.threePointAttempts || 0
  const away3PM = awayBox.threePointMade || 0
  const away3PA = awayBox.threePointAttempts || 0

  const homeCurrent3Pct = home3PA > 0 ? home3PM / home3PA : 0
  const awayCurrent3Pct = away3PA > 0 ? away3PM / away3PA : 0

  // Get season 3PT% from team stats
  const [homeSeason3Pct, awaySeason3Pct] = await Promise.all([
    getSeasonThreePointPct(homeTeam?.name || '', league),
    getSeasonThreePointPct(awayTeam?.name || '', league),
  ])

  const homeDeviation = homeCurrent3Pct - homeSeason3Pct
  const awayDeviation = awayCurrent3Pct - awaySeason3Pct

  // Outlier = >10% above/below season average with 10+ attempts
  const homeIsOutlier = Math.abs(homeDeviation) > 0.10 && home3PA >= 10
  const awayIsOutlier = Math.abs(awayDeviation) > 0.10 && away3PA >= 10

  const factors: string[] = []

  // Calculate expected regression
  // Assume team will shoot season average for remaining time
  const minutesRemaining = timeRemaining / 60
  const avgAttemptsPerMinute = league === 'ncaab' ? 0.65 : 0.8
  const expectedRemaining3PA = avgAttemptsPerMinute * minutesRemaining

  // Current pace has them at X points from 3PT
  // Expected pace (at season avg) would have them at Y points
  // Adjustment = Y - X

  let homePtsAdjustment = 0
  let awayPtsAdjustment = 0

  if (homeIsOutlier) {
    const currentExpectedRemaining = expectedRemaining3PA * homeCurrent3Pct * 3
    const seasonExpectedRemaining = expectedRemaining3PA * homeSeason3Pct * 3
    homePtsAdjustment = seasonExpectedRemaining - currentExpectedRemaining

    factors.push(
      `${homeTeam?.name} 3PT: ${(homeCurrent3Pct * 100).toFixed(1)}% (${home3PM}/${home3PA}) vs ${(homeSeason3Pct * 100).toFixed(1)}% season → expect regression (${homePtsAdjustment > 0 ? '+' : ''}${homePtsAdjustment.toFixed(1)} pts)`
    )
  }

  if (awayIsOutlier) {
    const currentExpectedRemaining = expectedRemaining3PA * awayCurrent3Pct * 3
    const seasonExpectedRemaining = expectedRemaining3PA * awaySeason3Pct * 3
    awayPtsAdjustment = seasonExpectedRemaining - currentExpectedRemaining

    factors.push(
      `${awayTeam?.name} 3PT: ${(awayCurrent3Pct * 100).toFixed(1)}% (${away3PM}/${away3PA}) vs ${(awaySeason3Pct * 100).toFixed(1)}% season → expect regression (${awayPtsAdjustment > 0 ? '+' : ''}${awayPtsAdjustment.toFixed(1)} pts)`
    )
  }

  const totalAdjustment = homePtsAdjustment + awayPtsAdjustment

  return {
    homeThreePointInfo: {
      currentMade: home3PM,
      currentAttempted: home3PA,
      currentPercentage: homeCurrent3Pct,
      seasonPercentage: homeSeason3Pct,
      deviation: homeDeviation,
      isOutlier: homeIsOutlier
    },
    awayThreePointInfo: {
      currentMade: away3PM,
      currentAttempted: away3PA,
      currentPercentage: awayCurrent3Pct,
      seasonPercentage: awaySeason3Pct,
      deviation: awayDeviation,
      isOutlier: awayIsOutlier
    },
    expectedRegression: {
      homePtsAdjustment,
      awayPtsAdjustment,
      totalAdjustment
    },
    factors
  }
}

// ============================================================================
// QUARTER TRENDS ANALYSIS (Placeholder for future implementation)
// ============================================================================

// ============================================================================
// QUARTER TRENDS ANALYSIS
// ============================================================================

// In-memory cache for quarter averages
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class QuarterTrendsCache {
  private cache = new Map<string, CacheEntry<any>>()

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  set<T>(key: string, data: T, ttl: number = 600000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  static teamAveragesKey(teamName: string): string {
    return `quarter_avg:${teamName.toLowerCase().replace(/\s+/g, '')}`
  }
}

const quarterCache = new QuarterTrendsCache()

interface QuarterAverage {
  quarter: number
  avgPoints: number
  gamesCount: number
}

export interface TeamQuarterTrend {
  currentQuarter: number
  currentQuarterScore: number
  avgQuarterScore: number
  deviation: number
  trend: 'hot' | 'cold' | 'normal'
}

export interface QuarterTrendsAnalysis {
  homeTeam: TeamQuarterTrend
  awayTeam: TeamQuarterTrend
}

/**
 * Fetch team quarter averages from database
 */
async function fetchTeamQuarterAverages(
  teamName: string,
  sportKey: string = 'basketball_nba'
): Promise<QuarterAverage[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = createClient()

  const { data, error } = await supabase
    .from('team_quarter_averages')
    .select('*')
    .eq('sport_key', sportKey)
    .ilike('team', `%${teamName}%`)
    .order('period_number', { ascending: true })

  if (error || !data || data.length === 0) {
    return []
  }

  return data.map((row: any) => ({
    quarter: row.period_number,
    avgPoints: parseFloat(row.avg_points || '0'),
    gamesCount: row.games_count || 0,
  }))
}

/**
 * Get team quarter averages with fallback
 */
async function getTeamQuarterAveragesWithFallback(
  teamName: string
): Promise<QuarterAverage[]> {
  // 1. Try cache
  const cacheKey = QuarterTrendsCache.teamAveragesKey(teamName)
  const cached = quarterCache.get<QuarterAverage[]>(cacheKey)
  if (cached) return cached

  // 2. Try database
  try {
    const averages = await fetchTeamQuarterAverages(teamName)
    if (averages.length > 0) {
      quarterCache.set(cacheKey, averages, 600000) // 10 min TTL
      return averages
    }
  } catch (error) {
    console.warn(`[Quarter Trends] Database fetch failed for ${teamName}:`, error)
  }

  // 3. Fallback to league averages
  console.log(`[Quarter Trends] Using league averages for ${teamName}`)
  const leagueAverages = [
    { quarter: 1, avgPoints: 26, gamesCount: 0 },
    { quarter: 2, avgPoints: 27, gamesCount: 0 },
    { quarter: 3, avgPoints: 25, gamesCount: 0 },
    { quarter: 4, avgPoints: 27, gamesCount: 0 },
  ]

  quarterCache.set(cacheKey, leagueAverages, 60000) // 1 min TTL for fallback
  return leagueAverages
}

/**
 * Calculate trend classification
 */
function classifyTrend(deviation: number): 'hot' | 'cold' | 'normal' {
  if (deviation > 3) return 'hot'
  if (deviation < -3) return 'cold'
  return 'normal'
}

/**
 * Analyze quarter trends for both teams
 */
export async function analyzeQuarterTrends(
  currentPeriod: number,
  homeTeamName: string,
  awayTeamName: string,
  homeLinescore: any[],
  awayLinescore: any[],
  league: string
): Promise<QuarterTrendsAnalysis> {
  if (league === 'ncaab') {
    const currentHalf = Math.min(currentPeriod, 2)
    const homeCurrentScore =
      homeLinescore && homeLinescore[currentPeriod - 1]
        ? parseInt(homeLinescore[currentPeriod - 1].displayValue || '0', 10)
        : 0
    const awayCurrentScore =
      awayLinescore && awayLinescore[currentPeriod - 1]
        ? parseInt(awayLinescore[currentPeriod - 1].displayValue || '0', 10)
        : 0
    const avgHalfScore = 35

    return {
      homeTeam: {
        currentQuarter: currentHalf,
        currentQuarterScore: homeCurrentScore,
        avgQuarterScore: avgHalfScore,
        deviation: homeCurrentScore - avgHalfScore,
        trend: classifyTrend(homeCurrentScore - avgHalfScore),
      },
      awayTeam: {
        currentQuarter: currentHalf,
        currentQuarterScore: awayCurrentScore,
        avgQuarterScore: avgHalfScore,
        deviation: awayCurrentScore - avgHalfScore,
        trend: classifyTrend(awayCurrentScore - avgHalfScore),
      },
    }
  }

  // Get historical averages for both teams
  const homeAverages = await getTeamQuarterAveragesWithFallback(homeTeamName)
  const awayAverages = await getTeamQuarterAveragesWithFallback(awayTeamName)

  // Get current quarter score from linescore
  const currentQuarter = Math.min(currentPeriod, 4) // Cap at Q4 for trend analysis
  const homeCurrentScore =
    homeLinescore && homeLinescore[currentPeriod - 1]
      ? parseInt(homeLinescore[currentPeriod - 1].displayValue || '0', 10)
      : 0
  const awayCurrentScore =
    awayLinescore && awayLinescore[currentPeriod - 1]
      ? parseInt(awayLinescore[currentPeriod - 1].displayValue || '0', 10)
      : 0

  // Find average for current quarter
  const homeAvg = homeAverages.find((a) => a.quarter === currentQuarter)
  const awayAvg = awayAverages.find((a) => a.quarter === currentQuarter)

  // Calculate deviations and trends
  const homeDeviation = homeCurrentScore - (homeAvg?.avgPoints || 26)
  const awayDeviation = awayCurrentScore - (awayAvg?.avgPoints || 26)

  return {
    homeTeam: {
      currentQuarter,
      currentQuarterScore: homeCurrentScore,
      avgQuarterScore: homeAvg?.avgPoints || 26,
      deviation: homeDeviation,
      trend: classifyTrend(homeDeviation),
    },
    awayTeam: {
      currentQuarter,
      currentQuarterScore: awayCurrentScore,
      avgQuarterScore: awayAvg?.avgPoints || 26,
      deviation: awayDeviation,
      trend: classifyTrend(awayDeviation),
    },
  }
}

// ============================================================================
// PRE-GAME EDGE ANALYSIS
// ============================================================================

// Cache for pre-game edge context (per event)
const pregameEdgeCache = new Map<string, { data: PregameEdgeContext; timestamp: number }>()
const PREGAME_EDGE_CACHE_TTL = 600000 // 10 minutes

/**
 * Assess which pre-game edges are currently relevant based on game period
 *
 * Edge relevance by quarter:
 * - Rest/B2B: Peak in Q3-Q4 (fatigue compounds)
 * - Depth: Peak in Q4/OT (bench minutes matter more)
 * - Travel: Peak in Q1-Q2 (early lag, fades later)
 */
export async function analyzePregameEdges(
  homeTeamName: string,
  awayTeamName: string,
  currentPeriod: number,
  eventId: string,
  league: string
): Promise<PregameEdgeContext> {
  if (league !== 'nba') {
    return {
      restAdvantage: { home: 0, away: 0 },
      injuryImpact: { home: 0, away: 0 },
      depthAdvantage: 'neutral',
      relevantEdges: [],
      totalLineImpact: 0,
    }
  }

  // Check cache first
  const cached = pregameEdgeCache.get(eventId)
  if (cached && Date.now() - cached.timestamp < PREGAME_EDGE_CACHE_TTL) {
    // Update relevance based on current period
    return updateEdgeRelevance(cached.data, currentPeriod)
  }

  // Fetch rest factors for both teams
  const homeRest = await getRestFactors(homeTeamName)
  const awayRest = await getRestFactors(awayTeamName)

  const relevantEdges: PregameEdgeRelevance[] = []
  let totalLineImpact = 0

  // Calculate rest advantage
  const restAdvantage = { home: 0, away: 0 }

  if (homeRest && awayRest) {
    // Back-to-back penalty: ~2-3 points
    if (homeRest.isBackToBack && !awayRest.isBackToBack) {
      restAdvantage.away = 2.5
      relevantEdges.push({
        edge: 'Back-to-back fatigue',
        team: 'away',
        applicableQuarters: [3, 4],
        currentRelevance: currentPeriod >= 3 ? 'high' : 'low',
        explanation: `${homeTeamName} on B2B - fatigue compounds in Q3-Q4`,
        lineImpact: 2.5,
      })
    } else if (awayRest.isBackToBack && !homeRest.isBackToBack) {
      restAdvantage.home = 2.5
      relevantEdges.push({
        edge: 'Back-to-back fatigue',
        team: 'home',
        applicableQuarters: [3, 4],
        currentRelevance: currentPeriod >= 3 ? 'high' : 'low',
        explanation: `${awayTeamName} on B2B - fatigue compounds in Q3-Q4`,
        lineImpact: 2.5,
      })
    }

    // Rest differential: ~0.5 pts per day difference
    const restDiff = (homeRest.daysRest || 0) - (awayRest.daysRest || 0)
    if (Math.abs(restDiff) >= 2) {
      const advantageTeam = restDiff > 0 ? 'home' : 'away'
      const disadvantageTeam = restDiff > 0 ? awayTeamName : homeTeamName
      const impact = Math.min(Math.abs(restDiff) * 0.5, 2.0)

      if (advantageTeam === 'home') {
        restAdvantage.home += impact
      } else {
        restAdvantage.away += impact
      }

      relevantEdges.push({
        edge: 'Rest advantage',
        team: advantageTeam,
        applicableQuarters: [3, 4],
        currentRelevance: currentPeriod >= 3 ? 'medium' : 'low',
        explanation: `${disadvantageTeam} on ${restDiff > 0 ? awayRest.daysRest : homeRest.daysRest} days rest vs ${restDiff > 0 ? homeRest.daysRest : awayRest.daysRest}`,
        lineImpact: impact,
      })
    }

    // Heavy schedule: games in last 5 days
    if ((homeRest.gamesInLast5Days || 0) >= 4 && (awayRest.gamesInLast5Days || 0) < 3) {
      relevantEdges.push({
        edge: 'Schedule fatigue',
        team: 'away',
        applicableQuarters: [4],
        currentRelevance: currentPeriod >= 4 ? 'high' : 'low',
        explanation: `${homeTeamName} played ${homeRest.gamesInLast5Days} games in 5 days - legs heavy in Q4`,
        lineImpact: 1.5,
      })
      restAdvantage.away += 1.5
    } else if ((awayRest.gamesInLast5Days || 0) >= 4 && (homeRest.gamesInLast5Days || 0) < 3) {
      relevantEdges.push({
        edge: 'Schedule fatigue',
        team: 'home',
        applicableQuarters: [4],
        currentRelevance: currentPeriod >= 4 ? 'high' : 'low',
        explanation: `${awayTeamName} played ${awayRest.gamesInLast5Days} games in 5 days - legs heavy in Q4`,
        lineImpact: 1.5,
      })
      restAdvantage.home += 1.5
    }
  }

  // Calculate total line impact (only for currently relevant edges)
  for (const edge of relevantEdges) {
    if (edge.currentRelevance === 'high') {
      totalLineImpact += edge.team === 'home' ? edge.lineImpact : -edge.lineImpact
    } else if (edge.currentRelevance === 'medium') {
      totalLineImpact += (edge.team === 'home' ? edge.lineImpact : -edge.lineImpact) * 0.5
    }
  }

  // Determine depth advantage (placeholder - would need roster analysis)
  const depthAdvantage: 'home' | 'away' | 'neutral' = 'neutral'

  const result: PregameEdgeContext = {
    restAdvantage,
    injuryImpact: { home: 0, away: 0 }, // Would come from injury-detector
    depthAdvantage,
    relevantEdges,
    totalLineImpact,
  }

  // Cache the result
  pregameEdgeCache.set(eventId, { data: result, timestamp: Date.now() })

  return result
}

/**
 * Update edge relevance based on current period
 */
function updateEdgeRelevance(
  context: PregameEdgeContext,
  currentPeriod: number
): PregameEdgeContext {
  const updatedEdges = context.relevantEdges.map(edge => {
    let relevance: 'high' | 'medium' | 'low' = 'low'

    if (edge.applicableQuarters.includes(currentPeriod)) {
      relevance = 'high'
    } else if (edge.applicableQuarters.some(q => q === currentPeriod + 1)) {
      relevance = 'medium'
    }

    return { ...edge, currentRelevance: relevance }
  })

  // Recalculate total impact
  let totalLineImpact = 0
  for (const edge of updatedEdges) {
    if (edge.currentRelevance === 'high') {
      totalLineImpact += edge.team === 'home' ? edge.lineImpact : -edge.lineImpact
    } else if (edge.currentRelevance === 'medium') {
      totalLineImpact += (edge.team === 'home' ? edge.lineImpact : -edge.lineImpact) * 0.5
    }
  }

  return {
    ...context,
    relevantEdges: updatedEdges,
    totalLineImpact,
  }
}

