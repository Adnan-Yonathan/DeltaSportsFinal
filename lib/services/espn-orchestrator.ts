import {
  fetchTeamList as fetchNflTeams,
  fetchRoster as fetchNflRoster,
  fetchTeamStatistics as fetchNflTeamStats,
  fetchAthleteStatistics as fetchNflAthleteStats,
  fetchAthleteGamelog as fetchNflAthleteGamelog,
  fetchInjuries as fetchNflInjuries,
} from '@/lib/providers/espn-nfl'
import {
  fetchTeamList as fetchNbaTeams,
  fetchRoster as fetchNbaRoster,
  fetchTeamStatistics as fetchNbaTeamStats,
  fetchAthleteStatistics as fetchNbaAthleteStats,
  fetchAthleteGamelog as fetchNbaAthleteGamelog,
  fetchInjuries as fetchNbaInjuries,
} from '@/lib/providers/espn-nba'
import {
  fetchTeamList as fetchMlbTeams,
  fetchRoster as fetchMlbRoster,
  fetchTeamStatistics as fetchMlbTeamStats,
  fetchAthleteStatistics as fetchMlbAthleteStats,
  fetchAthleteGamelog as fetchMlbAthleteGamelog,
  fetchInjuries as fetchMlbInjuries,
} from '@/lib/providers/espn-mlb'
import {
  fetchTeamList as fetchNhlTeams,
  fetchRoster as fetchNhlRoster,
  fetchTeamStatistics as fetchNhlTeamStats,
  fetchAthleteStatistics as fetchNhlAthleteStats,
  fetchAthleteGamelog as fetchNhlAthleteGamelog,
  fetchInjuries as fetchNhlInjuries,
} from '@/lib/providers/espn-nhl'
import {
  fetchTeamAts,
  fetchTeamOddsRecord,
  fetchPredictor,
  fetchPowerIndex,
  fetchTeamPastPerformances,
} from '@/lib/providers/espn-betting'
import { fetchSbdFuturesSnapshot } from '@/lib/services/sbd-futures'

export type SportKey = 'nba' | 'nfl' | 'mlb' | 'nhl'

const ESPN_CORE_BASE = 'https://sports.core.api.espn.com/v2/sports'

const SPORT_PATH: Record<SportKey, string> = {
  nfl: 'football/leagues/nfl',
  nba: 'basketball/leagues/nba',
  mlb: 'baseball/leagues/mlb',
  nhl: 'icehockey/leagues/nhl',
}

const SPORT_SCOREBOARD: Record<SportKey, string> = {
  nfl: 'football/nfl',
  nba: 'basketball/nba',
  mlb: 'baseball/mlb',
  nhl: 'hockey/nhl',
}

const fetchJson = async <T>(url: string): Promise<T | null> => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as T
}

const rangeToDateParam = (from: string, to?: string) => {
  const cleanedFrom = from.replace(/-/g, '')
  if (!to) return cleanedFrom
  const cleanedTo = to.replace(/-/g, '')
  return `${cleanedFrom}-${cleanedTo}`
}

export const getTeams = async (sport: SportKey) => {
  if (sport === 'nfl') return fetchNflTeams()
  if (sport === 'nba') return fetchNbaTeams()
  if (sport === 'mlb') return fetchMlbTeams()
  return fetchNhlTeams()
}

export const getRoster = async (sport: SportKey, teamId: string) => {
  if (sport === 'nfl') return fetchNflRoster(teamId)
  if (sport === 'nba') return fetchNbaRoster(teamId)
  if (sport === 'mlb') return fetchMlbRoster(teamId)
  return fetchNhlRoster(teamId)
}

export const getTeamSeasonStats = async (sport: SportKey, teamId: string, season: number, seasonType = 2) => {
  if (sport === 'nfl') return fetchNflTeamStats(teamId, season, seasonType)
  if (sport === 'nba') return fetchNbaTeamStats(teamId, season)
  if (sport === 'mlb') return fetchMlbTeamStats(teamId, season)
  return fetchNhlTeamStats(teamId, season)
}

export const getStandings = async (sport: SportKey, season: number, seasonType = 2) => {
  const sportPath = SPORT_PATH[sport]
  const url = `${ESPN_CORE_BASE}/${sportPath}/seasons/${season}/types/${seasonType}/standings`
  const data = await fetchJson<any>(url)
  const rows: any[] = (data?.children || data?.items || []) as any[]
  const toNum = (val: any) => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : null
    const num = Number(val)
    return Number.isFinite(num) ? num : null
  }
  const statValue = (record: any, name: string) => {
    const stat = record?.stats?.find((s: any) => s?.name === name || s?.abbreviation === name)
    return toNum(stat?.value)
  }

  return rows.map((row: any) => {
    const team = row.team || row?.competitor || {}
    const record = Array.isArray(row?.records) ? row.records[0] : row?.record
    const wins = record ? statValue(record, 'wins') : null
    const losses = record ? statValue(record, 'losses') : null
    const winPct = record ? statValue(record, 'winPercent') : null
    const gamesBack = record ? statValue(record, 'gamesBack') : null
    const ties = record ? statValue(record, 'ties') : null
    return {
      id: team?.id ? String(team.id) : team?.$ref?.split('/').pop(),
      team: team?.displayName || team?.name,
      wins,
      losses,
      ties,
      winPct,
      gamesBack,
      raw: row,
    }
  })
}

