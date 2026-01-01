/**
 * Injury Detection and Impact Calculation Service
 * Automatically detects injured players and calculates their impact on team performance
 * Uses ESPN's live injury API
 */

import { fetchInjuries, type EspnInjuryTeam } from '@/lib/providers/espn-nba'
import { getPlayerStats, getTeamAbbrev } from './matchup-analyzer'
import type { PlayerStats, TeamStats } from './pregame-value-calculator'

const INJURY_CACHE_TTL_MS = 1000 * 60 * 5
let espnInjuryCache: { ts: number; data: EspnInjuryTeam[] } | null = null
let espnInjuryInflight: Promise<EspnInjuryTeam[]> | null = null
const teamInjuryCache = new Map<string, { ts: number; report: TeamInjuryReport | null }>()

const normalizeTeamKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const loadEspnInjuries = async (): Promise<EspnInjuryTeam[]> => {
  if (espnInjuryCache && Date.now() - espnInjuryCache.ts < INJURY_CACHE_TTL_MS) {
    return espnInjuryCache.data
  }
  if (espnInjuryInflight) {
    return espnInjuryInflight
  }
  espnInjuryInflight = fetchInjuries()
    .then((data) => {
      const safe = Array.isArray(data) ? data : []
      espnInjuryCache = { ts: Date.now(), data: safe }
      return safe
    })
    .catch((error) => {
      console.error('[INJURY DETECTOR] Failed to fetch ESPN injuries:', error)
      return []
    })
    .finally(() => {
      espnInjuryInflight = null
    })
  return espnInjuryInflight
}

