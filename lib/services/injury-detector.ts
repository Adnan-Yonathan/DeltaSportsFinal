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
 * Determine player tier based on statistical thresholds
 * This is purely stats-based, not name recognition
 */
export type PlayerTier = 'elite' | 'star' | 'starter' | 'role'

export function getPlayerTier(playerStats: PlayerStats): PlayerTier {
  const bpm = playerStats.bpm || 0
  const vorp = playerStats.vorp || 0
  const usage = playerStats.usage || 0
  const mpg = playerStats.minutesPerGame || 0

  // Elite: Top-tier impact players based on advanced stats
  // BPM >= 5 is All-NBA level, VORP >= 3 is MVP-caliber contribution
  if (bpm >= 5 || vorp >= 3 || (usage >= 28 && mpg >= 32 && bpm >= 3)) {
    return 'elite'
  }

  // Star: High-impact starters
  // BPM >= 2 is All-Star level, VORP >= 1.5 is significant contribution
  if (bpm >= 2 || vorp >= 1.5 || (usage >= 25 && mpg >= 28 && bpm >= 1)) {
    return 'star'
  }

  // Starter: Regular rotation player
  if (mpg >= 20 && usage >= 18) {
    return 'starter'
  }

  // Role player: Limited minutes/impact
  return 'role'
}

// Tier-based impact multipliers
const TIER_MULTIPLIERS: Record<PlayerTier, number> = {
  elite: 2.5,    // Elite players have 2.5x impact
  star: 1.8,     // Star players have 1.8x impact
  starter: 1.2,  // Starters have 1.2x impact
  role: 0.8,     // Role players have reduced impact
}

/**
 * Calculate the impact of a single injured player
 * Uses BPM (Box Plus/Minus), VORP, and stat-based tier system
 * Impact is scaled by player's statistical contribution, NOT name recognition
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

  // Get stat-based tier multiplier
  const tier = getPlayerTier(playerStats)
  const tierMultiplier = TIER_MULTIPLIERS[tier]

  // Offensive Rating Impact
  // Increased multipliers: OBPM * 1.2 + VORP * 4 (up from 0.5 and 2)
  // OBPM measures points above average per 100 possessions
  // VORP measures overall value contribution
  const rawOrtgImpact = (obpm * 1.2 + vorp * 4) * (mpg / 36)
  const ortgDrop = rawOrtgImpact * (teamStats.ortg / 115.0) * tierMultiplier

  // Defensive Rating Impact
  // Increased multiplier: DBPM * 1.5 (up from 1.0)
  // Positive DBPM helps defense; when player is out, defense worsens (DRtg increases)
  const rawDrtgImpact = dbpm * 1.5 * (mpg / 36)
  const drtgIncrease = -rawDrtgImpact * (teamStats.drtg / 115.0) * tierMultiplier

  // Usage-based pace impact
  // High-usage players affect pace more when out
  const usageImpact = (usage / 100) * (mpg / 48)
  const paceDrop = usageImpact * -0.8 * tierMultiplier

  return {
    ortgDrop: Math.max(0, ortgDrop), // Can't be negative
    drtgIncrease, // Can be positive or negative
    paceDrop,
  }
}

/**
 * Format injury impact into user-friendly explanation
 */
export function formatInjuryExplanation(impact: InjuryImpact, playerStats?: PlayerStats): string {
  const { playerName, stats, impact: impactValues } = impact
  if (stats.ppg === 0 && stats.usage === 0 && stats.mpg === 0) {
    return `${playerName} (${impact.status}): impact unknown`
  }

  // Get tier if player stats available
  let tierLabel = ''
  if (playerStats) {
    const tier = getPlayerTier(playerStats)
    tierLabel = tier !== 'role' ? ` [${tier.toUpperCase()}]` : ''
  }

  // Calculate total impact for display
  const totalImpact = impactValues.ortgDrop + Math.abs(impactValues.drtgIncrease)
  const impactDesc = totalImpact > 3 ? 'HIGH' : totalImpact > 1.5 ? 'MODERATE' : 'minor'

  // Use PPG, BPM and usage for user-friendly explanation
  return `${playerName}${tierLabel} (${impact.status}): ${stats.ppg.toFixed(1)} PPG, ${stats.bpm.toFixed(1)} BPM → ${impactDesc} impact (-${impactValues.ortgDrop.toFixed(1)} ORtg)`
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
      return (
        status.includes('out') ||
        status.includes('doubt') ||
        status.includes('question') ||
        status.includes('gtd') ||
        status.includes('day-to-day') ||
        status.includes('suspend') ||
        status.includes('inj')
      )
    })

    if (significantInjuries.length === 0) {
      return null
    }

    const impacts: InjuryImpact[] = []
    const playerStatsMap = new Map<string, PlayerStats>() // Store playerStats for tier display
    const missingStatsPlayers: string[] = []

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
        missingStatsPlayers.push(playerName)
        continue
      }

      // Store player stats for later tier display
      playerStatsMap.set(playerName, playerStats)

      if (playerStats.minutesPerGame < 10) {
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
          impact: { ortgDrop: 0, drtgIncrease: 0, paceDrop: 0 },
          explanation: '',
        })
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

    // Fill in explanations with tier information
    for (const impact of impacts) {
      const playerStats = playerStatsMap.get(impact.playerName)
      impact.explanation = formatInjuryExplanation(impact, playerStats)
    }

    if (missingStatsPlayers.length) {
      console.log(`[INJURY DETECTOR] Skipping players without stats for ${teamName}`, {
        players: missingStatsPlayers,
      })
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
