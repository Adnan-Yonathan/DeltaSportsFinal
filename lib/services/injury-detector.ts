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

// Tier-based impact multipliers (reduced from previous aggressive values)
const TIER_MULTIPLIERS: Record<PlayerTier, number> = {
  elite: 1.5,    // Elite players have 1.5x impact (was 2.5)
  star: 1.2,     // Star players have 1.2x impact (was 1.8)
  starter: 1.0,  // Starters have 1.0x impact (was 1.2)
  role: 0.6,     // Role players have reduced impact (was 0.8)
}

// Maximum impact caps per player (in rating points)
const MAX_ORTG_DROP_PER_PLAYER = 6.0  // No single player can drop ORtg more than 6 points
const MAX_DRTG_INCREASE_PER_PLAYER = 4.0  // No single player can worsen DRtg more than 4 points
const MAX_TOTAL_INJURY_IMPACT = 12.0  // Maximum total ORtg or DRtg impact from all injuries

/**
 * Calculate the impact of a single injured player
 * Uses BPM (Box Plus/Minus) rate stats - NOT VORP (which is cumulative)
 * Impact is scaled by player's statistical contribution, NOT name recognition
 *
 * Formula rationale:
 * - BPM measures points above average per 100 possessions
 * - OBPM/DBPM split that into offense/defense components
 * - Minutes played determines how much of the game they affect
 * - Tier multiplier accounts for star vs role player replacement quality
 */
export function calculatePlayerImpact(
  playerStats: PlayerStats,
  teamStats: TeamStats
): InjuryImpact['impact'] {
  const mpg = playerStats.minutesPerGame
  const usage = playerStats.usage
  const obpm = playerStats.obpm || 0
  const dbpm = playerStats.dbpm || 0

  // Get stat-based tier multiplier
  const tier = getPlayerTier(playerStats)
  const tierMultiplier = TIER_MULTIPLIERS[tier]

  // Minutes factor: how much of the game this player is on court
  // 36 mpg = 75% of game, so that's our reference point
  const minutesFactor = mpg / 48

  // Offensive Rating Impact
  // OBPM is points above average per 100 possessions
  // A +5 OBPM player missing ~30 min affects maybe 2-3 points of team ORtg
  // Scale: OBPM * 0.4 * (mpg/48) gives us base impact
  const rawOrtgImpact = obpm * 0.4 * minutesFactor * tierMultiplier
  // Cap at maximum per-player impact
  const ortgDrop = Math.min(Math.max(0, rawOrtgImpact), MAX_ORTG_DROP_PER_PLAYER)

  // Defensive Rating Impact
  // Positive DBPM = good defender. When out, defense worsens (DRtg increases)
  // So we negate: -DBPM becomes the increase
  const rawDrtgImpact = -dbpm * 0.35 * minutesFactor * tierMultiplier
  // Cap at maximum per-player impact
  const drtgIncrease = Math.min(Math.max(-MAX_DRTG_INCREASE_PER_PLAYER, rawDrtgImpact), MAX_DRTG_INCREASE_PER_PLAYER)

  // Usage-based pace impact (minimal effect)
  // High-usage players affect pace slightly when out
  const usageImpact = (usage / 100) * minutesFactor
  const paceDrop = usageImpact * -0.3 * tierMultiplier

  return {
    ortgDrop,
    drtgIncrease,
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
    // Then cap at maximum to prevent unrealistic projections
    const rawOrtgDrop = Math.sqrt(
      impacts.reduce((sum, i) => sum + Math.pow(i.impact.ortgDrop, 2), 0)
    )
    const totalOrtgDrop = Math.min(rawOrtgDrop, MAX_TOTAL_INJURY_IMPACT)

    const rawDrtgIncrease = Math.sqrt(
      impacts.reduce((sum, i) => sum + Math.pow(Math.abs(i.impact.drtgIncrease), 2), 0)
    ) * (impacts.some(i => i.impact.drtgIncrease > 0) ? 1 : -1)
    const totalDrtgIncrease = Math.sign(rawDrtgIncrease) * Math.min(Math.abs(rawDrtgIncrease), MAX_TOTAL_INJURY_IMPACT)

    const totalPaceDrop = impacts.reduce((sum, i) => sum + i.impact.paceDrop, 0)

    const summary = `${impacts.length} key ${impacts.length === 1 ? 'player' : 'players'} out`

    console.log(`[INJURY DETECTOR] ${teamName}: ${summary}`, {
      espnTeamName: teamData.displayName,
      totalOrtgDrop: totalOrtgDrop.toFixed(1),
      totalDrtgIncrease: totalDrtgIncrease.toFixed(1),
      rawOrtgDrop: rawOrtgDrop.toFixed(1),
      players: impacts.map(i => `${i.playerName} (ORtg: -${i.impact.ortgDrop.toFixed(1)}, DRtg: +${i.impact.drtgIncrease.toFixed(1)})`),
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
