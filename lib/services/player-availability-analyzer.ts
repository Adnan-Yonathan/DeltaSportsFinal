/**
 * Player Availability Analyzer
 * Detects ejections, unexpected DNP, reduced minutes, and fouled out players
 * Calculates impact on spread based on player impact score
 */

import type { PlayByPlayEntry, LiveScoreGameDetails, GameDetailsTeam } from '@/lib/live-scores'
import { getPlayerStats } from './matchup-analyzer'
import { getPlayerImpactScore } from './player-impact'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PlayerAvailabilityIssue {
  playerName: string
  team: 'home' | 'away'
  issueType: 'ejection' | 'unexpected_dnp' | 'reduced_minutes' | 'fouled_out'
  severity: 'critical' | 'moderate' | 'minor'
  minutesPlayed: number
  expectedMinutes: number
  impactOnSpread: number
  reason: string
}

export interface PlayerAvailabilityAnalysis {
  homeIssues: PlayerAvailabilityIssue[]
  awayIssues: PlayerAvailabilityIssue[]
  lineAdjustment: number
  factors: string[]
}

// ============================================================================
// EJECTION DETECTION
// ============================================================================

// Patterns to detect ejections in play-by-play
const EJECTION_PATTERNS = [
  /ejected/i,
  /flagrant\s*2/i,
  /flagrant\s*foul\s*type\s*2/i,
  /second\s+technical/i,
  /2nd\s+technical/i,
]

/**
 * Check if a play indicates an ejection
 */
function isEjectionPlay(playText: string): boolean {
  return EJECTION_PATTERNS.some(pattern => pattern.test(playText))
}

/**
 * Extract player name from ejection play text
 */
function extractPlayerFromEjection(playText: string): string | null {
  // Common patterns:
  // "J. Smith ejected"
  // "John Smith has been ejected"
  // "Flagrant 2 foul on J. Smith"

  const patterns = [
    /(\w+\.?\s+\w+)\s+ejected/i,
    /(\w+\.?\s+\w+)\s+has been ejected/i,
    /flagrant\s*2.*?on\s+(\w+\.?\s+\w+)/i,
    /second\s+technical.*?(\w+\.?\s+\w+)/i,
  ]

  for (const pattern of patterns) {
    const match = playText.match(pattern)
    if (match) return match[1]
  }

  return null
}

/**
 * Detect ejections from play-by-play
 */
export function detectEjections(
  plays: PlayByPlayEntry[],
  homeTeamId: string,
  awayTeamId: string
): Array<{ playerName: string; team: 'home' | 'away' }> {
  const ejections: Array<{ playerName: string; team: 'home' | 'away' }> = []

  for (const play of plays) {
    if (!isEjectionPlay(play.text)) continue

    const playerName = extractPlayerFromEjection(play.text)
    if (!playerName) continue

    // Determine team from play data
    let team: 'home' | 'away' | null = null
    if (play.teamId === homeTeamId) team = 'home'
    else if (play.teamId === awayTeamId) team = 'away'

    if (team) {
      ejections.push({ playerName, team })
    }
  }

  return ejections
}

// ============================================================================
// MINUTES ANALYSIS
// ============================================================================

/**
 * Calculate expected minutes for a player at current game time
 */
function getExpectedMinutesByPeriod(
  typicalMPG: number,
  currentPeriod: number,
  quarterMinutesElapsed: number
): number {
  // Distribute typical MPG across 4 quarters
  // Starters typically play more in Q1 and Q4
  const quarterDistribution = [0.27, 0.23, 0.23, 0.27] // Q1, Q2, Q3, Q4

  let expectedMinutes = 0

  for (let q = 1; q < currentPeriod; q++) {
    expectedMinutes += typicalMPG * quarterDistribution[q - 1]
  }

  // Add partial current quarter
  if (currentPeriod <= 4) {
    const quarterPct = quarterMinutesElapsed / 12
    expectedMinutes += typicalMPG * quarterDistribution[currentPeriod - 1] * quarterPct
  }

  return expectedMinutes
}

/**
 * Detect players with unexpected minute patterns
 */
