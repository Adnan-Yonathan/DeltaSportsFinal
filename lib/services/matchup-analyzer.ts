/**
 * Matchup Analyzer
 * Aggregates all relevant data for a matchup: stats, travel, rest, ATS, splits
 */

import { createClient } from '@/lib/supabase/server'

// ESPN API for schedule data
const ESPN_SITE_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
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
 * Uses static data which includes ORtg, DRtg, pace from Basketball Reference
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
 * Get team stats from static CSV data with injury adjustments
 */
export async function getTeamStats(teamName: string): Promise<TeamStats | null> {
  const abbrev = getTeamAbbrev(teamName)
  if (!abbrev) return null

  const advStats = parseTeamAdvStats()
  const stats = advStats.get(abbrev)

  if (!stats) return null

  // Base team stats from static CSV
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
    stats: TeamStats | null
    rest?: RestFactors
    travel?: TravelFactors
    trends?: any
    injuries?: any
    recentForm?: RecentForm
  }
  awayTeam: {
    name: string
    stats: TeamStats | null
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
  gameDate?: Date
): Promise<MatchupAnalysis> {
  const context: string[] = []

  // Get team stats (now includes injury adjustments)
  const homeStats = await getTeamStats(homeTeam)
  const awayStats = await getTeamStats(awayTeam)

  if (homeStats && awayStats) {
    context.push(`${homeTeam} ORtg: ${homeStats.ortg.toFixed(1)}, ${awayTeam} DRtg: ${awayStats.drtg.toFixed(1)}`)
    context.push(`${awayTeam} ORtg: ${awayStats.ortg.toFixed(1)}, ${homeTeam} DRtg: ${homeStats.drtg.toFixed(1)}`)
    context.push(`Pace: ${homeTeam} ${homeStats.pace.toFixed(1)}, ${awayTeam} ${awayStats.pace.toFixed(1)}`)

    // Add team style classification
    const homeStyle = classifyTeamStyle(homeStats)
    const awayStyle = classifyTeamStyle(awayStats)
    context.push(`🎯 Styles: ${homeTeam} (${homeStyle}) vs ${awayTeam} (${awayStyle})`)

    // Add style matchup adjustment if applicable
    const styleMatchup = calculateStyleMatchupAdjustment(homeStats, awayStats)
    if (styleMatchup.reason) {
      context.push(`🎲 ${styleMatchup.reason}`)
    }
  }

  // Get rest factors for both teams
  const homeRest = await getRestFactors(homeTeam, gameDate)
  const awayRest = await getRestFactors(awayTeam, gameDate)

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

  // Get recent form (L10)
  const homeForm = await getRecentForm(homeTeam)
  const awayForm = await getRecentForm(awayTeam)

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
