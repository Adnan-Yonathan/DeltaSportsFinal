import { normalizeTeamKey } from '@/lib/identity/sport'
import { fetchNcaaNetRankings } from '@/lib/providers/ncaab-free-sources'
import { resolveEspnTeamName } from '@/lib/utils/espn-team-lookup'

const CACHE_TTL_MS = 1000 * 60 * 60 * 24

export type CbbAdvancedRatingSource = 'net'

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
  netRank?: number
  netRating?: number
  capturedAt: string
}

type CacheEntry = {
  ts: number
  data: CbbAdvancedRating[]
}

let snapshotCache: CacheEntry | null = null

const netRankToRating = (rank: number | undefined, totalTeams: number) => {
  if (!rank || !Number.isFinite(rank) || totalTeams <= 1) return undefined
  const percentile = 1 - (rank - 1) / (totalTeams - 1)
  return Number(((percentile - 0.5) * 40).toFixed(2))
}

const mergeRatings = async (): Promise<CbbAdvancedRating[]> => {
  let netRankings: Awaited<ReturnType<typeof fetchNcaaNetRankings>> = []
  try {
    netRankings = await fetchNcaaNetRankings()
  } catch (error) {
    console.error('[CBB] NCAA NET rankings failed:', error)
  }

  const capturedAt = new Date().toISOString()
  const netTotalTeams = netRankings.length
  const netRows: CbbAdvancedRating[] = []
  for (const entry of netRankings) {
    const teamKey = normalizeTeamKey(entry.team)
    if (!teamKey) continue
    const rating = netRankToRating(entry.rank, netTotalTeams)
    netRows.push({
      team: entry.team,
      teamKey,
      source: 'net',
      adjEM: rating,
      netRank: entry.rank,
      netRating: rating,
      capturedAt,
    })
  }

  return netRows
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
