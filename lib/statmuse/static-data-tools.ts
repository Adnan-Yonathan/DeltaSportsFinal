/**
 * Static data tools for querying CSV-based sports statistics.
 * These are fast (no API calls) and should be prioritized for NBA data.
 */

import { findStaticNbaTeam, getStaticNbaTeams } from '@/lib/nba-static-team-stats'
import { findNbaStaticPlayer } from '@/lib/nba-static-stats'
import type { TeamStatsResult, PlayerStatsResult } from './types'

/**
 * Mapping of common stat name variations to actual keys in the static data
 */
const STAT_KEY_MAPPINGS: Record<string, string[]> = {
  // Opponent/Defensive stats
  opponent_3pt: ['opponentThreeMadePerGame', 'threesAllowedPerGame', 'OPP_3P'],
  opp_3pt_pct: ['opponentEffectiveFgPct', 'OPP_eFG_PCT'],
  opp_ts_pct: ['opponentTrueShootingPct', 'OPP_TS_PCT'],
  defensive_rating: ['defensiveRating', 'DRtg'],
  points_allowed: ['pointsAgainstPerGame', 'OPP_PTS'],
  opp_rebounds: ['opponentReboundsPerGame', 'OPP_TRB'],
  opp_offensive_rebounds: ['opponentOffensiveReboundsPerGame', 'OPP_ORB'],
  opp_defensive_rebounds: ['opponentDefensiveReboundsPerGame', 'OPP_DRB'],
  opp_assists: ['opponentAssistsPerGame', 'OPP_AST'],
  opp_turnovers: ['opponentTurnoversPerGame', 'OPP_TOV'],
  opp_fg_pct: ['opponentFieldGoalPct'],
  opp_ft_rate: ['opponentFreeThrowRate', 'OPP_FTr'],

  // Offensive stats
  points: ['pointsForPerGame', 'PTS'],
  offensive_rating: ['offensiveRating', 'ORtg'],
  pace: ['pace', 'Pace'],
  rebounds: ['reboundsPerGame', 'TRB'],
  offensive_rebounds: ['offensiveReboundsPerGame', 'ORB'],
  defensive_rebounds: ['defensiveReboundsPerGame', 'DRB'],
  assists: ['assistsPerGame', 'AST'],
  steals: ['stealsPerGame', 'STL'],
  blocks: ['blocksPerGame', 'BLK'],
  turnovers: ['turnoversPerGame', 'TOV'],
  threes: ['threesMadePerGame', '3P'],
  threes_attempted: ['threesAttemptedPerGame', '3PA'],
  fg_pct: ['fieldGoalPct', 'FG_PCT'],
  three_pct: ['threePointPct', '3P_PCT'],
  ft_pct: ['freeThrowPct', 'FT_PCT'],
  ts_pct: ['trueShootingPct', 'TS_PCT'],
  efg_pct: ['effectiveFgPct', 'eFG_PCT'],

  // Advanced
  net_rating: ['netRating'],
  mov: ['marginOfVictory', 'MOV'],
  sos: ['strengthOfSchedule', 'SOS'],
  srs: ['simpleRatingSystem', 'SRS'],
}

/**
 * Find the actual stat key in the data given a requested stat name
 */
function findStatKey(requested: string, stats: Record<string, any>): string | null {
  const normalized = requested.toLowerCase().replace(/[^a-z0-9]/g, '')

  // First, check our mappings
  for (const [key, aliases] of Object.entries(STAT_KEY_MAPPINGS)) {
    const keyNormalized = key.replace(/[^a-z0-9]/g, '')
    if (keyNormalized === normalized || normalized.includes(keyNormalized) || keyNormalized.includes(normalized)) {
      // Found a mapping match, now find which alias exists in stats
      for (const alias of aliases) {
        if (alias in stats) return alias
      }
    }
    // Also check if the requested stat matches any alias
    for (const alias of aliases) {
      const aliasNormalized = alias.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (aliasNormalized === normalized || normalized.includes(aliasNormalized)) {
        if (alias in stats) return alias
      }
    }
  }

  // Direct match attempt on stats keys
  for (const key of Object.keys(stats)) {
    const keyNormalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (keyNormalized === normalized || keyNormalized.includes(normalized) || normalized.includes(keyNormalized)) {
      return key
    }
  }

  return null
}

