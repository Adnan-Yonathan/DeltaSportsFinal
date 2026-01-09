const ESPN_SITE_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'
const ESPN_CORE_BASE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl'
const ESPN_WEB_BASE = 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl'

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
  rank?: number
  rankDisplayValue?: string
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
  pointsFor?: number
  pointsAgainst?: number
  avgPointsFor?: number
  avgPointsAgainst?: number
}

export interface EspnInjuryItem {
  athlete: { displayName?: string }
  status?: string
  details?: { type?: string }
  longComment?: string
  date?: string
}

export interface EspnInjuryTeam {
  team?: { displayName?: string }
  injuries?: EspnInjuryItem[]
}

const getCurrentSeason = () => {
  const now = new Date()
  const month = now.getUTCMonth() // 0-11
  const year = now.getUTCFullYear()
  return month >= 6 ? year : year - 1
}

const fetchJson = async <T>(url: string, cacheTtl = CACHE_TTL): Promise<T | null> => {
  const cached = cache.get(url)
  if (cached && Date.now() - cached.ts < cacheTtl) {
    return cached.data as T
  }
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as T
  cache.set(url, { ts: Date.now(), data })
  return data
}

const pickStat = (
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
}

export const fetchTeamList = async (): Promise<EspnTeamMeta[]> => {
  const url = `${ESPN_SITE_BASE}/teams`
  const data = await fetchJson<any>(url)
  if (!data?.sports?.[0]?.leagues?.[0]?.teams) return []

  return data.sports[0].leagues[0].teams.map((entry: any) => {
    const team = entry.team
    const recordItem = team?.record?.items?.[0]
    const pick = (name: string) => recordItem?.stats?.find((s: any) => s.name === name)?.value
    const wins = pick('wins')
    const losses = pick('losses')
    return {
      id: String(team?.id ?? ''),
      name: team?.name || team?.displayName || '',
      displayName: team?.displayName || '',
      shortDisplayName: team?.shortDisplayName || '',
      abbreviation: team?.abbreviation || '',
      recordSummary: recordItem?.summary,
      wins: typeof wins === 'number' ? wins : undefined,
      losses: typeof losses === 'number' ? losses : undefined,
      pointsFor: typeof pick('pointsFor') === 'number' ? pick('pointsFor') : undefined,
      pointsAgainst: typeof pick('pointsAgainst') === 'number' ? pick('pointsAgainst') : undefined,
      avgPointsFor: typeof pick('avgPointsFor') === 'number' ? pick('avgPointsFor') : undefined,
      avgPointsAgainst: typeof pick('avgPointsAgainst') === 'number' ? pick('avgPointsAgainst') : undefined,
    } as EspnTeamMeta
  })
}

export const fetchTeamStatistics = async (
  teamId: string,
  season = getCurrentSeason(),
  seasonType = 2
): Promise<EspnStatsResponse | null> => {
  const url = `${ESPN_CORE_BASE}/seasons/${season}/types/${seasonType}/teams/${teamId}/statistics`
  return fetchJson<EspnStatsResponse>(url)
}

export const fetchTeamRecord = async (
  teamId: string,
  season = getCurrentSeason(),
  seasonType = 2
): Promise<Partial<EspnTeamMeta> | null> => {
  const url = `${ESPN_CORE_BASE}/seasons/${season}/types/${seasonType}/teams/${teamId}/record`
  const data = await fetchJson<any>(url)
  const item = data?.items?.[0]
  const stats = item?.stats ?? []
  if (!stats.length) return null

  const pick = (name: string) => stats.find((s: any) => s.name === name)?.value
  const wins = pick('wins')
  const losses = pick('losses')
  const pointsFor = pick('pointsFor')
  const pointsAgainst = pick('pointsAgainst')
  const avgPointsFor = pick('avgPointsFor')
  const avgPointsAgainst = pick('avgPointsAgainst')

  return {
    recordSummary: typeof item?.summary === 'string' ? item.summary : undefined,
    wins: typeof wins === 'number' ? wins : undefined,
    losses: typeof losses === 'number' ? losses : undefined,
    pointsFor: typeof pointsFor === 'number' ? pointsFor : undefined,
    pointsAgainst: typeof pointsAgainst === 'number' ? pointsAgainst : undefined,
    avgPointsFor: typeof avgPointsFor === 'number' ? avgPointsFor : undefined,
    avgPointsAgainst:
      typeof avgPointsAgainst === 'number' ? avgPointsAgainst : undefined,
  }
}

export const fetchAthleteStatistics = async (
  athleteId: string,
  season = getCurrentSeason(),
  seasonType = 2
): Promise<EspnStatsResponse | null> => {
  const url = `${ESPN_CORE_BASE}/seasons/${season}/types/${seasonType}/athletes/${athleteId}/statistics`
  return fetchJson<EspnStatsResponse>(url)
}

export const fetchAthleteGamelog = async (
  athleteId: string,
  season = getCurrentSeason(),
  seasonType = 2
): Promise<any[]> => {
  const url = `${ESPN_WEB_BASE}/athletes/${athleteId}/gamelog?season=${season}&seasontype=${seasonType}`
  const data = await fetchJson<any>(url, 1000 * 60 * 5)
  if (!data) return []

  // Parse the ESPN gamelog structure which has:
  // - names: array of stat names
  // - seasonTypes[0].categories[0].events: array of events with stats arrays
  const names = data.names || []
  const seasonTypes = data.seasonTypes || []

  const results: any[] = []

  for (const st of seasonTypes) {
    const categories = st.categories || []
    for (const cat of categories) {
      const events = cat.events || []
      for (const event of events) {
        const statsArray = event.stats || []
        // Build an object mapping stat names to values
        const statsObj: Record<string, number> = {}
        for (let i = 0; i < names.length && i < statsArray.length; i++) {
          const name = names[i]
          const value = statsArray[i]
          // Parse numeric value (some are strings like "0.0" or "-")
          const num = parseFloat(value)
          if (Number.isFinite(num)) {
            statsObj[name] = num
          }
        }
        results.push({
          eventId: event.eventId,
          ...statsObj,
        })
      }
    }
  }

  // Fallback to old format if no results from new parsing
  if (results.length === 0) {
    return data.events || data.gameLog || data.gamelog || data.items || data.entries || []
  }

  return results
}

export const fetchInjuries = async (): Promise<EspnInjuryTeam[]> => {
  const url = `${ESPN_SITE_BASE}/injuries`
  const data = await fetchJson<any>(url, 1000 * 60 * 15)
  if (!data?.teams) return []
  return data.teams as EspnInjuryTeam[]
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
  pickStat,
}

export const seasonHelpers = {
  getCurrentSeason,
}
