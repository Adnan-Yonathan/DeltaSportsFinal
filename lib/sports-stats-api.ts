import { RecentPerformance } from '@/lib/utils/recent-performances'
import {
  getSportsReferencePlayerSeasonStats,
  getSportsReferenceTeamStats,
} from '@/lib/providers/sports-reference'
import {
  fetchAthleteStatistics as fetchNflAthleteStatistics,
  fetchInjuries as fetchEspnNFLInjuries,
  fetchRoster as fetchEspnNFLRoster,
  fetchTeamList as fetchNflTeamList,
  fetchTeamRecord as fetchNflTeamRecord,
  fetchTeamStatistics as fetchNflTeamStatistics,
  statHelpers as nflStatHelpers,
  type EspnStatCategory,
  type EspnTeamMeta,
} from '@/lib/providers/espn-nfl'
import {
  fetchAthleteStatistics as fetchNcaafAthleteStatistics,
  fetchTeamList as fetchNcaafTeamList,
  fetchTeamStatistics as fetchNcaafTeamStatistics,
  statHelpers as ncaafStatHelpers,
  type EspnStatCategory as EspnNcaafStatCategory,
  type EspnTeamMeta as EspnNcaafTeamMeta,
} from '@/lib/providers/espn-ncaaf'
import { getNbaOpponentStats } from '@/lib/services/espn-opponent-stats'
import {
  fetchAthleteStatistics as fetchNbaAthleteStatistics,
  fetchTeamList as fetchNbaTeamList,
  fetchTeamStatistics as fetchNbaTeamStatistics,
  statHelpers as nbaStatHelpers,
} from '@/lib/providers/espn-nba'
import {
  fetchLeagueTeamStats as fetchNbaLeagueTeamStats,
  getCurrentNbaSeason,
  parseRowToObject,
} from '@/lib/providers/nba-stats/client'
import { fetchNcaabTeamList } from '@/lib/providers/espn-ncaab'
import {
  fetchNcaaNetRankings,
  fetchNcaaScoringStats,
  fetchNcaaTeamStatProfiles,
} from '@/lib/providers/ncaab-free-sources'
import { normalizeTeamKey, resolveSportKey } from '@/lib/identity/sport'
import { resolveEspnTeamName } from '@/lib/utils/espn-team-lookup'

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
  teamAbbr?: string
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

const SPORT_PRIORITY = [
  'basketball_nba',
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'baseball_mlb',
  'icehockey_nhl',
]
const ESPN_SPORT_PATH: Record<string, string> = {
  basketball_nba: 'basketball/nba',
  basketball_ncaab: 'basketball/mens-college-basketball',
  americanfootball_nfl: 'football/nfl',
  americanfootball_ncaaf: 'football/college-football',
}

const normalizeName = (value: string) => normalizeTeamKey(value)

const buildTeamKeyVariants = (value: string) => {
  const variants = new Set<string>()
  const base = normalizeTeamKey(value)
  if (base) variants.add(base)

  const tokens = value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.includes('state')) {
    const replaced = tokens.map((token) => (token === 'state' ? 'st' : token))
    variants.add(normalizeTeamKey(replaced.join(' ')))
  }
  if (tokens.includes('st')) {
    const replaced = tokens.map((token) => (token === 'st' ? 'state' : token))
    variants.add(normalizeTeamKey(replaced.join(' ')))
  }

  return Array.from(variants)
}

const parseRecordSummary = (summary?: string | null) => {
  if (!summary) return null
  const match = summary.match(/(\d+)\s*-\s*(\d+)/)
  if (!match) return null
  const wins = Number(match[1])
  const losses = Number(match[2])
  if (!Number.isFinite(wins) || !Number.isFinite(losses)) return null
  return { wins, losses }
}

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
let nflTeamStatsCache: {
  ts: number
  season: number
  data: Array<{ meta: EspnTeamMeta; categories: EspnStatCategory[] }>
} | null = null
let nflRosterCache: { ts: number; roster: RosterPlayer[] } | null = null
const NFL_ROSTER_CACHE_TTL = 1000 * 60 * 60 // 1 hour
let nbaTeamStatsCache: { ts: number; data: Array<{ meta: EspnTeamMeta; categories: EspnStatCategory[] }> } | null = null
let ncaabTeamStatsCache: { ts: number; data: TeamStats[] } | null = null
let ncaafTeamStatsCache: {
  ts: number
  season: number
  data: Array<{
    meta: EspnNcaafTeamMeta
    categories: EspnNcaafStatCategory[]
    postseasonCategories: EspnNcaafStatCategory[]
  }>
} | null = null

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

const LEAGUE_SYNONYMS: Record<string, string[]> = {
  ncf: ['ncaaf', 'college-football', 'ncaa football', 'college football'],
  ncb: ['ncaab', 'college-basketball', 'ncaa basketball', 'college basketball'],
  nfl: ['nfl', 'national football league'],
  nba: ['nba', 'national basketball association'],
  nhl: ['nhl', 'national hockey league'],
  mlb: ['mlb', 'major league baseball'],
  wnba: ["wnba", "women's national basketball association"],
}

const extractAthleteIdFromUid = (uid?: string): string | null => {
  if (!uid) return null
  const match = /a:(\d+)/.exec(uid)
  return match?.[1] || null
}

const extractTeamIdFromUid = (uid?: string): string | null => {
  if (!uid) return null
  const match = /t:(\d+)/.exec(uid)
  return match?.[1] || null
}