async function analyzePlayerMinutes(
  team: GameDetailsTeam | undefined,
  teamSide: 'home' | 'away',
  currentPeriod: number,
  quarterMinutesElapsed: number
): Promise<PlayerAvailabilityIssue[]> {
  const issues: PlayerAvailabilityIssue[] = []

  if (!team) return issues

  const allPlayers = [...team.starters, ...team.bench]

  for (const player of allPlayers) {
    const minutesPlayed = parseFloat(player.statMap?.MIN || '0')
    const playerStats = await getPlayerStats(player.name || '', 'points')

    if (!playerStats) continue

    const typicalMPG = playerStats.minutesPerGame || 0
    const impactScore = getPlayerImpactScore(playerStats)
    const isStarter = team.starters.some(s => s.id === player.id)

    // Skip players who don't play much anyway
    if (typicalMPG < 15) continue

    const expectedMinutes = getExpectedMinutesByPeriod(
      typicalMPG,
      currentPeriod,
      quarterMinutesElapsed
    )

    const minutesDiff = expectedMinutes - minutesPlayed

    // Check for fouled out (6 personal fouls)
    const fouls = parseInt(player.statMap?.PF || '0', 10)
    if (fouls >= 6) {
      const severity =
        impactScore > 2.5 ? 'critical' : impactScore > 0.5 ? 'moderate' : 'minor'
      const impactOnSpread =
        impactScore > 2.5 ? -3.0 : impactScore > 0.5 ? -1.5 : -0.5

      issues.push({
        playerName: player.name || 'Unknown',
        team: teamSide,
        issueType: 'fouled_out',
        severity,
        minutesPlayed,
        expectedMinutes,
        impactOnSpread,
        reason: `Fouled out with 6 fouls after ${minutesPlayed.toFixed(0)} minutes`,
      })
      continue
    }

    // Check for reduced minutes (playing significantly less than expected)
    // Only flag if difference is significant (>5 minutes behind)
    if (minutesDiff > 5 && isStarter && currentPeriod >= 2) {
      const severity =
        impactScore > 2.5 ? 'critical' : impactScore > 0.5 ? 'moderate' : 'minor'
      const impactOnSpread =
        (impactScore > 2.5 ? -2.0 : impactScore > 0.5 ? -1.0 : -0.3) *
        (minutesDiff / 10)

      issues.push({
        playerName: player.name || 'Unknown',
        team: teamSide,
        issueType: 'reduced_minutes',
        severity,
        minutesPlayed,
        expectedMinutes,
        impactOnSpread,
        reason: `${minutesPlayed.toFixed(0)} min played vs ${expectedMinutes.toFixed(0)} expected (${minutesDiff.toFixed(0)} behind)`,
      })
    }

    // Check for unexpected DNP (starter with 0 minutes after Q1)
    if (minutesPlayed === 0 && isStarter && currentPeriod >= 2) {
      const severity = impactScore > 2.5 ? 'critical' : 'moderate'
      const impactOnSpread =
        impactScore > 2.5 ? -4.0 : impactScore > 0.5 ? -2.0 : -1.0

      issues.push({
        playerName: player.name || 'Unknown',
        team: teamSide,
        issueType: 'unexpected_dnp',
        severity,
        minutesPlayed: 0,
        expectedMinutes,
        impactOnSpread,
        reason: `Starter with 0 minutes in Q${currentPeriod} - possible injury/illness`,
      })
    }
  }

  return issues
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze player availability for both teams
 */
export async function analyzePlayerAvailability(
  liveGame: LiveScoreGameDetails,
  currentPeriod: number,
  quarterSecondsElapsed: number
): Promise<PlayerAvailabilityAnalysis> {
  const homeTeam = liveGame.teams.find(t => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find(t => t.homeAway === 'away')

  const plays = liveGame.plays || []
  const homeTeamId = homeTeam?.id || ''
  const awayTeamId = awayTeam?.id || ''

  const quarterMinutesElapsed = quarterSecondsElapsed / 60

  // Detect ejections
  const ejections = detectEjections(plays, homeTeamId, awayTeamId)

  // Convert ejections to issues
  const ejectionIssues: PlayerAvailabilityIssue[] = await Promise.all(
    ejections.map(async (ejection) => {
      const playerStats = await getPlayerStats(ejection.playerName, 'points')
      const impactScore = getPlayerImpactScore(playerStats)
      const severity =
        impactScore > 2.5 ? 'critical' : impactScore > 0.5 ? 'moderate' : 'minor'
      const impactOnSpread =
        impactScore > 2.5 ? -4.0 : impactScore > 0.5 ? -2.0 : -0.5

      return {
        playerName: ejection.playerName,
        team: ejection.team,
        issueType: 'ejection' as const,
        severity,
        minutesPlayed: 0,
        expectedMinutes: 0,
        impactOnSpread,
        reason: 'Ejected from game',
      }
    })
  )

  // Analyze minute patterns
  const [homeMinuteIssues, awayMinuteIssues] = await Promise.all([
    analyzePlayerMinutes(homeTeam, 'home', currentPeriod, quarterMinutesElapsed),
    analyzePlayerMinutes(awayTeam, 'away', currentPeriod, quarterMinutesElapsed),
  ])

  // Combine all issues
  const homeIssues = [
    ...ejectionIssues.filter(e => e.team === 'home'),
    ...homeMinuteIssues,
  ]
  const awayIssues = [
    ...ejectionIssues.filter(e => e.team === 'away'),
    ...awayMinuteIssues,
  ]

  // Calculate total line adjustment
  const homeAdjustment = homeIssues.reduce((sum, issue) => sum + issue.impactOnSpread, 0)
  const awayAdjustment = awayIssues.reduce((sum, issue) => sum + issue.impactOnSpread, 0)
  const lineAdjustment = awayAdjustment - homeAdjustment // Positive = favor home

  // Generate factors
  const factors: string[] = []

  for (const issue of [...homeIssues, ...awayIssues]) {
    if (issue.severity === 'critical') {
      const emoji = issue.issueType === 'ejection' ? '🚫' :
                    issue.issueType === 'fouled_out' ? '6️⃣' : '⚠️'
      factors.push(`${emoji} ${issue.playerName}: ${issue.reason} (${issue.impactOnSpread > 0 ? '+' : ''}${issue.impactOnSpread.toFixed(1)} pts)`)
    }
  }

  return {
    homeIssues,
    awayIssues,
    lineAdjustment,
    factors,
  }
}