export const getPlayerSeasonStats = async (sport: SportKey, athleteId: string, season: number, seasonType = 2) => {
  if (sport === 'nfl') return fetchNflAthleteStats(athleteId, season, seasonType)
  if (sport === 'nba') return fetchNbaAthleteStats(athleteId, season)
  if (sport === 'mlb') return fetchMlbAthleteStats(athleteId, season)
  return fetchNhlAthleteStats(athleteId, season)
}

export const getPlayerGameLogs = async (sport: SportKey, athleteId: string, season: number, seasonType = 2) => {
  const normalizeLogs = (raw: any) => {
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    if (Array.isArray(raw?.events)) return raw.events
    if (Array.isArray(raw?.gameLog)) return raw.gameLog
    if (Array.isArray(raw?.gamelog)) return raw.gamelog
    if (Array.isArray(raw?.items)) return raw.items
    if (Array.isArray(raw?.entries)) return raw.entries
    if (typeof raw === 'object') return Object.values(raw)
    return []
  }

  const raw =
    sport === 'nfl'
      ? await fetchNflAthleteGamelog(athleteId, season, seasonType)
      : sport === 'nba'
      ? await fetchNbaAthleteGamelog(athleteId, season)
      : sport === 'mlb'
      ? await fetchMlbAthleteGamelog(athleteId, season)
      : await fetchNhlAthleteGamelog(athleteId, season)

  return normalizeLogs(raw)
}

export const getInjuries = async (sport: SportKey) => {
  if (sport === 'nfl') return fetchNflInjuries()
  if (sport === 'nba') return fetchNbaInjuries()
  if (sport === 'mlb') return fetchMlbInjuries()
  return fetchNhlInjuries()
}

export const getTeamAtsRecord = async (sport: SportKey, teamId: string, season: number, seasonType = 2) => {
  const sportPath = SPORT_PATH[sport]
  return fetchTeamAts(sportPath, season, seasonType, teamId)
}

export const getTeamOddsRecord = async (sport: SportKey, teamId: string, season: number) => {
  const sportPath = SPORT_PATH[sport]
  return fetchTeamOddsRecord(sportPath, season, teamId)
}

export const getTeamPastPerformances = async (sport: SportKey, teamId: string, providerId = '1003', limit = 140) => {
  const sportPath = SPORT_PATH[sport]
  return fetchTeamPastPerformances(sportPath, teamId, providerId, limit)
}

export const getTeamSchedule = async (sport: SportKey, teamId: string, season: number, seasonType = 2) => {
  const path = SPORT_SCOREBOARD[sport]
  // site.api host returns schedules; site.web.api 404s for many leagues
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${teamId}/schedule?season=${season}&seasontype=${seasonType}&limit=400`
  const data = await fetchJson<any>(url)
  const items: any[] = data?.events || data?.items || []

  return items
    .map((ev) => {
      const comp = ev?.competitions?.[0] || ev?.competition
      const competitors: any[] = comp?.competitors || []
      const date = String(ev?.date || comp?.date || '').slice(0, 10)
      let ours: any = null
      let opp: any = null
      for (const c of competitors) {
        const id = String(c?.team?.id || c?.id || '')
        if (id === String(teamId)) ours = c
        else opp = c
      }
      const parseScore = (val: any) => {
        if (val == null) return null
        const raw = typeof val === 'number' ? val : Number(val?.score ?? val?.value ?? val)
        return Number.isFinite(raw) ? raw : null
      }
      const ourScore = parseScore(ours?.score)
      const oppScore = parseScore(opp?.score)
      const ourNumeric = ourScore ?? NaN
      const oppNumeric = oppScore ?? NaN
      const result =
        Number.isFinite(ourNumeric) && Number.isFinite(oppNumeric)
          ? ourNumeric > oppNumeric
            ? 'W'
            : ourNumeric < oppNumeric
            ? 'L'
            : 'T'
          : undefined
      return {
        eventId: String(ev?.id || comp?.id || ''),
        date,
        isHome: (ours?.homeAway || ours?.homeaway) === 'home',
        opponentId: String(opp?.team?.id || opp?.id || ''),
        opponentName: opp?.team?.displayName || opp?.team?.shortDisplayName || opp?.displayName || opp?.name || '',
        ourScore,
        oppScore,
        result,
      }
    })
    .filter((g) => g.date)
}

export const getFutures = async (
  sport: SportKey,
  season: number,
  market?: string,
  books?: string[] | string
) => {
  const snapshot = await fetchSbdFuturesSnapshot({ sport, market, books })
  if (!snapshot) return null
  return { season, sport, ...snapshot }
}

export const getPredictor = async (sport: SportKey, eventId: string) => {
  const sportPath = SPORT_PATH[sport]
  return fetchPredictor(sportPath, eventId)
}

export const getPowerIndex = async (sport: SportKey, eventId: string, teamId: string) => {
  const sportPath = SPORT_PATH[sport]
  return fetchPowerIndex(sportPath, eventId, teamId)
}

export const getEventsByDateRange = async (sport: SportKey, from: string, to?: string) => {
  const dateParam = rangeToDateParam(from, to)
  const url = `https://site.api.espn.com/apis/site/v2/sports/${SPORT_SCOREBOARD[sport]}/scoreboard?dates=${dateParam}&limit=500`
  const data = await fetchJson<any>(url)
  const ids: string[] = []
  for (const ev of data?.events ?? []) {
    if (ev?.id) ids.push(String(ev.id))
  }
  return Array.from(new Set(ids))
}

