/**
 * NBA team/player stat tools sourced from ESPN endpoints.
 */

import {
  getNBARoster,
  getNBAPlayerSeasonStats,
  getPlayerSeasonStats,
  getTeamStats as getSportsTeamStats,
  type TeamStats,
} from '@/lib/sports-stats-api'
import type { TeamStatsResult, PlayerStatsResult } from './types'

/**
 * Mapping of common stat name variations to actual keys in the ESPN data
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
 * Get team stats from ESPN NBA data
 */
type TeamStatsMode = 'summary' | 'profile'

const formatStatValue = (key: string, value: number): string => {
  if (Number.isNaN(value)) return 'n/a'
  if (/Pct|percent/i.test(key)) return `${value.toFixed(1)}%`
  if (key === 'freeThrowRate' || key === 'opponentFreeThrowRate') {
    return value.toFixed(3)
  }
  if (key === 'strengthOfSchedule' || key === 'simpleRatingSystem') {
    return value.toFixed(2)
  }
  return value.toFixed(1)
}

const buildTeamProfile = async (
  team: TeamStats,
  stats: Record<string, any>
): Promise<string> => {
  const regularStats = [
    { key: 'gamesPlayed', label: 'Games' },
    { key: 'minutesPerGame', label: 'MPG' },
    { key: 'pointsForPerGame', label: 'PPG' },
    { key: 'pointsAgainstPerGame', label: 'Opp PPG' },
    { key: 'fieldGoalsMadePerGame', label: 'FGM/G' },
    { key: 'fieldGoalsAttemptedPerGame', label: 'FGA/G' },
    { key: 'fieldGoalPct', label: 'FG%' },
    { key: 'twosMadePerGame', label: '2PM/G' },
    { key: 'twosAttemptedPerGame', label: '2PA/G' },
    { key: 'twoPointPct', label: '2P%' },
    { key: 'threesMadePerGame', label: '3PM/G' },
    { key: 'threesAttemptedPerGame', label: '3PA/G' },
    { key: 'threePointPct', label: '3P%' },
    { key: 'freeThrowsMadePerGame', label: 'FTM/G' },
    { key: 'freeThrowsAttemptedPerGame', label: 'FTA/G' },
    { key: 'freeThrowPct', label: 'FT%' },
    { key: 'reboundsPerGame', label: 'REB/G' },
    { key: 'offensiveReboundsPerGame', label: 'ORB/G' },
    { key: 'defensiveReboundsPerGame', label: 'DRB/G' },
    { key: 'assistsPerGame', label: 'AST/G' },
    { key: 'stealsPerGame', label: 'STL/G' },
    { key: 'blocksPerGame', label: 'BLK/G' },
    { key: 'turnoversPerGame', label: 'TOV/G' },
    { key: 'personalFoulsPerGame', label: 'PF/G' },
  ]

  const opponentStats = [
    { key: 'opponentFieldGoalsMadePerGame', label: 'Opp FGM/G' },
    { key: 'opponentFieldGoalsAttemptedPerGame', label: 'Opp FGA/G' },
    { key: 'opponentTwoPointMadePerGame', label: 'Opp 2PM/G' },
    { key: 'opponentTwoPointAttemptedPerGame', label: 'Opp 2PA/G' },
    { key: 'opponentThreeMadePerGame', label: 'Opp 3PM/G' },
    { key: 'opponentThreeAttemptedPerGame', label: 'Opp 3PA/G' },
    { key: 'opponentFreeThrowsMadePerGame', label: 'Opp FTM/G' },
    { key: 'opponentFreeThrowsAttemptedPerGame', label: 'Opp FTA/G' },
    { key: 'opponentOffensiveReboundsPerGame', label: 'Opp ORB/G' },
    { key: 'opponentDefensiveReboundsPerGame', label: 'Opp DRB/G' },
    { key: 'opponentReboundsPerGame', label: 'Opp REB/G' },
    { key: 'opponentAssistsPerGame', label: 'Opp AST/G' },
    { key: 'opponentStealsPerGame', label: 'Opp STL/G' },
    { key: 'opponentBlocksPerGame', label: 'Opp BLK/G' },
    { key: 'opponentTurnoversPerGame', label: 'Opp TOV/G' },
    { key: 'opponentPersonalFoulsPerGame', label: 'Opp PF/G' },
    { key: 'opponentThreesMadePerGame', label: 'Opp 3PM/G (alt)' },
    { key: 'threePointersAllowedPerGame', label: '3PA Allowed/G' },
    { key: 'threesAllowedPerGame', label: '3PM Allowed/G' },
  ]

  const advancedStats = [
    { key: 'offensiveRating', label: 'ORtg' },
    { key: 'defensiveRating', label: 'DRtg' },
    { key: 'netRating', label: 'NetRtg' },
    { key: 'pace', label: 'Pace' },
    { key: 'marginOfVictory', label: 'MOV' },
    { key: 'strengthOfSchedule', label: 'SOS' },
    { key: 'simpleRatingSystem', label: 'SRS' },
    { key: 'effectiveFgPct', label: 'eFG%' },
    { key: 'trueShootingPct', label: 'TS%' },
    { key: 'turnoverPct', label: 'TOV%' },
    { key: 'offensiveReboundPct', label: 'ORB%' },
    { key: 'defensiveReboundPct', label: 'DRB%' },
    { key: 'freeThrowRate', label: 'FTr' },
    { key: 'opponentEffectiveFgPct', label: 'Opp eFG%' },
    { key: 'opponentTrueShootingPct', label: 'Opp TS%' },
    { key: 'opponentTurnoverPct', label: 'Opp TOV%' },
    { key: 'opponentOffensiveReboundPct', label: 'Opp ORB%' },
    { key: 'opponentDefensiveReboundPct', label: 'Opp DRB%' },
    { key: 'opponentFreeThrowRate', label: 'Opp FTr' },
  ]

  const addSection = (title: string, items: Array<{ key: string; label: string }>) => {
    const lines = items
      .filter((item) => typeof stats[item.key] === 'number')
      .map((item) => `- ${item.label}: ${formatStatValue(item.key, stats[item.key])}`)
    return lines.length ? `\n${title}\n${lines.join('\n')}` : ''
  }

  const knownKeys = new Set<string>([
    ...regularStats.map((item) => item.key),
    ...opponentStats.map((item) => item.key),
    ...advancedStats.map((item) => item.key),
  ])
  const extraStats = Object.keys(stats)
    .filter((key) => !knownKeys.has(key) && typeof stats[key] === 'number')
    .map((key) => `- ${key}: ${formatStatValue(key, stats[key])}`)

  const bettingOutlook: string[] = []
  const pace = stats.pace as number | undefined
  const ortg = stats.offensiveRating as number | undefined
  const drtg = stats.defensiveRating as number | undefined
  const net = stats.netRating as number | undefined
  const ppg = stats.pointsForPerGame as number | undefined
  const papg = stats.pointsAgainstPerGame as number | undefined
  const [paceAvg, ortgAvg, drtgAvg, ppgAvg, papgAvg] = await Promise.all([
    getLeagueAverage('pace'),
    getLeagueAverage('offensiveRating'),
    getLeagueAverage('defensiveRating'),
    getLeagueAverage('pointsForPerGame'),
    getLeagueAverage('pointsAgainstPerGame'),
  ])

  if (pace != null && paceAvg != null) {
    if (pace >= paceAvg + 1.5) bettingOutlook.push('Fast pace -> higher totals and more possessions.')
    if (pace <= paceAvg - 1.5) bettingOutlook.push('Slow pace -> lower totals and tighter games.')
  }
  if (ortg != null && ortgAvg != null && ortg >= ortgAvg + 2) {
    bettingOutlook.push(`Above-average offense (ORtg ${ortg.toFixed(1)} vs avg ${ortgAvg.toFixed(1)}).`)
  }
  if (drtg != null && drtgAvg != null && drtg <= drtgAvg - 2) {
    bettingOutlook.push(`Above-average defense (DRtg ${drtg.toFixed(1)} vs avg ${drtgAvg.toFixed(1)}) -> unders more viable.`)
  }
  if (net != null) {
    if (net >= 3) bettingOutlook.push('Strong net rating -> spreads may be justified but beware inflated lines.')
    if (net <= -3) bettingOutlook.push('Negative net rating -> fade as favorites, look for opponent value.')
  }
  if (ppg != null && ppgAvg != null && ppg >= ppgAvg + 3) {
    bettingOutlook.push(`High scoring profile (PPG ${ppg.toFixed(1)} vs avg ${ppgAvg.toFixed(1)}) -> overs in pace-friendly matchups.`)
  }
  if (papg != null && papgAvg != null && papg >= papgAvg + 3) {
    bettingOutlook.push(`Leaky defense (Opp PPG ${papg.toFixed(1)} vs avg ${papgAvg.toFixed(1)}) -> opponent overs/props can get there.`)
  }

  const outlookLines = bettingOutlook.length
    ? `\nBetting Outlook\n- ${bettingOutlook.slice(0, 4).join('\n- ')}`
    : '\nBetting Outlook\n- No clear betting edge from the available stats.'

  return [
    `## ${team.team} Team Profile`,
    `\nRecord: ${team.wins}-${team.losses} (${(team.winPct * 100).toFixed(1)}%)`,
    addSection('Regular Stats', regularStats),
    addSection('Opponent Stats', opponentStats),
    addSection('Advanced Stats', advancedStats),
    extraStats.length ? `\nOther Stats\n${extraStats.join('\n')}` : '',
    `\n${outlookLines}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function executeStaticTeamStats(args: {
  team: string
  stats?: string[]
  mode?: TeamStatsMode
}): Promise<TeamStatsResult> {
  const teams = await getSportsTeamStats('basketball_nba', args.team)

  if (!teams.length) {
    return {
      team: args.team,
      stats: {},
      error: `Team "${args.team}" not found in ESPN data. Try using full team name or city.`,
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
  if (args.mode === 'profile') {
    return {
      team: team.team,
      stats: allStats,
      record: `${team.wins}-${team.losses}`,
      formatted: await buildTeamProfile(team, allStats),
    }
  }

  // Default summary formatting
  const { formatTeamStats } = await import('@/lib/formatters/team-formatter')
  const formatted = await formatTeamStats(
    {
      team: team.team,
      wins: team.wins,
      losses: team.losses,
      winPct: team.winPct,
      stats: allStats,
    },
    {
      includeBettingAngles: true,
      includeLeagueContext: true,
      includeEmoji: true,
    }
  )

  return {
    team: team.team,
    stats: allStats,
    record: `${team.wins}-${team.losses}`,
    formatted: formatted.formatted, // Add formatted string
  }
}

/**
 * Get player stats from ESPN NBA data
 */
export async function executeStaticPlayerStats(args: { player: string; stats?: string[] }): Promise<PlayerStatsResult> {
  const player = await getPlayerSeasonStats(args.player, 'basketball_nba')

  if (!player) {
    return {
      player: args.player,
      stats: {},
      error: `Player "${args.player}" not found in ESPN data. Check spelling or try a different name format.`,
    }
  }

  if (args.stats?.length) {
    const filtered: Record<string, any> = {}
    const notFound: string[] = []

    for (const stat of args.stats) {
      const key = findStatKey(stat, player.stats)
      if (key && player.stats[key] != null) {
        filtered[stat] = player.stats[key]
      } else {
        notFound.push(stat)
      }
    }

    return {
      player: player.name,
    team: player.team,
    stats: filtered,
    ...(notFound.length > 0 && { error: `Stats not found: ${notFound.join(', ')}` }),
  }
  }

  // Add formatted output with prop implications
  const { formatPlayerStats } = await import('@/lib/formatters/player-formatter')
  const formatted = await formatPlayerStats(
    {
      name: player.name,
      team: player.team,
      stats: player.stats,
    },
    {
      includeBettingAngles: true,
      includeLeagueContext: true,
      includeEmoji: true,
    }
  )

  return {
    player: player.name,
    team: player.team,
    stats: player.stats,
    formatted: formatted.formatted, // Add formatted string
  }
}

/**
 * Get all team stats for comparison/ranking purposes
 */
export async function getAllStaticTeamStats(): Promise<TeamStatsResult[]> {
  const teams = await getSportsTeamStats('basketball_nba')
  return teams.map((team) => ({
    team: team.team,
    stats: team.stats,
    record: `${team.wins}-${team.losses}`,
  }))
}

/**
 * Get a specific stat across all teams for ranking
 */
export async function getStatRankings(statName: string): Promise<Array<{ team: string; value: number | null; rank: number }>> {
  const teams = await getSportsTeamStats('basketball_nba')
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
export async function getTeamStatRank(
  teamName: string,
  statName: string
): Promise<{ team: string; value: number | null; rank: number; total: number } | null> {
  const rankings = await getStatRankings(statName)
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
export async function getLeagueAverage(statName: string): Promise<number | null> {
  const teams = await getSportsTeamStats('basketball_nba')
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

/**
 * Player stat key mappings for leaderboards
 */
const PLAYER_STAT_KEY_MAPPINGS: Record<string, string[]> = {
  points: ['PTS', 'PPG'],
  rebounds: ['TRB', 'REB', 'RPG'],
  assists: ['AST', 'APG'],
  steals: ['STL'],
  blocks: ['BLK'],
  threes: ['THREE_PM', '3PM', '3P'],
  minutes: ['MPG'],
  turnovers: ['TOV'],
  field_goal_pct: ['FG_PERCENT'],
  three_pct: ['THREE_PERCENT', '3P_PCT'],
  free_throw_pct: ['FT_PERCENT', 'FT_PCT'],
  true_shooting: ['TS_PERCENT'],
  effective_fg: ['EFG_PERCENT'],
}

/**
 * Find the player stat key for a given stat name
 */
function findPlayerStatKey(requested: string, stats: Record<string, number>): string | null {
  const normalized = requested.toLowerCase().replace(/[^a-z0-9]/g, '')

  // Check mappings
  for (const [key, aliases] of Object.entries(PLAYER_STAT_KEY_MAPPINGS)) {
    const keyNormalized = key.replace(/[^a-z0-9]/g, '')
    if (keyNormalized === normalized || normalized.includes(keyNormalized) || keyNormalized.includes(normalized)) {
      for (const alias of aliases) {
        if (alias in stats) return alias
      }
    }
    for (const alias of aliases) {
      const aliasNormalized = alias.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (aliasNormalized === normalized || normalized.includes(aliasNormalized)) {
        if (alias in stats) return alias
      }
    }
  }

  // Direct match on stats keys
  for (const key of Object.keys(stats)) {
    const keyNormalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (keyNormalized === normalized || keyNormalized.includes(normalized) || normalized.includes(keyNormalized)) {
      return key
    }
  }

  return null
}

/**
 * Get player leaderboard for a specific stat
 */
export interface PlayerLeaderboardEntry {
  rank: number
  player: string
  team: string
  value: number
  gamesPlayed: number
}

const LEADERBOARD_CACHE_TTL = 1000 * 60 * 10
const leaderboardCache = new Map<
  string,
  { ts: number; result: { stat: string; leaders: PlayerLeaderboardEntry[]; error?: string } }
>()

const mapWithConcurrency = async <T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>
) => {
  for (let i = 0; i < items.length; i += limit) {
    const slice = items.slice(i, i + limit)
    await Promise.all(slice.map((item) => handler(item)))
  }
}

export async function getPlayerLeaderboard(
  statName: string,
  limit: number = 10,
  minGames: number = 10
): Promise<{ stat: string; leaders: PlayerLeaderboardEntry[]; error?: string }> {
  const cacheKey = `${statName}:${limit}:${minGames}`
  const cached = leaderboardCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < LEADERBOARD_CACHE_TTL) {
    return cached.result
  }

  const roster = await getNBARoster()
  if (!roster || roster.length === 0) {
    return { stat: statName, leaders: [], error: 'No player data available' }
  }

  let statKey: string | null = null
  const leaders: Array<{ player: string; team: string; value: number; gamesPlayed: number }> = []

  await mapWithConcurrency(roster, 6, async (player) => {
    const data = await getNBAPlayerSeasonStats(player.name)
    const stats = data?.stats || {}
    if (!Object.keys(stats).length) return

    if (!statKey) {
      statKey = findPlayerStatKey(statName, stats as Record<string, any>)
    }
    if (!statKey) return

    const gp = (stats as any).GP || 0
    const value = (stats as any)[statKey]
    if (gp < minGames || typeof value !== 'number' || value <= 0) return

    leaders.push({
      player: data?.name || player.name,
      team: data?.team || player.teamAbbr,
      value,
      gamesPlayed: gp,
    })
  })

  if (!statKey) {
    return {
      stat: statName,
      leaders: [],
      error: `Stat "${statName}" not found in ESPN data.`,
    }
  }

  const sorted = leaders
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }))

  const result = { stat: statKey, leaders: sorted }
  leaderboardCache.set(cacheKey, { ts: Date.now(), result })
  return result
}
