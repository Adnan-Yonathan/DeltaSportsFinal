/**
 * Live Game State Analyzer
 * Extracts momentum factors from live game data for betting recommendations
 * Analyzes: scoring runs, pace changes, foul trouble, comeback probability, quarter trends
 */

import type { LiveScoreGameDetails, PlayByPlayEntry, GameDetailsTeam } from '@/lib/live-scores'
import { getTeamStats, getPlayerStats } from './matchup-analyzer'
import { analyzeFatigue, type FatigueAnalysis } from './fatigue-analyzer'
import { analyzeTimeoutImpact, type TimeoutImpactAnalysis } from './timeout-analyzer'

// ============================================================================
// INTERFACES
// ============================================================================

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
    fatigue: FatigueAnalysis
    timeoutImpact: TimeoutImpactAnalysis
  }
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
  } | null
}

export interface PaceAnalysis {
  currentPace: number // Possessions per 48 min at current rate
  seasonPace: number // Team's season average
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
  const clockState = calculateClockState(homeTeam, awayTeam, liveGame.league)

  // Extract current clock from status text (format: "5:24 - 2nd Quarter")
  const currentClock = extractClockFromStatus(liveGame.statusText || '')

  // Analyze all momentum factors
  const scoringRun = analyzeScoringRun(
    liveGame.plays || [],
    clockState.elapsedSeconds,
    clockState.periodIndex,
    currentClock
  )
  const paceChange = await analyzePaceChange(liveGame, clockState)
  const foulTrouble = analyzeFoulTrouble(liveGame)
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
    awayTeam.linescore
  )
  const garbageTime = detectGarbageTime(
    homeScore,
    awayScore,
    clockState.remainingSeconds,
    clockState.periodIndex
  )
  const recentFouls = countRecentFouls(liveGame.plays || [], 2)
  const foulingStrategy = detectFoulingStrategy(
    homeScore,
    awayScore,
    clockState.remainingSeconds,
    clockState.periodIndex,
    recentFouls
  )
  const threePointVariance = await analyzeThreePointVariance(
    liveGame,
    clockState.remainingSeconds
  )
  const fatigue = analyzeFatigue(liveGame, clockState.periodIndex)
  const timeoutImpact = analyzeTimeoutImpact(
    liveGame,
    homeTeam.name || 'Home',
    awayTeam.name || 'Away'
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
    displayClock: liveGame.statusText || '',
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
      fatigue,
      timeoutImpact,
    },
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

// Helper function to calculate clock state from linescore
function calculateClockState(homeTeam: GameDetailsTeam, awayTeam: GameDetailsTeam, league: string) {
  // For NBA: 4 quarters x 12 minutes = 48 minutes = 2880 seconds
  const QUARTER_MINUTES: Record<string, number> = {
    nba: 12,
    nfl: 15,
    nhl: 20,
    ncaab: 20, // 2 halves
  }

  const PERIODS: Record<string, number> = {
    nba: 4,
    nfl: 4,
    nhl: 3,
    ncaab: 2,
  }

  const quarterMinutes = QUARTER_MINUTES[league] || 12
  const totalPeriods = PERIODS[league] || 4
  const quarterSeconds = quarterMinutes * 60
  const totalSeconds = totalPeriods * quarterSeconds

  // Count completed quarters from linescore
  const completedQuarters = homeTeam.linescore.length
  const elapsedSeconds = Math.min(completedQuarters * quarterSeconds, totalSeconds)
  const remainingSeconds = Math.max(totalSeconds - elapsedSeconds, 0)

  return {
    elapsedSeconds,
    remainingSeconds,
    totalSeconds,
    periodIndex: completedQuarters,
  }
}

