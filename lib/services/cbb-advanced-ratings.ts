import { normalizeTeamKey } from '@/lib/identity/sport'
import { fetchTorvikAdvancedRatings } from '@/lib/providers/ncaab-free-sources'
import { resolveEspnTeamName } from '@/lib/utils/espn-team-lookup'

const CACHE_TTL_MS = 1000 * 60 * 60 * 24

export type CbbAdvancedRatingSource = 'torvik'

export type CbbAdvancedRating = {
  team: string
  teamKey: string
  source: CbbAdvancedRatingSource
  adjO?: number
  adjD?: number
  adjEM?: number
  tempo?: number
  luck?: number
  sos?: number
  ncsos?: number
  capturedAt: string
}

type CacheEntry = {
  ts: number
  data: CbbAdvancedRating[]
}

let snapshotCache: CacheEntry | null = null

const mergeRatings = async (): Promise<CbbAdvancedRating[]> => {
  let torvik: Awaited<ReturnType<typeof fetchTorvikAdvancedRatings>> = []
  try {
    torvik = await fetchTorvikAdvancedRatings()
  } catch (error) {
    console.error('[CBB] Torvik ratings failed:', error)
  }

  const capturedAt = new Date().toISOString()
  return torvik.map((entry) => ({
    team: entry.team,
    teamKey: normalizeTeamKey(entry.team),
    source: 'torvik',
    adjO: entry.adjO,
    adjD: entry.adjD,
    adjEM: entry.adjEM ?? (entry.adjO != null && entry.adjD != null
      ? Number((entry.adjO - entry.adjD).toFixed(2))
      : undefined),
    tempo: entry.tempo,
    luck: entry.luck,
    sos: entry.sos,
    ncsos: entry.ncsos,
    capturedAt,
  }))
}

export async function getCbbAdvancedRatingsSnapshot(): Promise<CbbAdvancedRating[]> {
  if (snapshotCache && Date.now() - snapshotCache.ts < CACHE_TTL_MS) {
    return snapshotCache.data
  }

  try {
    const merged = await mergeRatings()
    if (merged.length > 0) {
      snapshotCache = { ts: Date.now(), data: merged }
    }
    return merged
  } catch (error) {
    console.error('[CBB] Ratings snapshot failed:', error)
    return snapshotCache?.data ?? []
  }
}

export async function getCbbAdvancedRatingsForTeam(
  teamName: string
): Promise<CbbAdvancedRating | null> {
  if (!teamName) return null
  const resolvedName = (await resolveEspnTeamName('ncaab', teamName)) ?? teamName
  const ratings = await getCbbAdvancedRatingsSnapshot()
  const key = normalizeTeamKey(resolvedName)
  const resolvedMatch = ratings.find((entry) => entry.teamKey === key)
  if (resolvedMatch) return resolvedMatch
  const fallbackKey = normalizeTeamKey(teamName)
  return ratings.find((entry) => entry.teamKey === fallbackKey) ?? null
}
