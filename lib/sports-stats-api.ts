import Papa from 'papaparse'
import { buildRecentPerformances } from '@/lib/utils/recent-performances'
import { RecentPerformance } from '@/lib/utils/recent-performances'

// Comprehensive Sports Statistics API Integration
// Supports NBA, NFL, MLB, NHL - Player stats, team stats, advanced analytics, injuries

export interface PlayerStats {
  name: string
  team: string
  position?: string
  stats: Record<string, number | string>
  season?: string
  headshot?: string
  sport?: string
  recent?: ReturnType<typeof buildRecentPerformances>
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
}

const NFL_PLAYER_STATS_BASE =
  'https://github.com/nflverse/nflverse-data/releases/download/player_stats'

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
    const games: any[] =
      data?.events ||
      data?.gameLog ||
      data?.gamelog ||
      data?.items ||
      data?.entries ||
      []

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
const nflSeasonRowsCache = new Map<number, { ts: number; rows: Record<string, any>[] }>()
const nflEpaRankCache = new Map<number, Map<string, { rank: number; total: number; epaPerPlay: number }>>()

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
  const [baseStats, csvData] = await Promise.all([
    fetchNFLPlayerBaseStats(rosterEntry.id, seasonYear),
    loadNFLPlayerSeasonRows(rosterEntry.fullName, seasonYear),
  ])

  if (!baseStats && !csvData) {
    return null
  }

  const stats: Record<string, number | string> = {}
  if (baseStats) {
    stats.PASSING_YARDS = baseStats.passingYards ?? 0
    stats.PASSING_TDS = baseStats.passingTouchdowns ?? 0
    stats.INTERCEPTIONS = baseStats.passingInterceptions ?? 0
    stats.COMPLETIONS = baseStats.completions ?? 0
    stats.ATTEMPTS = baseStats.passingAttempts ?? 0
    stats.RUSHING_YARDS = baseStats.rushingYards ?? 0
    stats.RUSHING_TDS = baseStats.rushingTouchdowns ?? 0
    stats.RUSHING_ATTEMPTS = baseStats.rushingAttempts ?? 0
    if ((baseStats.receptions ?? 0) > 0) {
      stats.RECEPTIONS = baseStats.receptions ?? 0
      stats.RECEIVING_YARDS = baseStats.receivingYards ?? 0
      stats.RECEIVING_TDS = baseStats.receivingTouchdowns ?? 0
      stats.TARGETS = baseStats.targets ?? 0
    }
  }

  if (csvData && csvData.rows.length) {
    let passingEPA = 0
    let rushingEPA = 0
    let receivingEPA = 0
    let passAttempts = 0
    let rushAttempts = 0
    let targets = 0

    for (const row of csvData.rows) {
      passingEPA += Number(row.passing_epa ?? 0)
      rushingEPA += Number(row.rushing_epa ?? 0)
      receivingEPA += Number(row.receiving_epa ?? 0)
      passAttempts += Number(row.attempts ?? 0)
      rushAttempts += Number(row.carries ?? 0)
      targets += Number(row.targets ?? 0)
    }

    const totalPlays = passAttempts + rushAttempts + targets
    const totalEPA = passingEPA + rushingEPA + receivingEPA
    stats.EPA_TOTAL = Number(totalEPA.toFixed(2))
    if (totalPlays > 0) {
      stats.EPA_PER_PLAY = Number((totalEPA / totalPlays).toFixed(3))
    }
  }

  // EPA/play position rank
  try {
    const ranks = await getEpaPerPlayPositionRanks(seasonYear)
    const pos = (rosterEntry.position || '').trim().toUpperCase()
    if (pos) {
      const lookupKey = `${normalizeName(rosterEntry.fullName)}|${pos}`
      const rankEntry = ranks.get(lookupKey)
      if (rankEntry) {
        stats.EPA_PER_PLAY_RANK = `${rankEntry.rank}/${rankEntry.total} ${pos}`
      }
    }
  } catch (err) {
    console.warn('[NFL] EPA rank lookup failed', err)
  }

  const result: PlayerStats = {
    name: rosterEntry.fullName,
    team: rosterEntry.team,
    position: rosterEntry.position,
    season: String(baseStats?.season ?? csvData?.season ?? seasonYear),
    stats,
    headshot: rosterEntry.headshot,
    sport: 'americanfootball_nfl',
  }

  // Recent performances (last 5 games from CSV rows)
  if (csvData?.rows?.length) {
    result.recent = buildRecentPerformances(csvData.rows, 5)
  }

  playerStatsCache.set(cacheKey, { data: result, ts: Date.now() })
  return result
}

