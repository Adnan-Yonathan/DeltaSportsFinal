/**
 * Matchup Analyzer
 * Aggregates all relevant data for a matchup: stats, travel, rest, ATS, splits
 */

import { resolveSportKey } from '@/lib/identity/sport'
import { createClient } from '@/lib/supabase/server'

// ESPN API for schedule data
const ESPN_SITE_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
import { nbaTravelMeta, type ArenaMeta } from '@/data/nba_travel_meta'
import type {
  TeamStats,
  FootballTeamStats,
  HockeyTeamStats,
  RestFactors,
  TravelFactors,
  PlayerStats,
  OpponentDefense,
} from './pregame-value-calculator'
import { getCbbAdvancedRatingsForTeam } from '@/lib/services/cbb-advanced-ratings'
import { getPlayerSeasonStats, getTeamStats as getSportsTeamStats } from '@/lib/sports-stats-api'
import { detectInjuries } from './injury-detector'

// Team abbreviation mappings
const TEAM_ALIAS_MAP: Record<string, string> = {
  atlantahawks: 'ATL', bostonceltics: 'BOS', brooklynnets: 'BKN',
  charlottehornets: 'CHA', chicagobulls: 'CHI', clevelandcavaliers: 'CLE',
  dallasmavericks: 'DAL', denvernuggets: 'DEN', detroitpistons: 'DET',
  goldenstatewarriors: 'GSW', houstonrockets: 'HOU', indianapacers: 'IND',
  losangelesclippers: 'LAC', losangeleslakers: 'LAL', memphisgrizzlies: 'MEM',
  miamiheat: 'MIA', milwaukeebucks: 'MIL', minnesotatimberwolves: 'MIN',
  neworleanspelicans: 'NOP', newyorkknicks: 'NYK', oklahomacitythunder: 'OKC',
  orlandomagic: 'ORL', philadelphia76ers: 'PHI', phoenixsuns: 'PHX',
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
 * Helpers for ESPN-derived team and player stats with injury adjustments
 */
const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const toPctDecimal = (value: unknown): number | undefined => {
  const num = toNumber(value)
  if (num == null) return undefined
  return num > 1 ? num / 100 : num
}

const formatPct = (value?: number | null): string => {
  if (value == null || !Number.isFinite(value)) return '0.0'
  const normalized = value > 1 ? value : value * 100
  return normalized.toFixed(1)
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const formatSigned = (value?: number | null) => {
  const num = value ?? 0
  return num > 0 ? `+${num.toFixed(1)}` : num.toFixed(1)
}

const DEFAULT_NBA_TEAM_STATS: TeamStats = {
  ortg: 115,
  drtg: 115,
  pace: 100,
  eFG: 0.54,
  ts: 0.57,
}

const DEFAULT_NFL_TEAM_STATS: FootballTeamStats = {
  pointsForPerGame: 22,
  pointsAgainstPerGame: 22,
  yardsPerPlay: 5.5,
  yardsAllowedPerPlay: 5.5,
  playsPerGame: 63,
  drivesPerGame: 11,
  pointsPerDrive: 2.05,
  thirdDownConvPct: 0.38,
  redZoneTouchdownPct: 0.55,
  redZoneScoringPct: 0.82,
  explosivePlayRate: 0.1,
  sackRate: 0.07,
  defensiveSackRate: 0.07,
  turnoverDifferential: 0,
}

const DEFAULT_NCAAF_TEAM_STATS: FootballTeamStats = {
  pointsForPerGame: 28,
  pointsAgainstPerGame: 28,
  yardsPerPlay: 6.0,
  yardsAllowedPerPlay: 6.0,
  playsPerGame: 70,
  drivesPerGame: 12,
  pointsPerDrive: 2.4,
  thirdDownConvPct: 0.41,
  redZoneTouchdownPct: 0.62,
  redZoneScoringPct: 0.85,
  explosivePlayRate: 0.11,
  sackRate: 0.06,
  defensiveSackRate: 0.06,
  turnoverDifferential: 0,
}

const DEFAULT_NHL_TEAM_STATS: HockeyTeamStats = {
  goalsForPerGame: 3.1,
  goalsAgainstPerGame: 3.1,
  shotsForPerGame: 30,
  shotsAgainstPerGame: 30,
}

const getCbbTeamStats = async (teamName: string): Promise<TeamStats | null> => {
  const [advanced, teams] = await Promise.all([
    getCbbAdvancedRatingsForTeam(teamName),
    getSportsTeamStats('basketball_ncaab', teamName),
  ])
  const entry = teams?.[0]
  const stats = entry?.stats || {}

  const ortg = advanced?.adjO ?? toNumber(stats.offensiveRating)
  const drtg = advanced?.adjD ?? toNumber(stats.defensiveRating)
  const pace = advanced?.tempo ?? toNumber(stats.pace)

  if (ortg == null || drtg == null || pace == null) return null

  return {
    ortg,
    drtg,
    pace,
    eFG: toPctDecimal(stats.effectiveFieldGoalPct ?? stats.effectiveFgPct),
    ts: toPctDecimal(stats.trueShootingPct),
  }
}

const getNbaTeamStats = async (teamName: string): Promise<TeamStats | null> => {
  const teams = await getSportsTeamStats('basketball_nba', teamName)
  const entry = teams?.[0]
  const stats = entry?.stats || {}

  const gamesPlayed = toNumber(stats.gamesPlayed)
  const pointsFor = toNumber(stats.pointsFor)
  const pointsAgainst = toNumber(stats.pointsAgainst)
  const rawPpg = toNumber(stats.pointsForPerGame) ?? (pointsFor != null && gamesPlayed ? pointsFor / gamesPlayed : null)
  const rawPapg =
    toNumber(stats.pointsAgainstPerGame) ??
    (pointsAgainst != null && gamesPlayed ? pointsAgainst / gamesPlayed : null)

  const validRating = (value: number | null) =>
    value != null && value >= 50 && value <= 150 ? value : null
  const validPace = (value: number | null) =>
    value != null && value >= 70 && value <= 120 ? value : null
  const validPpg = (value: number | null) =>
    value != null && value >= 70 && value <= 140 ? value : null

  const pace = validPace(toNumber(stats.pace)) ?? DEFAULT_NBA_TEAM_STATS.pace
  const ppg = validPpg(rawPpg)
  const papg = validPpg(rawPapg)
  const ortg =
    validRating(toNumber(stats.offensiveRating)) ??
    (ppg != null && pace ? Number(((ppg / pace) * 100).toFixed(1)) : null) ??
    DEFAULT_NBA_TEAM_STATS.ortg
  const drtg =
    validRating(toNumber(stats.defensiveRating)) ??
    (papg != null && pace ? Number(((papg / pace) * 100).toFixed(1)) : null) ??
    DEFAULT_NBA_TEAM_STATS.drtg

  return {
    ortg,
    drtg,
    pace,
    eFG: toPctDecimal(stats.effectiveFieldGoalPct ?? stats.effectiveFgPct),
    ts: toPctDecimal(stats.trueShootingPct),
  }
}

const calculateNflQbValue = (stats: {
  passerRating?: number | null
  passingYardsPerAttempt?: number | null
  completionPct?: number | null
  interceptionPct?: number | null
  sackRate?: number | null
}) => {
  const passerRating = stats.passerRating ?? null
  const ypa = stats.passingYardsPerAttempt ?? null
  const completionPct = stats.completionPct ?? null
  const interceptionPct = stats.interceptionPct ?? null
  const sackRate = stats.sackRate ?? null

  if (
    passerRating == null &&
    ypa == null &&
    completionPct == null &&
    interceptionPct == null
  ) {
    return null
  }

  const ratingAdj = passerRating != null ? (passerRating - 90) * 0.22 : 0
  const ypaAdj = ypa != null ? (ypa - 7.0) * 1.5 : 0
  const compAdj = completionPct != null ? (completionPct - 0.65) * 24 : 0
  const intAdj = interceptionPct != null ? (0.022 - interceptionPct) * 60 : 0
  const sackAdj = sackRate != null ? (0.07 - sackRate) * 30 : 0

  return clamp(ratingAdj + ypaAdj + compAdj + intAdj + sackAdj, -7.5, 7.5)
}

const getFootballTeamStats = async (
  teamName: string,
  sportKey: 'americanfootball_nfl' | 'americanfootball_ncaaf'
): Promise<FootballTeamStats | null> => {
  const teams = await getSportsTeamStats(sportKey, teamName)
  const entry = teams?.[0]
  const stats = entry?.stats || {}

  const gamesPlayed = toNumber(stats.gamesPlayed)
  const pointsFor =
    toNumber(stats.pointsFor) ??
    (gamesPlayed && toNumber(stats.pointsForPerGame) != null
      ? Number(stats.pointsForPerGame) * gamesPlayed
      : null)
  const pointsAgainst =
    toNumber(stats.pointsAgainst) ??
    (gamesPlayed && toNumber(stats.pointsAgainstPerGame) != null
      ? Number(stats.pointsAgainstPerGame) * gamesPlayed
      : null)
  const pointsForPerGame =
    toNumber(stats.pointsForPerGame) ??
    (pointsFor != null && gamesPlayed ? pointsFor / gamesPlayed : null)
  const pointsAgainstPerGame =
    toNumber(stats.pointsAgainstPerGame) ??
    (pointsAgainst != null && gamesPlayed ? pointsAgainst / gamesPlayed : null)
  const yardsPerPlay = toNumber(stats.yardsPerPlay)
  const totalPlays = toNumber(stats.totalOffensivePlays)
  const playsPerGame =
    toNumber(stats.playsPerGame) ??
    (totalPlays != null && gamesPlayed ? totalPlays / gamesPlayed : null)
  const totalDrives = toNumber(stats.totalDrives)
  const drivesPerGame =
    toNumber(stats.drivesPerGame) ??
    (totalDrives != null && gamesPlayed ? totalDrives / gamesPlayed : null)
  const pointsPerDrive =
    toNumber(stats.pointsPerDrive) ??
    (pointsFor != null && totalDrives ? pointsFor / totalDrives : null)
  const thirdDownConvPct = toPctDecimal(stats.thirdDownPct)
  const redZoneTouchdownPct = toPctDecimal(stats.redZoneTdPct)
  const redZoneScoringPct = toPctDecimal(stats.redZoneScoringPct)
  const explosivePlayRate = toPctDecimal(stats.explosivePlayRate) ?? toNumber(stats.explosivePlayRate)
  const passingYardsPerAttempt =
    toNumber(stats.passingYardsPerAttempt) ??
    toNumber(stats.yardsPerPassAttempt) ??
    (toNumber(stats.passingYards) != null && toNumber(stats.passingAttempts)
      ? Number(stats.passingYards) / Number(stats.passingAttempts)
      : null)
  const completionPct = toPctDecimal(stats.completionPct)
  const interceptionPct = toPctDecimal(stats.interceptionPct)
  const passerRating =
    toNumber(stats.passerRating) ??
    toNumber(stats.passingRating) ??
    toNumber(stats.quarterbackRating)
  const sacksAllowed = toNumber(stats.sacksAllowed)
  const passAttempts = toNumber(stats.passingAttempts)
  const sackRate =
    toPctDecimal(stats.sackRate) ??
    (sacksAllowed != null && passAttempts != null
      ? sacksAllowed / (sacksAllowed + passAttempts)
      : null)
  const defensiveSackRate = toPctDecimal(stats.defensiveSackRate) ?? toNumber(stats.defensiveSackRate)
  const yardsAllowedPerGame =
    toNumber(stats.yardsAllowedPerGame) ??
    (toNumber(stats.yardsAllowed) != null && gamesPlayed
      ? Number(stats.yardsAllowed) / gamesPlayed
      : null)
  const yardsAllowedPerPlay =
    yardsAllowedPerGame != null && (playsPerGame ?? 0) > 0
      ? yardsAllowedPerGame / (playsPerGame ?? 1)
      : toNumber(stats.yardsAllowedPerPlay)
  const turnoverDifferential = toNumber(stats.turnoverDifferential)
  const qbValue =
    sportKey === 'americanfootball_nfl'
      ? calculateNflQbValue({
          passerRating,
          passingYardsPerAttempt,
          completionPct,
          interceptionPct,
          sackRate,
        })
      : null

  if (pointsForPerGame == null || pointsAgainstPerGame == null) {
    return sportKey === 'americanfootball_nfl'
      ? DEFAULT_NFL_TEAM_STATS
      : DEFAULT_NCAAF_TEAM_STATS
  }

  return {
    pointsForPerGame: Number(pointsForPerGame.toFixed(1)),
    pointsAgainstPerGame: Number(pointsAgainstPerGame.toFixed(1)),
    yardsPerPlay,
    yardsAllowedPerPlay,
    playsPerGame,
    drivesPerGame,
    pointsPerDrive,
    thirdDownConvPct,
    redZoneTouchdownPct,
    redZoneScoringPct,
    explosivePlayRate,
    sackRate,
    defensiveSackRate,
    turnoverDifferential,
    qbValue,
    passerRating,
    passingYardsPerAttempt,
    completionPct,
    interceptionPct,
  }
}

const getHockeyTeamStats = async (
  teamName: string
): Promise<HockeyTeamStats | null> => {
  const teams = await getSportsTeamStats('icehockey_nhl', teamName)
  const entry = teams?.[0]
  const stats = entry?.stats || {}
  const gamesPlayed = toNumber(stats.gamesPlayed) ?? null
  const goalsFor = toNumber(stats.goalsFor)
  const goalsAgainst = toNumber(stats.goalsAgainst)
  const goalsForPerGame =
    toNumber(stats.goalsForPerGame) ??
    (goalsFor != null && gamesPlayed ? goalsFor / gamesPlayed : null)
  const goalsAgainstPerGame =
    toNumber(stats.goalsAgainstPerGame) ??
    (goalsAgainst != null && gamesPlayed ? goalsAgainst / gamesPlayed : null)
  const shotsForPerGame = toNumber(stats.shotsForPerGame)
  const shotsAgainstPerGame = toNumber(stats.shotsAgainstPerGame)

  if (goalsForPerGame == null || goalsAgainstPerGame == null) {
    return DEFAULT_NHL_TEAM_STATS
  }

  return {
    goalsForPerGame: Number(goalsForPerGame.toFixed(2)),
    goalsAgainstPerGame: Number(goalsAgainstPerGame.toFixed(2)),
    shotsForPerGame,
    shotsAgainstPerGame,
  }
}

export async function getTeamStats(
  teamName: string,
  sportKey?: string
): Promise<TeamStats | FootballTeamStats | HockeyTeamStats | null> {
  const resolvedSport = resolveSportKey(sportKey) ?? 'basketball_nba'
  if (resolvedSport === 'basketball_ncaab') {
    return getCbbTeamStats(teamName)
  }
  if (resolvedSport === 'americanfootball_nfl') {
    return getFootballTeamStats(teamName, resolvedSport)
  }
  if (resolvedSport === 'americanfootball_ncaaf') {
    return getFootballTeamStats(teamName, resolvedSport)
  }
  if (resolvedSport === 'icehockey_nhl') {
    return getHockeyTeamStats(teamName)
  }

  const baseStats = await getNbaTeamStats(teamName)
  if (!baseStats) return null

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

const pickStat = (stats: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = toNumber(stats[key])
    if (value != null) return value
  }
  return null
}

export async function getPlayerStats(
  playerName: string,
  statType: string
): Promise<PlayerStats | null> {
  const data = await getPlayerSeasonStats(playerName, 'basketball_nba')
  const stats = (data?.stats || {}) as Record<string, unknown>
  if (!Object.keys(stats).length) return null

  const points = pickStat(stats, ['PTS', 'PPG', 'points', 'pointsPerGame']) ?? 0
  const rebounds = pickStat(stats, ['REB', 'RPG', 'TRB', 'rebounds']) ?? 0
  const assists = pickStat(stats, ['AST', 'APG', 'assists']) ?? 0
  const threes =
    pickStat(stats, ['THREE_PM', '3P', 'threePointersMade', 'threesMadePerGame']) ??
    0

  let seasonAverage = points
  switch (statType.toLowerCase()) {
    case 'points':
    case 'pts':
      seasonAverage = points
      break
    case 'rebounds':
    case 'reb':
    case 'trb':
      seasonAverage = rebounds
      break
    case 'assists':
    case 'ast':
      seasonAverage = assists
      break
    case 'threes':
    case '3pm':
    case 'three_pointers':
      seasonAverage = threes
      break
    case 'pra':
    case 'pts_reb_ast':
      seasonAverage = points + rebounds + assists
      break
    default:
      seasonAverage = points
  }

  return {
    seasonAverage,
    usage: pickStat(stats, ['USG_PERCENT', 'usageRate', 'USG%']) ?? 25,
    minutesPerGame: pickStat(stats, ['MPG', 'minutesPerGame', 'minutes']) ?? 0,
    pace: pickStat(stats, ['pace', 'PACE']) ?? undefined,
    vorp: pickStat(stats, ['VORP']) ?? undefined,
    per: pickStat(stats, ['PER']) ?? undefined,
    ws48: pickStat(stats, ['WS48', 'winSharesPer48']) ?? undefined,
    nbaRating: pickStat(stats, ['NBA_RATING', 'NBARating', 'nbaRating']) ?? undefined,
    trueShootingPct: pickStat(stats, ['TS_PERCENT', 'trueShootingPct', 'TS%']) ?? undefined,
    effectiveFgPct: pickStat(stats, ['EFG_PERCENT', 'effectiveFGPct', 'EFG%']) ?? undefined,
    scoringEfficiency: pickStat(stats, ['SCORING_EFFICIENCY', 'scoringEfficiency']) ?? undefined,
    shootingEfficiency: pickStat(stats, ['SHOOTING_EFFICIENCY', 'shootingEfficiency']) ?? undefined,
    pointsPerEstimatedPossessions:
      pickStat(stats, ['POINTS_PER_EST_POSSESSIONS', 'pointsPerEstimatedPossessions']) ?? undefined,
    assistsPerGame: assists,
    stealsPerGame: pickStat(stats, ['STL', 'SPG', 'steals', 'stealsPerGame']) ?? undefined,
    blocksPerGame: pickStat(stats, ['BLK', 'BPG', 'blocks', 'blocksPerGame']) ?? undefined,
    defensiveReboundsPerGame:
      pickStat(stats, ['DRB', 'DREB', 'defensiveRebounds', 'defensiveReboundsPerGame']) ?? undefined,
    defensiveReboundRate:
      pickStat(stats, ['DRB_PERCENT', 'defReboundRate', 'defensiveReboundRate']) ?? undefined,
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
 * Fetch ESPN scoreboard for a specific date
 */
async function fetchScoreboard(dateStr: string): Promise<any | null> {
  const url = `${ESPN_SITE_API_BASE}/scoreboard?dates=${dateStr.replace(/-/g, '')}&limit=500`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    console.error(`[REST FACTORS] Failed to fetch scoreboard for ${dateStr}:`, error)
    return null
  }
}

/**
 * Get rest factors for a team by looking at recent games
 * Fetches last 5 days of games from ESPN scoreboard
 */
export async function getRestFactors(teamName: string, gameDate?: Date): Promise<RestFactors | null> {
  const teamAbbrev = getTeamAbbrev(teamName)
  if (!teamAbbrev) return null

  try {
    const targetDate = gameDate || new Date()
    const recentGames: { date: Date; location: string; wasHome: boolean }[] = []

    // Look back 5 days for recent games
    for (let daysBack = 1; daysBack <= 5; daysBack++) {
      const checkDate = new Date(targetDate)
      checkDate.setDate(checkDate.getDate() - daysBack)
      const dateStr = checkDate.toISOString().split('T')[0]

      const scoreboard = await fetchScoreboard(dateStr)
      if (!scoreboard?.events) continue

      // Find games involving this team
      for (const event of scoreboard.events) {
        const status = event?.status?.type?.state
        // Only count completed games
        if (status !== 'post' && status !== 'final') continue

        const competitors = event?.competitions?.[0]?.competitors || []
        const teamComp = competitors.find((c: any) => {
          const abbr = c?.team?.abbreviation?.toUpperCase()
          return abbr === teamAbbrev
        })

        if (teamComp) {
          const wasHome = teamComp.homeAway === 'home'
          const opponent = competitors.find((c: any) => c.homeAway !== teamComp.homeAway)
          const location = wasHome ? teamAbbrev : opponent?.team?.abbreviation || ''

          recentGames.push({
            date: checkDate,
            location,
            wasHome,
          })
        }
      }
    }

    // Sort by date (most recent first)
    recentGames.sort((a, b) => b.date.getTime() - a.date.getTime())

    // Calculate rest factors
    const today = targetDate.getTime()
    let daysRest = 7 // Default to well-rested if no recent games found
    let isBackToBack = false
    const gamesInLast5Days = recentGames.length

    if (recentGames.length > 0) {
      const lastGame = recentGames[0]
      const daysSinceLastGame = Math.floor((today - lastGame.date.getTime()) / (1000 * 60 * 60 * 24))
      daysRest = daysSinceLastGame
      isBackToBack = daysSinceLastGame <= 1
    }

    console.log(`[REST FACTORS] ${teamName}: ${daysRest} days rest, B2B: ${isBackToBack}, Games L5: ${gamesInLast5Days}`)

    return {
      daysRest,
      isBackToBack,
      gamesInLast5Days,
    }
  } catch (error) {
    console.error(`[REST FACTORS] Error calculating rest for ${teamName}:`, error)
    return null
  }
}

/**
 * Team playing style classification
 */
export type TeamStyle =
  | 'fast-paced-offense'   // High pace + high ORtg
  | 'halfcourt-offense'    // Low pace + high ORtg
  | 'defensive-grinder'    // Low pace + elite DRtg
  | 'run-and-gun'          // Very high pace
  | 'balanced'             // Average in most categories

/**
 * Classify a team's playing style based on their stats
 */
export function classifyTeamStyle(stats: TeamStats): TeamStyle {
  const avgPace = 100.0
  const avgORtg = 115.0
  const avgDRtg = 115.0

  const isHighPace = stats.pace >= avgPace + 2
  const isLowPace = stats.pace <= avgPace - 2
  const isVeryHighPace = stats.pace >= avgPace + 4
  const isEliteOffense = stats.ortg >= avgORtg + 3
  const isEliteDefense = stats.drtg <= avgDRtg - 3

  if (isVeryHighPace) {
    return 'run-and-gun'
  }
  if (isHighPace && isEliteOffense) {
    return 'fast-paced-offense'
  }
  if (isLowPace && isEliteOffense) {
    return 'halfcourt-offense'
  }
  if (isLowPace && isEliteDefense) {
    return 'defensive-grinder'
  }
  return 'balanced'
}

/**
 * Calculate matchup adjustment based on team styles
 * Returns adjustment in points (positive = favors home team)
 */
export function calculateStyleMatchupAdjustment(
  homeStats: TeamStats,
  awayStats: TeamStats
): { adjustment: number; reason: string } {
  const homeStyle = classifyTeamStyle(homeStats)
  const awayStyle = classifyTeamStyle(awayStats)

  let adjustment = 0
  let reason = ''

  // Fast-paced teams struggle against defensive grinders
  if (homeStyle === 'run-and-gun' && awayStyle === 'defensive-grinder') {
    adjustment -= 1.5
    reason = 'Pace mismatch: Home fast offense vs Away grinding defense'
  } else if (awayStyle === 'run-and-gun' && homeStyle === 'defensive-grinder') {
    adjustment += 1.5
    reason = 'Pace mismatch: Away fast offense vs Home grinding defense'
  }

  // Halfcourt teams can exploit run-and-gun teams that don't defend
  if (homeStyle === 'halfcourt-offense' && awayStyle === 'run-and-gun') {
    const awayDefenseRating = awayStats.drtg
    if (awayDefenseRating > 117) {
      adjustment += 1.0
      reason = 'Halfcourt exploits poor run-and-gun defense'
    }
  } else if (awayStyle === 'halfcourt-offense' && homeStyle === 'run-and-gun') {
    const homeDefenseRating = homeStats.drtg
    if (homeDefenseRating > 117) {
      adjustment -= 1.0
      reason = 'Halfcourt exploits poor run-and-gun defense'
    }
  }

  // When two grinders meet, the spread should compress
  if (homeStyle === 'defensive-grinder' && awayStyle === 'defensive-grinder') {
    // This will be handled by pace scaling, but we note it
    reason = 'Two grinding defenses - expect low-scoring game'
  }

  // Fast teams vs fast teams - expect high variance
  if ((homeStyle === 'run-and-gun' || homeStyle === 'fast-paced-offense') &&
      (awayStyle === 'run-and-gun' || awayStyle === 'fast-paced-offense')) {
    reason = 'Pace-up game - high variance expected'
  }

  return { adjustment, reason }
}

/**
 * Recent form data for a team (Last 10 games)
 */
export interface RecentForm {
  wins: number
  losses: number
  avgMargin: number // Average point margin in L10
  streak: number // Positive = wins, negative = losses
  performanceRating: number // 0-100 scale of recent performance
}

/**
 * Get recent form data by analyzing last 10 games
 */
export async function getRecentForm(teamName: string): Promise<RecentForm | null> {
  const teamAbbrev = getTeamAbbrev(teamName)
  if (!teamAbbrev) return null

  try {
    const games: { margin: number; won: boolean }[] = []
    const today = new Date()

    // Look back up to 30 days to find 10 games
    for (let daysBack = 1; daysBack <= 30 && games.length < 10; daysBack++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - daysBack)
      const dateStr = checkDate.toISOString().split('T')[0]

      const scoreboard = await fetchScoreboard(dateStr)
      if (!scoreboard?.events) continue

      // Find games involving this team
      for (const event of scoreboard.events) {
        if (games.length >= 10) break

        const status = event?.status?.type?.state
        // Only count completed games
        if (status !== 'post' && status !== 'final') continue

        const competitors = event?.competitions?.[0]?.competitors || []
        const teamComp = competitors.find((c: any) => {
          const abbr = c?.team?.abbreviation?.toUpperCase()
          return abbr === teamAbbrev
        })

        if (teamComp) {
          const opponent = competitors.find((c: any) => c !== teamComp)
          const teamScore = parseInt(teamComp?.score || '0', 10)
          const opponentScore = parseInt(opponent?.score || '0', 10)
          const margin = teamScore - opponentScore
          const won = margin > 0

          games.push({ margin, won })
        }
      }
    }

    if (games.length === 0) {
      return null
    }

    // Calculate metrics
    const wins = games.filter(g => g.won).length
    const losses = games.filter(g => !g.won).length
    const avgMargin = games.reduce((sum, g) => sum + g.margin, 0) / games.length

    // Calculate streak (most recent games first)
    let streak = 0
    const direction = games[0]?.won ? 1 : -1
    for (const game of games) {
      if (game.won && direction === 1) streak++
      else if (!game.won && direction === -1) streak--
      else break
    }

    // Performance rating: blend win%, margin, and recency
    // Win% contributes 60%, normalized margin contributes 40%
    const winPct = wins / games.length
    const normalizedMargin = Math.max(-20, Math.min(20, avgMargin)) / 20 // Clamp to -20 to +20, normalize to -1 to 1
    const marginScore = (normalizedMargin + 1) / 2 // Convert to 0-1 scale
    const performanceRating = Math.round((winPct * 0.6 + marginScore * 0.4) * 100)

    console.log(`[RECENT FORM] ${teamName}: ${wins}-${losses} L${games.length}, Avg margin: ${avgMargin.toFixed(1)}, Streak: ${streak > 0 ? 'W' : 'L'}${Math.abs(streak)}`)

    return {
      wins,
      losses,
      avgMargin,
      streak,
      performanceRating,
    }
  } catch (error) {
    console.error(`[RECENT FORM] Error calculating form for ${teamName}:`, error)
    return null
  }
}

/**
 * Analyze a full matchup
 */
export interface MatchupAnalysis {
  homeTeam: {
    name: string
    stats: TeamStats | FootballTeamStats | HockeyTeamStats | null
    rest?: RestFactors
    travel?: TravelFactors
    trends?: any
    injuries?: any
    recentForm?: RecentForm
  }
  awayTeam: {
    name: string
    stats: TeamStats | FootballTeamStats | HockeyTeamStats | null
    rest?: RestFactors
    travel?: TravelFactors
    trends?: any
    injuries?: any
    recentForm?: RecentForm
  }
  splits?: any
  context: string[]
}

export async function analyzeMatchup(
  homeTeam: string,
  awayTeam: string,
  gameId?: string,
  gameDate?: Date,
  sportKey?: string
): Promise<MatchupAnalysis> {
  const context: string[] = []
  const resolvedSport = resolveSportKey(sportKey) ?? 'basketball_nba'
  const isNba = resolvedSport === 'basketball_nba'
  const isFootball =
    resolvedSport === 'americanfootball_nfl' ||
    resolvedSport === 'americanfootball_ncaaf'
  const isHockey = resolvedSport === 'icehockey_nhl'

  // Get team stats (now includes injury adjustments)
  const homeStats = await getTeamStats(homeTeam, resolvedSport)
  const awayStats = await getTeamStats(awayTeam, resolvedSport)

  if (homeStats && awayStats) {
    if (isNba || resolvedSport === 'basketball_ncaab') {
      const home = homeStats as TeamStats
      const away = awayStats as TeamStats
      context.push(
        `${homeTeam} ORtg: ${home.ortg.toFixed(1)}, ${awayTeam} DRtg: ${away.drtg.toFixed(1)}`
      )
      context.push(
        `${awayTeam} ORtg: ${away.ortg.toFixed(1)}, ${homeTeam} DRtg: ${home.drtg.toFixed(1)}`
      )
      context.push(
        `Pace: ${homeTeam} ${home.pace.toFixed(1)}, ${awayTeam} ${away.pace.toFixed(1)}`
      )
    } else if (isFootball) {
      const home = homeStats as FootballTeamStats
      const away = awayStats as FootballTeamStats
      context.push(
        `${homeTeam} PPG: ${home.pointsForPerGame.toFixed(1)}, ${awayTeam} PAPG: ${away.pointsAgainstPerGame.toFixed(1)}`
      )
      context.push(
        `${awayTeam} PPG: ${away.pointsForPerGame.toFixed(1)}, ${homeTeam} PAPG: ${home.pointsAgainstPerGame.toFixed(1)}`
      )
      if (home.yardsPerPlay != null || away.yardsPerPlay != null) {
        context.push(
          `Yards/play: ${homeTeam} ${(home.yardsPerPlay ?? 0).toFixed(2)}, ${awayTeam} ${(away.yardsPerPlay ?? 0).toFixed(2)}`
        )
      }
      if (home.pointsPerDrive != null || away.pointsPerDrive != null) {
        context.push(
          `Points/drive: ${homeTeam} ${(home.pointsPerDrive ?? 0).toFixed(2)}, ${awayTeam} ${(away.pointsPerDrive ?? 0).toFixed(2)}`
        )
      }
      if (home.thirdDownConvPct != null || away.thirdDownConvPct != null) {
        context.push(
          `3rd down: ${homeTeam} ${formatPct(home.thirdDownConvPct)}%, ${awayTeam} ${formatPct(away.thirdDownConvPct)}%`
        )
      }
      if (home.redZoneTouchdownPct != null || away.redZoneTouchdownPct != null) {
        context.push(
          `Red zone TD: ${homeTeam} ${formatPct(home.redZoneTouchdownPct)}%, ${awayTeam} ${formatPct(away.redZoneTouchdownPct)}%`
        )
      }
      if (home.explosivePlayRate != null || away.explosivePlayRate != null) {
        context.push(
          `Explosive rate: ${homeTeam} ${((home.explosivePlayRate ?? 0) * 100).toFixed(1)}%, ${awayTeam} ${((away.explosivePlayRate ?? 0) * 100).toFixed(1)}%`
        )
      }
      if (home.sackRate != null || away.sackRate != null) {
        context.push(
          `Sack rate: ${homeTeam} ${((home.sackRate ?? 0) * 100).toFixed(1)}%, ${awayTeam} ${((away.sackRate ?? 0) * 100).toFixed(1)}%`
        )
      }
      if (home.qbValue != null || away.qbValue != null) {
        context.push(
          `QB value: ${homeTeam} ${formatSigned(home.qbValue)}, ${awayTeam} ${formatSigned(away.qbValue)}`
        )
      }
      if (home.yardsAllowedPerPlay != null || away.yardsAllowedPerPlay != null) {
        context.push(
          `Yards allowed/play: ${homeTeam} ${(home.yardsAllowedPerPlay ?? 0).toFixed(2)}, ${awayTeam} ${(away.yardsAllowedPerPlay ?? 0).toFixed(2)}`
        )
      }
      if (home.turnoverDifferential != null || away.turnoverDifferential != null) {
        context.push(
          `Turnover diff: ${homeTeam} ${home.turnoverDifferential ?? 0}, ${awayTeam} ${away.turnoverDifferential ?? 0}`
        )
      }
    } else if (isHockey) {
      const home = homeStats as HockeyTeamStats
      const away = awayStats as HockeyTeamStats
      context.push(
        `${homeTeam} GPG: ${home.goalsForPerGame.toFixed(2)}, ${awayTeam} GAA: ${away.goalsAgainstPerGame.toFixed(2)}`
      )
      context.push(
        `${awayTeam} GPG: ${away.goalsForPerGame.toFixed(2)}, ${homeTeam} GAA: ${home.goalsAgainstPerGame.toFixed(2)}`
      )
    }

    if (isNba) {
      // Add team style classification
      const homeStyle = classifyTeamStyle(homeStats as TeamStats)
      const awayStyle = classifyTeamStyle(awayStats as TeamStats)
      context.push(`🎯 Styles: ${homeTeam} (${homeStyle}) vs ${awayTeam} (${awayStyle})`)

      // Add style matchup adjustment if applicable
      const styleMatchup = calculateStyleMatchupAdjustment(
        homeStats as TeamStats,
        awayStats as TeamStats
      )
      if (styleMatchup.reason) {
        context.push(`🎲 ${styleMatchup.reason}`)
      }
    }
  }

  // Get rest factors for both teams (NBA only for now)
  const homeRest = isNba ? await getRestFactors(homeTeam, gameDate) : null
  const awayRest = isNba ? await getRestFactors(awayTeam, gameDate) : null

  // Add rest context
  if (homeRest) {
    if (homeRest.isBackToBack) {
      context.push(`⚠️ ${homeTeam} on BACK-TO-BACK`)
    } else if (homeRest.daysRest >= 3) {
      context.push(`✓ ${homeTeam} well-rested (${homeRest.daysRest} days)`)
    }
    if (homeRest.gamesInLast5Days >= 4) {
      context.push(`⚠️ ${homeTeam} heavy schedule (${homeRest.gamesInLast5Days} games in 5 days)`)
    }
  }

  if (awayRest) {
    if (awayRest.isBackToBack) {
      context.push(`⚠️ ${awayTeam} on BACK-TO-BACK`)
    } else if (awayRest.daysRest >= 3) {
      context.push(`✓ ${awayTeam} well-rested (${awayRest.daysRest} days)`)
    }
    if (awayRest.gamesInLast5Days >= 4) {
      context.push(`⚠️ ${awayTeam} heavy schedule (${awayRest.gamesInLast5Days} games in 5 days)`)
    }
  }

  // Get injury reports (NBA only for now)
  const homeInjuries = isNba ? await detectInjuries(homeTeam) : null
  const awayInjuries = isNba ? await detectInjuries(awayTeam) : null

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

  // Get ATS trends (NBA only)
  const homeTrends = isNba ? await getATSTrends(homeTeam) : null
  const awayTrends = isNba ? await getATSTrends(awayTeam) : null

  if (homeTrends) {
    context.push(`${homeTeam} ATS: ${homeTrends.overall}, Last 10: ${homeTrends.last10}`)
  }
  if (awayTrends) {
    context.push(`${awayTeam} ATS: ${awayTrends.overall}, Last 10: ${awayTrends.last10}`)
  }

  // Get recent form (NBA only)
  const homeForm = isNba ? await getRecentForm(homeTeam) : null
  const awayForm = isNba ? await getRecentForm(awayTeam) : null

  if (homeForm) {
    const streakLabel = homeForm.streak > 0 ? `W${homeForm.streak}` : `L${Math.abs(homeForm.streak)}`
    context.push(`📈 ${homeTeam} L10: ${homeForm.wins}-${homeForm.losses} (${streakLabel}), Avg margin: ${homeForm.avgMargin > 0 ? '+' : ''}${homeForm.avgMargin.toFixed(1)}`)
  }
  if (awayForm) {
    const streakLabel = awayForm.streak > 0 ? `W${awayForm.streak}` : `L${Math.abs(awayForm.streak)}`
    context.push(`📈 ${awayTeam} L10: ${awayForm.wins}-${awayForm.losses} (${streakLabel}), Avg margin: ${awayForm.avgMargin > 0 ? '+' : ''}${awayForm.avgMargin.toFixed(1)}`)
  }

  // Get betting splits
  let splits = null
  if (gameId) {
    splits = await getBettingSplits(gameId)
    if (splits && splits.sharpSide) {
      context.push(`Sharp money: ${splits.sharpSide}`)
    }
  }

  console.log('[MATCHUP ANALYZER] Returning matchup result for:', homeTeam, 'vs', awayTeam)
  return {
    homeTeam: {
      name: homeTeam,
      stats: homeStats,
      rest: homeRest || undefined,
      trends: homeTrends,
      injuries: homeInjuries,
      recentForm: homeForm || undefined,
    },
    awayTeam: {
      name: awayTeam,
      stats: awayStats,
      rest: awayRest || undefined,
      trends: awayTrends,
      injuries: awayInjuries,
      recentForm: awayForm || undefined,
    },
    splits,
    context,
  }
}

