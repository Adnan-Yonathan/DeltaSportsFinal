const ESPN_SITE_BASE =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football'
const ESPN_CORE_BASE =
  'https://sports.core.api.espn.com/v2/sports/football/leagues/college-football'
const ESPN_WEB_BASE =
  'https://site.web.api.espn.com/apis/common/v3/sports/football/college-football'

const CACHE_TTL = 1000 * 60 * 10 // 10 minutes
type CacheEntry<T> = { ts: number; data: T }
const cache = new Map<string, CacheEntry<any>>()
const ESPN_CORE_FBS_GROUP_ID = 80

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
  const teamsMap = new Map<string, EspnTeamMeta>()

  const parseTeam = (team: any): EspnTeamMeta | null => {
    if (!team?.id) return null
    return {
      id: String(team?.id ?? ''),
      name: team?.name || team?.displayName || '',
      displayName: team?.displayName || '',
      shortDisplayName: team?.shortDisplayName || '',
      abbreviation: team?.abbreviation || '',
    }
  }

  const parseTeamRefId = (ref?: string | null) => {
    if (!ref) return null
    const match = ref.match(/teams\/(\d+)/i)
    return match ? match[1] : null
  }

  const fetchFbsTeamsFromCore = async () => {
    const season = getCurrentSeason()
    const baseUrl = `${ESPN_CORE_BASE}/seasons/${season}/types/2/groups/${ESPN_CORE_FBS_GROUP_ID}/teams?lang=en&region=us`
    const first = await fetchJson<any>(baseUrl)
    if (!first?.items?.length) return []
    const pageCount = Number(first.pageCount) || 1
    const pages: any[] = [first]
    if (pageCount > 1) {
      const rest = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_, i) =>
          fetchJson<any>(`${baseUrl}&page=${i + 2}`)
        )
      )
      pages.push(...rest.filter(Boolean))
    }

    const teamRefs: string[] = []
    for (const page of pages) {
      for (const entry of page?.items ?? []) {
        if (entry?.$ref) teamRefs.push(String(entry.$ref))
      }
    }

    const teamDetails = await Promise.all(
      teamRefs.map(async (ref) => {
        const data = await fetchJson<any>(ref)
        const fallbackId = parseTeamRefId(ref)
        if (data?.id) return data
        if (fallbackId) return { id: fallbackId }
        return null
      })
    )

    for (const team of teamDetails) {
      const parsed = parseTeam(team)
      if (parsed && !teamsMap.has(parsed.id)) {
        teamsMap.set(parsed.id, parsed)
      }
    }
  }

  await fetchFbsTeamsFromCore()
  if (teamsMap.size >= 120) {
    return Array.from(teamsMap.values())
  }

  const groupsUrl = `${ESPN_SITE_BASE}/groups`
  const groupsData = await fetchJson<any>(groupsUrl)
  if (groupsData?.groups) {
    for (const division of groupsData.groups) {
      if (division.teams) {
        for (const team of division.teams) {
          const parsed = parseTeam(team)
          if (parsed && !teamsMap.has(parsed.id)) {
            teamsMap.set(parsed.id, parsed)
          }
        }
      }
      if (division.children) {
        for (const conference of division.children) {
          if (conference.teams) {
            for (const team of conference.teams) {
              const parsed = parseTeam(team)
              if (parsed && !teamsMap.has(parsed.id)) {
                teamsMap.set(parsed.id, parsed)
              }
            }
          }
        }
      }
    }
  }

  if (teamsMap.size < 100) {
    const limitPerPage = 200
    const pages = [0, 200, 400]
    for (const offset of pages) {
      const url = `${ESPN_SITE_BASE}/teams?limit=${limitPerPage}&offset=${offset}`
      const data = await fetchJson<any>(url)
      const rawTeams = data?.sports?.[0]?.leagues?.[0]?.teams ?? []
      if (!Array.isArray(rawTeams)) continue
      for (const entry of rawTeams) {
        const team = entry?.team
        const parsed = parseTeam(team)
        if (parsed && !teamsMap.has(parsed.id)) {
          teamsMap.set(parsed.id, parsed)
        }
      }
    }
  }

  return Array.from(teamsMap.values())
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
