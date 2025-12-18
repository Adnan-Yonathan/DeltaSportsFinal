/**
 * Matchup Analyzer
 * Aggregates all relevant data for a matchup: stats, travel, rest, ATS, splits
 */

import { createClient } from '@/lib/supabase/server'
import { nbaTeamAdvStats2025_2026Csv } from '@/data/nba_team_adv_stats_2025_2026'
import { nbaTeamPerGame2025_2026Csv } from '@/data/nba_team_per_game_2025_2026'
import { nbaPlayerAdvStats2025_2026Csv } from '@/data/nba_player_advanced_stats_2025_2026'
import { nbaPlayerPerGame2025_2026Csv } from '@/data/nba_player_per_game_2025_2026'
import { nbaTravelMeta, type ArenaMeta } from '@/data/nba_travel_meta'
import type { TeamStats, RestFactors, TravelFactors, PlayerStats, OpponentDefense } from './pregame-value-calculator'
import { detectInjuries } from './injury-detector'

// Team abbreviation mappings
const TEAM_ALIAS_MAP: Record<string, string> = {
  atlantahawks: 'ATL', bostonceltics: 'BOS', brooklynnets: 'BRK',
  charlottehornets: 'CHO', chicagobulls: 'CHI', clevelandcavaliers: 'CLE',
  dallasmavericks: 'DAL', denvernuggets: 'DEN', detroitpistons: 'DET',
  goldenstatewarriors: 'GSW', houstonrockets: 'HOU', indianapacers: 'IND',
  losangelesclippers: 'LAC', losangeleslakers: 'LAL', memphisgrizzlies: 'MEM',
  miamiheat: 'MIA', milwaukeebucks: 'MIL', minnesotatimberwolves: 'MIN',
  neworleanspelicans: 'NOP', newyorkknicks: 'NYK', oklahomacitythunder: 'OKC',
  orlandomagic: 'ORL', philadelphia76ers: 'PHI', phoenixsuns: 'PHO',
  portlandtrailblazers: 'POR', sacramentokings: 'SAC', sanantoniospurs: 'SAS',
  torontoraptors: 'TOR', utahjazz: 'UTA', washingtonwizards: 'WAS',
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

/**
 * Get team abbreviation from full name or partial match
 */
export function getTeamAbbrev(teamName: string): string | null {
  const normalized = normalize(teamName)

  // Check direct mapping
  if (TEAM_ALIAS_MAP[normalized]) {
    return TEAM_ALIAS_MAP[normalized]
  }

  // Check if it's already an abbreviation
  const upperName = teamName.toUpperCase()
  if (nbaTravelMeta.teams.includes(upperName)) {
    return upperName
  }

  // Try partial match
  for (const [key, abbrev] of Object.entries(TEAM_ALIAS_MAP)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return abbrev
    }
  }

  return null
}

/**
 * Parse team advanced stats from CSV
 */
function parseTeamAdvStats(): Map<string, any> {
  const map = new Map()
  const lines = nbaTeamAdvStats2025_2026Csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && /^\d+,/.test(l))

  for (const line of lines) {
    const cells = line.split(',')
    if (cells.length < 20) continue

    const team = cells[2] // Team column
    map.set(team, {
      ortg: parseFloat(cells[12]) || 0,
      drtg: parseFloat(cells[13]) || 0,
      pace: parseFloat(cells[11]) || 100,
      eFG: parseFloat(cells[14]) || 0,
      ts: parseFloat(cells[15]) || 0,
    })
  }

  return map
}

/**
 * Get team stats from static data with injury adjustments
 */
export async function getTeamStats(teamName: string): Promise<TeamStats | null> {
  const abbrev = getTeamAbbrev(teamName)
  if (!abbrev) return null

  const advStats = parseTeamAdvStats()
  const stats = advStats.get(abbrev)

  if (!stats) return null

  // Base team stats
  const baseStats: TeamStats = {
    ortg: stats.ortg,
    drtg: stats.drtg,
    pace: stats.pace,
    eFG: stats.eFG,
    ts: stats.ts,
  }

  // Check for injuries and adjust
  const injuryReport = await detectInjuries(teamName)

  if (injuryReport && injuryReport.injuries.length > 0) {
    console.log(`[MATCHUP ANALYZER] Applying injury adjustments for ${teamName}:`, {
      ortgDrop: injuryReport.totalImpact.ortgDrop.toFixed(1),
      drtgIncrease: injuryReport.totalImpact.drtgIncrease.toFixed(1),
      players: injuryReport.injuries.map(i => i.playerName),
    })

    return {
      ortg: baseStats.ortg - injuryReport.totalImpact.ortgDrop,
      drtg: baseStats.drtg + injuryReport.totalImpact.drtgIncrease,
      pace: baseStats.pace + injuryReport.totalImpact.paceDrop,
      eFG: baseStats.eFG,
      ts: baseStats.ts,
    }
  }

  return baseStats
}