const fetchNFLPlayerBaseStats = async (playerId: string, seasonYear: number) => {
  const trySeason = async (year: number) => {
    const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/types/2/athletes/${playerId}/statistics?lang=en&region=us`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      return null
    }
    const data = await response.json()
    const stats = data.splits?.categories?.flatMap((cat: any) => cat.stats) ?? []
    const pick = (name: string) => {
      const entry = stats.find((stat: any) => stat.name === name)
      return entry?.value ?? null
    }
    return {
      season: year,
      passingYards: pick('passingYards'),
      passingTouchdowns: pick('passingTouchdowns'),
      passingInterceptions: pick('interceptions'),
      passingAttempts: pick('passingAttempts'),
      completions: pick('completions'),
      rushingYards: pick('rushingYards'),
      rushingTouchdowns: pick('rushingTouchdowns'),
      rushingAttempts: pick('rushingAttempts'),
      receptions: pick('receptions'),
      receivingYards: pick('receivingYards'),
      receivingTouchdowns: pick('receivingTouchdowns'),
      targets: pick('receivingTargets'),
    }
  }

  const primary = await trySeason(seasonYear)
  if (primary) return primary
  return trySeason(seasonYear - 1)
}

const MIN_PLAYS_FOR_EPA_RANK = 20

const getEpaPerPlayPositionRanks = async (seasonYear: number) => {
  const cache = nflEpaRankCache.get(seasonYear)
  if (cache) return cache

  const seasonRows = nflSeasonRowsCache.get(seasonYear)?.rows || (await loadNFLPlayerSeasonRows('', seasonYear))?.rows || []
  if (!seasonRows.length) {
    return new Map<string, { rank: number; total: number; epaPerPlay: number }>()
  }

  const positionGroups = new Map<string, Array<{ name: string; epaPerPlay: number }>>()

  for (const row of seasonRows) {
    const name =
      String(row.player_display_name ?? row.player_name ?? '').trim()
    const pos = String(row.position ?? '').trim().toUpperCase()
    if (!name || !pos) continue

    const attempts = Number(row.attempts ?? 0)
    const carries = Number(row.carries ?? 0)
    const targets = Number(row.targets ?? 0)
    const totalPlays = attempts + carries + targets
    if (!Number.isFinite(totalPlays) || totalPlays < MIN_PLAYS_FOR_EPA_RANK) continue

    const passingEPA = Number(row.passing_epa ?? 0)
    const rushingEPA = Number(row.rushing_epa ?? 0)
    const receivingEPA = Number(row.receiving_epa ?? 0)
    const totalEPA = passingEPA + rushingEPA + receivingEPA
    const epaPerPlay = totalPlays > 0 ? totalEPA / totalPlays : 0

    if (!positionGroups.has(pos)) {
      positionGroups.set(pos, [])
    }
    positionGroups.get(pos)!.push({ name, epaPerPlay })
  }

  const rankMap = new Map<string, { rank: number; total: number; epaPerPlay: number }>()

  for (const [pos, list] of positionGroups.entries()) {
    const sorted = list.sort((a, b) => b.epaPerPlay - a.epaPerPlay)
    sorted.forEach((entry, idx) => {
      const key = `${normalizeName(entry.name)}|${pos}`
      rankMap.set(key, { rank: idx + 1, total: sorted.length, epaPerPlay: entry.epaPerPlay })
    })
  }

  nflEpaRankCache.set(seasonYear, rankMap)
  return rankMap
}

const loadNFLPlayerSeasonRows = async (playerName: string, seasonYear: number) => {
  const loadSeasonRows = async (year: number) => {
    const cached = nflSeasonRowsCache.get(year)
    if (cached && Date.now() - cached.ts < PLAYER_STATS_CACHE_TTL) {
      return cached.rows
    }

    const url = `${NFL_PLAYER_STATS_BASE}/player_stats_${year}.csv`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      return null
    }
    const text = await response.text()
    const parsed = Papa.parse<Record<string, string | number>>(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    })
    const rows = (parsed.data || []).filter(
      (row) =>
        Number(row.season) === year &&
        String(row.season_type).toUpperCase() === 'REG'
    )
    nflSeasonRowsCache.set(year, { ts: Date.now(), rows })
    return rows
  }

  const seasonRows = (await loadSeasonRows(seasonYear)) || (await loadSeasonRows(seasonYear - 1))
  if (!seasonRows) return null

  if (!playerName) {
    return { rows: seasonRows, season: seasonRows?.[0]?.season ?? seasonYear }
  }

  const filtered = seasonRows.filter(
    (row) =>
      normalizeName(String(row.player_display_name ?? row.player_name ?? '')) === normalizeName(playerName)
  )

  return { rows: filtered, season: seasonRows?.[0]?.season ?? seasonYear }
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
    const response = await fetch(url, { next: { revalidate: 3600 } })

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

          const pointsForPerGame = numOrNull(pickStat(statsArray, ['pointsPerGame', 'pointsFor']))
          const pointsAgainstPerGame = numOrNull(
            pickStat(statsArray, ['pointsAgainstPerGame', 'pointsAgainst', 'oppPointsPerGame'])
          )
          const pointsFor = pointsForPerGame && gamesPlayed ? Number((pointsForPerGame * gamesPlayed).toFixed(1)) : null
          const pointsAgainst =
            pointsAgainstPerGame && gamesPlayed ? Number((pointsAgainstPerGame * gamesPlayed).toFixed(1)) : null
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

// ==================== NFL ADVANCED STATS (via nflfastR CSV) ====================

/**
 * Fetch team-level advanced metrics (EPA/Play, success rate, pass/run rate) from nflfastR public CSV.
 * Uses season summary file to avoid pulling full play-by-play.
 */
export async function getNFLAdvancedTeamStats(): Promise<AdvancedTeamStats[]> {
  try {
    const season = new Date().getFullYear()
    const csvUrl = `https://raw.githubusercontent.com/guga31bb/nflfastR-data/master/data/seasons/` +
      `team_stats_${season}.csv`

    const response = await fetch(csvUrl, { cache: 'no-store' })
    if (!response.ok) {
      console.warn('NFL advanced stats fetch failed:', response.statusText)
      return []
    }

    const csvText = await response.text()
    const lines = csvText.split('\n').filter(Boolean)
    const header = lines.shift()
    if (!header) return []

    const cols = header.split(',')
    const colIdx = (key: string) => cols.indexOf(key)

    const requiredCols = ['posteam', 'epa_play', 'success_rate', 'pass_rate', 'rush_rate']
    if (!requiredCols.every((c) => colIdx(c) !== -1)) {
      console.warn('NFL advanced stats missing required columns')
      return []
    }

    const results: AdvancedTeamStats[] = lines.map((line) => {
      const parts = line.split(',')
      return {
        team: parts[colIdx('posteam')],
        teamAbbr: parts[colIdx('posteam')],
        epaPerPlay: parseFloat(parts[colIdx('epa_play')]),
        successRate: parseFloat(parts[colIdx('success_rate')]),
        passRate: parseFloat(parts[colIdx('pass_rate')]),
        rushRate: parseFloat(parts[colIdx('rush_rate')]),
      }
    })

    return results
  } catch (error) {
    console.error('Error fetching NFL advanced team stats:', error)
    return []
  }
}

