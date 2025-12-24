import { RecentPerformance } from '@/lib/utils/recent-performances'
import {
  getSportsReferencePlayerSeasonStats,
  getSportsReferenceTeamStats,
} from '@/lib/providers/sports-reference'
import { findNbaStaticPlayer } from '@/lib/nba-static-stats'
import { findStaticNbaTeam, getStaticNbaTeams } from '@/lib/nba-static-team-stats'
import {
  fetchAthleteStatistics,
  fetchInjuries as fetchEspnNFLInjuries,
  fetchRoster as fetchEspnNFLRoster,
  fetchTeamList,
  fetchTeamStatistics,
  statHelpers,
  type EspnStatCategory,
  type EspnTeamMeta,
} from '@/lib/providers/espn-nfl'

type NextFetchInit = RequestInit & { next?: { revalidate?: number } }

const fetchWithRevalidate = (url: string, revalidateSeconds: number) => {
  return fetch(url, { next: { revalidate: revalidateSeconds } } as NextFetchInit)
}

// Comprehensive Sports Statistics API Integration
// Supports NBA, NFL, MLB, NHL - Player stats, team stats, advanced analytics, injuries

export interface PlayerStats {
  id?: string
  name: string
  team: string
  position?: string
  stats: Record<string, number | string>
  season?: string
  headshot?: string
  sport?: string
  recent?: RecentPerformance[]
}

export interface RosterPlayer {
  id: string
  name: string
  fullName: string
  team: string
  teamAbbr: string
  position: string
  jersey?: string
  height?: string
  weight?: string
  age?: number
  experience?: number
  status?: string // Active, Injured, Out
  headshot?: string
  sport?: string
  stats?: Record<string, number | string> // Player statistics
}

export interface TeamStats {
  team: string
  wins: number
  losses: number
  winPct: number
  stats: Record<string, number | string | null>
  rank?: number
  season?: string
  sport?: string
}

export interface AdvancedTeamStats {
  team: string
  teamAbbr?: string
  pace?: number
  oRating?: number
  dRating?: number
  netRating?: number
  reboundPct?: number
  turnoverPct?: number
  tsPct?: number
  epaPerPlay?: number
  successRate?: number
  passRate?: number
  rushRate?: number
  yardsPerPlay?: number
}

const SPORT_ALIASES: Record<string, string> = {
  nba: 'basketball_nba',
  basketball: 'basketball_nba',
  basketball_nba: 'basketball_nba',
  nfl: 'americanfootball_nfl',
  football: 'americanfootball_nfl',
  americanfootball: 'americanfootball_nfl',
  americanfootball_nfl: 'americanfootball_nfl',
  mlb: 'baseball_mlb',
  baseball: 'baseball_mlb',
  baseball_mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  hockey: 'icehockey_nhl',
  icehockey: 'icehockey_nhl',
  icehockey_nhl: 'icehockey_nhl',
}

const SPORT_PRIORITY = ['basketball_nba', 'americanfootball_nfl', 'baseball_mlb', 'icehockey_nhl']
const ESPN_SPORT_PATH: Record<string, string> = {
  basketball_nba: 'basketball/nba',
  basketball_ncaab: 'basketball/mens-college-basketball',
  americanfootball_nfl: 'football/nfl',
  americanfootball_ncaaf: 'football/college-football',
}

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()

const fetchEspnRecentGames = async (
  athleteId: string,
  sportPath: string,
  options?: {
    season?: string | number
    seasonType?: number
    maxGames?: number
  }
): Promise<RecentPerformance[]> => {
  try {
    const season = options?.season
    const seasonType = options?.seasonType ?? 2 // 2 = regular season on ESPN
    const maxGames = options?.maxGames ?? 5
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/${sportPath}/athletes/${athleteId}/gamelog${
      season ? `?season=${season}&seasontype=${seasonType}` : `?seasontype=${seasonType}`
    }`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    const gamesSource =
      data?.events ||
      data?.gameLog ||
      data?.gamelog ||
      data?.items ||
      data?.entries ||
      []
    const games: any[] = Array.isArray(gamesSource) ? gamesSource : []

    const result: RecentPerformance[] = []
    for (const game of games) {
      if (result.length >= maxGames) break
      const date = game?.date || game?.gameDate || game?.game_date || ''
      const opponent =
        game?.opponent?.displayName ||
        game?.opponent?.name ||
        game?.opponent ||
        game?.opponentName ||
        ''
      const resultText = game?.result || game?.gameResult || game?.outcome || ''
      const stats: Record<string, number> = {}

      const statBlocks: any[] = Array.isArray(game?.stats) ? game.stats : Array.isArray(game?.statistics) ? game.statistics : []
      for (const block of statBlocks) {
        const entries: any[] = Array.isArray(block?.stats) ? block.stats : Array.isArray(block) ? block : []
        for (const entry of entries) {
          const label = entry?.label || entry?.displayName || entry?.name
          const value = typeof entry?.value === 'number' ? entry.value : Number(entry?.value)
          if (!label || !Number.isFinite(value)) continue
          const key = label.toString().toUpperCase().replace(/\s+/g, '_')
          stats[key] = value
        }
      }

      result.push({
        date: date ? String(date) : '',
        opponent: String(opponent),
        result: resultText ? String(resultText) : undefined,
        stats,
      })
    }

    return result
  } catch (err) {
    console.warn('[ESPN] gamelog fetch failed', err)
    return []
  }
}

const resolveSportKey = (sport?: string | null): string | undefined => {
  if (!sport) return undefined
  const key = sport.trim().toLowerCase()
  return SPORT_ALIASES[key] || SPORT_ALIASES[key.replace(/[_\s-]+/g, '_')] || undefined
}

const getCurrentNBASeasonLabel = () => {
  const now = new Date()
  const month = now.getUTCMonth()
  const startYear = month >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const nextYear = String(startYear + 1)
  return `${startYear}-${nextYear.slice(-2)}`
}

const getCurrentNBASeasonYear = () => {
  const now = new Date()
  const month = now.getUTCMonth()
  const startYear = month >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  // ESPN often expects the ending year for season param (e.g., 2025 for 2024-25)
  return startYear + 1
}

const getCurrentNFLSeasonYear = () => {
  const now = new Date()
  const month = now.getUTCMonth() // 0-11
  const year = now.getUTCFullYear()
  // Season starts in August/September; early months belong to previous year
  return month >= 6 ? year : year - 1
}

const PLAYER_STATS_CACHE_TTL = 1000 * 60 * 15 // 15 minutes
const playerStatsCache = new Map<string, { data: PlayerStats | null; ts: number }>()
const TEAM_STATS_CACHE_TTL = 1000 * 60 * 10 // 10 minutes
let nflTeamStatsCache: { ts: number; data: Array<{ meta: EspnTeamMeta; categories: EspnStatCategory[] }> } | null = null
let nflRosterCache: { ts: number; roster: RosterPlayer[] } | null = null
const NFL_ROSTER_CACHE_TTL = 1000 * 60 * 60 // 1 hour

const extractEspnId = (content: any): string | null => {
  const web = content?.link?.web
  if (typeof web === 'string') {
    const match = web.match(/\/id\/(\d+)/)
    if (match?.[1]) return match[1]
  }
  const uid = content?.uid
  const uidMatch = typeof uid === 'string' ? uid.match(/~a:(\d+)/) : null
  return uidMatch?.[1] ?? null
}

const searchNBAPlayerFast = async (playerName: string): Promise<RosterPlayer | null> => {
  try {
    const url = `https://site.api.espn.com/apis/search/v2?type=player&limit=5&query=${encodeURIComponent(
      playerName
    )}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const playerResults = data?.results?.find((r: any) => r?.type === 'player')?.contents
    if (!Array.isArray(playerResults)) return null

    const target = normalizeName(playerName)
    const match = playerResults.find((entry: any) => normalizeName(entry?.displayName || '') === target)
    if (!match) return null

    const espnId = extractEspnId(match)
    if (!espnId) return null

    // Fetch profile to fill team/position; keep this lightweight
    let profile: any = null
    try {
      const profileRes = await fetch(
        `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}`,
        { cache: 'no-store' }
      )
      if (profileRes.ok) {
        profile = await profileRes.json()
      }
    } catch (err) {
      console.warn('NBA profile fetch failed (non-fatal):', err)
    }

    const name = match.displayName || profile?.fullName || playerName
    return {
      id: espnId,
      name,
      fullName: name,
      team: profile?.team?.displayName || match?.subtitle || '',
      teamAbbr: profile?.team?.abbreviation || '',
      position:
        profile?.position?.abbreviation ||
        profile?.position?.displayName ||
        profile?.position?.name ||
        'N/A',
      jersey: profile?.jersey,
      height: profile?.displayHeight,
      weight: profile?.displayWeight,
      age: profile?.age,
      experience: profile?.experience?.years,
      status: profile?.status?.type ?? 'Active',
      headshot: profile?.headshot?.href || match?.image?.default,
    }
  } catch (error) {
    console.warn('NBA fast search failed:', error)
    return null
  }
}

