import {
  fetchNcaaNetRankings,
  fetchNcaaScoringStats,
  fetchNcaaTeamStatProfiles,
  normalizeNcaabTeamKey,
} from '@/lib/providers/ncaab-free-sources'
import { resolveEspnTeamName } from '@/lib/utils/espn-team-lookup'

const CACHE_TTL_MS = 1000 * 60 * 60 * 24

export type CbbAdvancedRatingSource = 'net' | 'ncaa'

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
  stats?: Record<string, number | string | null>
  capturedAt: string
}

type CacheEntry = {
  ts: number
  data: CbbAdvancedRating[]
}

let snapshotCache: CacheEntry | null = null
let snapshotInflight: Promise<CbbAdvancedRating[]> | null = null

const netRankToRating = (rank: number | undefined, totalTeams: number) => {     
  if (!rank || !Number.isFinite(rank) || totalTeams <= 1) return undefined      
  const percentile = 1 - (rank - 1) / (totalTeams - 1)
  return Number(((percentile - 0.5) * 28).toFixed(2))
}

const toNumber = (value: number | string | undefined | null) => {
  if (value == null) return null
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

const computeNcaaAdvanced = (profile: {
  games?: number
  stats: Record<string, number>
}) => {
  const stats = profile.stats
  const games =
    toNumber(profile.games) ?? toNumber(stats.gamesPlayed) ?? undefined

  const pointsFor =
    toNumber(stats.pointsForPerGame) ??
    (games && stats.pointsFor ? stats.pointsFor / games : null)
  const pointsAgainst =
    toNumber(stats.pointsAgainstPerGame) ??
    (games && stats.pointsAgainst ? stats.pointsAgainst / games : null)
  const fga =
    toNumber(stats.fieldGoalsAttemptedPerGame) ??
    (games && stats.fieldGoalsAttempted
      ? stats.fieldGoalsAttempted / games
      : null)
  const fta =
    toNumber(stats.freeThrowAttemptsPerGame) ??
    (games && stats.freeThrowAttempts ? stats.freeThrowAttempts / games : null)
  const turnovers =
    toNumber(stats.turnoversPerGame) ??
    (games && stats.turnovers ? stats.turnovers / games : null)
  const offensiveRebounds =
    toNumber(stats.offensiveReboundsPerGame) ??
    (games && stats.offensiveRebounds ? stats.offensiveRebounds / games : null)

  if (
    pointsFor == null ||
    pointsAgainst == null ||
    fga == null ||
    fta == null ||
    turnovers == null ||
    offensiveRebounds == null
  ) {
    return null
  }

  const possessions = fga - offensiveRebounds + turnovers + 0.475 * fta
  if (!Number.isFinite(possessions) || possessions <= 0) return null

  const adjO = Number(((pointsFor / possessions) * 100).toFixed(2))
  const adjD = Number(((pointsAgainst / possessions) * 100).toFixed(2))
  const adjEM = Number((adjO - adjD).toFixed(2))
  const tempo = Number(possessions.toFixed(1))

  const extendedStats: Record<string, number> = {
    ...stats,
    possessionsPerGame: tempo,
    offensiveRating: adjO,
    defensiveRating: adjD,
    netRating: adjEM,
  }

  return { adjO, adjD, adjEM, tempo, netRating: adjEM, stats: extendedStats }
}

const mergeRatings = async (): Promise<CbbAdvancedRating[]> => {
  let netRankings: Awaited<ReturnType<typeof fetchNcaaNetRankings>> = []        
  let scoringEntries: Awaited<ReturnType<typeof fetchNcaaScoringStats>> = []
  let statProfiles: Awaited<ReturnType<typeof fetchNcaaTeamStatProfiles>> = []
  try {
    netRankings = await fetchNcaaNetRankings()
  } catch (error) {
    console.error('[CBB] NCAA NET rankings failed:', error)
  }
  try {
    scoringEntries = await fetchNcaaScoringStats()
  } catch (error) {
    console.error('[CBB] NCAA scoring stats failed:', error)
  }
  try {
    statProfiles = await fetchNcaaTeamStatProfiles()
  } catch (error) {
    console.error('[CBB] NCAA team stat profiles failed:', error)
  }

  const capturedAt = new Date().toISOString()
  const netTotalTeams = netRankings.length
  const netRows: CbbAdvancedRating[] = []
  const profileRows: CbbAdvancedRating[] = []
  const profileMap = new Map<string, CbbAdvancedRating>()
  const scoringMap = new Map(
    scoringEntries.map((entry) => [normalizeNcaabTeamKey(entry.team), entry])
  )

  for (const profile of statProfiles) {
    const teamKey = normalizeNcaabTeamKey(profile.team)
    if (!teamKey) continue
    const computed = computeNcaaAdvanced(profile)
    if (!computed) continue
    const scoring = scoringMap.get(teamKey)
    const entry: CbbAdvancedRating = {
      team: profile.team,
      teamKey,
      source: 'ncaa',
      adjO: computed.adjO,
      adjD: computed.adjD,
      adjEM: computed.adjEM,
      tempo: computed.tempo,
      netRating: computed.netRating,
      stats: {
        ...computed.stats,
        pointsForPerGame: scoring?.ppg ?? computed.stats?.pointsForPerGame,
        pointsAgainstPerGame:
          scoring?.oppPpg ?? computed.stats?.pointsAgainstPerGame,
        offenseRank: scoring?.rank ?? computed.stats?.offenseRank,
        defenseRank: scoring?.oppPpgRank ?? computed.stats?.defenseRank,
        gamesPlayed: scoring?.games ?? computed.stats?.gamesPlayed,
      },
      capturedAt,
    }
    profileRows.push(entry)
    profileMap.set(teamKey, entry)
  }

  for (const entry of netRankings) {
    const teamKey = normalizeNcaabTeamKey(entry.team)
    if (!teamKey) continue
    const rating = netRankToRating(entry.rank, netTotalTeams)
    const existing = profileMap.get(teamKey)
    if (existing) {
      existing.netRank = entry.rank
      if (existing.netRating == null && rating != null) {
        existing.netRating = rating
      }
      if (existing.adjEM == null && rating != null) {
        existing.adjEM = rating
      }
      if (existing.stats) {
        existing.stats.netRank = entry.rank
      }
      continue
    }
    const scoring = scoringMap.get(teamKey)
    netRows.push({
      team: entry.team,
      teamKey,
      source: 'net',
      adjEM: rating,
      netRank: entry.rank,
      netRating: rating,
      stats: scoring
        ? {
            pointsForPerGame: scoring.ppg ?? null,
            pointsAgainstPerGame: scoring.oppPpg ?? null,
            offenseRank: scoring.rank ?? null,
            defenseRank: scoring.oppPpgRank ?? null,
            gamesPlayed: scoring.games ?? null,
          }
        : undefined,
      capturedAt,
    })
  }

  return [...profileRows, ...netRows]
}

export async function getCbbAdvancedRatingsSnapshot(): Promise<CbbAdvancedRating[]> {
  if (snapshotCache && Date.now() - snapshotCache.ts < CACHE_TTL_MS) {
    return snapshotCache.data
  }
  if (snapshotInflight) {
    return snapshotInflight
  }

  snapshotInflight = (async () => {
    try {
      const merged = await mergeRatings()
      snapshotCache = { ts: Date.now(), data: merged }
      return merged
    } catch (error) {
      console.error('[CBB] Ratings snapshot failed:', error)
      if (!snapshotCache) {
        snapshotCache = { ts: Date.now(), data: [] }
      }
      return snapshotCache.data
    } finally {
      snapshotInflight = null
    }
  })()

  return snapshotInflight
}

export async function getCbbAdvancedRatingsForTeam(
  teamName: string
): Promise<CbbAdvancedRating | null> {
  if (!teamName) return null
  const resolvedName = (await resolveEspnTeamName('ncaab', teamName)) ?? teamName
  const ratings = await getCbbAdvancedRatingsSnapshot()
  const key = normalizeNcaabTeamKey(resolvedName)
  const resolvedMatch = ratings.find((entry) => entry.teamKey === key)
  if (resolvedMatch) return resolvedMatch
  const fallbackKey = normalizeNcaabTeamKey(teamName)
  return ratings.find((entry) => entry.teamKey === fallbackKey) ?? null
}