// ============================================================================
// SCORING RUN ANALYSIS
// ============================================================================

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

    currentRunResult = {
      team: currentRun.team,
      points: currentRun.points,
      duration: `${minutes}:${seconds.toString().padStart(2, '0')}`,
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
    return {
      currentPace: 100,
      seasonPace: 100,
      deviation: 0,
      impactOnTotal: 0,
    }
  }

  // Get season pace from team stats
  const homeStats = await getTeamStats(homeTeam.name || '')
  const awayStats = await getTeamStats(awayTeam.name || '')

  const seasonPace = homeStats && awayStats ? (homeStats.pace + awayStats.pace) / 2 : 100

  // Calculate current pace from box score
  // Possessions = FGA + 0.44 * FTA + TOV - ORB
  const homeStats_box = homeTeam.statistics || []
  const awayStats_box = awayTeam.statistics || []

  const getStatValue = (stats: any[], name: string): number => {
    const stat = stats.find((s) => s.label === name || s.label?.toLowerCase().includes(name.toLowerCase()))
    return parseFloat(stat?.value || '0')
  }

  const homeFGA = getStatValue(homeStats_box, 'fieldGoalsAttempted')
  const homeFTA = getStatValue(homeStats_box, 'freeThrowsAttempted')
  const homeTOV = getStatValue(homeStats_box, 'turnovers')
  const homeORB = getStatValue(homeStats_box, 'offensiveRebounds')

  const awayFGA = getStatValue(awayStats_box, 'fieldGoalsAttempted')
  const awayFTA = getStatValue(awayStats_box, 'freeThrowsAttempted')
  const awayTOV = getStatValue(awayStats_box, 'turnovers')
  const awayORB = getStatValue(awayStats_box, 'offensiveRebounds')

  const homePossessions = homeFGA + 0.44 * homeFTA + homeTOV - homeORB
  const awayPossessions = awayFGA + 0.44 * awayFTA + awayTOV - awayORB

  const totalPossessions = (homePossessions + awayPossessions) / 2

  // Convert to pace (possessions per 48 minutes)
  const elapsedMinutes = clockState.elapsedSeconds / 60
  const currentPace = elapsedMinutes > 0 ? (totalPossessions / elapsedMinutes) * 48 : seasonPace

  const deviation = currentPace - seasonPace

  // Estimate impact on final total
  // If pace is 5% faster, final total will be ~5% higher
  const paceMultiplier = currentPace / seasonPace
  const expectedBaseline = 110 // Rough NBA average total score
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