interface NBAPlayerDirectoryEntry {
  id: string
  name: string
  teamId: string | null
  teamName: string
  teamAbbr: string | null
}

type NBAPlayerDirectoryCache =
  | {
      season: string
      timestamp: number
      entries: NBAPlayerDirectoryEntry[]
    }
  | null

let nbaPlayerDirectoryCache: NBAPlayerDirectoryCache = null

const NBA_ROSTER_CACHE_TTL = 1000 * 60 * 15
let nbaRosterCache: { timestamp: number; roster: RosterPlayer[] } | null = null

const loadNBAPlayerDirectory = async (): Promise<NBAPlayerDirectoryEntry[]> => {
  // stats.nba.com calls are disabled; rely on ESPN roster data via getNBARoster
  // Directory lookup is bypassed; return empty and fall back to roster search
  return []
}

const findNBAPlayerId = async (playerName: string, seasonLabel: string): Promise<string | null> => {
  // stats.nba.com calls are disabled; rely on ESPN roster data in searchNBAPlayer
  return null
}

const fetchNBAPlayerBaseStats = async (playerId: string, seasonLabel: string) => {
  // stats.nba.com is disabled; base stats are sourced from ESPN instead
  return null
}

const fetchNBAPlayerAdvancedStats = async (playerId: string, seasonLabel: string) => {
  // stats.nba.com is disabled; advanced splits are unavailable from ESPN endpoints
  return null
}

type EspnSearchTarget = {
  id: string
  name: string
  team?: string
  teamAbbr?: string
  position?: string
  headshot?: string
}

const searchEspnAthlete = async (
  playerName: string,
  sportPath: string,
  leagueAbbrev?: string
): Promise<EspnSearchTarget | null> => {
  try {
    const url = `https://site.api.espn.com/apis/search/v2?type=player&limit=10&query=${encodeURIComponent(
      playerName
    )}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const results: any[] = data?.results?.find((r: any) => r?.type === 'player')?.contents || []
    if (!Array.isArray(results)) return null
    const target = normalizeName(playerName)
    const matches = results.filter((entry: any) => {
      if (!leagueAbbrev) return true
      const league = entry?.leagues?.[0]?.leagueAbbrev || entry?.leagues?.[0]?.abbr
      return league && league.toLowerCase() === leagueAbbrev.toLowerCase()
    })
    const pick =
      matches.find((entry: any) => normalizeName(entry?.displayName || '') === target) ||
      matches.find((entry: any) => normalizeName(entry?.displayName || '').includes(target)) ||
      matches[0]
    if (!pick?.id) return null
    return {
      id: String(pick.id),
      name: pick.displayName || playerName,
      team: pick.team || pick.teamName || '',
      teamAbbr: pick.teamAbbreviation || '',
      position: pick.position || '',
      headshot: pick.image?.default || pick.image?.href || undefined,
    }
  } catch (err) {
    console.warn('[ESPN] search failed', err)
    return null
  }
}

type ESPNPlayerSummary = {
  ppg: number | null
  rpg: number | null
  apg: number | null
  fgPct: number | null
  threePct: number | null
  seasonLabel: string
}

const fetchESPNNBAPlayerStats = async (espnId: string): Promise<ESPNPlayerSummary | null> => {
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}/stats?region=us&lang=en`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return null
    }
    const data = await res.json()
    const categories = data?.categories ?? []
    const averages =
      categories.find((c: any) => c.name === 'averages') || categories[0]
    if (!averages) return null

    const labels: string[] = averages.labels ?? []
    const statsEntries: any[] = averages.statistics ?? []
    const targetSeasonLabel = getCurrentNBASeasonLabel()

    const pickLatestStats = () => {
      if (!statsEntries.length) return null
      // Prefer entry matching current season label, otherwise newest year
      const exact = statsEntries.find(
        (entry) => entry?.season?.displayName === targetSeasonLabel
      )
      if (exact) return exact

      return statsEntries.reduce((latest, curr) => {
        const currYear = curr?.season?.year ?? 0
        const latestYear = latest?.season?.year ?? 0
        return currYear >= latestYear ? curr : latest
      }, statsEntries[0] as any)
    }

    const latest = pickLatestStats()
    const values: (string | number)[] =
      (Array.isArray(latest?.stats) ? latest.stats : averages.totals) ?? []

    const getVal = (label: string) => {
      const idx = labels.indexOf(label)
      if (idx === -1) return null
      const raw = values[idx]
      if (raw == null) return null
      if (typeof raw === 'number') return raw
      const parts = raw.split('-').map((v) => Number(v))
      if (parts.length === 2 && !Number.isNaN(parts[0])) return parts[0]
      const n = Number(raw)
      return Number.isNaN(n) ? null : n
    }

    // Season label from any stats entry
    const anyStat = latest || (averages.statistics || [])[0]
    const seasonLabel =
      anyStat?.season?.displayName ??
      (anyStat?.season?.year ? String(anyStat.season.year) : getCurrentNBASeasonLabel())

    return {
      ppg: getVal('PTS'),
      rpg: getVal('REB'),
      apg: getVal('AST'),
      fgPct: getVal('FG%'),
      threePct: getVal('3P%'),
      seasonLabel,
    }
  } catch (error) {
    console.warn('ESPN NBA stats fetch failed:', error)
    return null
  }
}

export async function getNBAPlayerSeasonStats(playerName: string): Promise<PlayerStats | null> {
  const cacheKey = `nba:${normalizeName(playerName)}`
  const cached = playerStatsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PLAYER_STATS_CACHE_TTL) {
    return cached.data
  }

  const rosterEntry = (await searchNBAPlayerFast(playerName)) ?? (await searchNBAPlayer(playerName))
  if (!rosterEntry) {
    playerStatsCache.set(cacheKey, { data: null, ts: Date.now() })
    return null
  }

  const espnId = rosterEntry.id
  const espnStats = await fetchESPNNBAPlayerStats(espnId)
  if (!espnStats) {
    return null
  }

  const stats: Record<string, number | string> = {}
  if (espnStats.ppg != null) stats.PPG = Number(espnStats.ppg.toFixed(1))
  if (espnStats.rpg != null) stats.RPG = Number(espnStats.rpg.toFixed(1))
  if (espnStats.apg != null) stats.APG = Number(espnStats.apg.toFixed(1))
  if (espnStats.fgPct != null) stats.FG_PERCENT = Number(espnStats.fgPct.toFixed(1))
  // Always return a 3P% value (default 0.0 if missing) so the UI can display it consistently
  stats.THREE_PERCENT = Number((espnStats.threePct ?? 0).toFixed(1))

  const result: PlayerStats = {
    name: rosterEntry?.fullName ?? playerName,
    team: rosterEntry?.team ?? '',
    position: rosterEntry?.position,
    season: espnStats.seasonLabel,
    stats,
    headshot: rosterEntry?.headshot,
    sport: 'basketball_nba',
  }

  if (rosterEntry.id) {
    const seasonYear = getCurrentNBASeasonYear()
    const recent =
      (await fetchEspnRecentGames(rosterEntry.id, ESPN_SPORT_PATH.basketball_nba, {
        season: seasonYear,
        seasonType: 2,
        maxGames: 5,
      })) ||
      (await fetchEspnRecentGames(rosterEntry.id, ESPN_SPORT_PATH.basketball_nba, {
        season: seasonYear - 1,
        seasonType: 2,
        maxGames: 5,
      }))
    if (recent && recent.length) {
      result.recent = recent
    }
  }

  playerStatsCache.set(cacheKey, { data: result, ts: Date.now() })
  return result
}

// ============ NCAA FOOTBALL / BASKETBALL (basic + recent only) ============

const buildStatsFromRecent = (games: RecentPerformance[]): Record<string, number> => {
  const totals: Record<string, number> = {}
  for (const game of games) {
    for (const [k, v] of Object.entries(game.stats)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      totals[k] = (totals[k] || 0) + v
    }
  }
  return totals
}

export async function getNCAAFPlayerSeasonStats(playerName: string): Promise<PlayerStats | null> {
  const cacheKey = `ncaaf:${normalizeName(playerName)}`
  const cached = playerStatsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PLAYER_STATS_CACHE_TTL) return cached.data

  const search = await searchEspnAthlete(playerName, ESPN_SPORT_PATH.americanfootball_ncaaf, 'ncf')
  if (!search) {
    playerStatsCache.set(cacheKey, { data: null, ts: Date.now() })
    return null
  }

  const currentYear = new Date().getFullYear()
  const recent =
    (await fetchEspnRecentGames(search.id, ESPN_SPORT_PATH.americanfootball_ncaaf, {
      season: currentYear,
      seasonType: 2,
      maxGames: 5,
    })) ||
    (await fetchEspnRecentGames(search.id, ESPN_SPORT_PATH.americanfootball_ncaaf, {
      season: currentYear - 1,
      seasonType: 2,
      maxGames: 5,
    }))
  const stats = buildStatsFromRecent(recent)

  const result: PlayerStats = {
    name: search.name,
    team: search.team || '',
    position: search.position,
    season: String(getCurrentNFLSeasonYear()),
    stats,
    headshot: search.headshot,
    sport: 'americanfootball_ncaaf',
    recent,
  }

  playerStatsCache.set(cacheKey, { data: result, ts: Date.now() })
  return result
}