/**
 * Parse player stats from CSV
 */
function parsePlayerStats(): Map<string, any> {
  const map = new Map()

  // Parse per-game stats
  const perGameLines = nbaPlayerPerGame2025_2026Csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && /^\d+,/.test(l))

  for (const line of perGameLines) {
    const cells = line.split(',')
    if (cells.length < 30) continue

    const player = cells[1].trim() // Player name
    const key = normalize(player)

    map.set(key, {
      name: player,
      team: cells[5],
      mpg: parseFloat(cells[2]) || 0,
      points: parseFloat(cells[26]) || 0,
      rebounds: parseFloat(cells[20]) || 0,
      assists: parseFloat(cells[21]) || 0,
      threes: parseFloat(cells[14]) || 0,
      fg: parseFloat(cells[10]) || 0,
      fga: parseFloat(cells[11]) || 0,
    })
  }

  // Parse advanced stats for usage
  const advLines = nbaPlayerAdvStats2025_2026Csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && /^\d+,/.test(l))

  for (const line of advLines) {
    const cells = line.split(',')
    if (cells.length < 28) continue

    const player = cells[1].trim()
    const key = normalize(player)

    if (map.has(key)) {
      const existing = map.get(key)
      existing.usage = parseFloat(cells[27]) || 0 // USG% column
      existing.pace = parseFloat(cells[2]) || 0 // MP/G as pace proxy
      existing.ws48 = parseFloat(cells[14]) || 0 // WS/48
      existing.obpm = parseFloat(cells[15]) || 0 // OBPM
      existing.dbpm = parseFloat(cells[16]) || 0 // DBPM
      existing.bpm = parseFloat(cells[17]) || 0 // BPM
      existing.vorp = parseFloat(cells[18]) || 0 // VORP
      existing.per = parseFloat(cells[19]) || 0 // PER
    }
  }

  return map
}

/**
 * Get player stats from static data
 */
export function getPlayerStats(playerName: string, statType: string): PlayerStats | null {
  const playerMap = parsePlayerStats()
  const key = normalize(playerName)
  const player = playerMap.get(key)

  if (!player) return null

  let seasonAverage = 0
  switch (statType.toLowerCase()) {
    case 'points':
    case 'pts':
      seasonAverage = player.points
      break
    case 'rebounds':
    case 'reb':
    case 'trb':
      seasonAverage = player.rebounds
      break
    case 'assists':
    case 'ast':
      seasonAverage = player.assists
      break
    case 'threes':
    case '3pm':
    case 'three_pointers':
      seasonAverage = player.threes
      break
    case 'pra':
    case 'pts_reb_ast':
      seasonAverage = player.points + player.rebounds + player.assists
      break
    default:
      seasonAverage = player.points // default to points
  }

  return {
    seasonAverage,
    usage: player.usage || 25,
    minutesPerGame: player.mpg,
    pace: player.pace,
    bpm: player.bpm,
    obpm: player.obpm,
    dbpm: player.dbpm,
    vorp: player.vorp,
    per: player.per,
    ws48: player.ws48,
  }
}

/**
 * Get ATS trends from database
 */
