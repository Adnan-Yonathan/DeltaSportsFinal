import { normalizeTeamKey } from '@/lib/identity/sport'
import {
  fetchHaslametricsRatings,
  fetchTorvikAdvancedRatings,
} from '@/lib/providers/ncaab-free-sources'
import { getTeamStats as getSportsTeamStats } from '@/lib/sports-stats-api'
import { resolveEspnTeamName } from '@/lib/utils/espn-team-lookup'

const CACHE_TTL_MS = 1000 * 60 * 60 * 24

export type CbbAdvancedRatingSource = 'torvik' | 'hasla' | 'derived'

export type CbbAdvancedRating = {
  team: string
  teamKey: string
  season?: string | null
  source: CbbAdvancedRatingSource
  adjO?: number
  adjD?: number
  adjEM?: number
  tempo?: number
  luck?: number
  sos?: number
  ncsos?: number
  netRank?: number
  netRecord?: string
  netConference?: string
  capturedAt: string
}

type CacheEntry = {
  ts: number
  data: CbbAdvancedRating[]
}

let snapshotCache: CacheEntry | null = null

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const buildDerivedRatings = async (): Promise<CbbAdvancedRating[]> => {
  const teams = await getSportsTeamStats('basketball_ncaab')
  const capturedAt = new Date().toISOString()
  return teams.map((team) => {
    const stats = team.stats || {}
    const adjO = toNumber(stats.offensiveRating)
    const adjD = toNumber(stats.defensiveRating)
    const adjEM =
      toNumber(stats.netRating) ??
      (adjO != null && adjD != null ? Number((adjO - adjD).toFixed(2)) : null)

    return {
      team: team.team,
      teamKey: normalizeTeamKey(team.team),
      season: team.season ?? null,
      source: 'derived',
      adjO: adjO ?? undefined,
      adjD: adjD ?? undefined,
      adjEM: adjEM ?? undefined,
      tempo: toNumber(stats.pace) ?? undefined,
      netRank: toNumber(stats.netRank) ?? undefined,
      netRecord: stats.netRecord ? String(stats.netRecord) : undefined,
      netConference: stats.netConference ? String(stats.netConference) : undefined,
      capturedAt,
    }
  })
}

const mergeRatings = async (): Promise<CbbAdvancedRating[]> => {
  const [derived, torvik, hasla] = await Promise.all([
    buildDerivedRatings(),
    fetchTorvikAdvancedRatings(),
    fetchHaslametricsRatings(),
  ])

  const merged = new Map<string, CbbAdvancedRating>()

  for (const entry of derived) {
    merged.set(entry.teamKey, entry)
  }

  const applyAdvanced = (entry: CbbAdvancedRating, source: CbbAdvancedRatingSource) => {
    entry.source = source
    if (entry.adjO != null && entry.adjD != null) {
      entry.adjEM = Number((entry.adjO - entry.adjD).toFixed(2))
    }
  }

  for (const entry of torvik) {
    const key = normalizeTeamKey(entry.team)
    const existing = merged.get(key)
    if (!existing) continue
    if (entry.adjO != null) existing.adjO = entry.adjO
    if (entry.adjD != null) existing.adjD = entry.adjD
    if (entry.adjEM != null) existing.adjEM = entry.adjEM
    if (entry.tempo != null) existing.tempo = entry.tempo
    if (entry.luck != null) existing.luck = entry.luck
    if (entry.sos != null) existing.sos = entry.sos
    if (entry.ncsos != null) existing.ncsos = entry.ncsos
    applyAdvanced(existing, 'torvik')
  }

  for (const entry of hasla) {
    const key = normalizeTeamKey(entry.team)
    const existing = merged.get(key)
    if (!existing || existing.source === 'torvik') continue
    if (entry.adjO != null) existing.adjO = entry.adjO
    if (entry.adjD != null) existing.adjD = entry.adjD
    if (entry.adjEM != null) existing.adjEM = entry.adjEM
    if (entry.tempo != null) existing.tempo = entry.tempo
    if (entry.luck != null) existing.luck = entry.luck
    if (entry.sos != null) existing.sos = entry.sos
    if (entry.ncsos != null) existing.ncsos = entry.ncsos
    applyAdvanced(existing, 'hasla')
  }

  return Array.from(merged.values())
}

export async function getCbbAdvancedRatingsSnapshot(): Promise<CbbAdvancedRating[]> {
  if (snapshotCache && Date.now() - snapshotCache.ts < CACHE_TTL_MS) {
    return snapshotCache.data
  }

  const merged = await mergeRatings()
  if (merged.length > 0) {
    snapshotCache = { ts: Date.now(), data: merged }
  }
  return merged
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