export async function getNCAABPlayerSeasonStats(playerName: string): Promise<PlayerStats | null> {
  const cacheKey = `ncaab:${normalizeName(playerName)}`
  const cached = playerStatsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PLAYER_STATS_CACHE_TTL) return cached.data

  const search = await searchEspnAthlete(playerName, ESPN_SPORT_PATH.basketball_ncaab, 'ncb')
  if (!search) {
    playerStatsCache.set(cacheKey, { data: null, ts: Date.now() })
    return null
  }

  const currentYear = new Date().getFullYear()
  const recent =
    (await fetchEspnRecentGames(search.id, ESPN_SPORT_PATH.basketball_ncaab, {
      season: currentYear,
      seasonType: 2,
      maxGames: 5,
    })) ||
    (await fetchEspnRecentGames(search.id, ESPN_SPORT_PATH.basketball_ncaab, {
      season: currentYear - 1,
      seasonType: 2,
      maxGames: 5,
    }))
  const stats = buildStatsFromRecent(recent)

  const result: PlayerStats = {
    name: search.name,
    team: search.team || '',
    position: search.position,
    season: String(new Date().getFullYear()),
    stats,
    headshot: search.headshot,
    sport: 'basketball_ncaab',
    recent,
  }

  playerStatsCache.set(cacheKey, { data: result, ts: Date.now() })
  return result
}

export async function getNFLPlayerSeasonStats(playerName: string): Promise<PlayerStats | null> {
  const cacheKey = `nfl:${normalizeName(playerName)}`
  const cached = playerStatsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PLAYER_STATS_CACHE_TTL) {
    return cached.data
  }

  const rosterEntry = await searchNFLPlayer(playerName)
  if (!rosterEntry) {
    playerStatsCache.set(cacheKey, { data: null, ts: Date.now() })
    return null
  }
  const seasonYear = getCurrentNFLSeasonYear()
  const [statsResp, recent] = await Promise.all([
    fetchAthleteStatistics(rosterEntry.id, seasonYear),
    fetchEspnRecentGames(rosterEntry.id, ESPN_SPORT_PATH.americanfootball_nfl, {
      season: seasonYear,
      seasonType: 2,
      maxGames: 5,
    }),
  ])

  const categories = statsResp?.splits?.categories ?? []
  const pick = (keys: string[]) => statHelpers.pickStat(categories, keys)
  const stats: Record<string, number | string> = {}
  const set = (key: string, value: number | null) => {
    if (value != null) stats[key] = value
  }

  set('PASSING_YARDS', pick(['passingYards', 'netPassingYards']))
  set('PASSING_TDS', pick(['passingTouchdowns']))
  set('INTERCEPTIONS', pick(['interceptions']))
  set('COMPLETIONS', pick(['completions']))
  set('ATTEMPTS', pick(['passingAttempts', 'netPassingAttempts']))
  set('RUSHING_YARDS', pick(['rushingYards', 'netRushingYards']))
  set('RUSHING_TDS', pick(['rushingTouchdowns']))
  set('RUSHING_ATTEMPTS', pick(['rushingAttempts', 'netRushingAttempts']))
  set('RECEPTIONS', pick(['receptions']))
  set('RECEIVING_YARDS', pick(['receivingYards']))
  set('RECEIVING_TDS', pick(['receivingTouchdowns']))
  set('TARGETS', pick(['receivingTargets', 'targets']))

  const result: PlayerStats = {
    name: rosterEntry.fullName,
    team: rosterEntry.team,
    position: rosterEntry.position,
    season: String(seasonYear),
    stats,
    headshot: rosterEntry.headshot,
    sport: 'americanfootball_nfl',
    recent: recent && recent.length ? recent : undefined,
  }

  playerStatsCache.set(cacheKey, { data: result, ts: Date.now() })
  return result
}

export interface InjuryReport {
  player: string
  team: string
  status: string // Out, Questionable, Doubtful, Day-to-Day
  injury?: string
  date?: string
}

export interface GameStats {
  gameId: string
  homeTeam: string
  awayTeam: string
  homeStats?: TeamStats
  awayStats?: TeamStats
  topPlayers?: PlayerStats[]
}

// ==================== NBA STATS (via ESPN) ====================

