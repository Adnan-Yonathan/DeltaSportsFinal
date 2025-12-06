import { getTeams } from '@/lib/services/espn-orchestrator'

type SportKey = 'nba' | 'nfl' | 'mlb' | 'nhl'

const cache = new Map<SportKey, { ts: number; teams: any[] }>()
const TTL = 1000 * 60 * 30 // 30 minutes

const norm = (v?: string) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export async function resolveEspnTeamId(sport: SportKey, query: string): Promise<{ id: string; name: string; abbr?: string } | null> {
  const now = Date.now()
  let entry = cache.get(sport)
  if (!entry || now - entry.ts > TTL) {
    const teams = await getTeams(sport)
    entry = { ts: now, teams: teams || [] }
    cache.set(sport, entry)
  }

  const q = norm(query)
  let best: any = null

  // Prefer exact token match over substring to avoid cross-league collisions (e.g., saints vs spurs)
  for (const t of entry.teams) {
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
    for (const t of entry.teams) {
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