export const getEventSummary = async (sport: SportKey, eventId: string) => {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${SPORT_SCOREBOARD[sport]}/summary?event=${eventId}`
  return fetchJson<any>(url)
}

export const getEventOdds = async (
  sport: SportKey,
  eventId: string,
  providerPriority: string[] = ['1304', '878', '879', '1695', '1385'] // DraftKings IDs, FanDuel, BetMGM
) => {
  const summary = await getEventSummary(sport, eventId)
  const oddsBlocks: any[] = summary?.pickcenter || summary?.header?.competitions?.[0]?.odds || []
  if (!Array.isArray(oddsBlocks) || !oddsBlocks.length) return null

  const providerIdFromBlock = (o: any) => String(o?.provider?.id || o?.provider?.uid?.split(':').pop() || '')
  const selected =
    providerPriority
      .map((pid) => oddsBlocks.find((o: any) => providerIdFromBlock(o) === pid))
      .find(Boolean) || oddsBlocks[0]
  const comp = summary?.header?.competitions?.[0]
  const competitors: any[] = comp?.competitors || []
  const home = competitors.find((c: any) => (c?.homeAway || c?.homeaway) === 'home')
  const away = competitors.find((c: any) => (c?.homeAway || c?.homeaway) === 'away')
  const homeId = String(home?.id || home?.team?.id || '')
  const awayId = String(away?.id || away?.team?.id || '')

  const parseNum = (v: any) => {
    if (typeof v === 'number') return v
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const spreadFromDetails = () => {
    const details = String(selected?.details || '')
    const m = details.match(/(-?\d+(\.\d+)?)/)
    return m ? Number(m[1]) : null
  }

  const totalFromDetails = () => {
    const details = String(selected?.details || '')
    const m = details.match(/(tot|o\/u|over\/under)[:\s]*(-?\d+(\.\d+)?)/i)
    if (m) return Number(m[2])
    const m2 = details.match(/(over|under)\s+(\d+(\.\d+)?)/i)
    return m2 ? Number(m2[2]) : null
  }

  const homeSpread = parseNum(selected?.homeTeamOdds?.spread ?? selected?.homeTeamOdds?.spreadOdds)
  const awaySpread = parseNum(selected?.awayTeamOdds?.spread ?? selected?.awayTeamOdds?.spreadOdds)
  const baseSpread = parseNum(selected?.spread) ?? spreadFromDetails()
  const overUnder = parseNum(selected?.overUnder) ?? parseNum(selected?.total) ?? totalFromDetails()

  let favoriteId: string | null = null
  let underdogId: string | null = null
  let spread: number | null = null

  if (Number.isFinite(homeSpread) && homeSpread! < 0) {
    favoriteId = homeId
    underdogId = awayId
    spread = Math.abs(homeSpread!)
  } else if (Number.isFinite(awaySpread) && awaySpread! < 0) {
    favoriteId = awayId
    underdogId = homeId
    spread = Math.abs(awaySpread!)
  } else if (Number.isFinite(baseSpread)) {
    spread = Math.abs(baseSpread!)
    if (baseSpread! < 0) {
      favoriteId = homeId
      underdogId = awayId
    } else if (baseSpread! > 0) {
      favoriteId = awayId
      underdogId = homeId
    }
  }

  const chosenProviderId = providerIdFromBlock(selected) || (providerPriority[0] ?? '')

  return {
    providerId: chosenProviderId,
    spread,
    total: overUnder ?? null,
    favoriteId,
    underdogId,
  }
}

export const getEventSnapshot = async (sport: SportKey, eventId: string) => {
  const summary = await getEventSummary(sport, eventId)
  if (!summary) return null
  const competition = summary?.header?.competitions?.[0]
  return {
    eventId,
    competition,
    boxscore: summary?.boxscore,
    plays: summary?.plays,
    winprobability: summary?.winprobability,
    predictor: summary?.predictor,
    injuries: summary?.injuries,
    leaders: summary?.leaders,
  }
}

export const searchAthlete = async (sport: SportKey, query: string, limit = 5) => {
  const url = `${ESPN_CORE_BASE}/${SPORT_PATH[sport]}/athletes?search=${encodeURIComponent(query)}&limit=${limit}`
  const data = await fetchJson<any>(url)
  const items: any[] = data?.items || []
  if (!items.length) return null
  const first = items[0]
  return {
    id: first?.id ? String(first.id) : first?.$ref?.split('/').pop(),
    items,
  }
}