export function analyzeFoulTrouble(liveGame: LiveScoreGameDetails): FoulTroubleAnalysis {
  const homeTeam = liveGame.teams.find((t) => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find((t) => t.homeAway === 'away')

  const analyzePlayers = (team: GameDetailsTeam | undefined) => {
    const players: any[] = []

    if (!team) return players

    // Check both starters and bench players for foul trouble (4+ fouls)
    const allPlayers = [...team.starters, ...team.bench]

    for (const player of allPlayers) {
      // Get fouls from statMap if available
      const fouls = parseInt(player.statMap?.PF || player.statMap?.fouls || '0', 10)

      if (fouls >= 4) {
        // Get player impact from BPM data
        const playerStats = getPlayerStats(player.name || '', 'points')

        const isStarter = team.starters.some((s) => s.id === player.id)
        const bpm = playerStats?.bpm || 0

        // High BPM players have more impact when in foul trouble
        const impactOnSpread = isStarter && bpm > 3 ? -2.5 : bpm > 0 ? -1.5 : -0.5

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

  const homePlayers = analyzePlayers(homeTeam)
  const awayPlayers = analyzePlayers(awayTeam)

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
  period: number
): GarbageTimeAnalysis {
  const margin = Math.abs(homeScore - awayScore)
  const minutesRemaining = timeRemaining / 60

  // Garbage time thresholds by time remaining
  const thresholds: Array<{ minMinutes: number; maxMinutes: number; margin: number }> = [
    { minMinutes: 0, maxMinutes: 3, margin: 15 },   // Last 3 min: 15+ point lead
    { minMinutes: 3, maxMinutes: 6, margin: 20 },   // 3-6 min: 20+ point lead
    { minMinutes: 6, maxMinutes: 9, margin: 25 },   // 6-9 min: 25+ point lead
    { minMinutes: 9, maxMinutes: 12, margin: 30 },  // Full Q4: 30+ point lead
  ]

  // Only check Q4 and overtime
  if (period < 4) {
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

/**
 * Detect if trailing team is in "must foul" mode
 */
export function detectFoulingStrategy(
  homeScore: number,
  awayScore: number,
  timeRemaining: number, // seconds
  period: number,
  recentFouls: number // Fouls in last 2 minutes (from play-by-play)
): FoulingStrategyAnalysis {
  const margin = Math.abs(homeScore - awayScore)
  const minutesRemaining = timeRemaining / 60
  const secondsRemaining = timeRemaining

  // Not in fouling time yet
  if (period < 4 || minutesRemaining > 3) {
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

  // Calculate impact on pace and total
  // Each foul = 2 FT + change of possession
  // Expected: ~5-8 fouls per minute in fouling situations
  const expectedFoulsPerMin = 6
  const expectedFouls = expectedFoulsPerMin * minutesRemaining

  // Impact on possessions: each foul = 1 extra possession
  const impactOnPace = expectedFouls * 10 // Scaled to per-48 pace

  // Impact on total:
  // - Leading team: 75% FT shooting, 1.5 pts per foul
  // - Trailing team: Gets ball back, ~50% conversion on quick shots
  const leadingTeamPoints = expectedFouls * 1.5
  const trailingTeamPoints = expectedFouls * 0.5
  const impactOnTotal = leadingTeamPoints + trailingTeamPoints

  factors.push(`⚠️ INTENTIONAL FOULING DETECTED: ${reason}`)
  factors.push(`Expected ${expectedFouls.toFixed(0)} fouls in final ${minutesRemaining.toFixed(1)} minutes`)
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

/**
 * Analyze three-point shooting variance and expected regression
 */
export async function analyzeThreePointVariance(
  liveGame: LiveScoreGameDetails,
  timeRemaining: number
): Promise<ThreePointVarianceAnalysis> {
  const homeTeam = liveGame.teams.find(t => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find(t => t.homeAway === 'away')

  const getStatValue = (team: GameDetailsTeam | undefined, statName: string): number => {
    if (!team) return 0
    const stat = team.statistics?.find(s =>
      s.label?.toLowerCase().includes(statName.toLowerCase())
    )
    return parseFloat(stat?.value || '0')
  }

  // Get current 3PT stats from box score
  const home3PM = getStatValue(homeTeam, 'threepointfieldgoalsmade')
  const home3PA = getStatValue(homeTeam, 'threepointfieldgoalsattempted')
  const away3PM = getStatValue(awayTeam, 'threepointfieldgoalsmade')
  const away3PA = getStatValue(awayTeam, 'threepointfieldgoalsattempted')

  const homeCurrent3Pct = home3PA > 0 ? home3PM / home3PA : 0
  const awayCurrent3Pct = away3PA > 0 ? away3PM / away3PA : 0

  // Get season 3PT% from team stats
  const homeStats = await getTeamStats(homeTeam?.name || '')
  const awayStats = await getTeamStats(awayTeam?.name || '')

  const homeSeason3Pct = homeStats?.three_point_pct || 0.355 // League avg
  const awaySeason3Pct = awayStats?.three_point_pct || 0.355

  const homeDeviation = homeCurrent3Pct - homeSeason3Pct
  const awayDeviation = awayCurrent3Pct - awaySeason3Pct

  // Outlier = >10% above/below season average with 10+ attempts
  const homeIsOutlier = Math.abs(homeDeviation) > 0.10 && home3PA >= 10
  const awayIsOutlier = Math.abs(awayDeviation) > 0.10 && away3PA >= 10

  const factors: string[] = []

  // Calculate expected regression
  // Assume team will shoot season average for remaining time
  const minutesRemaining = timeRemaining / 60
  const avgAttemptsPerMinute = 0.8 // ~38 3PA per game / 48 min
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
  awayLinescore: any[]
): Promise<QuarterTrendsAnalysis> {
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