/**
 * Get team stats from static NBA data
 */
export async function executeStaticTeamStats(args: {
  team: string
  stats?: string[]
}): Promise<TeamStatsResult> {
  const teams = findStaticNbaTeam(args.team)

  if (!teams.length) {
    return {
      team: args.team,
      stats: {},
      error: `Team "${args.team}" not found in static data. Try using full team name or city.`,
    }
  }

  const team = teams[0]
  const allStats = team.stats

  // If specific stats requested, filter to just those
  if (args.stats?.length) {
    const filtered: Record<string, any> = {}
    const notFound: string[] = []

    for (const stat of args.stats) {
      const key = findStatKey(stat, allStats)
      if (key && allStats[key] != null) {
        filtered[stat] = allStats[key]
      } else {
        notFound.push(stat)
      }
    }

    return {
      team: team.team,
      stats: filtered,
      record: `${team.wins}-${team.losses}`,
      ...(notFound.length > 0 && { error: `Stats not found: ${notFound.join(', ')}` }),
    }
  }

  // Return all stats if none specified
  return {
    team: team.team,
    stats: allStats,
    record: `${team.wins}-${team.losses}`,
  }
}

/**
 * Get player stats from static NBA data
 */
export async function executeStaticPlayerStats(args: { player: string }): Promise<PlayerStatsResult> {
  const player = findNbaStaticPlayer(args.player)

  if (!player) {
    return {
      player: args.player,
      stats: {},
      error: `Player "${args.player}" not found in static data. Check spelling or try a different name format.`,
    }
  }

  return {
    player: player.name,
    team: player.team,
    stats: player.stats,
  }
}

/**
 * Get all team stats for comparison/ranking purposes
 */
export function getAllStaticTeamStats(): TeamStatsResult[] {
  const teams = getStaticNbaTeams()
  return teams.map((team) => ({
    team: team.team,
    stats: team.stats,
    record: `${team.wins}-${team.losses}`,
  }))
}

/**
 * Get a specific stat across all teams for ranking
 */
export function getStatRankings(statName: string): Array<{ team: string; value: number | null; rank: number }> {
  const teams = getStaticNbaTeams()
  const results: Array<{ team: string; value: number | null }> = []

  for (const team of teams) {
    const key = findStatKey(statName, team.stats)
    const value = key ? (team.stats[key] as number | null) : null
    results.push({ team: team.team, value })
  }

  // Sort by value (handle nulls)
  results.sort((a, b) => {
    if (a.value == null && b.value == null) return 0
    if (a.value == null) return 1
    if (b.value == null) return -1
    return b.value - a.value
  })

  // Add ranks
  return results.map((r, idx) => ({ ...r, rank: idx + 1 }))
}

/**
 * Find team rank for a specific stat
 */
export function getTeamStatRank(
  teamName: string,
  statName: string
): { team: string; value: number | null; rank: number; total: number } | null {
  const rankings = getStatRankings(statName)
  const teamRanking = rankings.find(
    (r) =>
      r.team.toLowerCase().includes(teamName.toLowerCase()) ||
      teamName.toLowerCase().includes(r.team.toLowerCase().split(' ').pop() || '')
  )

  if (!teamRanking) return null

  return {
    ...teamRanking,
    total: rankings.length,
  }
}

/**
 * Get league average for a stat
 */
export function getLeagueAverage(statName: string): number | null {
  const teams = getStaticNbaTeams()
  let sum = 0
  let count = 0

  for (const team of teams) {
    const key = findStatKey(statName, team.stats)
    const value = key ? (team.stats[key] as number | null) : null
    if (value != null) {
      sum += value
      count++
    }
  }

  return count > 0 ? Number((sum / count).toFixed(2)) : null
}
