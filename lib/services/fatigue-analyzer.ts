/**
 * Fatigue Analyzer
 * Tracks player minutes and detects performance degradation from fatigue
 */

import type { LiveScoreGameDetails, GameDetailsTeam } from '@/lib/live-scores'
import { getPlayerStats } from './matchup-analyzer'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PlayerFatigue {
  name: string
  minutesPlayed: number
  typicalMinutes: number
  fatigueLevel: 'fresh' | 'normal' | 'tired' | 'exhausted'
  performanceImpact: number // ORtg/DRtg adjustment
  isStarPlayer: boolean
}

export interface FatigueAnalysis {
  homeFatigued: PlayerFatigue[]
  awayFatigued: PlayerFatigue[]
  teamFatigueImpact: {
    home: number
    away: number
  }
  lineAdjustment: number
  factors: string[]
}

// ============================================================================
// FATIGUE LEVEL CALCULATION
// ============================================================================

/**
 * Determine fatigue level based on minutes played
 */
function calculateFatigueLevel(
  minutesPlayed: number,
  typicalMinutes: number,
  period: number
): PlayerFatigue['fatigueLevel'] {
  const minutesAboveTypical = minutesPlayed - typicalMinutes

  // Q3 or earlier
  if (period <= 3) {
    if (minutesAboveTypical > 4) return 'tired'
    if (minutesAboveTypical > 2) return 'normal'
    return 'fresh'
  }

  // Q4
  if (minutesPlayed > 38) return 'exhausted'
  if (minutesPlayed > 34) return 'tired'
  if (minutesPlayed > 30) return 'normal'
  return 'fresh'
}

/**
 * Calculate performance impact from fatigue
 */
function calculateFatigueImpact(
  fatigueLevel: PlayerFatigue['fatigueLevel'],
  isStarPlayer: boolean
): number {
  // Star players have bigger impact when fatigued
  const multiplier = isStarPlayer ? 1.5 : 1.0

  const baseImpacts = {
    fresh: 0,
    normal: 0,
    tired: -1.5,
    exhausted: -3.0
  }

  return baseImpacts[fatigueLevel] * multiplier
}

// ============================================================================
// FATIGUE ANALYSIS
// ============================================================================

/**
 * Analyze player fatigue across both teams
 */
export function analyzeFatigue(
  liveGame: LiveScoreGameDetails,
  period: number
): FatigueAnalysis {
  const homeTeam = liveGame.teams.find(t => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find(t => t.homeAway === 'away')

  const analyzePlayers = (team: GameDetailsTeam | undefined) => {
    const fatigued: PlayerFatigue[] = []

    if (!team) return fatigued

    const allPlayers = [...team.starters, ...team.bench]

    for (const player of allPlayers) {
      const minutesPlayed = parseFloat(player.statMap?.MIN || '0')

      // Only check players who are playing significant minutes
      if (minutesPlayed < 20) continue

      // Get player stats to determine typical minutes and star status
      const playerStats = getPlayerStats(player.name || '', 'points')
      const typicalMinutes = playerStats?.minutesPerGame || 32
      const bpm = playerStats?.bpm || 0
      const isStarPlayer = bpm > 3 // High BPM = star player

      const fatigueLevel = calculateFatigueLevel(minutesPlayed, typicalMinutes, period)

      // Only track if fatigued
      if (fatigueLevel === 'tired' || fatigueLevel === 'exhausted') {
        const performanceImpact = calculateFatigueImpact(fatigueLevel, isStarPlayer)

        fatigued.push({
          name: player.name || '',
          minutesPlayed,
          typicalMinutes,
          fatigueLevel,
          performanceImpact,
          isStarPlayer
        })
      }
    }

    return fatigued
  }

  const homeFatigued = analyzePlayers(homeTeam)
  const awayFatigued = analyzePlayers(awayTeam)

  // Calculate team-level fatigue impact
  const homeFatigueImpact = homeFatigued.reduce((sum, p) => sum + p.performanceImpact, 0)
  const awayFatigueImpact = awayFatigued.reduce((sum, p) => sum + p.performanceImpact, 0)

  // Convert to line adjustment
  const lineAdjustment = (awayFatigueImpact - homeFatigueImpact) * 0.15 // Scale down

  const factors: string[] = []

  // Add notable fatigue factors
  for (const player of homeFatigued) {
    if (player.isStarPlayer) {
      factors.push(
        `🥵 ${player.name} (${homeTeam?.name}): ${player.minutesPlayed.toFixed(0)} min, ${player.fatigueLevel.toUpperCase()}`
      )
    }
  }

  for (const player of awayFatigued) {
    if (player.isStarPlayer) {
      factors.push(
        `🥵 ${player.name} (${awayTeam?.name}): ${player.minutesPlayed.toFixed(0)} min, ${player.fatigueLevel.toUpperCase()}`
      )
    }
  }

  return {
    homeFatigued,
    awayFatigued,
    teamFatigueImpact: {
      home: homeFatigueImpact,
      away: awayFatigueImpact
    },
    lineAdjustment,
    factors
  }
}
