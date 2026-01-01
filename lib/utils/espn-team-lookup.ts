import { fetchNcaabTeamList } from '@/lib/providers/espn-ncaab'
import { normalizeTeamKey, resolveSportKey } from '@/lib/identity/sport'
import { getTeams } from '@/lib/services/espn-orchestrator'

type SportKey = 'nba' | 'nfl' | 'mlb' | 'nhl' | 'ncaab'

const cache = new Map<SportKey, { ts: number; teams: any[] }>()
const TTL = 1000 * 60 * 30 // 30 minutes

const norm = (v?: string) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const resolveCacheKey = (sport: string): SportKey | null => {
  const resolved = resolveSportKey(sport) ?? sport
  switch (resolved) {
    case 'basketball_nba':
    case 'nba':
      return 'nba'
    case 'basketball_ncaab':
    case 'ncaab':
      return 'ncaab'
    case 'americanfootball_nfl':
    case 'nfl':
      return 'nfl'
    case 'baseball_mlb':
    case 'mlb':
      return 'mlb'
    case 'icehockey_nhl':
    case 'nhl':
      return 'nhl'
    default:
      return null
  }
}

const loadTeams = async (sportKey: SportKey) => {
  const now = Date.now()
  let entry = cache.get(sportKey)
  if (!entry || now - entry.ts > TTL) {
    const teams =
      sportKey === 'ncaab' ? await fetchNcaabTeamList() : await getTeams(sportKey)
    entry = { ts: now, teams: teams || [] }
    cache.set(sportKey, entry)
  }
  return entry.teams || []
}

const scoreMatch = (target: string, candidate: string): number => {
  if (!target || !candidate) return 0
  if (target === candidate) return 100 + candidate.length
  if (target.startsWith(candidate) || target.endsWith(candidate)) {
    return 80 + candidate.length
  }
  if (candidate.startsWith(target) || candidate.endsWith(target)) {
    return 70 + target.length
  }
  if (target.includes(candidate)) return 60 + candidate.length
  if (candidate.includes(target)) return 50 + target.length
  return 0
}

export async function resolveEspnTeamName(
  sport: SportKey | string,
  query: string
): Promise<string | null> {
  const sportKey = resolveCacheKey(sport)
  if (!sportKey) return null
  const teams = await loadTeams(sportKey)
  const target = normalizeTeamKey(query)
  if (!target) return null

  let bestTeam: any = null
  let bestScore = -1

  const consider = (team: any, value?: string, isAbbr = false) => {
    const key = normalizeTeamKey(value || '')
    if (!key) return
    if (!isAbbr && key.length < 4) return
    if (isAbbr && key.length < 2) return
    const score = scoreMatch(target, key)
    if (score > bestScore) {
      bestScore = score
      bestTeam = team
    }
  }

  for (const team of teams) {
    consider(team, team.displayName)
    consider(team, team.shortDisplayName)
    consider(team, team.name)
    consider(team, team.abbreviation, true)
  }

  const minScore = target.length <= 4 ? 45 : 60
  if (!bestTeam) return null
  if (bestScore < minScore) return null
  const picked = bestTeam
  return (
    picked?.shortDisplayName ||
    picked?.displayName ||
    picked?.name ||
    null
  )
}

export async function resolveEspnTeamId(
  sport: SportKey | string,
  query: string
): Promise<{ id: string; name: string; abbr?: string } | null> {
  const sportKey = resolveCacheKey(sport)
  if (!sportKey) return null
  const teams = await loadTeams(sportKey)

  const q = norm(query)
  let best: any = null

  // Prefer exact token match over substring to avoid cross-league collisions (e.g., saints vs spurs)
  for (const t of teams) {
    const candidates = [
      norm(t.displayName),
      norm(t.name),
      norm(t.shortDisplayName),
      norm(t.abbreviation),
    ].filter(Boolean)
    if (candidates.some((c) => q === c)) {
      best = t
      break
    }
  }

  // Fallback: contains match if nothing exact
  if (!best) {
    for (const t of teams) {
      const candidates = [
        norm(t.displayName),
        norm(t.name),
        norm(t.shortDisplayName),
        norm(t.abbreviation),
      ].filter(Boolean)
      if (candidates.some((c) => q.includes(c) || c.includes(q))) {
        best = t
        break
      }
    }
  }

  return best?.id
    ? { id: String(best.id), name: best.displayName || best.name || query, abbr: best.abbreviation }
    : null
}