export async function getNBAInjuries(): Promise<InjuryReport[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries'
    const response = await fetch(url, { next: { revalidate: 1800 } })

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
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return useCache && nbaRosterCache ? nbaRosterCache.roster : []

    const data = await response.json()
    const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? []
    const roster: RosterPlayer[] = []

    const fetchTeamRoster = async (team: any): Promise<RosterPlayer[]> => {
      const players: RosterPlayer[] = []
      const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`

      try {
        const rosterResponse = await fetch(rosterUrl, { next: { revalidate: 3600 } })

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
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams'
    const response = await fetch(url, { next: { revalidate: 3600 } })
    if (!response.ok) return []
    const data = await response.json()
    const roster: RosterPlayer[] = []
    const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? []
    for (const entry of teams) {
      const team = entry.team
      if (!team) continue
      if (teamAbbr && team.abbreviation !== teamAbbr) continue
      try {
        const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team.id}/roster`
        const rosterResponse = await fetch(rosterUrl, { next: { revalidate: 3600 } })
        if (!rosterResponse.ok) continue
        const rosterData = await rosterResponse.json()
        const groups = rosterData.athletes ?? []
        for (const group of groups) {
          const athletes = group.items ?? []
          for (const athlete of athletes) {
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
        }
      } catch (error) {
        console.error(`Error fetching roster for ${team.displayName}:`, error)
      }
    }
    return roster
  } catch (error) {
    console.error('Error fetching NFL rosters:', error)
    return []
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

// ==================== NFL STATS (via ESPN) ====================

export async function getNFLTeamStats(teamAbbr?: string): Promise<TeamStats[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams'
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    if (data.sports?.[0]?.leagues?.[0]?.teams) {
      for (const teamObj of data.sports[0].leagues[0].teams) {
        const team = teamObj.team
        if (teamAbbr && team.abbreviation !== teamAbbr) continue

        teams.push({
          team: team.displayName,
          wins: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'wins')?.value || 0,
          losses: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'losses')?.value || 0,
          winPct: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'winPercent')?.value || 0,
          stats: {
            gamesPlayed: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'gamesPlayed')?.value || 0,
            pointsFor: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'pointsFor')?.value || 0,
            pointsAgainst: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'pointsAgainst')?.value || 0,
            streak: team.record?.items?.[0]?.summary || '',
          },
        })
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching NFL team stats:', error)
    return []
  }
}

