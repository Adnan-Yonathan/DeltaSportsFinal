/**
 * Rotation Analyzer
 * Tracks substitution patterns and detects rotation anomalies
 * Flags when starters are benched early or bench players get extended runs
 */

import type { PlayByPlayEntry, LiveScoreGameDetails, GameDetailsTeam } from '@/lib/live-scores'
import { getPlayerStats } from './matchup-analyzer'
import { getPlayerImpactScore } from './player-impact'

// ============================================================================
// INTERFACES
// ============================================================================

export interface RotationAnomaly {
  playerName: string
  team: 'home' | 'away'
  anomalyType: 'starter_benched_early' | 'bench_extended_run'
  minutesInQuarter: number
  typicalMinutesInQuarter: number
  impactScore: number
  reason: string
}

export interface RotationAnalysis {
  homeAnomalies: RotationAnomaly[]
  awayAnomalies: RotationAnomaly[]
  lineupQualityDelta: number  // +/- based on lineup quality difference
  lineAdjustment: number
  factors: string[]
}

interface SubstitutionEvent {
  period: number
  clock: string
  playerIn: string
  playerOut: string
  teamId?: string
}

// ============================================================================
// SUBSTITUTION PARSING
// ============================================================================

// Patterns to detect substitutions in play-by-play text
const SUB_PATTERNS = [
  /(\w+\.?\s*\w+)\s+substitutes?\s+in\s+for\s+(\w+\.?\s*\w+)/i,
  /(\w+\.?\s*\w+)\s+enters\s+(?:the\s+)?game\s+for\s+(\w+\.?\s*\w+)/i,
  /(\w+\.?\s*\w+)\s+checks?\s+in\s+for\s+(\w+\.?\s*\w+)/i,
  /(\w+\.?\s*\w+)\s+replaces?\s+(\w+\.?\s*\w+)/i,
]

/**
 * Parse substitutions from play-by-play
 */
export function parseSubstitutions(
  plays: PlayByPlayEntry[]
): SubstitutionEvent[] {
  const subs: SubstitutionEvent[] = []

  for (const play of plays) {
    const text = play.text

    for (const pattern of SUB_PATTERNS) {
      const match = text.match(pattern)
      if (match) {
        subs.push({
          period: play.period || 0,
          clock: play.clock || '0:00',
          playerIn: match[1],
          playerOut: match[2],
          teamId: play.teamId,
        })
        break
      }
    }
  }

  return subs
}

/**
 * Parse clock string to seconds
 */
function parseClockToSeconds(clock: string): number {
  const parts = clock.split(':')
  if (parts.length !== 2) return 0
  const minutes = parseInt(parts[0], 10) || 0
  const seconds = parseInt(parts[1], 10) || 0
  return minutes * 60 + seconds
}

/**
 * Calculate minutes played by a player in a specific quarter
 * Based on substitution events
 */