const matchesLeagueAbbrev = (entry: any, leagueAbbrev: string): boolean => {
  const target = leagueAbbrev.toLowerCase()
  const candidates = [
    entry?.leagues?.[0]?.leagueAbbrev,
    entry?.leagues?.[0]?.abbr,
    entry?.description,
    entry?.defaultLeagueSlug,
    entry?.league,
  ]
    .filter(Boolean)
    .map((value: string) => value.toLowerCase())

  if (candidates.some((value: string) => value === target)) return true
  const synonyms = LEAGUE_SYNONYMS[target] || []
  return candidates.some((value: string) =>
    synonyms.some((synonym) => value === synonym || value.includes(synonym))
  )
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
      return matchesLeagueAbbrev(entry, leagueAbbrev)
    })
    const pick =
      matches.find((entry: any) => normalizeName(entry?.displayName || '') === target) ||
      matches.find((entry: any) => normalizeName(entry?.displayName || '').includes(target)) ||
      matches[0]
    if (!pick?.id) return null
    const athleteId = extractAthleteIdFromUid(pick?.uid)
    return {
      id: athleteId ? String(athleteId) : String(pick.id),
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

const searchEspnTeam = async (
  teamName: string,
  leagueAbbrev?: string
): Promise<{ id: string; name: string } | null> => {
  const url = `https://site.api.espn.com/apis/search/v2?type=team&limit=10&query=${encodeURIComponent(
    teamName
  )}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  const results: any[] = data?.results?.find((r: any) => r?.type === 'team')
    ?.contents || []
  if (!Array.isArray(results) || results.length === 0) return null

  const target = normalizeName(teamName)
  const matches = leagueAbbrev
    ? results.filter((entry: any) => matchesLeagueAbbrev(entry, leagueAbbrev))
    : results
  const pick =
    matches.find((entry: any) => normalizeName(entry?.displayName || '') === target) ||
    matches.find((entry: any) => normalizeName(entry?.displayName || '').includes(target)) ||
    matches[0]
  if (!pick) return null
  const teamId = extractTeamIdFromUid(pick?.uid) || pick?.id
  if (!teamId) return null
  return {
    id: String(teamId),
    name: pick.displayName || teamName,
  }
}

const fetchNcaafTeamRecordMeta = async (teamId: string) => {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${teamId}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  const team = data?.team
  const recordItem = team?.record?.items?.[0]
  const pick = (name: string) =>
    recordItem?.stats?.find((s: any) => s.name === name)?.value
  const wins = pick('wins')
  const losses = pick('losses')
  return {
    abbreviation: team?.abbreviation || '',
    wins: typeof wins === 'number' ? wins : undefined,
    losses: typeof losses === 'number' ? losses : undefined,
    pointsFor: typeof pick('pointsFor') === 'number' ? pick('pointsFor') : undefined,
    pointsAgainst:
      typeof pick('pointsAgainst') === 'number' ? pick('pointsAgainst') : undefined,
    avgPointsFor:
      typeof pick('avgPointsFor') === 'number' ? pick('avgPointsFor') : undefined,
    avgPointsAgainst:
      typeof pick('avgPointsAgainst') === 'number' ? pick('avgPointsAgainst') : undefined,
  }
}

type ESPNPlayerSummary = {
  ppg: number | null
  rpg: number | null
  apg: number | null
  spg: number | null
  bpg: number | null
  threepm: number | null
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
      spg: getVal('STL'),
      bpg: getVal('BLK'),
      threepm: getVal('3PM'),
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
  const seasonYear = getCurrentNBASeasonYear()
  const coreStatsResponse =
    (await fetchNbaAthleteStatistics(espnId, seasonYear, 2)) ||
    (await fetchNbaAthleteStatistics(espnId, seasonYear - 1, 2))
  const coreStats = buildNbaPlayerStatsFromCategories(
    coreStatsResponse?.splits?.categories
  )
  const espnStats = await fetchESPNNBAPlayerStats(espnId)

  if (!espnStats && Object.keys(coreStats.stats).length === 0) {
    return null
  }

  const stats: Record<string, number | string> = { ...coreStats.stats }
  const setIfMissing = (key: string, value: number | null, decimals = 1) => {
    if (value == null || stats[key] != null) return
    stats[key] = Number(value.toFixed(decimals))
  }

  setIfMissing('PPG', espnStats?.ppg ?? null)
  setIfMissing('RPG', espnStats?.rpg ?? null)
  setIfMissing('APG', espnStats?.apg ?? null)
  setIfMissing('STL', espnStats?.spg ?? null)
  setIfMissing('BLK', espnStats?.bpg ?? null)
  if (espnStats?.threepm != null && stats['3PM'] == null) {
    stats['3PM'] = Number(espnStats.threepm.toFixed(1))
  }
  if (espnStats?.fgPct != null && stats.FG_PERCENT == null) {
    stats.FG_PERCENT = Number(espnStats.fgPct.toFixed(1))
  }
  if (stats.THREE_PERCENT == null) {
    stats.THREE_PERCENT = Number((espnStats?.threePct ?? 0).toFixed(1))
  }

  if (stats.PTS == null && stats.PPG != null) stats.PTS = stats.PPG as number
  if (stats.REB == null && stats.TRB != null) stats.REB = stats.TRB as number
  if (stats.RPG == null && stats.REB != null) stats.RPG = stats.REB as number
  if (stats.APG == null && stats.AST != null) stats.APG = stats.AST as number
  if (stats['3PM'] == null && stats.THREE_PM != null) {
    stats['3PM'] = stats.THREE_PM as number
  }
  const seasonLabel = espnStats?.seasonLabel ?? getCurrentNBASeasonLabel()

  const result: PlayerStats = {
    name: rosterEntry?.fullName ?? playerName,
    team: rosterEntry?.team ?? '',
    position: rosterEntry?.position,
    season: seasonLabel,
    stats,
    headshot: rosterEntry?.headshot,
    sport: 'basketball_nba',
  }

  if (rosterEntry.id) {
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

const buildNcaafPlayerStats = (
  categories: EspnNcaafStatCategory[]
): Record<string, number> => {
  const stats: Record<string, number> = {}
  const pick = (names: string[], opts: { perGame?: boolean } = {}) =>
    ncaafStatHelpers.pickStat(categories, names, opts)
  const setStat = (key: string, value: number | null) => {
    if (value == null || !Number.isFinite(value)) return
    stats[key] = Number(value)
  }

  const gamesPlayed = pick(['gamesPlayed', 'teamGamesPlayed'])
  const pickPerGame = (names: string[], perGameNames: string[] = []) => {
    const perGame =
      pick(perGameNames.length ? perGameNames : names, { perGame: true }) ??
      pick(names, { perGame: true })
    if (perGame != null) return perGame
    const perGameNamed = perGameNames.length ? pick(perGameNames) : null
    if (perGameNamed != null) return perGameNamed
    const total = pick(names)
    if (total != null && gamesPlayed && gamesPlayed > 0) return total / gamesPlayed
    return total
  }
  setStat('GAMES_PLAYED', gamesPlayed)

  setStat(
    'PASSING_YARDS',
    pickPerGame(['passingYards'], ['passingYardsPerGame'])
  )
  setStat('PASSING_ATTEMPTS', pickPerGame(['passingAttempts']))
  setStat('PASSING_COMPLETIONS', pickPerGame(['completions']))
  setStat('COMPLETION_PCT', pick(['completionPct']))
  setStat(
    'PASSING_TOUCHDOWNS',
    pickPerGame(['passingTouchdowns'])
  )
  setStat('INTERCEPTIONS', pickPerGame(['interceptions']))
  setStat('INTERCEPTION_PCT', pick(['interceptionPct']))
  setStat(
    'YARDS_PER_PASS_ATTEMPT',
    pick(['yardsPerPassAttempt', 'netYardsPerPassAttempt'])
  )
  setStat('PASSING_BIG_PLAYS', pick(['passingBigPlays']))
  setStat('PASSING_FIRST_DOWNS', pick(['passingFirstDowns']))
  setStat('SACKS_TAKEN', pick(['sacks']))
  setStat('SACK_YARDS_LOST', pick(['sackYardsLost']))
  setStat('PASSING_TD_PCT', pick(['passingTouchdownPct']))
  setStat('QBR', pick(['QBR', 'QBRating']))
  setStat('ADJ_QBR', pick(['adjQBR']))
  setStat('ESPN_QBR', pick(['ESPNQBRating']))
  setStat('QB_RATING', pick(['quarterbackRating']))
  setStat('PASSING_YARDS_AT_CATCH', pick(['passingYardsAtCatch']))
  setStat('PASSING_YARDS_AFTER_CATCH', pick(['passingYardsAfterCatch']))
  setStat('LONG_PASSING', pick(['longPassing']))

  setStat(
    'RUSHING_YARDS',
    pickPerGame(['rushingYards'], ['rushingYardsPerGame'])
  )
  setStat('RUSHING_ATTEMPTS', pickPerGame(['rushingAttempts']))
  setStat(
    'RUSHING_TOUCHDOWNS',
    pickPerGame(['rushingTouchdowns'])
  )
  setStat('YARDS_PER_RUSH_ATTEMPT', pick(['yardsPerRushAttempt']))
  setStat('RUSHING_BIG_PLAYS', pick(['rushingBigPlays']))
  setStat('RUSHING_FIRST_DOWNS', pick(['rushingFirstDowns']))
  setStat('RUSHING_STUFFS', pick(['stuffs']))
  setStat('RUSHING_STUFF_YARDS_LOST', pick(['stuffYardsLost']))
  setStat('LONG_RUSHING', pick(['longRushing']))

  setStat(
    'RECEIVING_YARDS',
    pickPerGame(['receivingYards'], ['receivingYardsPerGame'])
  )
  setStat('RECEPTIONS', pickPerGame(['receptions']))
  setStat('RECEIVING_TARGETS', pickPerGame(['receivingTargets']))
  setStat(
    'RECEIVING_TOUCHDOWNS',
    pickPerGame(['receivingTouchdowns'])
  )
  setStat('YARDS_PER_RECEPTION', pick(['yardsPerReception']))
  setStat('RECEIVING_BIG_PLAYS', pick(['receivingBigPlays']))
  setStat('RECEIVING_FIRST_DOWNS', pick(['receivingFirstDowns']))
  setStat('RECEIVING_YARDS_AT_CATCH', pick(['receivingYardsAtCatch']))
  setStat('RECEIVING_YARDS_AFTER_CATCH', pick(['receivingYardsAfterCatch']))
  setStat('LONG_RECEPTION', pick(['longReception']))

  setStat('TOTAL_TOUCHDOWNS', pickPerGame(['totalTouchdowns']))
  setStat(
    'TOTAL_YARDS',
    pickPerGame(['totalYards', 'totalYardsFromScrimmage'], [
      'yardsFromScrimmagePerGame',
    ])
  )
  setStat('FUMBLES', pickPerGame(['fumbles']))
  setStat('FUMBLES_LOST', pickPerGame(['fumblesLost']))

  return stats
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

  const season = getCurrentNFLSeasonYear()
  const [seasonStatsResp, postseasonStatsResp] = await Promise.all([
    fetchNcaafAthleteStatistics(search.id, season, 2),
    fetchNcaafAthleteStatistics(search.id, season, 3),
  ])
  const seasonCategories = seasonStatsResp?.splits?.categories ?? []
  const postseasonCategories = postseasonStatsResp?.splits?.categories ?? []
  const seasonStats = seasonCategories.length
    ? buildNcaafPlayerStats(seasonCategories)
    : {}
  const postseasonStats = postseasonCategories.length
    ? buildNcaafPlayerStats(postseasonCategories)
    : {}

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
  const recentStats = buildStatsFromRecent(recent)

  const stats: Record<string, number | string> =
    Object.keys(seasonStats).length > 0 ? { ...seasonStats } : { ...recentStats }

  if (Object.keys(postseasonStats).length > 0) {
    for (const [key, value] of Object.entries(postseasonStats)) {
      stats[`POST_${key}`] = value
    }
  }

  appendEspnCategoryStats(
    stats as Record<string, number | string | null>,
    seasonCategories,
    'ESPN_PLAYER'
  )
  if (postseasonCategories.length) {
    appendEspnCategoryStats(
      stats as Record<string, number | string | null>,
      postseasonCategories,
      'ESPN_PLAYER_POST'
    )
  }

  const result: PlayerStats = {
    name: search.name,
    team: search.team || '',
    position: search.position,
    season: String(season),
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
    fetchNflAthleteStatistics(rosterEntry.id, seasonYear),
    fetchEspnRecentGames(rosterEntry.id, ESPN_SPORT_PATH.americanfootball_nfl, {
      season: seasonYear,
      seasonType: 2,
      maxGames: 5,
    }),
  ])

  const categories = statsResp?.splits?.categories ?? []
  // Use perGame: true to get per-game averages instead of season totals
  const pick = (keys: string[]) => nflStatHelpers.pickStat(categories, keys, { perGame: true })
  const pickTotal = (keys: string[]) => nflStatHelpers.pickStat(categories, keys)
  const stats: Record<string, number | string> = {}
  const set = (key: string, value: number | null) => {
    if (value != null) stats[key] = value
  }

  // Per-game stats for prop projections
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

  // Also store games played for reference
  const gamesPlayed = pickTotal(['gamesPlayed'])
  if (gamesPlayed) stats['GAMES_PLAYED'] = gamesPlayed

  appendEspnCategoryStats(
    stats as Record<string, number | string | null>,
    categories,
    'ESPN_PLAYER'
  )

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

const roundValue = (value: number | null, decimals = 1) => {
  if (value == null || !Number.isFinite(value)) return null
  return Number(value.toFixed(decimals))
}

const normalizePercent = (value: number | null, decimals = 1) => {
  if (value == null || !Number.isFinite(value)) return null
  const pct = value >= 0 && value <= 1 ? value * 100 : value
  return Number(pct.toFixed(decimals))
}

const normalizeRatio = (value: number | null, decimals = 3) => {
  if (value == null || !Number.isFinite(value)) return null
  const ratio = value > 1 ? value / 100 : value
  return Number(ratio.toFixed(decimals))
}

const normalizeRating = (value: number | null, decimals = 1) => {
  if (value == null || !Number.isFinite(value)) return null
  const rating = Math.abs(value) < 10 ? value * 100 : value
  return Number(rating.toFixed(decimals))
}

type EspnCategoryStatLike = {
  name?: string
  displayName?: string
  abbreviation?: string
  value?: number
  perGameValue?: number
  displayValue?: string
}

type EspnStatCategoryLike = {
  name?: string
  displayName?: string
  shortDisplayName?: string
  abbreviation?: string
  stats?: EspnCategoryStatLike[]
}

const normalizeEspnKey = (value?: string | null) => {
  if (!value) return ''
  return value
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const coerceEspnValue = (value: unknown): number | string | null => {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) return numeric
    return trimmed
  }
  return null
}

const appendEspnCategoryStats = (
  stats: Record<string, number | string | null>,
  categories: EspnStatCategoryLike[] | undefined,
  prefix: string
) => {
  if (!categories?.length) return
  const prefixKey = normalizeEspnKey(prefix)
  for (const category of categories) {
    const categoryKey = normalizeEspnKey(
      category.abbreviation || category.name || category.displayName
    )
    if (!categoryKey) continue
    for (const stat of category.stats || []) {
      const statKey = normalizeEspnKey(
        stat.abbreviation || stat.name || stat.displayName
      )
      if (!statKey) continue
      const baseKey = `${prefixKey}_${categoryKey}_${statKey}`
      const value = coerceEspnValue(stat.value)
      const perGameValue = coerceEspnValue(stat.perGameValue)
      if (value != null) stats[baseKey] = value
      if (perGameValue != null) stats[`${baseKey}_PER_GAME`] = perGameValue
      if (stat.displayValue) {
        stats[`${baseKey}_DISPLAY`] = String(stat.displayValue)
      }
    }
  }
}

const buildNbaPlayerStatsFromCategories = (
  categories?: EspnStatCategory[]
) => {
  const stats: Record<string, number | string> = {}
  if (!categories?.length) return { stats, gamesPlayed: null }

  appendEspnCategoryStats(
    stats as Record<string, number | string | null>,
    categories,
    'ESPN_PLAYER'
  )

  const pick = (names: string[], opts?: { perGame?: boolean }) =>
    nbaStatHelpers.pickStat(categories, names, opts)
  const gamesPlayed =
    pick(['gamesPlayed', 'games', 'gamesPlayedSeason', 'gamesPlayedTotal']) ?? null
  const perGame = (names: string[], totalNames = names) => {
    const perGameValue = pick(names, { perGame: true })
    if (perGameValue != null) return perGameValue
    const total = pick(totalNames)
    if (total != null && gamesPlayed) return total / gamesPlayed
    return null
  }
  const set = (key: string, value: number | null, decimals = 1) => {
    const rounded = roundValue(value, decimals)
    if (rounded != null) stats[key] = rounded
  }

  const mpg = perGame(['minutes', 'minutesPlayed', 'avgMinutes', 'minutesPerGame'])
  if (mpg != null) stats.MPG = roundValue(mpg, 1) as number
  if (gamesPlayed != null) stats.GP = Math.round(gamesPlayed)

  const ppg = perGame(['points', 'totalPoints', 'pointsPerGame', 'pts'])
  if (ppg != null) {
    const pts = roundValue(ppg, 1) as number
    stats.PTS = pts
    stats.PPG = pts
  }

  set('FGM', perGame(['fieldGoalsMade', 'fieldGoals', 'fieldGoalsPerGame']))
  set('FGA', perGame(['fieldGoalsAttempted', 'fieldGoalAttempts', 'fgAttempted']))
  set(
    'TWOPM',
    perGame(['twoPointFieldGoalsMade', 'twoPointFieldGoals', 'twoPointFieldGoalsPerGame'])
  )
  set(
    'TWOPA',
    perGame(['twoPointFieldGoalsAttempted', 'twoPointFieldGoalAttempts'])
  )
  set(
    'THREE_PM',
    perGame([
      'threePointFieldGoalsMade',
      'threePointFieldGoals',
      'threePointFieldGoalsPerGame',
    ])
  )
  set(
    'THREE_PA',
    perGame(['threePointFieldGoalsAttempted', 'threePointFieldGoalAttempts'])
  )
  set('FTM', perGame(['freeThrowsMade', 'freeThrows', 'freeThrowsPerGame']))
  set('FTA', perGame(['freeThrowsAttempted', 'freeThrowAttempts']))

  set('ORB', perGame(['offensiveRebounds', 'offRebounds']))
  set('DRB', perGame(['defensiveRebounds', 'defRebounds']))
  set('TRB', perGame(['rebounds', 'totalRebounds']))
  set('AST', perGame(['assists', 'assist']))
  set('STL', perGame(['steals', 'steal']))
  set('BLK', perGame(['blocks', 'block']))
  set('TOV', perGame(['turnovers', 'turnover']))
  set('PF', perGame(['personalFouls', 'fouls']))

  if (stats.TRB != null) {
    stats.REB = stats.TRB as number
    stats.RPG = stats.TRB as number
  }
  if (stats.AST != null) stats.APG = stats.AST as number

  const fgPct = normalizePercent(
    pick(['fieldGoalPct', 'fgPct', 'fieldGoalPercentage'])
  )
  const twoPct = normalizePercent(
    pick(['twoPointFieldGoalPct', 'twoPointPct', 'twoPointPercentage'])
  )
  const threePct = normalizePercent(
    pick(['threePointPct', 'threePointFieldGoalPct', 'threePointPercentage'])
  )
  const ftPct = normalizePercent(
    pick(['freeThrowPct', 'freeThrowPercentage', 'ftPct'])
  )
  const tsPct = normalizePercent(pick(['trueShootingPct', 'trueShootingPercentage']))
  const efgPct = normalizePercent(
    pick(['effectiveFGPct', 'effectiveFieldGoalPct', 'effectiveFieldGoalPercentage'])
  )

  if (fgPct != null) stats.FG_PERCENT = fgPct
  if (twoPct != null) stats.TWOP_PERCENT = twoPct
  if (threePct != null) stats.THREE_PERCENT = threePct
  if (ftPct != null) stats.FT_PERCENT = ftPct
  if (tsPct != null) stats.TS_PERCENT = tsPct
  if (efgPct != null) stats.EFG_PERCENT = efgPct

  const usgPct = normalizePercent(pick(['usageRate', 'usagePct', 'usgPct']))
  const orbPct = normalizePercent(
    pick(['offensiveReboundPct', 'offensiveReboundRate', 'offReboundRate'])
  )
  const drbPct = normalizePercent(
    pick(['defensiveReboundPct', 'defensiveReboundRate', 'defReboundRate'])
  )
  const trbPct = normalizePercent(pick(['reboundPct', 'reboundRate', 'trbPct']))
  const astPct = normalizePercent(pick(['assistPct', 'assistRate', 'astPct']))
  const stlPct = normalizePercent(pick(['stealPct', 'stealRate', 'stlPct']))
  const blkPct = normalizePercent(pick(['blockPct', 'blockRate', 'blkPct']))
  const tovPct = normalizePercent(pick(['turnoverPct', 'turnoverRate', 'tovPct']))
  const per = roundValue(pick(['playerEfficiencyRating', 'PER']), 1)
  const vorp = roundValue(pick(['valueOverReplacementPlayer', 'VORP']), 2)
  const nbaRating = roundValue(pick(['NBARating', 'nbaRating']), 1)
  const scoringEfficiency = roundValue(pick(['scoringEfficiency']), 3)
  const shootingEfficiency = roundValue(pick(['shootingEfficiency']), 3)
  const pointsPerEstimatedPossessions = roundValue(
    pick(['pointsPerEstimatedPossessions']),
    2
  )

  if (usgPct != null) stats.USG_PERCENT = usgPct
  if (orbPct != null) stats.ORB_PERCENT = orbPct
  if (drbPct != null) stats.DRB_PERCENT = drbPct
  if (trbPct != null) stats.TRB_PERCENT = trbPct
  if (astPct != null) stats.AST_PERCENT = astPct
  if (stlPct != null) stats.STL_PERCENT = stlPct
  if (blkPct != null) stats.BLK_PERCENT = blkPct
  if (tovPct != null) stats.TOV_PERCENT = tovPct
  if (per != null) stats.PER = per
  if (vorp != null) stats.VORP = vorp
  if (nbaRating != null) stats.NBA_RATING = nbaRating
  if (scoringEfficiency != null) stats.SCORING_EFFICIENCY = scoringEfficiency
  if (shootingEfficiency != null) stats.SHOOTING_EFFICIENCY = shootingEfficiency
  if (pointsPerEstimatedPossessions != null) {
    stats.POINTS_PER_EST_POSSESSIONS = pointsPerEstimatedPossessions
  }

  return { stats, gamesPlayed }
}

const buildNbaTeamStatsFromCategories = (categories?: EspnStatCategory[]) => {
  const stats: Record<string, number | string | null> = {}
  if (!categories?.length) return stats

  appendEspnCategoryStats(stats, categories, 'ESPN_TEAM')

  const pick = (names: string[], opts?: { perGame?: boolean }) =>
    nbaStatHelpers.pickStat(categories, names, opts)
  const gamesPlayed =
    pick(['gamesPlayed', 'teamGamesPlayed', 'games', 'gamesPlayedSeason']) ?? null
  const perGame = (names: string[], totalNames = names) => {
    const perGameValue = pick(names, { perGame: true })
    if (perGameValue != null) return perGameValue
    const total = pick(totalNames)
    if (total != null && gamesPlayed) return total / gamesPlayed
    return null
  }
  const assign = (key: string, value: number | null, decimals = 1) => {
    const rounded = roundValue(value, decimals)
    if (rounded != null) stats[key] = rounded
  }

  if (gamesPlayed != null) stats.gamesPlayed = Math.round(gamesPlayed)
  assign('minutesPerGame', perGame(['minutes', 'minutesPlayed', 'avgMinutes']))

  assign('fieldGoalsMadePerGame', perGame(['fieldGoalsMade', 'fieldGoals']))
  assign('fieldGoalsAttemptedPerGame', perGame(['fieldGoalsAttempted']))
  assign('twosMadePerGame', perGame(['twoPointFieldGoalsMade', 'twoPointFieldGoals']))
  assign('twosAttemptedPerGame', perGame(['twoPointFieldGoalsAttempted']))
  assign('threesMadePerGame', perGame(['threePointFieldGoalsMade', 'threePointFieldGoals']))
  assign('threesAttemptedPerGame', perGame(['threePointFieldGoalsAttempted']))
  assign('freeThrowsMadePerGame', perGame(['freeThrowsMade', 'freeThrows']))
  assign('freeThrowsAttemptedPerGame', perGame(['freeThrowsAttempted']))

  assign('offensiveReboundsPerGame', perGame(['offensiveRebounds', 'offRebounds']))
  assign('defensiveReboundsPerGame', perGame(['defensiveRebounds', 'defRebounds']))
  assign('reboundsPerGame', perGame(['rebounds', 'totalRebounds']))
  assign('assistsPerGame', perGame(['assists']))
  assign('stealsPerGame', perGame(['steals']))
  assign('blocksPerGame', perGame(['blocks']))
  assign('turnoversPerGame', perGame(['turnovers']))
  assign('personalFoulsPerGame', perGame(['personalFouls', 'fouls']))
  assign('pointsForPerGame', perGame(['points', 'totalPoints']))
  assign(
    'pointsAgainstPerGame',
    perGame(['pointsAgainst', 'pointsAllowed', 'opponentPoints'])
  )

  const fgPct = normalizePercent(
    pick(['fieldGoalPct', 'fgPct', 'fieldGoalPercentage'])
  )
  const twoPct = normalizePercent(
    pick(['twoPointFieldGoalPct', 'twoPointPct', 'twoPointPercentage'])
  )
  const threePct = normalizePercent(
    pick(['threePointPct', 'threePointFieldGoalPct', 'threePointPercentage'])
  )
  const ftPct = normalizePercent(
    pick(['freeThrowPct', 'freeThrowPercentage', 'ftPct'])
  )
  const tsPct = normalizePercent(pick(['trueShootingPct', 'trueShootingPercentage']))
  const efgPct = normalizePercent(
    pick(['effectiveFGPct', 'effectiveFieldGoalPct', 'effectiveFieldGoalPercentage'])
  )

  if (fgPct != null) stats.fieldGoalPct = fgPct
  if (twoPct != null) stats.twoPointPct = twoPct
  if (threePct != null) stats.threePointPct = threePct
  if (ftPct != null) stats.freeThrowPct = ftPct
  if (tsPct != null) stats.trueShootingPct = tsPct
  if (efgPct != null) stats.effectiveFgPct = efgPct

  const turnoverPct = normalizePercent(
    pick(['turnoverRatio', 'turnoverPct', 'turnoverPercentage'])
  )
  const offensiveReboundPct = normalizePercent(
    pick(['offensiveReboundPct', 'offensiveReboundRate', 'offReboundRate'])
  )
  const defensiveReboundPct = normalizePercent(
    pick(['defensiveReboundPct', 'defensiveReboundRate', 'defReboundRate'])
  )
  const freeThrowRate = normalizeRatio(
    pick([
      'freeThrowRate',
      'freeThrowRatePerFieldGoalAttempt',
      'freeThrowRatePerFga',
      'ftaPerFga',
    ])
  )
  const pace = roundValue(pick(['paceFactor', 'pace']), 1)
  const offensiveRating = normalizeRating(
    pick(['pointsPerEstimatedPossessions', 'pointsPerPossession', 'offensiveRating'])
  )
  const defensiveRating = normalizeRating(
    pick([
      'pointsAgainstPerEstimatedPossessions',
      'pointsAllowedPerPossession',
      'defensiveRating',
    ])
  )

  if (turnoverPct != null) stats.turnoverPct = turnoverPct
  if (offensiveReboundPct != null) stats.offensiveReboundPct = offensiveReboundPct
  if (defensiveReboundPct != null) stats.defensiveReboundPct = defensiveReboundPct
  if (freeThrowRate != null) stats.freeThrowRate = freeThrowRate
  if (pace != null) stats.pace = pace
  if (offensiveRating != null) stats.offensiveRating = offensiveRating
  if (defensiveRating != null) stats.defensiveRating = defensiveRating
  if (offensiveRating != null && defensiveRating != null) {
    stats.netRating = Number((offensiveRating - defensiveRating).toFixed(1))
  }

  return stats
}

const loadNBATeamStatBlocks = async (teamAbbr?: string) => {
  const useCache = !teamAbbr
  const now = Date.now()
  if (useCache && nbaTeamStatsCache && now - nbaTeamStatsCache.ts < TEAM_STATS_CACHE_TTL) {
    return nbaTeamStatsCache.data
  }

  const season = getCurrentNBASeasonYear()
  const teams = await fetchNbaTeamList()
  const targets = teamAbbr
    ? teams.filter(
        (team) =>
          normalizeName(team.abbreviation || '') === normalizeName(teamAbbr)
      )
    : teams

  const results = await Promise.all(
    targets.map(async (meta) => {
      const statsResp = await fetchNbaTeamStatistics(meta.id, season, 2)
      const categories = statsResp?.splits?.categories ?? []
      return { meta, categories }
    })
  )

  if (useCache) {
    nbaTeamStatsCache = { ts: now, data: results }
  }

  return results
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

          const pointsForPerGame = numOrNull(
            pickStat(statsArray, ['pointsPerGame', 'avgPointsFor', 'avgPoints'])
          )
          const pointsAgainstPerGame = numOrNull(
            pickStat(statsArray, ['pointsAgainstPerGame', 'oppPointsPerGame', 'avgPointsAgainst'])
          )
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
            teamAbbr: team.abbreviation,
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
    const coreStats = await loadNBATeamStatBlocks(teamAbbr)
    if (coreStats.length) {
      const byAbbr = new Map(
        coreStats.map((entry) => [
          normalizeName(entry.meta.abbreviation || ''),
          entry,
        ])
      )
      const byName = new Map(
        coreStats.map((entry) => [
          normalizeName(entry.meta.displayName || entry.meta.name || ''),
          entry,
        ])
      )

      for (const teamEntry of teams) {
        const key = normalizeName(teamEntry.teamAbbr || teamEntry.team)
        const block =
          byAbbr.get(key) || byName.get(normalizeName(teamEntry.team))
        if (!block) continue
        const extras = buildNbaTeamStatsFromCategories(block.categories)
        if (Object.keys(extras).length) {
          teamEntry.stats = {
            ...teamEntry.stats,
            ...extras,
          }
        }
      }
    }

    const opponentEntries = await getNbaOpponentStats()
    if (opponentEntries.length) {
      const byAbbr = new Map(
        opponentEntries.map((entry) => [
          normalizeName(entry.teamAbbr || ''),
          entry,
        ])
      )
      const byName = new Map(
        opponentEntries.map((entry) => [
          normalizeName(entry.teamName || ''),
          entry,
        ])
      )
      for (const teamEntry of teams) {
        const key = normalizeName(teamEntry.teamAbbr || teamEntry.team)
        const oppEntry =
          byAbbr.get(key) || byName.get(normalizeName(teamEntry.team))
        if (!oppEntry) continue
        const stats = oppEntry.stats || {}
        for (const [statKey, statValue] of Object.entries(stats)) {
          if (teamEntry.stats[statKey] == null) {
            teamEntry.stats[statKey] = statValue
          }
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
  try {
    const season = getCurrentNbaSeason()
    const advanced = await fetchNbaLeagueTeamStats(season, 'Advanced', 'PerGame')
    const resultSet = advanced?.resultSets?.[0]
    if (!resultSet?.headers?.length || !Array.isArray(resultSet.rowSet)) {
      return []
    }

    const toNumber = (value: unknown) => {
      const num = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(num) ? num : null
    }

    return resultSet.rowSet
      .map((row) => {
        const parsed = parseRowToObject(resultSet.headers, row)
        return {
          team: String(parsed.TEAM_NAME || parsed.TEAM || ''),
          teamAbbr: String(parsed.TEAM_ABBREVIATION || parsed.TEAM_ABBR || ''),
          pace: toNumber(parsed.PACE),
          oRating: toNumber(parsed.OFF_RATING),
          dRating: toNumber(parsed.DEF_RATING),
          netRating: toNumber(parsed.NET_RATING),
          tsPct: toNumber(parsed.TS_PCT),
          reboundPct: toNumber(parsed.REB_PCT),
          turnoverPct: toNumber(parsed.TOV_PCT),
        } satisfies AdvancedTeamStats
      })
      .filter((entry) => entry.team.length > 0)
  } catch (error) {
    console.warn('[NBA Stats] Advanced team stats fetch failed', error)
    return []
  }
}

// ==================== NCAAB TEAM STATS (ESPN + NCAA free sources) ====================

export async function getNCAABTeamStats(): Promise<TeamStats[]> {
  const now = Date.now()
  if (ncaabTeamStatsCache && now - ncaabTeamStatsCache.ts < TEAM_STATS_CACHE_TTL) {
    return ncaabTeamStatsCache.data
  }

  const [espnTeams, scoringEntries, netEntries, statProfiles] = await Promise.all([
    fetchNcaabTeamList(),
    fetchNcaaScoringStats(),
    fetchNcaaNetRankings(),
    fetchNcaaTeamStatProfiles(),
  ])

  const scoringMap = new Map(
    scoringEntries.map((entry) => [normalizeTeamKey(entry.team), entry])
  )
  const netMap = new Map(
    netEntries.map((entry) => [normalizeTeamKey(entry.team), entry])
  )
  const profileMap = new Map(
    statProfiles.map((entry) => [normalizeTeamKey(entry.team), entry])
  )

  const buildStats = (
    scoringEntry?: (typeof scoringEntries)[number],
    netEntry?: (typeof netEntries)[number],
    profile?: (typeof statProfiles)[number]
  ) => {
    const stats: Record<string, number | string | null> = {}
    if (scoringEntry?.games != null) stats.gamesPlayed = scoringEntry.games
    if (scoringEntry?.ppg != null) stats.pointsForPerGame = scoringEntry.ppg    
    if (scoringEntry?.oppPpg != null)
      stats.pointsAgainstPerGame = scoringEntry.oppPpg
    if (scoringEntry?.rank != null) stats.offenseRank = scoringEntry.rank
    if (scoringEntry?.oppPpgRank != null)
      stats.defenseRank = scoringEntry.oppPpgRank
    if (scoringEntry?.ppg != null && scoringEntry?.oppPpg != null) {
      stats.pointDiff = Number(
        (scoringEntry.ppg - scoringEntry.oppPpg).toFixed(1)
      )
    }
    if (netEntry?.rank != null) stats.netRank = netEntry.rank
    if (netEntry?.record) stats.netRecord = netEntry.record
    if (netEntry?.conference) stats.netConference = netEntry.conference
    if (profile?.stats) {
      for (const [key, value] of Object.entries(profile.stats)) {
        stats[key] = value
      }
    }
    if (profile?.games != null && stats.gamesPlayed == null) {
      stats.gamesPlayed = profile.games
    }

    const num = (key: string) => {
      const value = stats[key]
      if (value == null) return null
      const n = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(n) ? n : null
    }

    const games = num('gamesPlayed')
    if (games) {
      if (num('pointsForPerGame') == null && num('pointsFor') != null) {
        stats.pointsForPerGame = Number((num('pointsFor')! / games).toFixed(1))
      }
      if (num('pointsAgainstPerGame') == null && num('pointsAgainst') != null) {
        stats.pointsAgainstPerGame = Number(
          (num('pointsAgainst')! / games).toFixed(1)
        )
      }

      const opponentPerGameMap: Array<{ total: string; perGame: string }> = [
        {
          total: 'opponentFieldGoalsMade',
          perGame: 'opponentFieldGoalsMadePerGame',
        },
        {
          total: 'opponentFieldGoalsAttempted',
          perGame: 'opponentFieldGoalsAttemptedPerGame',
        },
        {
          total: 'opponentThreePointMade',
          perGame: 'opponentThreePointMadePerGame',
        },
        {
          total: 'opponentThreePointAttempts',
          perGame: 'opponentThreePointAttemptsPerGame',
        },
        {
          total: 'opponentRebounds',
          perGame: 'opponentReboundsPerGame',
        },
        {
          total: 'opponentTurnovers',
          perGame: 'opponentTurnoversPerGame',
        },
      ]
      opponentPerGameMap.forEach(({ total, perGame }) => {
        if (num(perGame) == null && num(total) != null) {
          stats[perGame] = Number((num(total)! / games).toFixed(2))
        }
      })
    }
    if (num('pointDiff') == null && num('pointsForPerGame') != null && num('pointsAgainstPerGame') != null) {
      stats.pointDiff = Number(
        (num('pointsForPerGame')! - num('pointsAgainstPerGame')!).toFixed(1)
      )
    }
    const fgaPerGame =
      num('fieldGoalsAttemptedPerGame') ??
      (num('fieldGoalsAttempted') != null && games
        ? num('fieldGoalsAttempted')! / games
        : null)
    const ftaPerGame =
      num('freeThrowAttemptsPerGame') ??
      (num('freeThrowAttempts') != null && games
        ? num('freeThrowAttempts')! / games
        : null)
    const toPerGame =
      num('turnoversPerGame') ??
      (num('turnovers') != null && games ? num('turnovers')! / games : null)
    const orebPerGame =
      num('offensiveReboundsPerGame') ??
      (num('offensiveRebounds') != null && games
        ? num('offensiveRebounds')! / games
        : null)

    if (
      fgaPerGame != null &&
      ftaPerGame != null &&
      toPerGame != null &&
      orebPerGame != null
    ) {
      const possPerGame = fgaPerGame - orebPerGame + toPerGame + 0.475 * ftaPerGame
      if (Number.isFinite(possPerGame) && possPerGame > 0) {
        stats.pace = Number(possPerGame.toFixed(1))
        const ppg = num('pointsForPerGame')
        const oppPpg = num('pointsAgainstPerGame')
        if (ppg != null) {
          stats.offensiveRating = Number(((ppg / possPerGame) * 100).toFixed(1))
        }
        if (oppPpg != null) {
          stats.defensiveRating = Number(((oppPpg / possPerGame) * 100).toFixed(1))
        }
        if (stats.offensiveRating != null && stats.defensiveRating != null) {
          stats.netRating = Number(
            (
              (stats.offensiveRating as number) -
              (stats.defensiveRating as number)
            ).toFixed(1)
          )
        }
      }
    }

    if (fgaPerGame != null && ftaPerGame != null && num('pointsForPerGame') != null) {
      const tsPct =
        num('pointsForPerGame')! /
        (2 * (fgaPerGame + 0.44 * ftaPerGame))
      if (Number.isFinite(tsPct)) {
        stats.trueShootingPct = Number((tsPct * 100).toFixed(1))
      }
    }

    const oppFgm = num('opponentFieldGoalsMade')
    const oppFga = num('opponentFieldGoalsAttempted')
    const opp3pm = num('opponentThreePointMade') ?? 0
    const opp3pa = num('opponentThreePointAttempts')
    if (oppFga != null && oppFga > 0) {
      if (num('opponentFieldGoalPct') == null && oppFgm != null) {
        stats.opponentFieldGoalPct = Number(((oppFgm / oppFga) * 100).toFixed(1))
      }
      if (oppFgm != null) {
        stats.opponentEffectiveFieldGoalPct = Number(
          (((oppFgm + 0.5 * opp3pm) / oppFga) * 100).toFixed(1)
        )
      }
    }
    if (opp3pa != null && opp3pa > 0 && num('opponentThreePointPct') == null) {
      stats.opponentThreePointPct = Number(((opp3pm / opp3pa) * 100).toFixed(1))
    }
    return stats
  }

  const merged = new Map<string, TeamStats>()

  for (const team of espnTeams) {
    const key = normalizeTeamKey(team.displayName || team.name)
    const scoringEntry = scoringMap.get(key)
    const netEntry = netMap.get(key)
    const profile = profileMap.get(key)
    const record = parseRecordSummary(team.recordSummary)
    const wins = team.wins ?? record?.wins ?? 0
    const losses = team.losses ?? record?.losses ?? 0
    const total = wins + losses
    const winPct = total > 0 ? wins / total : 0
    merged.set(key, {
      team: team.displayName || team.name || scoringEntry?.team || netEntry?.team || '',
      wins,
      losses,
      winPct,
      stats: buildStats(scoringEntry, netEntry, profile),
      rank: netEntry?.rank,
      season: String(new Date().getFullYear()),
      sport: 'basketball_ncaab',
      teamAbbr: team.abbreviation || undefined,
    })
  }

  const upsertFromNcaa = (
    entry: (typeof scoringEntries)[number] | (typeof netEntries)[number]
  ) => {
    const key = normalizeTeamKey(entry.team)
    if (merged.has(key)) return
    const netEntry = netMap.get(key)
    const scoringEntry = scoringMap.get(key)
    const profile = profileMap.get(key)
    const record = parseRecordSummary(netEntry?.record)
    const wins = record?.wins ?? 0
    const losses = record?.losses ?? 0
    const total = wins + losses
    merged.set(key, {
      team: entry.team,
      wins,
      losses,
      winPct: total > 0 ? wins / total : 0,
      stats: buildStats(scoringEntry, netEntry, profile),
      rank: netEntry?.rank,
      season: String(new Date().getFullYear()),
      sport: 'basketball_ncaab',
    })
  }

  scoringEntries.forEach(upsertFromNcaa)
  netEntries.forEach(upsertFromNcaa)

  const data = Array.from(merged.values())
  ncaabTeamStatsCache = { ts: Date.now(), data }
  return data
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
    const teams = await fetchNflTeamList()
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

const loadNFLTeamStatBlocksForSeason = async (season: number) => {
  const now = Date.now()
  if (
    nflTeamStatsCache &&
    nflTeamStatsCache.season === season &&
    now - nflTeamStatsCache.ts < TEAM_STATS_CACHE_TTL
  ) {
    return nflTeamStatsCache.data
  }

  const teams = await fetchNflTeamList()
  const results = await Promise.all(
    teams.map(async (meta) => {
      const [statsResp, recordMeta] = await Promise.all([
        fetchNflTeamStatistics(meta.id, season),
        fetchNflTeamRecord(meta.id, season),
      ])
      const categories = statsResp?.splits?.categories ?? []
      return { meta: { ...meta, ...(recordMeta ?? {}) }, categories }
    })
  )

  nflTeamStatsCache = { ts: now, season, data: results }
  return results
}

const hasMeaningfulNflStats = (
  blocks: Array<{ meta: EspnTeamMeta; categories: EspnStatCategory[] }>
) => {
  return blocks.some(({ meta, categories }) => {
    const pick = (names: string[]) => nflStatHelpers.pickStat(categories, names)
    const gamesPlayed =
      pick(['gamesPlayed', 'teamGamesPlayed']) ??
      ((meta.wins ?? 0) + (meta.losses ?? 0) || null)
    const pointsFor =
      pick(['totalPoints', 'totalPointsFor', 'pointsFor']) ??
      meta.pointsFor ??
      (meta.avgPointsFor != null && gamesPlayed ? meta.avgPointsFor * gamesPlayed : null)
    const ppg =
      pick(['totalPointsPerGame', 'pointsForPerGame']) ??
      (gamesPlayed && pointsFor != null
        ? pointsFor / gamesPlayed
        : meta.avgPointsFor ?? null)
    return Number.isFinite(ppg) && (ppg ?? 0) > 0
  })
}

const loadNFLTeamStatBlocks = async () => {
  const season = getCurrentNFLSeasonYear()
  let blocks = await loadNFLTeamStatBlocksForSeason(season)
  if (!blocks.length || !hasMeaningfulNflStats(blocks)) {
    const fallbackSeason = season - 1
    const fallbackBlocks = await loadNFLTeamStatBlocksForSeason(fallbackSeason)
    if (fallbackBlocks.length && hasMeaningfulNflStats(fallbackBlocks)) {
      blocks = fallbackBlocks
    }
  }
  return blocks
}

const hasMeaningfulNcaafStats = (
  blocks: Array<{
    meta: EspnNcaafTeamMeta
    categories: EspnNcaafStatCategory[]
  }>
) => {
  return blocks.some(({ meta, categories }) => {
    const pick = (names: string[]) => ncaafStatHelpers.pickStat(categories, names)
    const gamesPlayed =
      pick(['gamesPlayed', 'teamGamesPlayed']) ??
      ((meta.wins ?? 0) + (meta.losses ?? 0) || null)
    const pointsFor =
      pick(['totalPoints', 'totalPointsFor']) ??
      meta.pointsFor ??
      (meta.avgPointsFor != null && gamesPlayed ? meta.avgPointsFor * gamesPlayed : null)
    const ppg =
      pick(['totalPointsPerGame', 'pointsForPerGame']) ??
      (gamesPlayed && pointsFor != null
        ? pointsFor / gamesPlayed
        : meta.avgPointsFor ?? null)
    return Number.isFinite(ppg) && (ppg ?? 0) > 0
  })
}

const loadNCAAFTeamStatBlocksForSeason = async (season: number) => {
  const now = Date.now()
  if (
    ncaafTeamStatsCache &&
    ncaafTeamStatsCache.season === season &&
    now - ncaafTeamStatsCache.ts < TEAM_STATS_CACHE_TTL
  ) {
    return ncaafTeamStatsCache.data
  }

  const teams = await fetchNcaafTeamList()
  const results = await Promise.all(
    teams.map(async (meta) => {
      const [statsResp, postseasonResp, recordMeta] = await Promise.all([
        fetchNcaafTeamStatistics(meta.id, season, 2),
        fetchNcaafTeamStatistics(meta.id, season, 3),
        fetchNcaafTeamRecordMeta(meta.id),
      ])
      const categories = statsResp?.splits?.categories ?? []
      const postseasonCategories = postseasonResp?.splits?.categories ?? []
      const enrichedMeta = {
        ...meta,
        abbreviation: recordMeta?.abbreviation || meta.abbreviation,
        wins: recordMeta?.wins ?? meta.wins,
        losses: recordMeta?.losses ?? meta.losses,
        pointsFor: recordMeta?.pointsFor ?? meta.pointsFor,
        pointsAgainst: recordMeta?.pointsAgainst ?? meta.pointsAgainst,
        avgPointsFor: recordMeta?.avgPointsFor ?? meta.avgPointsFor,
        avgPointsAgainst: recordMeta?.avgPointsAgainst ?? meta.avgPointsAgainst,
      }
      return { meta: enrichedMeta, categories, postseasonCategories }
    })
  )

  ncaafTeamStatsCache = { ts: now, season, data: results }
  return results
}

const loadNCAAFTeamStatBlocks = async () => {
  const season = getCurrentNFLSeasonYear()
  let blocks = await loadNCAAFTeamStatBlocksForSeason(season)
  if (!blocks.length || !hasMeaningfulNcaafStats(blocks)) {
    const fallbackSeason = season - 1
    const fallbackBlocks = await loadNCAAFTeamStatBlocksForSeason(fallbackSeason)
    if (fallbackBlocks.length && hasMeaningfulNcaafStats(fallbackBlocks)) {
      blocks = fallbackBlocks
    }
  }
  return blocks
}

const buildNFLTeamEntry = (teamMeta: EspnTeamMeta, categories: EspnStatCategory[]) => {
  const pick = (names: string[]) => nflStatHelpers.pickStat(categories, names)
  const pickPositive = (names: string[]) => {
    const value = pick(names)
    return value != null && value > 0 ? value : null
  }
  const gamesPlayed =
    pick(['gamesPlayed', 'teamGamesPlayed']) ??
    ((teamMeta.wins ?? 0) + (teamMeta.losses ?? 0) || null)
  const pointsFor =
    pickPositive(['totalPoints', 'totalPointsFor', 'pointsFor']) ??
    teamMeta.pointsFor ??
    (gamesPlayed && teamMeta.avgPointsFor != null ? teamMeta.avgPointsFor * gamesPlayed : null)
  const pointsAgainst =
    pickPositive(['pointsAgainst', 'pointsAllowed', 'totalPointsAllowed', 'totalPointsAgainst']) ??
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
  const redzoneScoringPct = pick(['redzoneScoringPct'])
  const totalDrives = pick(['totalDrives'])
  const yardsAllowed =
    pick(['yardsAllowed', 'totalYardsAllowed', 'opponentTotalYards']) ?? null
  const yardsAllowedPerGame =
    yardsAllowed != null && gamesPlayed ? yardsAllowed / gamesPlayed : null
  const passingYards = pick(['passingYards', 'netPassingYards'])
  const passingYardsPerAttempt =
    pick(['yardsPerPassAttempt', 'netYardsPerPassAttempt']) ??
    (passingYards != null && passAttempts != null && passAttempts > 0
      ? passingYards / passAttempts
      : null)
  const completionPct = pick(['completionPct'])
  const interceptionPct = pick(['interceptionPct'])
  const passerRating = pick(['passerRating', 'passingRating', 'quarterbackRating'])
  const sacksAllowed = pick(['sacksAllowed'])
  const defensiveSacks = pick(['sacks', 'defensiveSacks'])
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
      avgPointsFor: teamMeta.avgPointsFor ?? null,
      avgPointsAgainst: teamMeta.avgPointsAgainst ?? null,
      totalYards: totalYards ?? null,
      yardsPerPlay: yardsPerPlay ?? null,
      passRate: passRate ?? null,
      rushRate: rushRate ?? null,
      thirdDownPct: thirdDownPct ?? null,
      redZoneTdPct: redzoneTdPct ?? null,
      redZoneScoringPct: redzoneScoringPct ?? null,
      turnoverDifferential: turnoverDifferential ?? null,
      pointsForPerGame:
        pickPositive(['totalPointsPerGame', 'pointsForPerGame']) ??
        (pointsFor != null && gamesPlayed ? pointsFor / gamesPlayed : null),
      pointsAgainstPerGame:
        pickPositive(['pointsAgainstPerGame', 'pointsAllowedPerGame', 'totalPointsAllowedPerGame']) ??
        (pointsAgainst != null && gamesPlayed ? pointsAgainst / gamesPlayed : null),
      playsPerGame:
        offensivePlays != null && gamesPlayed ? offensivePlays / gamesPlayed : null,
      drivesPerGame:
        totalDrives != null && gamesPlayed ? totalDrives / gamesPlayed : null,
      pointsPerDrive:
        pointsFor != null && totalDrives ? pointsFor / totalDrives : null,
      yardsAllowedPerGame: yardsAllowedPerGame ?? null,
      passingYards: passingYards ?? null,
      passingAttempts: passAttempts ?? null,
      passingYardsPerAttempt: passingYardsPerAttempt ?? null,
      completionPct: completionPct ?? null,
      interceptionPct: interceptionPct ?? null,
      passerRating: passerRating ?? null,
      sacksAllowed: sacksAllowed ?? null,
      defensiveSacks: defensiveSacks ?? null,
      streak: teamMeta.recordSummary ?? null,
    },
  }

  appendEspnCategoryStats(
    teamStats.stats as Record<string, number | string | null>,
    categories,
    'ESPN_TEAM'
  )

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

const buildNCAAFTeamEntry = (
  teamMeta: EspnNcaafTeamMeta,
  categories: EspnNcaafStatCategory[],
  postseasonCategories: EspnNcaafStatCategory[] = []
) => {
  const pick = (names: string[]) => ncaafStatHelpers.pickStat(categories, names)
  const pickPercent = (names: string[]) => {
    const value = pick(names)
    if (value != null && value !== 0) return value
    return ncaafStatHelpers.pickStat(categories, names, { perGame: true })
  }
  const sanitizeZero = (value: number | null) => (value === 0 ? null : value)
  const pickFromCategory = (
    categoryName: string,
    names: string[],
    opts: { perGame?: boolean } = {}
  ) => {
    const category = categories.find(
      (entry) => entry?.name?.toLowerCase() === categoryName.toLowerCase()
    )
    if (!category) return null
    return ncaafStatHelpers.pickStat([category], names, opts)
  }
  const gamesPlayed =
    pick(['gamesPlayed', 'teamGamesPlayed']) ??
    ((teamMeta.wins ?? 0) + (teamMeta.losses ?? 0) || null)
  const pointsFor =
    pick(['totalPoints', 'totalPointsFor']) ??
    teamMeta.pointsFor ??
    (gamesPlayed && teamMeta.avgPointsFor != null
      ? teamMeta.avgPointsFor * gamesPlayed
      : null)
  const pointsAgainst =
    pick(['pointsAgainst']) ??
    teamMeta.pointsAgainst ??
    (gamesPlayed && teamMeta.avgPointsAgainst != null
      ? teamMeta.avgPointsAgainst * gamesPlayed
      : null)
  const totalYards = pick(['totalYards', 'totalYardsFromScrimmage'])
  const offensivePlays = pick(['totalOffensivePlays'])
  const totalDrives = sanitizeZero(pick(['totalDrives']))
  const pointsForPerGame = pick(['totalPointsPerGame'])
  const pointsAgainstPerGame = pick(['pointsAgainstPerGame'])
  const avgPointsFor = teamMeta.avgPointsFor ?? null
  const avgPointsAgainst = teamMeta.avgPointsAgainst ?? null
  const pointsForPerGameValue =
    pointsForPerGame ??
    (pointsFor != null && gamesPlayed ? pointsFor / gamesPlayed : null) ??
    avgPointsFor
  const pointsAgainstPerGameValue =
    pointsAgainstPerGame ??
    (pointsAgainst != null && gamesPlayed ? pointsAgainst / gamesPlayed : null) ??
    avgPointsAgainst
  const passingYardsPerGame = pick(['passingYardsPerGame'])
  const rushingYardsPerGame = pick(['rushingYardsPerGame'])
  const passAttempts = pick(['passingAttempts', 'netPassingAttempts'])
  const rushAttempts = pick(['rushingAttempts', 'netRushingAttempts'])
  const passingYards = pick(['passingYards', 'netPassingYards'])
  const passAttemptsPerGame =
    passAttempts != null && gamesPlayed && gamesPlayed > 0
      ? passAttempts / gamesPlayed
      : null
  const rushAttemptsPerGame =
    rushAttempts != null && gamesPlayed && gamesPlayed > 0
      ? rushAttempts / gamesPlayed
      : null
  const passingYardsPerAttempt =
    pick(['yardsPerPassAttempt', 'netYardsPerPassAttempt']) ??
    (passingYards != null && passAttempts != null && passAttempts > 0
      ? passingYards / passAttempts
      : null)
  const rushingYardsPerAttempt = pick(['yardsPerRushAttempt'])
  const completionPct = pickPercent(['completionPct'])
  const interceptionPct = pickPercent(['interceptionPct'])
  const passerRating = pick(['passerRating', 'passingRating', 'quarterbackRating'])
  const sacksAllowed = pick(['sacksAllowed', 'sacks'])
  const yardsPerPlay =
    totalYards != null && offensivePlays && offensivePlays > 0
      ? totalYards / offensivePlays
      : null
  const playsPerGame =
    offensivePlays != null && gamesPlayed && gamesPlayed > 0
      ? offensivePlays / gamesPlayed
      : null
  const drivesPerGame =
    totalDrives != null && gamesPlayed && gamesPlayed > 0
      ? totalDrives / gamesPlayed
      : null
  const pointsPerDrive =
    pointsFor != null && totalDrives && totalDrives > 0
      ? pointsFor / totalDrives
      : null
  const passRate =
    offensivePlays && passAttempts != null && offensivePlays > 0
      ? passAttempts / offensivePlays
      : null
  const rushRate =
    offensivePlays && rushAttempts != null && offensivePlays > 0
      ? rushAttempts / offensivePlays
      : null
  const thirdDownPct = pickPercent(['thirdDownConvPct'])
  const redzoneTdPct = pickPercent(['redzoneTouchdownPct'])
  const redzoneScoringPct = pickPercent(['redzoneScoringPct'])
  const fourthDownPct = pickPercent(['fourthDownConvPct'])
  const passingBigPlays = sanitizeZero(pick(['passingBigPlays']))
  const rushingBigPlays = sanitizeZero(pick(['rushingBigPlays']))
  const explosivePlays =
    passingBigPlays != null && rushingBigPlays != null
      ? passingBigPlays + rushingBigPlays
      : null
  const explosivePlayRate =
    explosivePlays != null && offensivePlays && offensivePlays > 0
      ? explosivePlays / offensivePlays
      : null
  const sackRate =
    sacksAllowed != null && passAttempts != null && passAttempts + sacksAllowed > 0
      ? sacksAllowed / (passAttempts + sacksAllowed)
      : null
  const turnoverDifferential =
    pick(['turnOverDifferential']) ??
    (pick(['totalTakeaways']) != null && pick(['totalGiveaways']) != null
      ? (pick(['totalTakeaways']) as number) - (pick(['totalGiveaways']) as number)
      : null)
  const defensiveSacks = pickFromCategory('defensive', ['sacks'])
  const defensiveInterceptions = pickFromCategory('defensiveInterceptions', [
    'interceptions',
  ])
  const tacklesForLoss = pickFromCategory('defensive', ['tacklesForLoss'])
  const passesDefended = pickFromCategory('defensive', ['passesDefended'])
  const qbHits = pickFromCategory('defensive', ['QBHits', 'qbHits'])
  const pointsAllowed = pickFromCategory('defensive', ['pointsAllowed'])
  const yardsAllowed =
    pickFromCategory('defensive', ['yardsAllowed']) ??
    pick(['yardsAllowed', 'totalYardsAllowed', 'opponentTotalYards']) ??
    null
  const yardsAllowedPerGame =
    yardsAllowed != null && gamesPlayed && gamesPlayed > 0
      ? yardsAllowed / gamesPlayed
      : null

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
      pointsForPerGame: pointsForPerGameValue ?? null,
      pointsAgainstPerGame: pointsAgainstPerGameValue ?? null,
      pointsPerDrive: pointsPerDrive ?? null,
      totalYards: totalYards ?? null,
      totalOffensivePlays: offensivePlays ?? null,
      totalDrives: totalDrives ?? null,
      yardsPerPlay: yardsPerPlay ?? null,
      passingYardsPerGame: passingYardsPerGame ?? null,
      rushingYardsPerGame: rushingYardsPerGame ?? null,
      passingYardsPerAttempt: passingYardsPerAttempt ?? null,
      rushingYardsPerAttempt: rushingYardsPerAttempt ?? null,
      passingAttempts: passAttempts ?? null,
      rushingAttempts: rushAttempts ?? null,
      passingAttemptsPerGame: passAttemptsPerGame ?? null,
      rushingAttemptsPerGame: rushAttemptsPerGame ?? null,
      completionPct: completionPct ?? null,
      interceptionPct: interceptionPct ?? null,
      playsPerGame: playsPerGame ?? null,
      drivesPerGame: drivesPerGame ?? null,
      passRate: passRate ?? null,
      rushRate: rushRate ?? null,
      thirdDownPct: thirdDownPct ?? null,
      fourthDownConvPct: fourthDownPct ?? null,
      redZoneTdPct: redzoneTdPct ?? null,
      redZoneScoringPct: redzoneScoringPct ?? null,
      explosivePlays: explosivePlays ?? null,
      explosivePlayRate: explosivePlayRate ?? null,
      sackRate: sackRate ?? null,
      sacksAllowed: sacksAllowed ?? null,
      defensiveSacks: defensiveSacks ?? null,
      defensiveInterceptions: defensiveInterceptions ?? null,
      tacklesForLoss: tacklesForLoss ?? null,
      passesDefended: passesDefended ?? null,
      qbHits: qbHits ?? null,
      pointsAllowed: pointsAllowed ?? null,
      yardsAllowed: yardsAllowed ?? null,
      yardsAllowedPerGame: yardsAllowedPerGame ?? null,
      turnoverDifferential: turnoverDifferential ?? null,
      streak: teamMeta.recordSummary ?? null,
    },
  }

  appendEspnCategoryStats(
    teamStats.stats as Record<string, number | string | null>,
    categories,
    'ESPN_TEAM'
  )

  if (postseasonCategories.length) {
    const postPick = (names: string[]) =>
      ncaafStatHelpers.pickStat(postseasonCategories, names)
    const postGames = postPick(['gamesPlayed', 'teamGamesPlayed'])
    const postPointsFor = postPick(['totalPoints', 'totalPointsFor'])
    const postPointsAgainst = postPick(['pointsAgainst'])
    const postPointsForPerGame =
      postPick(['totalPointsPerGame']) ??
      (postPointsFor != null && postGames ? postPointsFor / postGames : null)
    const postPointsAgainstPerGame =
      postPick(['pointsAgainstPerGame']) ??
      (postPointsAgainst != null && postGames
        ? postPointsAgainst / postGames
        : null)
    const postTotalYards = postPick(['totalYards', 'totalYardsFromScrimmage'])
    const postPlays = postPick(['totalOffensivePlays'])
    const postYardsPerPlay =
      postTotalYards != null && postPlays && postPlays > 0
        ? postTotalYards / postPlays
        : null
    const postDrives = postPick(['totalDrives'])
    const postPointsPerDrive =
      postPointsFor != null && postDrives && postDrives > 0
        ? postPointsFor / postDrives
        : null
    const postThirdDownPct = postPick(['thirdDownConvPct'])
    const postRedZoneTdPct = postPick(['redzoneTouchdownPct'])
    const postPassingBigPlays = postPick(['passingBigPlays']) ?? 0
    const postRushingBigPlays = postPick(['rushingBigPlays']) ?? 0
    const postExplosivePlays =
      postPassingBigPlays != null && postRushingBigPlays != null
        ? postPassingBigPlays + postRushingBigPlays
        : null
    const postExplosiveRate =
      postExplosivePlays != null && postPlays && postPlays > 0
        ? postExplosivePlays / postPlays
        : null
    const postTurnoverDifferential =
      postPick(['turnOverDifferential']) ??
      (postPick(['totalTakeaways']) != null &&
      postPick(['totalGiveaways']) != null
        ? (postPick(['totalTakeaways']) as number) -
          (postPick(['totalGiveaways']) as number)
        : null)

    Object.assign(teamStats.stats, {
      postseasonPointsForPerGame: postPointsForPerGame ?? null,
      postseasonPointsAgainstPerGame: postPointsAgainstPerGame ?? null,
      postseasonYardsPerPlay: postYardsPerPlay ?? null,
      postseasonPointsPerDrive: postPointsPerDrive ?? null,
      postseasonThirdDownPct: postThirdDownPct ?? null,
      postseasonRedZoneTdPct: postRedZoneTdPct ?? null,
      postseasonExplosivePlayRate: postExplosiveRate ?? null,
      postseasonTurnoverDifferential: postTurnoverDifferential ?? null,
    })
    appendEspnCategoryStats(
      teamStats.stats as Record<string, number | string | null>,
      postseasonCategories,
      'ESPN_TEAM_POST'
    )
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

export async function getNCAAFTeamStats(teamAbbr?: string): Promise<TeamStats[]> {
  try {
    const blocks = await loadNCAAFTeamStatBlocks()
    const teams = blocks
      .filter((entry) => !teamAbbr || entry.meta.abbreviation === teamAbbr)
      .map((entry) =>
        buildNCAAFTeamEntry(
          entry.meta,
          entry.categories,
          entry.postseasonCategories
        ).teamStats
      )
    return teams
  } catch (error) {
    console.error('Error fetching NCAAF team stats:', error)
    return []
  }
}

const fetchNcaafTeamStatsBySearch = async (
  teamName: string
): Promise<TeamStats | null> => {
  const search = await searchEspnTeam(teamName, 'ncf')
  if (!search) return null

  const season = getCurrentNFLSeasonYear()
  const recordMeta = await fetchNcaafTeamRecordMeta(search.id)
  let statsResp = await fetchNcaafTeamStatistics(search.id, season, 2)
  let postseasonResp = await fetchNcaafTeamStatistics(search.id, season, 3)

  let categories = statsResp?.splits?.categories ?? []
  let postseasonCategories = postseasonResp?.splits?.categories ?? []
  if (!categories.length) {
    const fallbackSeason = season - 1
    statsResp = await fetchNcaafTeamStatistics(search.id, fallbackSeason, 2)
    postseasonResp = await fetchNcaafTeamStatistics(search.id, fallbackSeason, 3)
    categories = statsResp?.splits?.categories ?? []
    postseasonCategories = postseasonResp?.splits?.categories ?? []
  }

  if (!categories.length && !postseasonCategories.length) return null

  const meta: EspnNcaafTeamMeta = {
    id: String(search.id),
    name: search.name,
    displayName: search.name,
    shortDisplayName: search.name,
    abbreviation: recordMeta?.abbreviation || '',
    wins: recordMeta?.wins,
    losses: recordMeta?.losses,
    pointsFor: recordMeta?.pointsFor,
    pointsAgainst: recordMeta?.pointsAgainst,
    avgPointsFor: recordMeta?.avgPointsFor,
    avgPointsAgainst: recordMeta?.avgPointsAgainst,
  }

  return buildNCAAFTeamEntry(meta, categories, postseasonCategories).teamStats
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
    // Sports Reference first for non-live stats
    try {
      if (sportKey !== 'basketball_nba') {
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
  const resolvedSport = resolveSportKey(sport) ?? sport.toLowerCase()
  const sportKey = resolvedSport
  let resolvedTeamIdentifier = teamIdentifier
  if (resolvedSport === 'basketball_ncaab' && teamIdentifier) {
    const resolvedName = await resolveEspnTeamName('ncaab', teamIdentifier)
    if (resolvedName) {
      resolvedTeamIdentifier = resolvedName
    }
  }

  const filterTeams = (teams: TeamStats[]): TeamStats[] => {
    if (!resolvedTeamIdentifier && !teamIdentifier) return teams

    const targets = new Set<string>()
    const addTargets = (value?: string | null) => {
      if (!value) return
      for (const variant of buildTeamKeyVariants(value)) {
        if (variant) targets.add(variant)
      }
    }
    addTargets(resolvedTeamIdentifier ?? null)
    if (teamIdentifier && teamIdentifier !== resolvedTeamIdentifier) {
      addTargets(teamIdentifier)
    }
    const matched = teams.filter((entry) => {
      const name = normalizeName(entry.team)
      const abbr = normalizeName((entry as any).teamAbbr || '')
      // Fixed matching: avoid substring issues like "nets" matching "hornets"
      // Match if: exact match, name ends with target (nickname), or abbreviation matches
      for (const target of targets) {
        if (!target) continue
        if (
          name === target ||
          name.endsWith(target) ||
          target.endsWith(name) ||
          (abbr && (abbr === target || abbr.endsWith(target) || target.endsWith(abbr)))
        ) {
          return true
        }
      }
      return false
    })
    if (
      (resolvedSport === 'basketball_ncaab' ||
        resolvedSport === 'americanfootball_ncaaf') &&
      matched.length > 1
    ) {
      matched.sort(
        (a, b) =>
          Object.keys(b.stats || {}).length - Object.keys(a.stats || {}).length
      )
    }
    return matched
  }

  switch (sportKey) {
    case 'nba':
    case 'basketball_nba': {
      const [basic, advanced] = await Promise.all([
        getNBATeamStats(),
        getNBAAdvancedTeamStats(),
      ])
      const advByAbbr = new Map(
        advanced
          .filter((entry) => entry.teamAbbr)
          .map((entry) => [normalizeName(entry.teamAbbr || ''), entry])
      )
      const advByName = new Map(
        advanced.map((entry) => [normalizeName(entry.team), entry])
      )
      const merged = basic.map((teamEntry) => {
        const abbrKey = normalizeName(teamEntry.teamAbbr || '')
        const nameKey = normalizeName(teamEntry.team)
        const adv = advByAbbr.get(abbrKey) || advByName.get(nameKey)
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
    case 'ncaaf':
    case 'americanfootball_ncaaf': {
      const teams = await getNCAAFTeamStats()
      const filtered = filterTeams(teams)
      if (!filtered.length && teamIdentifier) {
        const fallback = await fetchNcaafTeamStatsBySearch(teamIdentifier)
        if (fallback) return [fallback]
      }
      return filtered
    }
    case 'ncaab':
    case 'basketball_ncaab': {
      const teams = await getNCAABTeamStats()
      return filterTeams(teams)
    }
    default:
      return []
  }
}

export async function getInjuryReports(sport: string): Promise<InjuryReport[]> {
  const resolved = resolveSportKey(sport) ?? sport.toLowerCase()
  switch (resolved) {
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
  const resolved = resolveSportKey(sport) ?? sport.toLowerCase()
  switch (resolved) {
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
        teams[0].stats?.reboundsPerGame != null ||
        teams[0].stats?.pointsForPerGame != null ||
        teams[0].stats?.pointsAgainstPerGame != null)

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