export async function getNFLInjuries(): Promise<InjuryReport[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries'
    // Disable Next.js caching - response is 8.4MB, exceeds 2MB cache limit
    const response = await fetch(url, { cache: 'no-store' })

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
    const response = await fetch(url, { next: { revalidate: 3600 } })

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
    const response = await fetch(url, { next: { revalidate: 3600 } })

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
    const response = await fetch(url, { next: { revalidate: 3600 } })

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
    const response = await fetch(url, { next: { revalidate: 3600 } })

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
    const epaLines: string[] = []
    if (s.EPA_PER_PLAY != null) epaLines.push(`EPA/play: ${fmtNumber(s.EPA_PER_PLAY, 3)}`)
    if (s.EPA_TOTAL != null) epaLines.push(`EPA total: ${fmtNumber(s.EPA_TOTAL, 2)}`)

    const lines = [`- Passing: ${pass.join(', ')}`]
    if (rush.some((v) => v.includes('n/a') === false)) lines.push(`- Rushing: ${rush.join(', ')}`)
    if (recv.some((v) => v.includes('n/a') === false)) lines.push(`- Receiving: ${recv.join(', ')}`)
    if (epaLines.length) lines.push(`- Advanced: ${epaLines.join(' | ')}`)

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
    return teams.map(t =>
      `${t.team}: ${t.wins}-${t.losses} (${(t.winPct * 100).toFixed(1)}%)\n${JSON.stringify(t.stats, null, 2)}`
    ).join('\n\n')
  }
}
