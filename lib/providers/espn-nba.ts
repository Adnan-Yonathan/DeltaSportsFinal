const ESPN_SITE_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
const ESPN_CORE_BASE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba'
const ESPN_WEB_BASE = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba'

const CACHE_TTL = 1000 * 60 * 10 // 10 minutes

type CacheEntry<T> = { ts: number; data: T }
const cache = new Map<string, CacheEntry<any>>()

export interface EspnCategoryStat {
  name: string
  displayName?: string
  abbreviation?: string
  value?: number
  perGameValue?: number
  displayValue?: string
}

export interface EspnStatCategory {
  name: string
  displayName?: string
  shortDisplayName?: string
  abbreviation?: string
  stats: EspnCategoryStat[]
}

export interface EspnStatsResponse {
  splits?: {
    categories?: EspnStatCategory[]
  }
}

export interface EspnTeamMeta {
  id: string
  name: string
  displayName: string
  shortDisplayName: string
  abbreviation: string
  recordSummary?: string
  wins?: number
  losses?: number
}

export interface EspnInjuryItem {
  athlete?: { displayName?: string }
  status?: string
  details?: { type?: string }
  longComment?: string
  shortComment?: string
  date?: string
}

export interface EspnInjuryTeam {
  id?: string
  displayName?: string
  injuries?: EspnInjuryItem[]
}

const getCurrentSeason = () => {
  const now = new Date()
  const month = now.getUTCMonth()
  const startYear = month >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  return startYear + 1
}

const fetchJson = async <T>(url: string, cacheTtl = CACHE_TTL): Promise<T | null> => {
  const cached = cache.get(url)
  if (cached && Date.now() - cached.ts < cacheTtl) return cached.data as T
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as T
  cache.set(url, { ts: Date.now(), data })
  return data
}

export const fetchTeamList = async (): Promise<EspnTeamMeta[]> => {
  const url = `${ESPN_SITE_BASE}/teams`
  const data = await fetchJson<any>(url)
  if (!data?.sports?.[0]?.leagues?.[0]?.teams) return []
  return data.sports[0].leagues[0].teams.map((entry: any) => {
    const team = entry.team
    const recordItem = team?.record?.items?.[0]
    const pick = (name: string) => recordItem?.stats?.find((s: any) => s.name === name)?.value
    return {
      id: String(team?.id ?? ''),
      name: team?.name || team?.displayName || '',
      displayName: team?.displayName || '',
      shortDisplayName: team?.shortDisplayName || '',
      abbreviation: team?.abbreviation || '',
      recordSummary: recordItem?.summary,
      wins: typeof pick('wins') === 'number' ? pick('wins') : undefined,
      losses: typeof pick('losses') === 'number' ? pick('losses') : undefined,
    } as EspnTeamMeta
  })
}

export const fetchTeamStatistics = async (
  teamId: string,
  season = getCurrentSeason(),
  seasonType = 2
): Promise<EspnStatsResponse | null> => {
  const url = `${ESPN_CORE_BASE}/seasons/${season}/types/${seasonType}/teams/${teamId}/statistics`
  const data = await fetchJson<EspnStatsResponse>(url)
  if (data) return data
  const fallbackUrl = `${ESPN_CORE_BASE}/seasons/${season}/teams/${teamId}/statistics`
  return fetchJson<EspnStatsResponse>(fallbackUrl)
}

export const fetchAthleteStatistics = async (
  athleteId: string,
  season = getCurrentSeason(),
  seasonType = 2
): Promise<EspnStatsResponse | null> => {
  const url = `${ESPN_CORE_BASE}/seasons/${season}/types/${seasonType}/athletes/${athleteId}/statistics`
  const seasonal = await fetchJson<EspnStatsResponse>(url)
  if (seasonal) return seasonal
  const fallbackUrl = `${ESPN_CORE_BASE}/seasons/${season}/athletes/${athleteId}/statistics`
  const fallback = await fetchJson<EspnStatsResponse>(fallbackUrl)
  if (fallback) return fallback
  const legacyUrl = `${ESPN_CORE_BASE}/athletes/${athleteId}/statistics`
  return fetchJson<EspnStatsResponse>(legacyUrl)
}

export const fetchAthleteGamelog = async (
  athleteId: string,
  season: number
): Promise<any[]> => {
  const url = `${ESPN_WEB_BASE}/athletes/${athleteId}/gamelog?season=${season}&seasontype=2`
  const data = await fetchJson<any>(url, 1000 * 60 * 5)
  if (!data) return []
  return data.events || data.gameLog || data.gamelog || data.items || data.entries || []
}

export const fetchInjuries = async (): Promise<EspnInjuryTeam[]> => {
  const url = `${ESPN_SITE_BASE}/injuries`
  const data = await fetchJson<any>(url, 1000 * 60 * 15)
  if (!data?.injuries) return []
  return data.injuries as EspnInjuryTeam[]
}

export const fetchRoster = async (teamId: string): Promise<any[]> => {
  const url = `${ESPN_SITE_BASE}/teams/${teamId}/roster`
  const data = await fetchJson<any>(url, 1000 * 60 * 15)
  const groups = data?.athletes ?? []
  const athletes: any[] = []
  for (const group of groups) {
    const items = group?.items ?? []
    athletes.push(...items)
  }
  return athletes
}

export const statHelpers = {
  pickStat: (
    categories: EspnStatCategory[] | undefined,
    names: string[],
    opts: { perGame?: boolean } = {}
  ): number | null => {
    if (!categories) return null
    for (const category of categories) {
      for (const stat of category.stats || []) {
        const key = stat.name?.toLowerCase()
        if (key && names.some((n) => n.toLowerCase() === key)) {
          const value = opts.perGame ? stat.perGameValue : stat.value
          if (typeof value === 'number' && Number.isFinite(value)) {
            return value
          }
        }
      }
    }
    return null
  },
}

export const seasonHelpers = {
  getCurrentSeason,
}