export async function getATSTrends(teamName: string) {
  const abbrev = getTeamAbbrev(teamName)
  if (!abbrev) return null

  const supabase = createClient()
  const { data, error } = await supabase
    .from('team_ats_records')
    .select('*')
    .eq('sport_key', 'basketball_nba')
    .or(`team_name.ilike.%${teamName}%,team_name.ilike.%${abbrev}%`)
    .order('captured_at', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return null

  const record = data[0]
  return {
    overall: record.record,
    home: record.home_ats_record,
    away: record.away_ats_record,
    favorite: record.favorite_ats_record,
    underdog: record.underdog_ats_record,
    last10: record.last_10_ats,
    streak: record.ats_streak,
  }
}

/**
 * Get betting splits from database
 */
export async function getBettingSplits(gameId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('latest_betting_splits')
    .select('*')
    .eq('game_id', gameId)

  if (error || !data || data.length === 0) return null

  const spreadSplit = data.find((s) => s.market_type === 'spread')

  return {
    spreadBetsPct: spreadSplit?.home_bets_pct || null,
    spreadMoneyPct: spreadSplit?.home_money_pct || null,
    sharpSide: spreadSplit?.sharp_indicator || null,
  }
}

/**
 * Get travel factors for a team
 */
export function getTravelFactors(
  teamName: string,
  previousGameLocation?: string,
  currentGameLocation?: string
): TravelFactors | null {
  const teamAbbrev = getTeamAbbrev(teamName)
  if (!teamAbbrev) return null

  // If we don't have previous/current location, return neutral
  if (!previousGameLocation || !currentGameLocation) {
    return {
      milesFromPrevious: 0,
      timezoneDelta: 0,
      altitudeDelta: 0,
    }
  }

  const prevAbbrev = getTeamAbbrev(previousGameLocation)
  const currAbbrev = getTeamAbbrev(currentGameLocation)

  if (!prevAbbrev || !currAbbrev) return null

  const prevIndex = nbaTravelMeta.teams.indexOf(prevAbbrev)
  const currIndex = nbaTravelMeta.teams.indexOf(currAbbrev)

  if (prevIndex === -1 || currIndex === -1) return null

  return {
    milesFromPrevious: nbaTravelMeta.distance_matrix_miles[prevIndex][currIndex],
    timezoneDelta: nbaTravelMeta.timezone_delta_matrix_hours[prevIndex][currIndex],
    altitudeDelta: nbaTravelMeta.altitude_delta_matrix_ft[prevIndex][currIndex],
  }
}

/**
 * Analyze a full matchup
 */
export interface MatchupAnalysis {
  homeTeam: {
    name: string
    stats: TeamStats | null
    rest?: RestFactors
    travel?: TravelFactors
    trends?: any
    injuries?: any
  }
  awayTeam: {
    name: string
    stats: TeamStats | null
    rest?: RestFactors
    travel?: TravelFactors
    trends?: any
    injuries?: any
  }
  splits?: any
  context: string[]
}

export async function analyzeMatchup(
  homeTeam: string,
  awayTeam: string,
  gameId?: string
): Promise<MatchupAnalysis> {
  const context: string[] = []

  // Get team stats (now includes injury adjustments)
  const homeStats = await getTeamStats(homeTeam)
  const awayStats = await getTeamStats(awayTeam)

  if (homeStats && awayStats) {
    context.push(`${homeTeam} ORtg: ${homeStats.ortg.toFixed(1)}, ${awayTeam} DRtg: ${awayStats.drtg.toFixed(1)}`)
    context.push(`${awayTeam} ORtg: ${awayStats.ortg.toFixed(1)}, ${homeTeam} DRtg: ${homeStats.drtg.toFixed(1)}`)
    context.push(`Pace: ${homeTeam} ${homeStats.pace.toFixed(1)}, ${awayTeam} ${awayStats.pace.toFixed(1)}`)
  }

  // Get injury reports
  const homeInjuries = await detectInjuries(homeTeam)
  const awayInjuries = await detectInjuries(awayTeam)

  if (homeInjuries && homeInjuries.injuries.length > 0) {
    context.push(`${homeTeam} injuries: ${homeInjuries.summary}`)
    for (const injury of homeInjuries.injuries) {
      context.push(`  ${injury.explanation}`)
    }
  }

  if (awayInjuries && awayInjuries.injuries.length > 0) {
    context.push(`${awayTeam} injuries: ${awayInjuries.summary}`)
    for (const injury of awayInjuries.injuries) {
      context.push(`  ${injury.explanation}`)
    }
  }

  // Get ATS trends
  const homeTrends = await getATSTrends(homeTeam)
  const awayTrends = await getATSTrends(awayTeam)

  if (homeTrends) {
    context.push(`${homeTeam} ATS: ${homeTrends.overall}, Last 10: ${homeTrends.last10}`)
  }
  if (awayTrends) {
    context.push(`${awayTeam} ATS: ${awayTrends.overall}, Last 10: ${awayTrends.last10}`)
  }

  // Get betting splits
  let splits = null
  if (gameId) {
    splits = await getBettingSplits(gameId)
    if (splits && splits.sharpSide) {
      context.push(`Sharp money: ${splits.sharpSide}`)
    }
  }

  return {
    homeTeam: {
      name: homeTeam,
      stats: homeStats,
      trends: homeTrends,
      injuries: homeInjuries,
    },
    awayTeam: {
      name: awayTeam,
      stats: awayStats,
      trends: awayTrends,
      injuries: awayInjuries,
    },
    splits,
    context,
  }
}