export async function getNBATeamStats(teamAbbr?: string): Promise<TeamStats[]> {
  try {
    // Use standings API which has current, accurate records
    const url = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings'
    const response = await fetchWithRevalidate(url, 3600)

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    const pickStat = (statsArray: any[], names: string | string[]) => {
      const list = Array.isArray(names) ? names : [names]
      for (const name of list) {
        const exact = statsArray.find((s: any) => s.name === name)
        if (exact) return exact.value != null ? exact.value : exact.displayValue ?? null
      }
      const lowerNames = list.map((n) => n.toLowerCase())
      const loose = statsArray.find((s: any) => lowerNames.some((n) => String(s?.name || '').toLowerCase().includes(n)))
      if (loose) return loose.value != null ? loose.value : loose.displayValue ?? null
      return null
    }

    const numOrNull = (value: any) => {
      const n = Number(value)
      return Number.isFinite(n) ? n : null
    }

    // Parse both Eastern and Western conferences
    if (data.children) {
      for (const conference of data.children) {
        const entries = conference.standings?.entries || []

        for (const entry of entries) {
          const team = entry.team
          if (teamAbbr && team.abbreviation !== teamAbbr) continue

          // Extract stats from the stats array
          const statsArray = entry.stats || []
          const wins = Number(pickStat(statsArray, 'wins')) || 0
          const losses = Number(pickStat(statsArray, 'losses')) || 0
          const winPct = Number(pickStat(statsArray, 'winPercent')) || 0
          const streak = pickStat(statsArray, 'streak') || ''
          const gamesPlayed = wins + losses
          const lastTenWins = Number(pickStat(statsArray, 'lastTenWins')) || null
          const lastTenLosses = Number(pickStat(statsArray, 'lastTenLosses')) || null
          const lastTen =
            pickStat(statsArray, 'lastTen') ||
            pickStat(statsArray, 'last10') ||
            (lastTenWins != null && lastTenLosses != null ? `${lastTenWins}-${lastTenLosses}` : null)

          const pointsForPerGame = numOrNull(pickStat(statsArray, ['pointsPerGame']))
          const pointsAgainstPerGame = numOrNull(pickStat(statsArray, ['pointsAgainstPerGame', 'oppPointsPerGame']))
          const pointsFor =
            pointsForPerGame != null && gamesPlayed
              ? Number((pointsForPerGame * gamesPlayed).toFixed(1))
              : numOrNull(pickStat(statsArray, ['pointsFor', 'points_scored']))
          const pointsAgainst =
            pointsAgainstPerGame != null && gamesPlayed
              ? Number((pointsAgainstPerGame * gamesPlayed).toFixed(1))
              : numOrNull(pickStat(statsArray, ['pointsAgainst', 'points_allowed']))
          const fgPct = numOrNull(pickStat(statsArray, ['fieldGoalPct', 'fgPct', 'fieldGoalPercentage']))
          const threePct = numOrNull(pickStat(statsArray, ['threePointPct', 'threePointPercentage', '3PointPct']))
          const ftPct = numOrNull(pickStat(statsArray, ['freeThrowPct', 'freeThrowPercentage', 'ftPct']))
          const reboundsPerGame = numOrNull(
            pickStat(statsArray, ['reboundsPerGame', 'totalReboundsPerGame', 'reboundAvg', 'rebPerGame'])
          )
          const assistsPerGame = numOrNull(pickStat(statsArray, ['assistsPerGame', 'assistAvg', 'astPerGame']))
          const blocksPerGame = numOrNull(pickStat(statsArray, ['blocksPerGame', 'blockAvg', 'blkPerGame']))
          const stealsPerGame = numOrNull(pickStat(statsArray, ['stealsPerGame', 'stealAvg', 'stlPerGame']))

          teams.push({
            team: team.displayName,
            wins,
            losses,
            winPct,
            stats: {
              gamesPlayed,
              streak,
              lastTen,
              pointsForPerGame,
              pointsAgainstPerGame,
              pointsFor,
              pointsAgainst,
              fieldGoalPct: fgPct,
              threePointPct: threePct,
              freeThrowPct: ftPct,
              reboundsPerGame,
              assistsPerGame,
              blocksPerGame,
              stealsPerGame,
            },
          })
        }
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching NBA team stats:', error)
    return []
  }
}

export async function getNBAPlayerStats(playerName?: string): Promise<PlayerStats[]> {
  try {
    // ESPN doesn't have a clean player stats endpoint without player ID
    // For now, we'll return empty and enhance this later with search
    return []
  } catch (error) {
    console.error('Error fetching NBA player stats:', error)
    return []
  }
}

// Advanced NBA team stats (stats.nba.com disabled; no advanced metrics available)
export async function getNBAAdvancedTeamStats(): Promise<AdvancedTeamStats[]> {
  // stats.nba.com is disabled; ESPN does not expose advanced pace/efficiency
  return []
}

// ==================== NFL ADVANCED STATS (ESPN-derived) ====================

/**
 * Fetch team-level efficiency metrics from ESPN team statistics.
 * Uses yards/play and third-down rate as "success" proxy plus pass/run rate splits.
 */
export async function getNFLAdvancedTeamStats(): Promise<AdvancedTeamStats[]> {
  try {
    const blocks = await loadNFLTeamStatBlocks()
    return blocks.map((entry) => buildNFLTeamEntry(entry.meta, entry.categories).advanced)
  } catch (error) {
    console.error('Error fetching NFL advanced team stats:', error)
    return []
  }
}

export async function getNBAInjuries(): Promise<InjuryReport[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries'
    const response = await fetchWithRevalidate(url, 1800)

    if (!response.ok) return []

    const data = await response.json()
    const injuries: InjuryReport[] = []

    if (data.teams) {
      for (const teamData of data.teams) {
        const team = teamData.team?.displayName || 'Unknown'

        if (teamData.injuries) {
          for (const injury of teamData.injuries) {
            injuries.push({
              player: injury.athlete?.displayName || 'Unknown',
              team,
              status: injury.status || 'Unknown',
              injury: injury.details?.type || injury.longComment,
              date: injury.date,
            })
          }
        }
      }
    }

    return injuries
  } catch (error) {
    console.error('Error fetching NBA injuries:', error)
    return []
  }
}

export async function getNBARoster(teamAbbr?: string): Promise<RosterPlayer[]> {
  const useCache = !teamAbbr
  const now = Date.now()
  if (useCache && nbaRosterCache && now - nbaRosterCache.timestamp < NBA_ROSTER_CACHE_TTL) {
    return nbaRosterCache.roster
  }

  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams'
    const response = await fetchWithRevalidate(url, 3600)

    if (!response.ok) return useCache && nbaRosterCache ? nbaRosterCache.roster : []

    const data = await response.json()
    const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? []
    const roster: RosterPlayer[] = []

    const fetchTeamRoster = async (team: any): Promise<RosterPlayer[]> => {
      const players: RosterPlayer[] = []
      const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`

      try {
        const rosterResponse = await fetchWithRevalidate(rosterUrl, 3600)

        if (!rosterResponse.ok) return players

        const rosterData = await rosterResponse.json()

        if (rosterData.athletes && Array.isArray(rosterData.athletes)) {
          for (const athlete of rosterData.athletes) {
            players.push({
              id: athlete.id,
              name: athlete.displayName || athlete.fullName,
              fullName: athlete.fullName || athlete.displayName,
              team: team.displayName,
              teamAbbr: team.abbreviation,
              position: athlete.position?.abbreviation || athlete.position?.displayName || 'N/A',
              jersey: athlete.jersey,
              height: athlete.displayHeight,
              weight: athlete.displayWeight,
              age: athlete.age,
              experience: athlete.experience?.years,
              status: athlete.injuries && athlete.injuries.length > 0 ? 'Injured' : (athlete.status?.type || 'Active'),
              headshot: athlete.headshot?.href,
            })
          }
        }
      } catch (error) {
        console.error(`Error fetching roster for ${team.displayName}:`, error)
      }

      return players
    }

    if (teamAbbr) {
      const targetTeam = teams.find((entry: any) => entry?.team?.abbreviation === teamAbbr)?.team
      if (!targetTeam) return []
      return await fetchTeamRoster(targetTeam)
    }

    const queue = [...teams]
    const concurrency = Math.min(5, queue.length)
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const teamEntry = queue.shift()
        if (!teamEntry?.team) continue
        const players = await fetchTeamRoster(teamEntry.team)
        if (players.length) {
          roster.push(...players)
        }
      }
    })

    await Promise.all(workers)

    if (useCache && roster.length) {
      nbaRosterCache = { timestamp: Date.now(), roster }
    }

    return roster
  } catch (error) {
    console.error('Error fetching NBA rosters:', error)
    return useCache && nbaRosterCache ? nbaRosterCache.roster : []
  }
}

export async function searchNBAPlayer(playerName: string): Promise<RosterPlayer | null> {
  try {
    const normalized = normalizeName(playerName)

    const allPlayers = await getNBARoster()
    const exactMatch =
      allPlayers.find(
        (player) => normalizeName(player.fullName) === normalized || normalizeName(player.name) === normalized
      ) || null

    if (exactMatch) {
      return exactMatch
    }

    return (
      allPlayers.find((player) => normalizeName(player.fullName).includes(normalized)) ||
      allPlayers.find((player) => normalizeName(player.name).includes(normalized)) ||
      null
    )
  } catch (error) {
    console.error('Error searching for NBA player:', error)
    return null
  }
}

export async function getNFLRoster(teamAbbr?: string): Promise<RosterPlayer[]> {
  const useCache = !teamAbbr
  const now = Date.now()
  if (useCache && nflRosterCache && now - nflRosterCache.ts < NFL_ROSTER_CACHE_TTL) {
    return nflRosterCache.roster
  }

  try {
    const teams = await fetchTeamList()
    const targets = teamAbbr
      ? teams.filter((t) => t.abbreviation === teamAbbr)
      : teams

    const roster: RosterPlayer[] = []

    await Promise.all(
      targets.map(async (team) => {
        try {
          const players = await fetchEspnNFLRoster(team.id)
          for (const athlete of players) {
            roster.push({
              id: athlete.id,
              name: athlete.displayName || athlete.fullName,
              fullName: athlete.fullName || athlete.displayName,
              team: team.displayName,
              teamAbbr: team.abbreviation,
              position: athlete.position?.abbreviation || athlete.position?.name || 'N/A',
              jersey: athlete.jersey,
              height: athlete.displayHeight,
              weight: athlete.displayWeight,
              age: athlete.age,
              experience: athlete.experience?.years,
              status: athlete.status?.type ?? 'Active',
              headshot: athlete.headshot?.href,
            })
          }
        } catch (error) {
          console.error(`Error fetching roster for ${team.displayName}:`, error)
        }
      })
    )

    if (useCache && roster.length) {
      nflRosterCache = { ts: Date.now(), roster }
    }
    return roster
  } catch (error) {
    console.error('Error fetching NFL rosters:', error)
    return useCache && nflRosterCache ? nflRosterCache.roster : []
  }
}

export async function searchNFLPlayer(playerName: string): Promise<RosterPlayer | null> {
  try {
    const roster = await getNFLRoster()
    const target = normalizeName(playerName)
    let found =
      roster.find((player) => normalizeName(player.fullName) === target) ??
      roster.find((player) => normalizeName(player.name).includes(target))
    return found || null
  } catch (error) {
    console.error('Error searching for NFL player:', error)
    return null
  }
}

const loadNFLTeamStatBlocks = async () => {
  const now = Date.now()
  if (nflTeamStatsCache && now - nflTeamStatsCache.ts < TEAM_STATS_CACHE_TTL) {
    return nflTeamStatsCache.data
  }

  const teams = await fetchTeamList()
  const season = getCurrentNFLSeasonYear()
  const results = await Promise.all(
    teams.map(async (meta) => {
      const statsResp = await fetchTeamStatistics(meta.id, season)
      const categories = statsResp?.splits?.categories ?? []
      return { meta, categories }
    })
  )

  nflTeamStatsCache = { ts: now, data: results }
  return results
}

const buildNFLTeamEntry = (teamMeta: EspnTeamMeta, categories: EspnStatCategory[]) => {
  const pick = (names: string[]) => statHelpers.pickStat(categories, names)
  const gamesPlayed =
    pick(['gamesPlayed', 'teamGamesPlayed']) ??
    ((teamMeta.wins ?? 0) + (teamMeta.losses ?? 0) || null)
  const pointsFor =
    pick(['totalPoints', 'totalPointsFor']) ??
    teamMeta.pointsFor ??
    (gamesPlayed && teamMeta.avgPointsFor != null ? teamMeta.avgPointsFor * gamesPlayed : null)
  const pointsAgainst =
    pick(['pointsAgainst']) ??
    teamMeta.pointsAgainst ??
    (gamesPlayed && teamMeta.avgPointsAgainst != null ? teamMeta.avgPointsAgainst * gamesPlayed : null)
  const totalYards = pick(['totalYards', 'totalYardsFromScrimmage'])
  const offensivePlays = pick(['totalOffensivePlays'])
  const passAttempts = pick(['passingAttempts', 'netPassingAttempts'])
  const rushAttempts = pick(['rushingAttempts', 'netRushingAttempts'])
  const yardsPerPlay =
    totalYards != null && offensivePlays && offensivePlays > 0
      ? totalYards / offensivePlays
      : null
  const passRate =
    offensivePlays && passAttempts != null && offensivePlays > 0
      ? passAttempts / offensivePlays
      : null
  const rushRate =
    offensivePlays && rushAttempts != null && offensivePlays > 0
      ? rushAttempts / offensivePlays
      : null
  const thirdDownPct = pick(['thirdDownConvPct'])
  const redzoneTdPct = pick(['redzoneTouchdownPct'])
  const turnoverDifferential =
    pick(['turnOverDifferential']) ??
    (pick(['totalTakeaways']) != null && pick(['totalGiveaways']) != null
      ? (pick(['totalTakeaways']) as number) - (pick(['totalGiveaways']) as number)
      : null)

  const teamStats: TeamStats = {
    team: teamMeta.displayName,
    wins: teamMeta.wins ?? 0,
    losses: teamMeta.losses ?? 0,
    winPct: (() => {
      const total = (teamMeta.wins ?? 0) + (teamMeta.losses ?? 0)
      return total > 0 ? (teamMeta.wins ?? 0) / total : 0
    })(),
    stats: {
      gamesPlayed: gamesPlayed ?? 0,
      pointsFor: pointsFor ?? null,
      pointsAgainst: pointsAgainst ?? null,
      totalYards: totalYards ?? null,
      yardsPerPlay: yardsPerPlay ?? null,
      passRate: passRate ?? null,
      rushRate: rushRate ?? null,
      thirdDownPct: thirdDownPct ?? null,
      redZoneTdPct: redzoneTdPct ?? null,
      turnoverDifferential: turnoverDifferential ?? null,
      streak: teamMeta.recordSummary ?? null,
    },
  }

  const advanced: AdvancedTeamStats = {
    team: teamMeta.displayName,
    teamAbbr: teamMeta.abbreviation,
    epaPerPlay: yardsPerPlay ?? undefined,
    yardsPerPlay: yardsPerPlay ?? undefined,
    successRate: thirdDownPct != null ? thirdDownPct / 100 : undefined,
    passRate: passRate ?? undefined,
    rushRate: rushRate ?? undefined,
  }

  return { teamStats, advanced }
}

// ==================== NFL STATS (via ESPN) ====================

export async function getNFLTeamStats(teamAbbr?: string): Promise<TeamStats[]> {
  try {
    const blocks = await loadNFLTeamStatBlocks()
    const teams = blocks
      .filter((entry) => !teamAbbr || entry.meta.abbreviation === teamAbbr)
      .map((entry) => buildNFLTeamEntry(entry.meta, entry.categories).teamStats)
    return teams
  } catch (error) {
    console.error('Error fetching NFL team stats:', error)
    return []
  }
}

export async function getNFLInjuries(): Promise<InjuryReport[]> {
  try {
    const data = await fetchEspnNFLInjuries()
    if (!data || !data.length) return []
    const injuries: InjuryReport[] = []

    for (const teamData of data) {
      const team = teamData.team?.displayName || 'Unknown'
      if (!teamData.injuries) continue
      for (const injury of teamData.injuries) {
        injuries.push({
          player: injury.athlete?.displayName || 'Unknown',
          team,
          status: injury.status || 'Unknown',
          injury: injury.details?.type || injury.longComment,
          date: injury.date,
        })
      }
    }

    return injuries
  } catch (error) {
    console.error('Error fetching NFL injuries:', error)
    return []
  }
}

// ==================== MLB STATS (Official API) ====================

export async function searchMLBPlayer(playerName: string): Promise<RosterPlayer | null> {
  try {
    const url = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(playerName)}`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return null

    const data = await response.json()
    const candidates: any[] = data.people ?? []
    if (!candidates.length) return null

    const normalized = normalizeName(playerName)
    const pick = () => {
      const exact = candidates.find(
        (p) => normalizeName(p.fullName || p.nameFirstLast || '') === normalized
      )
      if (exact) return exact
      return (
        candidates.find((p) => normalizeName(p.fullName || '').includes(normalized)) ||
        candidates[0]
      )
    }

    const selected = pick()
    if (!selected?.id) return null

    let person: any = null
    try {
      const personRes = await fetch(`https://statsapi.mlb.com/api/v1/people/${selected.id}`, {
        cache: 'no-store',
      })
      if (personRes.ok) {
        const personData = await personRes.json()
        person = personData.people?.[0] || null
      }
    } catch (err) {
      console.warn('MLB person lookup failed (non-fatal):', err)
    }

    const teamName =
      person?.currentTeam?.name ||
      person?.currentTeam?.abbreviation ||
      person?.fullName ||
      selected.fullName
    const teamAbbr =
      person?.currentTeam?.abbreviation ||
      person?.currentTeam?.abbrev ||
      person?.currentTeam?.abbreviation
    const debutYear = person?.proDebutDate ? new Date(person.proDebutDate).getFullYear() : null
    const experienceYears =
      debutYear && Number.isFinite(debutYear) ? new Date().getFullYear() - debutYear : undefined

    return {
      id: String(selected.id),
      name: selected.fullName || selected.nameFirstLast || playerName,
      fullName: selected.fullName || selected.nameFirstLast || playerName,
      team: teamName || '',
      teamAbbr: teamAbbr || '',
      position:
        person?.primaryPosition?.abbreviation ||
        person?.primaryPosition?.name ||
        selected.primaryPosition?.abbreviation ||
        'N/A',
      jersey: person?.primaryNumber,
      height: person?.height,
      weight: person?.weight ? String(person.weight) : undefined,
      age: person?.currentAge,
      experience: experienceYears,
      status: person?.active ? 'Active' : 'Inactive',
      headshot: person?.officialImageSrc,
      sport: 'baseball_mlb',
    }
  } catch (error) {
    console.error('Error searching for MLB player:', error)
    return null
  }
}

export async function getMLBTeamStats(teamId?: number): Promise<TeamStats[]> {
  try {
    const season = new Date().getFullYear()
    const url = `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`
    const response = await fetchWithRevalidate(url, 3600)

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    if (data.records) {
      for (const division of data.records) {
        for (const team of division.teamRecords) {
          if (teamId && team.team.id !== teamId) continue

          teams.push({
            team: team.team.name,
            wins: team.wins,
            losses: team.losses,
            winPct: parseFloat(team.leagueRecord?.pct || '0'),
            stats: {
              gamesPlayed: team.gamesPlayed,
              streak: team.streak?.streakCode || '',
              runsScored: team.runsScored || 0,
              runsAllowed: team.runsAllowed || 0,
              divisionRank: team.divisionRank,
            },
            rank: team.divisionRank,
          })
        }
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching MLB team stats:', error)
    return []
  }
}

export async function getMLBPlayerStats(playerId?: number): Promise<PlayerStats[]> {
  try {
    if (!playerId) return []

    const season = new Date().getFullYear()
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=${season}&group=hitting,pitching`
    const response = await fetchWithRevalidate(url, 3600)

    if (!response.ok) return []

    const data = await response.json()
    const players: PlayerStats[] = []

    if (data.stats) {
      for (const statGroup of data.stats) {
        const splits = statGroup.splits?.[0]
        if (splits) {
          players.push({
            name: data.people?.[0]?.fullName || 'Unknown',
            team: splits.team?.name || 'Unknown',
            position: data.people?.[0]?.primaryPosition?.abbreviation,
            stats: splits.stat || {},
            season: splits.season,
            sport: 'baseball_mlb',
          })
        }
      }
    }

    return players
  } catch (error) {
    console.error('Error fetching MLB player stats:', error)
    return []
  }
}

export async function getMLBPlayerSeasonStats(playerName: string): Promise<PlayerStats | null> {
  const cacheKey = `mlb:${normalizeName(playerName)}`
  const cached = playerStatsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PLAYER_STATS_CACHE_TTL) {
    return cached.data
  }

  const rosterEntry = await searchMLBPlayer(playerName)
  if (!rosterEntry) {
    playerStatsCache.set(cacheKey, { data: null, ts: Date.now() })
    return null
  }

  const season = new Date().getFullYear()
  const playerId = Number(rosterEntry.id)
  const entries = await getMLBPlayerStats(playerId)
  const primary = entries.find((e) => (e.stats as any)?.avg != null) || entries[0]
  if (!primary) {
    playerStatsCache.set(cacheKey, { data: null, ts: Date.now() })
    return null
  }

  const raw = primary.stats as Record<string, any>
  const stats: Record<string, number | string> = {}

  const toNumber = (val: any) => {
    if (val == null) return null
    const n = Number(String(val).replace(/[^0-9.-]/g, ''))
    return Number.isNaN(n) ? null : n
  }

  const hitter = raw.avg != null || raw.obp != null || raw.ops != null
  if (hitter) {
    const pick = (key: string) => raw[key] ?? null
    const avg = pick('avg')
    const obp = pick('obp')
    const slg = pick('slg')
    const ops = pick('ops')
    if (avg != null) stats.AVG = toNumber(avg) ?? avg
    if (obp != null) stats.OBP = toNumber(obp) ?? obp
    if (slg != null) stats.SLG = toNumber(slg) ?? slg
    if (ops != null) stats.OPS = toNumber(ops) ?? ops
    stats.HR = toNumber(pick('homeRuns')) ?? 0
    stats.RBI = toNumber(pick('rbi')) ?? 0
    stats.RUNS = toNumber(pick('runs')) ?? 0
    stats.HITS = toNumber(pick('hits')) ?? 0
    stats.SB = toNumber(pick('stolenBases')) ?? 0
  } else {
    stats.ERA = toNumber(raw.era) ?? 0
    stats.WHIP = toNumber(raw.whip) ?? 0
    stats.INNINGS_PITCHED = toNumber(raw.inningsPitched) ?? 0
    stats.STRIKEOUTS = toNumber(raw.strikeOuts) ?? 0
    stats.WINS = toNumber(raw.wins) ?? 0
    stats.LOSSES = toNumber(raw.losses) ?? 0
    stats.SAVES = toNumber(raw.saves) ?? 0
  }

  const result: PlayerStats = {
    name: rosterEntry.fullName,
    team: rosterEntry.team || primary.team,
    position: rosterEntry.position,
    season: primary.season || String(season),
    stats,
    headshot: rosterEntry.headshot,
    sport: 'baseball_mlb',
  }

  playerStatsCache.set(cacheKey, { data: result, ts: Date.now() })
  return result
}

// ==================== NHL STATS (Official API) ====================

export async function searchNHLPlayer(playerName: string): Promise<RosterPlayer | null> {
  try {
    const url = `https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=10&q=${encodeURIComponent(
      playerName
    )}`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return null

    const data = await response.json()
    const results: any[] = Array.isArray(data) ? data : []
    if (!results.length) return null

    const target = normalizeName(playerName)
    const pick = () => {
      const exact = results.find((p) => normalizeName(p.name || '') === target && p.active)
      if (exact) return exact
      const looseActive = results.find((p) => normalizeName(p.name || '').includes(target) && p.active)
      if (looseActive) return looseActive
      return results.find((p) => normalizeName(p.name || '').includes(target)) || results[0]
    }

    const player = pick()
    if (!player?.playerId) return null

    return {
      id: String(player.playerId),
      name: player.name || playerName,
      fullName: player.name || playerName,
      team: player.teamAbbrev || '',
      teamAbbr: player.teamAbbrev || '',
      position: player.positionCode || 'N/A',
      jersey: player.sweaterNumber ? String(player.sweaterNumber) : undefined,
      height: player.height,
      weight: player.weightInPounds ? String(player.weightInPounds) : undefined,
      status: player.active ? 'Active' : 'Inactive',
      headshot: player.playerId
        ? `https://assets.nhle.com/mugs/nhl/20252026/${player.teamAbbrev || 'NA'}/${player.playerId}.png`
        : undefined,
      sport: 'icehockey_nhl',
    }
  } catch (error) {
    console.error('Error searching for NHL player:', error)
    return null
  }
}

export async function getNHLTeamStats(teamAbbr?: string): Promise<TeamStats[]> {
  try {
    const url = 'https://api-web.nhle.com/v1/standings/now'
    const response = await fetchWithRevalidate(url, 3600)

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    if (data.standings) {
      for (const team of data.standings) {
        if (teamAbbr && team.teamAbbrev?.default !== teamAbbr) continue

        teams.push({
          team: team.teamName?.default || team.teamAbbrev?.default,
          wins: team.wins || 0,
          losses: team.losses || 0,
          winPct: team.pointPctg || 0,
          stats: {
            gamesPlayed: team.gamesPlayed || 0,
            points: team.points || 0,
            goalsFor: team.goalFor || 0,
            goalsAgainst: team.goalAgainst || 0,
            goalDifferential: team.goalDifferential || 0,
            overtimeLosses: team.otLosses || 0,
            streak: team.streakCode || '',
          },
          rank: team.leagueSequence,
        })
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching NHL team stats:', error)
    return []
  }
}

export async function getNHLPlayerStats(playerId?: number): Promise<PlayerStats[]> {
  try {
  if (!playerId) return []

  const season = `${new Date().getFullYear() - 1}${new Date().getFullYear()}`
  const url = `https://api-web.nhle.com/v1/player/${playerId}/landing`
    const response = await fetchWithRevalidate(url, 3600)

    if (!response.ok) return []

    const data = await response.json()
    const players: PlayerStats[] = []

    if (data.featuredStats?.regularSeason?.subSeason) {
      players.push({
        name: `${data.firstName?.default} ${data.lastName?.default}`,
        team: data.currentTeamAbbrev || 'Unknown',
        position: data.position,
        stats: data.featuredStats.regularSeason.subSeason,
        season,
        sport: 'icehockey_nhl',
      })
    }

    return players
  } catch (error) {
    console.error('Error fetching NHL player stats:', error)
    return []
  }
}

export async function getNHLPlayerSeasonStats(playerName: string): Promise<PlayerStats | null> {
  const cacheKey = `nhl:${normalizeName(playerName)}`
  const cached = playerStatsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PLAYER_STATS_CACHE_TTL) {
    return cached.data
  }

  const rosterEntry = await searchNHLPlayer(playerName)
  if (!rosterEntry) {
    playerStatsCache.set(cacheKey, { data: null, ts: Date.now() })
    return null
  }

  const entries = await getNHLPlayerStats(Number(rosterEntry.id))
  const primary = entries[0]
  if (!primary) {
    playerStatsCache.set(cacheKey, { data: null, ts: Date.now() })
    return null
  }

  const raw = primary.stats as Record<string, any>
  const stats: Record<string, number | string> = {}
  const pick = (key: string) => raw?.[key] ?? null
  const num = (key: string) => {
    const val = pick(key)
    if (val == null) return null
    const n = Number(val)
    return Number.isNaN(n) ? null : n
  }

  stats.GP = num('gamesPlayed') ?? num('games') ?? 0
  stats.GOALS = num('goals') ?? 0
  stats.ASSISTS = num('assists') ?? 0
  stats.POINTS = num('points') ?? (stats.GOALS as number) + (stats.ASSISTS as number)
  const plusMinus = num('plusMinus')
  if (plusMinus != null) stats.PLUS_MINUS = plusMinus
  const pim = num('pim') ?? num('penaltyMinutes')
  if (pim != null) stats.PIM = pim
  const shots = num('shots')
  if (shots != null) stats.SHOTS = shots

  const result: PlayerStats = {
    name: rosterEntry.fullName,
    team: rosterEntry.team || primary.team,
    position: rosterEntry.position,
    season: primary.season,
    stats,
    headshot: rosterEntry.headshot,
    sport: 'icehockey_nhl',
  }

  // NHL recent games from NHL API
  try {
    const season = new Date().getFullYear()
    const seasonLabel = `${season - 1}${season}` // e.g., 20242025
    const url = `https://api-web.nhle.com/v1/player/${rosterEntry.id}/game-log/${seasonLabel}`
    const res = await fetch(url, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      const items: any[] = data?.gameLog || []
      const recent: RecentPerformance[] = items.slice(0, 5).map((g: any) => ({
        date: g.gameDate || '',
        opponent: g.opponentAbbrev || g.opponentTeam || '',
        result: g.decision || undefined,
        stats: {
          GOALS: g.goals ?? 0,
          ASSISTS: g.assists ?? 0,
          POINTS: g.points ?? 0,
          SHOTS: g.shots ?? 0,
          PLUS_MINUS: g.plusMinus ?? 0,
          PIM: g.pim ?? 0,
        },
      }))
      if (recent.length) {
        result.recent = recent
      }
    }
  } catch (err) {
    console.warn('[NHL] recent fetch failed', err)
  }

  playerStatsCache.set(cacheKey, { data: result, ts: Date.now() })
  return result
}

export async function getPlayerSeasonStats(playerName: string, sport?: string): Promise<PlayerStats | null> {
  const resolved = resolveSportKey(sport)
  const targets = resolved ? [resolved] : SPORT_PRIORITY

  for (const sportKey of targets) {
    if (sportKey === 'basketball_nba') {
      const staticHit = findNbaStaticPlayer(playerName)
      if (staticHit) {
        return {
          name: staticHit.name,
          team: staticHit.team,
          position: staticHit.position,
          season: staticHit.season,
          stats: staticHit.stats,
          sport: 'basketball_nba',
        }
      }
    }

    // Sports Reference first for non-live stats
    try {
      const refStats = await getSportsReferencePlayerSeasonStats(playerName, sportKey)
      if (refStats) {
        return {
          name: refStats.name,
          team: refStats.team || '',
          position: refStats.position,
          season: refStats.season,
          stats: refStats.stats,
          sport: refStats.sport || sportKey,
        }
      }
    } catch (err) {
      console.warn('[SportsReference] player fetch failed', sportKey, err)
    }

    let data: PlayerStats | null = null
    if (sportKey === 'basketball_nba') {
      data = await getNBAPlayerSeasonStats(playerName)
    } else if (sportKey === 'americanfootball_nfl') {
      data = await getNFLPlayerSeasonStats(playerName)
    } else if (sportKey === 'baseball_mlb') {
      data = await getMLBPlayerSeasonStats(playerName)
    } else if (sportKey === 'icehockey_nhl') {
      data = await getNHLPlayerSeasonStats(playerName)
    } else if (sportKey === 'basketball_ncaab') {
      data = await getNCAABPlayerSeasonStats(playerName)
    } else if (sportKey === 'americanfootball_ncaaf') {
      data = await getNCAAFPlayerSeasonStats(playerName)
    }
    if (data) {
      return { ...data, sport: data.sport ?? sportKey }
    }
  }

  return null
}

// ==================== UNIFIED FUNCTIONS ====================

export async function getTeamStats(sport: string, teamIdentifier?: string): Promise<TeamStats[]> {
  const sportKey = sport.toLowerCase()

  const filterTeams = (teams: TeamStats[]): TeamStats[] => {
    if (!teamIdentifier) return teams

    const target = normalizeName(teamIdentifier)
      return teams.filter((entry) => {
        const name = normalizeName(entry.team)
        const abbr = normalizeName((entry as any).teamAbbr || '')
        return (
          name.includes(target) ||
        target.includes(name) ||
        (abbr && (abbr === target || target.includes(abbr) || abbr.includes(target)))
      )
    })
  }

  switch (sportKey) {
    case 'nba':
    case 'basketball_nba': {
      // Prefer static user-provided team table
      const staticTeams = filterTeams(teamIdentifier ? findStaticNbaTeam(teamIdentifier) : getStaticNbaTeams())
      if (staticTeams.length) return staticTeams

      try {
        const refTeams = await getSportsReferenceTeamStats('basketball_nba')
        if (refTeams?.length) {
          return filterTeams(
            refTeams.map((t) => ({
              team: t.team,
              wins: t.wins ?? 0,
              losses: t.losses ?? 0,
              winPct: t.winPct ?? 0,
              stats: t.stats,
              sport: 'basketball_nba',
            }))
          )
        }
      } catch (err) {
        console.warn('[SportsReference] NBA team fetch failed', err)
      }
      const [basic, advanced] = await Promise.all([
        getNBATeamStats(),
        getNBAAdvancedTeamStats(),
      ])
      const merged = basic.map((teamEntry) => {
        const adv = advanced.find(
          (candidate) => normalizeName(candidate.team) === normalizeName(teamEntry.team)
        )
        if (adv) {
          const extras: Record<string, number> = {}
          if (adv.pace != null) extras.pace = adv.pace
          if (adv.oRating != null) extras.offensiveRating = adv.oRating
          if (adv.dRating != null) extras.defensiveRating = adv.dRating
          if (adv.netRating != null) extras.netRating = adv.netRating
          if (adv.tsPct != null) extras.trueShootingPct = adv.tsPct
          if (adv.turnoverPct != null) extras.turnoverPct = adv.turnoverPct
          teamEntry.stats = {
            ...teamEntry.stats,
            ...extras,
          }
        }
        return teamEntry
      })
      return filterTeams(merged)
    }
    case 'nfl':
    case 'americanfootball_nfl': {
      try {
        const refTeams = await getSportsReferenceTeamStats('americanfootball_nfl')
        if (refTeams?.length) {
          return filterTeams(
            refTeams.map((t) => ({
              team: t.team,
              wins: t.wins ?? 0,
              losses: t.losses ?? 0,
              winPct: t.winPct ?? 0,
              stats: t.stats,
              sport: 'americanfootball_nfl',
            }))
          )
        }
      } catch (err) {
        console.warn('[SportsReference] NFL team fetch failed', err)
      }
      const [basic, advanced] = await Promise.all([
        getNFLTeamStats(),
        getNFLAdvancedTeamStats(),
      ])
      const merged = basic.map((teamEntry) => {
        const adv = advanced.find(
          (candidate) => normalizeName(candidate.team) === normalizeName(teamEntry.team)
        )
        if (adv) {
          const extras: Record<string, number> = {}
          if (adv.epaPerPlay != null) extras.epaPerPlay = adv.epaPerPlay
          if (adv.yardsPerPlay != null) extras.yardsPerPlay = adv.yardsPerPlay
          if (adv.successRate != null) extras.successRate = adv.successRate
          if (adv.passRate != null) extras.passRate = adv.passRate
          if (adv.rushRate != null) extras.rushRate = adv.rushRate
          teamEntry.stats = {
            ...teamEntry.stats,
            ...extras,
          }
        }
        return teamEntry
      })
      return filterTeams(merged)
    }
    case 'mlb':
    case 'baseball_mlb': {
      const teams = await getMLBTeamStats()
      return filterTeams(teams)
    }
    case 'nhl':
    case 'icehockey_nhl': {
      const teams = await getNHLTeamStats()
      return filterTeams(teams)
    }
    default:
      return []
  }
}

export async function getInjuryReports(sport: string): Promise<InjuryReport[]> {
  switch (sport.toLowerCase()) {
    case 'nba':
    case 'basketball_nba':
      return getNBAInjuries()
    case 'nfl':
    case 'americanfootball_nfl':
      return getNFLInjuries()
    default:
      return []
  }
}

export async function getAllInjuries(): Promise<{ sport: string; injuries: InjuryReport[] }[]> {
  const [nbaInjuries, nflInjuries] = await Promise.all([
    getNBAInjuries(),
    getNFLInjuries(),
  ])

  return [
    { sport: 'NBA', injuries: nbaInjuries },
    { sport: 'NFL', injuries: nflInjuries },
  ]
}

export async function searchPlayer(playerName: string, sport?: string): Promise<RosterPlayer | null> {
  try {
    const resolved = resolveSportKey(sport)

    const searchBySport = async (sportKey: string) => {
      switch (sportKey) {
        case 'basketball_nba':
          return await searchNBAPlayer(playerName)
        case 'americanfootball_nfl':
          return await searchNFLPlayer(playerName)
        case 'baseball_mlb':
          return await searchMLBPlayer(playerName)
        case 'icehockey_nhl':
          return await searchNHLPlayer(playerName)
        default:
          return null
      }
    }

    if (resolved) {
      return await searchBySport(resolved)
    }

    for (const sportKey of SPORT_PRIORITY) {
      const found = await searchBySport(sportKey)
      if (found) return found
    }

    return null
  } catch (error) {
    console.error('Error searching for player:', error)
    return null
  }
}

export async function getRoster(sport: string, teamAbbr?: string): Promise<RosterPlayer[]> {
  switch (sport.toLowerCase()) {
    case 'nba':
    case 'basketball_nba':
      return getNBARoster(teamAbbr)
    case 'nfl':
    case 'americanfootball_nfl':
      return getNFLRoster(teamAbbr)
    default:
      return []
  }
}

// Helper to format stats for AI consumption
export function formatStatsForAI(stats: TeamStats[] | PlayerStats[] | InjuryReport[]): string {
  if (stats.length === 0) return 'No stats available'

  const formatHeader = (p: PlayerStats) => {
    const headerParts = [p.name || 'Unknown']
    if (p.team) headerParts.push(p.team)
    if (p.position) headerParts.push(p.position)
    if (p.season) headerParts.push(`Season ${p.season}`)
    return headerParts.join(' | ')
  }

  const fmtNumber = (val: any, decimals = 1) => {
    if (val == null || val === '') return 'n/a'
    const num = Number(val)
    if (Number.isNaN(num)) return String(val)
    return Number.isInteger(num) ? String(num) : num.toFixed(decimals)
  }

  const detectPlayerSport = (p: PlayerStats): string => {
    if (p.sport) return p.sport
    const keys = Object.keys(p.stats || {}).map((k) => k.toUpperCase())
    if (keys.some((k) => k.startsWith('PASSING_') || k.startsWith('RUSHING_') || k.startsWith('RECEIVING_'))) {
      return 'americanfootball_nfl'
    }
    if (keys.some((k) => ['AVG', 'OBP', 'OPS', 'ERA', 'WHIP'].includes(k))) {
      return 'baseball_mlb'
    }
    if (keys.some((k) => ['GOALS', 'ASSISTS', 'POINTS', 'PLUS_MINUS'].includes(k))) {
      return 'icehockey_nhl'
    }
    return 'basketball_nba'
  }

  const formatNBAPlayer = (p: PlayerStats) => {
    const preferredOrder = ['PPG', 'RPG', 'APG', 'FG_PERCENT', 'FG%', 'THREE_PERCENT', '3P%']
    const formatLabel = (key: string) =>
      key
        .replace(/_/g, ' ')
        .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    const formatValue = (key: string, val: any) => {
      if (val == null) return 'n/a'
      const num = typeof val === 'number' ? val : Number(val)
      const isPercent = key.toLowerCase().includes('percent') || key.toLowerCase().includes('pct') || key === 'FG%'
      if (!Number.isNaN(num) && isPercent) return `${num.toFixed(1)}%`
      if (!Number.isNaN(num)) return Number.isInteger(num) ? String(num) : num.toFixed(1)
      return String(val)
    }
    const orderedKeys = [
      ...preferredOrder.filter((k) => p.stats[k] !== undefined),
      ...Object.keys(p.stats || {}).filter((k) => !preferredOrder.includes(k)),
    ]
    const lines = orderedKeys.map((key) => `- ${formatLabel(key)}: ${formatValue(key, (p.stats as any)[key])}`)
    return `${formatHeader(p)}\n${lines.join('\n')}`
  }

  const formatNFLPlayer = (p: PlayerStats) => {
    const s = p.stats as Record<string, any>
    const pass = [
      fmtNumber(s.PASSING_YARDS ?? s.PASS_YARDS ?? s.PASS_YDS, 0),
      `${fmtNumber(s.PASSING_TDS ?? s.PASS_TDS ?? s.PASS_TOUCHDOWNS, 0)} TD`,
      `${fmtNumber(s.INTERCEPTIONS ?? s.INT ?? s.PASS_INTERCEPTIONS, 0)} INT`,
    ]
    const rush = [
      `${fmtNumber(s.RUSHING_YARDS ?? s.RUSH_YARDS ?? s.RUSH_YDS, 0)} rush yds`,
      `${fmtNumber(s.RUSHING_TDS ?? s.RUSH_TDS, 0)} TD`,
      `${fmtNumber(s.RUSHING_ATTEMPTS ?? s.RUSH_ATTEMPTS ?? s.CARRIES, 0)} att`,
    ]
    const recv = [
      `${fmtNumber(s.RECEPTIONS ?? s.REC, 0)} rec`,
      `${fmtNumber(s.RECEIVING_YARDS ?? s.REC_YARDS ?? s.RECEIVING_YDS, 0)} yds`,
      `${fmtNumber(s.RECEIVING_TDS ?? s.REC_TDS, 0)} TD`,
      `${fmtNumber(s.TARGETS, 0)} tgt`,
    ]
    const lines = [`- Passing: ${pass.join(', ')}`]
    if (rush.some((v) => v.includes('n/a') === false)) lines.push(`- Rushing: ${rush.join(', ')}`)
    if (recv.some((v) => v.includes('n/a') === false)) lines.push(`- Receiving: ${recv.join(', ')}`)

    return `${formatHeader(p)}\n${lines.join('\n')}`
  }

  const formatMLBPlayer = (p: PlayerStats) => {
    const s = p.stats as Record<string, any>
    const hasPitching = s.ERA != null || s.WHIP != null || s.INNINGS_PITCHED != null
    if (hasPitching) {
      const lines = [
        `- ERA: ${fmtNumber(s.ERA, 2)} | WHIP: ${fmtNumber(s.WHIP, 2)} | IP: ${fmtNumber(s.INNINGS_PITCHED, 1)}`,
        `- SO: ${fmtNumber(s.STRIKEOUTS, 0)} | W-L-SV: ${fmtNumber(s.WINS, 0)}-${fmtNumber(s.LOSSES, 0)}-${fmtNumber(s.SAVES, 0)}`,
      ]
      return `${formatHeader(p)}\n${lines.join('\n')}`
    }

    const slash = `AVG/OBP/SLG: ${fmtNumber(s.AVG, 3)}/${fmtNumber(s.OBP, 3)}/${fmtNumber(s.SLG, 3)}`
    const ops = s.OPS != null ? `OPS: ${fmtNumber(s.OPS, 3)}` : null
    const lines = [
      `- ${slash}${ops ? ` | ${ops}` : ''}`,
      `- HR: ${fmtNumber(s.HR, 0)} | RBI: ${fmtNumber(s.RBI, 0)} | R: ${fmtNumber(s.RUNS, 0)} | H: ${fmtNumber(s.HITS, 0)} | SB: ${fmtNumber(s.SB, 0)}`,
    ]
    return `${formatHeader(p)}\n${lines.join('\n')}`
  }

  const formatNHLPlayer = (p: PlayerStats) => {
    const s = p.stats as Record<string, any>
    const gp = fmtNumber(s.GP ?? s.GAMES, 0)
    const goals = fmtNumber(s.GOALS, 0)
    const assists = fmtNumber(s.ASSISTS, 0)
    const points = fmtNumber(s.POINTS, 0)
    const plusMinus = s.PLUS_MINUS != null ? ` | +/-: ${fmtNumber(s.PLUS_MINUS, 0)}` : ''
    const pim = s.PIM != null ? ` | PIM: ${fmtNumber(s.PIM, 0)}` : ''
    const shots = s.SHOTS != null ? ` | SOG: ${fmtNumber(s.SHOTS, 0)}` : ''
    const lines = [`- GP: ${gp} | G: ${goals} | A: ${assists} | PTS: ${points}${plusMinus}${pim}${shots}`]
    return `${formatHeader(p)}\n${lines.join('\n')}`
  }

  if ('injury' in stats[0]) {
    // Injury reports
    const injuries = stats as InjuryReport[]
    return injuries.map(i =>
      `${i.player} (${i.team}) - ${i.status}${i.injury ? ': ' + i.injury : ''}`
    ).join('\n')
  } else if ('position' in stats[0]) {
    // Player stats with sport-specific formatting
    const players = stats as PlayerStats[]
    return players
      .map((p) => {
        const sportKey = detectPlayerSport(p)
        if (sportKey === 'americanfootball_nfl') return formatNFLPlayer(p)
        if (sportKey === 'baseball_mlb') return formatMLBPlayer(p)
        if (sportKey === 'icehockey_nhl') return formatNHLPlayer(p)
        return formatNBAPlayer(p)
      })
      .join('\n\n')
  } else {
    // Team stats
    const teams = stats as TeamStats[]
    const isBasketball =
      teams.length > 0 &&
      (teams[0].stats?.fieldGoalPct != null ||
        teams[0].stats?.threePointPct != null ||
        teams[0].stats?.reboundsPerGame != null)

    if (isBasketball) {
      const header = '| Team | Streak | Last 10 | PPG | PAPG | FG% | 3P% | REB | AST | BLK | STL |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
      const rows = teams.map((team) => {
        const games =
          Number.isFinite(Number(team.stats?.gamesPlayed))
            ? Number(team.stats?.gamesPlayed)
            : Number((team.wins ?? 0) + (team.losses ?? 0))
        const pointsFor = Number(team.stats?.pointsForPerGame ?? team.stats?.pointsFor ?? 0)
        const pointsAgainst = Number(team.stats?.pointsAgainstPerGame ?? team.stats?.pointsAgainst ?? 0)
        const ppg = games > 0 && pointsFor > 0 ? (pointsFor / (pointsFor > 200 ? games : 1)).toFixed(1) : 'n/a'
        const papg = games > 0 && pointsAgainst > 0 ? (pointsAgainst / (pointsAgainst > 200 ? games : 1)).toFixed(1) : 'n/a'
        const fgPct = team.stats?.fieldGoalPct != null ? Number(team.stats.fieldGoalPct).toFixed(1) : 'n/a'
        const threePct = team.stats?.threePointPct != null ? Number(team.stats.threePointPct).toFixed(1) : 'n/a'
        const reb = team.stats?.reboundsPerGame ?? team.stats?.rpg
        const ast = team.stats?.assistsPerGame ?? team.stats?.apg
        const blk = team.stats?.blocksPerGame ?? team.stats?.bpg
        const stl = team.stats?.stealsPerGame ?? team.stats?.spg
        const last10 =
          team.stats?.lastTen ??
          team.stats?.last10 ??
          (team.stats?.lastTenWins != null && team.stats?.lastTenLosses != null
            ? `${team.stats.lastTenWins}-${team.stats.lastTenLosses}`
            : 'n/a')
        const streak = team.stats?.streak ?? 'n/a'
        return `| ${team.team} | ${streak} | ${last10} | ${ppg} | ${papg} | ${fgPct} | ${threePct} | ${reb ?? 'n/a'} | ${ast ?? 'n/a'} | ${blk ?? 'n/a'} | ${stl ?? 'n/a'} |`
      })
      return `${header}\n${rows.join('\n')}`
    }

    return teams
      .map(
        (t) =>
          `${t.team}: ${t.wins}-${t.losses} (${(t.winPct * 100).toFixed(1)}%)\n${JSON.stringify(t.stats, null, 2)}`
      )
      .join('\n\n')
  }
}