export interface InjuryImpact {
  playerName: string
  status: string // "Out", "Doubtful", "Questionable"
  stats: {
    ppg: number
    usage: number
    mpg: number
    vorp: number
    per: number
    nbaRating: number
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
  const per = playerStats.per || 0
  const rating = playerStats.nbaRating || 0
  const vorp = playerStats.vorp || 0
  const usage = playerStats.usage || 0
  const mpg = playerStats.minutesPerGame || 0
  const ppg = playerStats.seasonAverage || 0

  // Elite: high PER or elite ESPN rating with heavy usage
  if (per >= 23 || rating >= 32 || (ppg >= 25 && usage >= 28)) {
    return 'elite'
  }

  // Star: above-average PER or rating with solid volume
  if (per >= 18 || rating >= 24 || vorp >= 1.5 || (ppg >= 17 && usage >= 24)) {
    return 'star'
  }

  // Starter: Regular rotation player with stable minutes
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
 * Uses ESPN-derived efficiency metrics (PER, Rating, usage, per-game defense)
 * Impact is scaled by statistical contribution, not name recognition
 *
 * Formula rationale:
 * - PER + ESPN Rating proxy overall efficiency
 * - Usage/PPG/TS% capture offensive load
 * - Steals/blocks/defensive rebounds proxy defensive impact
 * - Minutes played determines how much of the game they affect
 * - Tier multiplier accounts for star vs role player replacement quality
 */
export function calculatePlayerImpact(
  playerStats: PlayerStats,
  teamStats: TeamStats
): InjuryImpact['impact'] {
  const mpg = playerStats.minutesPerGame
  const usage = playerStats.usage
  const ppg = playerStats.seasonAverage || 0
  const per = playerStats.per ?? null
  const rating = playerStats.nbaRating ?? null
  const ts = playerStats.trueShootingPct ?? null
  const ast = playerStats.assistsPerGame ?? null
  const stl = playerStats.stealsPerGame ?? null
  const blk = playerStats.blocksPerGame ?? null
  const drb = playerStats.defensiveReboundsPerGame ?? null
  const drbRate = playerStats.defensiveReboundRate ?? null

  // Get stat-based tier multiplier
  const tier = getPlayerTier(playerStats)
  const tierMultiplier = TIER_MULTIPLIERS[tier]

  // Minutes factor: how much of the game this player is on court
  // 36 mpg = 75% of game, so that's our reference point
  const minutesFactor = mpg / 48

  // Offensive Rating Impact
  // ESPN-derived signals: PER, NBA Rating, usage, efficiency, assist volume
  const offenseBase =
    Math.max(
      0,
      (ppg - 10) * 0.12 +
        (usage - 18) * 0.05 +
        (per != null ? (per - 15) * 0.2 : 0) +
        (rating != null ? (rating - 15) * 0.08 : 0) +
        (ast != null ? (ast - 3) * 0.1 : 0) +
        (ts != null ? (ts - 55) * 0.04 : 0)
    )
  const rawOrtgImpact = offenseBase * minutesFactor * tierMultiplier
  const ortgDrop = Math.min(Math.max(0, rawOrtgImpact), MAX_ORTG_DROP_PER_PLAYER)

  // Defensive Rating Impact
  // Use ESPN defensive box stats as proxy (steals/blocks/rebounds)
  const defenseBase =
    Math.max(
      0,
      (stl != null ? (stl - 0.7) * 0.9 : 0) +
        (blk != null ? (blk - 0.5) * 0.9 : 0) +
        (drb != null ? (drb - 3) * 0.3 : 0) +
        (drbRate != null ? (drbRate - 0.2) * 4 : 0)
    )
  const rawDrtgImpact = defenseBase * minutesFactor * tierMultiplier
  const drtgIncrease = Math.min(
    Math.max(0, rawDrtgImpact),
    MAX_DRTG_INCREASE_PER_PLAYER
  )

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

  const perLabel = Number.isFinite(stats.per) ? `PER ${stats.per.toFixed(1)}` : 'PER n/a'
  const ratingLabel = Number.isFinite(stats.nbaRating)
    ? `Rating ${stats.nbaRating.toFixed(1)}`
    : 'Rating n/a'

  return `${playerName}${tierLabel} (${impact.status}): ${stats.ppg.toFixed(1)} PPG, ${perLabel}, ${ratingLabel} → ${impactDesc} impact (-${impactValues.ortgDrop.toFixed(1)} ORtg)`
}

/**
 * Detect injuries for a team and calculate their cumulative impact
 * Fetches live injury data from ESPN API
 */
export async function detectInjuries(
  teamName: string,
  sport: string = 'basketball_nba'
): Promise<TeamInjuryReport | null> {
  const cacheKey = `${sport}:${normalizeTeamKey(teamName)}`
  const cached = teamInjuryCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < INJURY_CACHE_TTL_MS) {
    return cached.report
  }
  const cacheReport = (report: TeamInjuryReport | null) => {
    teamInjuryCache.set(cacheKey, { ts: Date.now(), report })
    return report
  }
  try {
    // Fetch all injuries from ESPN
    const espnTeams = await loadEspnInjuries()

    if (!espnTeams || espnTeams.length === 0) {
      console.log('[INJURY DETECTOR] No injury data available from ESPN')
      return cacheReport(null)
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
      return cacheReport(null)
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
      return cacheReport(null)
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

      const playerStats = await getPlayerStats(playerName, 'points')
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
            vorp: playerStats.vorp || 0,
            per: playerStats.per ?? Number.NaN,
            nbaRating: playerStats.nbaRating ?? Number.NaN,
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
          vorp: playerStats.vorp || 0,
          per: playerStats.per ?? Number.NaN,
          nbaRating: playerStats.nbaRating ?? Number.NaN,
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
      return cacheReport(null)
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

    return cacheReport({
      team: teamName,
      injuries: impacts,
      totalImpact: {
        ortgDrop: totalOrtgDrop,
        drtgIncrease: totalDrtgIncrease,
        paceDrop: totalPaceDrop,
      },
      summary,
    })
  } catch (error) {
    console.error('[INJURY DETECTOR] Error detecting injuries:', error)
    return cacheReport(null) // Fail gracefully
  }
}
