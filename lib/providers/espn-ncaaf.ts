const ESPN_SITE_BASE =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football'
const ESPN_CORE_BASE =
  'https://sports.core.api.espn.com/v2/sports/football/leagues/college-football'
const ESPN_WEB_BASE =
  'https://site.web.api.espn.com/apis/common/v3/sports/football/college-football'

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

export interface EspnScoreboardEvent {
  id?: string
  name?: string
  shortName?: string
  season?: {
    type?: number
    slug?: string
  }
  competitions?: Array<{
    neutralSite?: boolean
    notes?: Array<{
      headline?: string
    }>
    competitors?: Array<{
      homeAway?: 'home' | 'away'
      team?: {
        displayName?: string
        name?: string
        shortDisplayName?: string
        abbreviation?: string
      }
    }>
  }>
}

const getCurrentSeason = () => {
  const now = new Date()
  const month = now.getUTCMonth()
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

const normalizeTeam = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const teamMatches = (left: string, right: string) => {
  const leftNorm = normalizeTeam(left)
  const rightNorm = normalizeTeam(right)
  if (!leftNorm || !rightNorm) return false
  if (leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm)) return true
  const leftTokens = leftNorm.split(' ').filter((token) => token.length > 2)
  const rightTokens = rightNorm.split(' ').filter((token) => token.length > 2)
  return (
    rightTokens.every((token) => leftTokens.includes(token)) ||
    leftTokens.every((token) => rightTokens.includes(token))
  )
}

const buildDateParam = (value?: string | Date) => {
  if (!value) return null
  if (typeof value === 'string') {
    if (/^\d{8}$/.test(value)) return value
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10).replace(/-/g, '')
    }
    return null
  }
  return value.toISOString().slice(0, 10).replace(/-/g, '')
}

export const fetchScoreboard = async (
  date?: string | Date
): Promise<EspnScoreboardEvent[]> => {
  const dateParam = buildDateParam(date)
  const url = dateParam
    ? `${ESPN_SITE_BASE}/scoreboard?dates=${dateParam}`
    : `${ESPN_SITE_BASE}/scoreboard`
  const data = await fetchJson<any>(url, 1000 * 60 * 3)
  const events = data?.events
  return Array.isArray(events) ? (events as EspnScoreboardEvent[]) : []
}

const getTeamVariants = (team?: {
  displayName?: string
  name?: string
  shortDisplayName?: string
  abbreviation?: string
}) =>
  [
    team?.displayName,
    team?.name,
    team?.shortDisplayName,
    team?.abbreviation,
  ].filter(Boolean) as string[]

export const findScoreboardEventByTeams = async (
  homeTeam: string,
  awayTeam: string,
  date?: string | Date
): Promise<{
  neutralSite: boolean
  note?: string
  eventName?: string
  seasonType?: number
  seasonSlug?: string
} | null> => {
  const events = await fetchScoreboard(date)
  if (!events.length) return null

  for (const event of events) {
    const competition = event.competitions?.[0]
    const competitors = competition?.competitors ?? []
    const home = competitors.find((c) => c.homeAway === 'home')
    const away = competitors.find((c) => c.homeAway === 'away')
    if (!home?.team || !away?.team) continue

    const homeVariants = getTeamVariants(home.team)
    const awayVariants = getTeamVariants(away.team)
    const homeMatchesHome = homeVariants.some((name) => teamMatches(name, homeTeam))
    const awayMatchesAway = awayVariants.some((name) => teamMatches(name, awayTeam))
    const homeMatchesAway = homeVariants.some((name) => teamMatches(name, awayTeam))
    const awayMatchesHome = awayVariants.some((name) => teamMatches(name, homeTeam))

    if ((homeMatchesHome && awayMatchesAway) || (homeMatchesAway && awayMatchesHome)) {
      const note = competition?.notes?.find((n) => n?.headline)?.headline
      return {
        neutralSite: Boolean(competition?.neutralSite),
        note,
        eventName: event?.name,
        seasonType: event?.season?.type,
        seasonSlug: event?.season?.slug,
      }
    }
  }

  return null
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
  const rawTeams = data?.sports?.[0]?.leagues?.[0]?.teams ?? []
  if (!Array.isArray(rawTeams)) return []

  return rawTeams
    .map((entry: any) => {
      const team = entry?.team
      if (!team) return null
      const recordItem = team?.record?.items?.[0]
      const pick = (name: string) =>
        recordItem?.stats?.find((s: any) => s.name === name)?.value
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
        avgPointsFor:
          typeof pick('avgPointsFor') === 'number' ? pick('avgPointsFor') : undefined,
        avgPointsAgainst:
          typeof pick('avgPointsAgainst') === 'number' ? pick('avgPointsAgainst') : undefined,
      } as EspnTeamMeta
    })
    .filter(Boolean) as EspnTeamMeta[]
}

export const fetchTeamStatistics = async (
  teamId: string,
  season = getCurrentSeason(),
  seasonType = 2
): Promise<EspnStatsResponse | null> => {
  const url = `${ESPN_CORE_BASE}/seasons/${season}/types/${seasonType}/teams/${teamId}/statistics`
  return fetchJson<EspnStatsResponse>(url)
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
  return data.events || data.gameLog || data.gamelog || data.items || data.entries || []
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