function calculateQuarterMinutes(
  playerName: string,
  period: number,
  subs: SubstitutionEvent[],
  isStarter: boolean
): number {
  const normalizedName = playerName.toLowerCase().replace(/\./g, '')

  // Filter subs for this quarter
  const quarterSubs = subs.filter(s => s.period === period)

  // Track time on court
  let isOnCourt = isStarter
  let totalSeconds = 0
  let lastEventSeconds = 12 * 60 // Start of quarter (12:00)

  // Sort by clock time descending (game clock counts down)
  const sortedSubs = [...quarterSubs].sort((a, b) => {
    return parseClockToSeconds(b.clock) - parseClockToSeconds(a.clock)
  })

  for (const sub of sortedSubs) {
    const eventSeconds = parseClockToSeconds(sub.clock)
    const playerInNorm = sub.playerIn.toLowerCase().replace(/\./g, '')
    const playerOutNorm = sub.playerOut.toLowerCase().replace(/\./g, '')

    // Check if this sub involves our player
    const isSubbedIn = playerInNorm.includes(normalizedName) || normalizedName.includes(playerInNorm)
    const isSubbedOut = playerOutNorm.includes(normalizedName) || normalizedName.includes(playerOutNorm)

    if (isSubbedIn || isSubbedOut) {
      // If player was on court, add time from last event to this event
      if (isOnCourt) {
        totalSeconds += lastEventSeconds - eventSeconds
      }

      // Update on-court status
      isOnCourt = isSubbedIn
      lastEventSeconds = eventSeconds
    }
  }

  // If player is still on court at end of quarter (0:00), add remaining time
  if (isOnCourt) {
    totalSeconds += lastEventSeconds
  }

  return totalSeconds / 60 // Convert to minutes
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

/**
 * Detect rotation anomalies for a team
 */
async function analyzeTeamRotation(
  team: GameDetailsTeam | undefined,
  teamSide: 'home' | 'away',
  currentPeriod: number,
  subs: SubstitutionEvent[],
  homeTeamId: string,
  awayTeamId: string
): Promise<RotationAnomaly[]> {
  const anomalies: RotationAnomaly[] = []

  if (!team || currentPeriod < 1) return anomalies

  const teamId = teamSide === 'home' ? homeTeamId : awayTeamId

  // Filter subs for this team
  const teamSubs = subs.filter(s => s.teamId === teamId)

  // Analyze starters
  for (const starter of team.starters) {
    const playerStats = await getPlayerStats(starter.name || '', 'points')
    const impactScore = getPlayerImpactScore(playerStats)
    const typicalMPG = playerStats?.minutesPerGame || 30

    // Calculate typical minutes per quarter (rough estimate)
    // Starters typically play ~9-10 mins in Q1/Q4, ~7-8 mins in Q2/Q3
    const typicalQuarterMins = currentPeriod === 1 || currentPeriod === 4
      ? typicalMPG / 4.5 // More in Q1/Q4
      : typicalMPG / 5.5 // Less in Q2/Q3

    // Calculate actual minutes in current quarter
    const quarterMinutes = calculateQuarterMinutes(
      starter.name || '',
      currentPeriod,
      teamSubs,
      true // isStarter
    )

    // Check for starter benched early (< 2 mins in quarter when typically plays 6+)
    if (quarterMinutes < 2 && typicalQuarterMins > 5 && impactScore > 0.5) {
      anomalies.push({
        playerName: starter.name || 'Unknown',
        team: teamSide,
        anomalyType: 'starter_benched_early',
        minutesInQuarter: quarterMinutes,
        typicalMinutesInQuarter: typicalQuarterMins,
        impactScore,
        reason: `Only ${quarterMinutes.toFixed(1)} min in Q${currentPeriod} (typically ${typicalQuarterMins.toFixed(1)})`,
      })
    }
  }

  // Analyze bench players for extended runs
  for (const bench of team.bench) {
    const playerStats = await getPlayerStats(bench.name || '', 'points')
    const impactScore = getPlayerImpactScore(playerStats)
    const typicalMPG = playerStats?.minutesPerGame || 15

    // Bench players typically play less per quarter
    const typicalQuarterMins = typicalMPG / 6

    // Calculate actual minutes in current quarter
    const quarterMinutes = calculateQuarterMinutes(
      bench.name || '',
      currentPeriod,
      subs.filter(s => s.teamId === teamId),
      false // not starter
    )

    // Check for extended bench run (> 8 mins in quarter for a bench player)
    if (quarterMinutes > 8 && typicalQuarterMins < 5) {
      anomalies.push({
        playerName: bench.name || 'Unknown',
        team: teamSide,
        anomalyType: 'bench_extended_run',
        minutesInQuarter: quarterMinutes,
        typicalMinutesInQuarter: typicalQuarterMins,
        impactScore,
        reason: `${quarterMinutes.toFixed(1)} min in Q${currentPeriod} (typically ${typicalQuarterMins.toFixed(1)})`,
      })
    }
  }

  return anomalies
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze rotation patterns for both teams
 */
export async function analyzeRotation(
  liveGame: LiveScoreGameDetails,
  currentPeriod: number
): Promise<RotationAnalysis> {
  const homeTeam = liveGame.teams.find(t => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find(t => t.homeAway === 'away')

  const plays = liveGame.plays || []
  const homeTeamId = homeTeam?.id || ''
  const awayTeamId = awayTeam?.id || ''

  // Parse all substitutions
  const subs = parseSubstitutions(plays)

  // Analyze both teams
  const [homeAnomalies, awayAnomalies] = await Promise.all([
    analyzeTeamRotation(homeTeam, 'home', currentPeriod, subs, homeTeamId, awayTeamId),
    analyzeTeamRotation(awayTeam, 'away', currentPeriod, subs, homeTeamId, awayTeamId),
  ])

  // Calculate lineup quality delta
  let homeQualityLoss = 0
  let awayQualityLoss = 0

  for (const anomaly of homeAnomalies) {
    if (anomaly.anomalyType === 'starter_benched_early') {
      homeQualityLoss += anomaly.impactScore * 0.5
    }
  }

  for (const anomaly of awayAnomalies) {
    if (anomaly.anomalyType === 'starter_benched_early') {
      awayQualityLoss += anomaly.impactScore * 0.5
    }
  }

  const lineupQualityDelta = awayQualityLoss - homeQualityLoss

  // Convert to line adjustment (scale down)
  const lineAdjustment = lineupQualityDelta * 0.3

  // Generate factors
  const factors: string[] = []

  for (const anomaly of [...homeAnomalies, ...awayAnomalies]) {
    if (anomaly.anomalyType === 'starter_benched_early' && anomaly.impactScore > 2) {
      factors.push(`📉 ${anomaly.playerName} benched early in Q${currentPeriod} - ${anomaly.reason}`)
    } else if (anomaly.anomalyType === 'bench_extended_run') {
      factors.push(`📈 ${anomaly.playerName} extended run in Q${currentPeriod} - ${anomaly.reason}`)
    }
  }

  return {
    homeAnomalies,
    awayAnomalies,
    lineupQualityDelta,
    lineAdjustment,
    factors,
  }
}
