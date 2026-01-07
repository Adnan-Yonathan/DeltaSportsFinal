const ESPN_SITE_BASE =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'

const CACHE_TTL = 1000 * 60 * 10 // 10 minutes

type CacheEntry<T> = { ts: number; data: T }
const cache = new Map<string, CacheEntry<any>>()
let teamListCache: CacheEntry<EspnTeamMeta[]> | null = null
let teamListInflight: Promise<EspnTeamMeta[]> | null = null

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

const fetchJson = async <T>(url: string, cacheTtl = CACHE_TTL): Promise<T | null> => {
  const cached = cache.get(url)
  if (cached && Date.now() - cached.ts < cacheTtl) return cached.data as T
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as T
  cache.set(url, { ts: Date.now(), data })
  return data
}

/**
 * Fetch all D1 NCAAB teams by extracting from the groups endpoint.
 * The /groups endpoint returns teams inline within each conference.
 */
export const fetchNcaabTeamList = async (): Promise<EspnTeamMeta[]> => {
  if (teamListCache && Date.now() - teamListCache.ts < CACHE_TTL) {
    return teamListCache.data
  }
  if (teamListInflight) {
    return teamListInflight
  }

  teamListInflight = (async () => {
    const teamsMap = new Map<string, EspnTeamMeta>()

    // Parse team from ESPN structure
    const parseTeam = (team: any): EspnTeamMeta => ({
      id: String(team?.id ?? ''),
      name: team?.name || team?.displayName || '',
      displayName: team?.displayName || '',
      shortDisplayName: team?.shortDisplayName || '',
      abbreviation: team?.abbreviation || '',
    })

    // Fetch groups (conferences) - teams are included inline
    const groupsUrl = `${ESPN_SITE_BASE}/groups`
    const groupsData = await fetchJson<any>(groupsUrl)

    // Extract teams from the groups response
    if (groupsData?.groups) {
      for (const division of groupsData.groups) {
        // Check if teams exist at division level
        if (division.teams) {
          for (const team of division.teams) {
            if (team.id && !teamsMap.has(String(team.id))) {
              teamsMap.set(String(team.id), parseTeam(team))
            }
          }
        }
        // Check conferences (children) for teams
        if (division.children) {
          for (const conference of division.children) {
            if (conference.teams) {
              for (const team of conference.teams) {
                if (team.id && !teamsMap.has(String(team.id))) {
                  teamsMap.set(String(team.id), parseTeam(team))
                }
              }
            }
          }
        }
      }
    }

    // If we didn't get enough teams from groups, fallback to teams endpoint with
    // limit
    if (teamsMap.size < 300) {
      console.log(
        `[ESPN NCAAB] Groups returned ${teamsMap.size} teams, fetching more...`
      )

      // Fetch teams with pagination
      const limitPerPage = 200
      const pages = [0, 200, 400]

      for (const offset of pages) {
        const url = `${ESPN_SITE_BASE}/teams?limit=${limitPerPage}&offset=${offset}`
        const data = await fetchJson<any>(url)
        if (data?.sports?.[0]?.leagues?.[0]?.teams) {
          for (const entry of data.sports[0].leagues[0].teams) {
            const team = entry.team
            if (team?.id && !teamsMap.has(String(team.id))) {
              teamsMap.set(String(team.id), parseTeam(team))
            }
          }
        }
      }
    }

    const teamList = Array.from(teamsMap.values())
    teamListCache = { ts: Date.now(), data: teamList }
    console.log(`[ESPN NCAAB] Fetched ${teamsMap.size} unique D1 teams`)
    return teamList
  })()

  try {
    return await teamListInflight
  } finally {
    teamListInflight = null
  }
}