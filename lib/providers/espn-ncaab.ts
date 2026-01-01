const ESPN_SITE_BASE =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'

const CACHE_TTL = 1000 * 60 * 10 // 10 minutes

type CacheEntry<T> = { ts: number; data: T }
const cache = new Map<string, CacheEntry<any>>()

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

export const fetchNcaabTeamList = async (): Promise<EspnTeamMeta[]> => {
  const url = `${ESPN_SITE_BASE}/teams`
  const data = await fetchJson<any>(url)
  if (!data?.sports?.[0]?.leagues?.[0]?.teams) return []
  return data.sports[0].leagues[0].teams.map((entry: any) => {
    const team = entry.team
    const recordItem = team?.record?.items?.[0]
    const pick = (name: string) =>
      recordItem?.stats?.find((s: any) => s.name === name)?.value
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
