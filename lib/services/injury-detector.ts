/**
 * Injury Detection and Impact Calculation Service
 * Automatically detects injured players and calculates their impact on team performance
 * Uses ESPN's live injury API
 */

import { fetchInjuries, type EspnInjuryTeam } from '@/lib/providers/espn-nba'
import { getPlayerStats, getTeamAbbrev } from './matchup-analyzer'
import type { PlayerStats, TeamStats } from './pregame-value-calculator'

export interface InjuryImpact {
  playerName: string
  status: string // "Out", "Doubtful", "Questionable"
  stats: {
    ppg: number
    usage: number
    mpg: number
    bpm: number
    vorp: number
  }
  impact: {
    ortgDrop: number
    drtgIncrease: number // Positive = defense worsens
    paceDrop: number
  }
  explanation: string
}

export interface TeamInjuryReport {
  team: string
  injuries: InjuryImpact[]
  totalImpact: {
    ortgDrop: number
    drtgIncrease: number
    paceDrop: number
  }
  summary: string
}

/**
 * Calculate the impact of a single injured player
 * Uses BPM (Box Plus/Minus) and VORP for accuracy
 */
export function calculatePlayerImpact(
  playerStats: PlayerStats,
  teamStats: TeamStats
): InjuryImpact['impact'] {
  const mpg = playerStats.minutesPerGame
  const usage = playerStats.usage
  const bpm = playerStats.bpm || 0
  const obpm = playerStats.obpm || 0
  const dbpm = playerStats.dbpm || 0
  const vorp = playerStats.vorp || 0

  // Offensive Rating Impact
  // Formula: (OBPM * 0.5 + VORP * 2) * (mpg / 36) scaled by team context
  const rawOrtgImpact = (obpm * 0.5 + vorp * 2) * (mpg / 36)
  const ortgDrop = rawOrtgImpact * (teamStats.ortg / 115.0)

  // Defensive Rating Impact
  // Positive DBPM helps defense; when player is out, defense worsens (DRtg increases)
  const rawDrtgImpact = dbpm * (mpg / 36)
  const drtgIncrease = -rawDrtgImpact * (teamStats.drtg / 115.0)

  // Pace Impact
  // High-usage players often slow the pace slightly
  const paceDrop = (usage / 100) * (mpg / 48) * -0.5

  return {
    ortgDrop: Math.max(0, ortgDrop), // Can't be negative
    drtgIncrease, // Can be positive or negative
    paceDrop,
  }
}

/**
 * Format injury impact into user-friendly explanation
 */
export function formatInjuryExplanation(impact: InjuryImpact): string {
  const { playerName, stats, impact: impactValues } = impact

  // Use PPG and usage for user-friendly explanation
  return `${playerName} (${impact.status}): ${stats.ppg.toFixed(1)} PPG, ${stats.usage.toFixed(1)}% usage → ${impactValues.ortgDrop > 0.5 ? `-${impactValues.ortgDrop.toFixed(1)} ORtg` : 'minor impact'}`
}

/**
 * Detect injuries for a team and calculate their cumulative impact
 * Fetches live injury data from ESPN API
 */
export async function detectInjuries(
  teamName: string,
  sport: string = 'basketball_nba'
): Promise<TeamInjuryReport | null> {
  try {
    // Fetch all injuries from ESPN
    const espnTeams = await fetchInjuries()

    if (!espnTeams || espnTeams.length === 0) {
      console.log('[INJURY DETECTOR] No injury data available from ESPN')
      return null
    }

    // Find the team by name matching
    const teamAbbrev = getTeamAbbrev(teamName)
    const normalizedTeamName = teamName.toLowerCase()

    const teamData = espnTeams.find((t) => {
      const espnTeamName = (t.displayName || '').toLowerCase()
      return (
        espnTeamName.includes(normalizedTeamName) ||
        normalizedTeamName.includes(espnTeamName) ||
        (teamAbbrev && espnTeamName.includes(teamAbbrev.toLowerCase()))
      )
    })

    if (!teamData || !teamData.injuries || teamData.injuries.length === 0) {
      return null
    }

    // Filter for definite absences (Out, Doubtful)
    const significantInjuries = teamData.injuries.filter((injury) => {
      const status = injury.status?.toLowerCase() || ''
      return status === 'out' || status === 'doubtful'
    })

    if (significantInjuries.length === 0) {
      return null
    }

    const impacts: InjuryImpact[] = []

    // Get base team stats for context (we'll need this for calculations)
    // Note: We can't import getTeamStats here due to circular dependency
    // So we'll use a simplified approach
    const baseTeamStats: TeamStats = {
      ortg: 115.0, // league average as fallback
      drtg: 115.0,
      pace: 100.0,
      eFG: 0.54,
      ts: 0.57,
    }

    // For each injured player, calculate impact
    for (const injury of significantInjuries) {
      const playerName = injury.athlete?.displayName
      if (!playerName) continue

      const playerStats = getPlayerStats(playerName, 'points')

      if (!playerStats) {
        console.warn(`[INJURY DETECTOR] Player not found in stats: ${playerName}`)
        continue
      }

      // Skip players with minimal minutes (< 10 MPG)
      if (playerStats.minutesPerGame < 10) {
        continue
      }

      const impactCalc = calculatePlayerImpact(playerStats, baseTeamStats)

      impacts.push({
        playerName,
        status: injury.status || 'Out',
        stats: {
          ppg: playerStats.seasonAverage,
          usage: playerStats.usage,
          mpg: playerStats.minutesPerGame,
          bpm: playerStats.bpm || 0,
          vorp: playerStats.vorp || 0,
        },
        impact: impactCalc,
        explanation: '', // Will be filled below
      })
    }

    // Fill in explanations
    for (const impact of impacts) {
      impact.explanation = formatInjuryExplanation(impact)
    }

    if (impacts.length === 0) {
      return null
    }

    // Calculate total impact with diminishing returns (root sum of squares)
    const totalOrtgDrop = Math.sqrt(
      impacts.reduce((sum, i) => sum + Math.pow(i.impact.ortgDrop, 2), 0)
    )

    const totalDrtgIncrease = Math.sqrt(
      impacts.reduce((sum, i) => sum + Math.pow(Math.abs(i.impact.drtgIncrease), 2), 0)
    ) * (impacts.some(i => i.impact.drtgIncrease > 0) ? 1 : -1)

    const totalPaceDrop = impacts.reduce((sum, i) => sum + i.impact.paceDrop, 0)

    const summary = `${impacts.length} key ${impacts.length === 1 ? 'player' : 'players'} out`

    console.log(`[INJURY DETECTOR] ${teamName}: ${summary}`, {
      totalOrtgDrop: totalOrtgDrop.toFixed(1),
      totalDrtgIncrease: totalDrtgIncrease.toFixed(1),
      players: impacts.map(i => i.playerName),
    })

    return {
      team: teamName,
      injuries: impacts,
      totalImpact: {
        ortgDrop: totalOrtgDrop,
        drtgIncrease: totalDrtgIncrease,
        paceDrop: totalPaceDrop,
      },
      summary,
    }
  } catch (error) {
    console.error('[INJURY DETECTOR] Error detecting injuries:', error)
    return null // Fail gracefully
  }
}
