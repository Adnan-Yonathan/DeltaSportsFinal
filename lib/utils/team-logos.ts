import { TEAMS_REGISTRY } from '@/lib/data/teams-registry'
import type { TeamRecord } from '@/lib/types/teams'
import { resolveSportKey } from '@/lib/identity/sport'

export type TeamLogoResult = {
  name: string
  abbreviation: string
  logoUrl: string
}

// Sport label (e.g. "NBA", "NFL") → canonical sport key
const SPORT_LABEL_TO_KEY: Record<string, string> = {
  NBA: 'nba',
  WNBA: 'nba',
  NFL: 'nfl',
  NHL: 'nhl',
  MLB: 'mlb',
  NCAAB: 'ncaab',
  NCAAF: 'ncaaf',
  CFB: 'ncaaf',
  CBB: 'ncaab',
  'COLLEGE BASKETBALL': 'ncaab',
  'COLLEGE FOOTBALL': 'ncaaf',
}

// NCAA logos require numeric team IDs, not abbreviations.
// Fix: if sport is ncaab/ncaaf and team has a numeric id, use /ncaa/500/{id}.png
function resolveLogoUrl(team: TeamRecord): string {
  if (!team.logoUrl) return ''
  const isNcaa = team.sport === 'basketball_ncaab' || team.sport === 'americanfootball_ncaaf'
  if (isNcaa && team.id) {
    return `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.id}.png`
  }
  return team.logoUrl
}

// Pre-build a lookup: normalized alias → TeamRecord
const aliasMap = new Map<string, TeamRecord>()
for (const team of TEAMS_REGISTRY) {
  // Index by shortName, name, abbreviation, and aliases
  const keys = [
    team.shortName.toLowerCase(),
    team.name.toLowerCase(),
    team.abbreviation.toLowerCase(),
    ...team.aliases.map(a => a.toLowerCase()),
  ]
  for (const key of keys) {
    // Don't overwrite existing entries (first match wins)
    if (!aliasMap.has(key)) {
      aliasMap.set(key, team)
    }
  }
}

function findTeamByName(name: string, sportKey?: string): TeamRecord | null {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return null

  const canonicalSport = sportKey ? resolveSportKey(sportKey) : undefined

  // Direct alias lookup
  const directMatch = aliasMap.get(normalized)
  if (directMatch) {
    if (!canonicalSport || directMatch.sport === canonicalSport) return directMatch
  }

  // If we have a sport filter, try sport-specific search
  if (canonicalSport) {
    const sportTeams = TEAMS_REGISTRY.filter(t => t.sport === canonicalSport)
    for (const team of sportTeams) {
      const checks = [team.shortName, team.name, team.abbreviation, ...team.aliases]
      if (checks.some(c => c.toLowerCase() === normalized)) return team
    }
    // Fuzzy: check if normalized contains any team shortName
    for (const team of sportTeams) {
      if (normalized.includes(team.shortName.toLowerCase())) return team
    }
  }

  // Fallback: global fuzzy search
  if (directMatch) return directMatch

  return null
}

/**
 * Extract team logos from a market title like "Lakers vs Celtics" or
 * "Will the Lakers cover -4.5 against the Celtics?"
 *
 * Returns 0-2 logos depending on how many teams are found.
 */
export function extractTeamLogos(
  title: string,
  sportLabel?: string | null,
): TeamLogoResult[] {
  if (!title) return []

  const sportKey = sportLabel ? SPORT_LABEL_TO_KEY[sportLabel] ?? sportLabel : undefined

  // Try common patterns: "Team A vs Team B", "Team A @ Team B", "Team A - Team B"
  const vsMatch = title.match(/^(.+?)\s+(?:vs\.?|@|at|-)\s+(.+?)(?:\s*[\(\[]|$)/i)
  if (vsMatch) {
    const results: TeamLogoResult[] = []
    for (const raw of [vsMatch[1], vsMatch[2]]) {
      // Clean up: remove spread/total markers like "-4.5", "Over 220.5"
      const cleaned = raw.replace(/\s*[-+]?\d+\.?\d*\s*$/, '').trim()
      const team = findTeamByName(cleaned, sportKey)
      const logoUrl = team ? resolveLogoUrl(team) : ''
      if (team && logoUrl) {
        results.push({ name: team.shortName, abbreviation: team.abbreviation, logoUrl })
      }
    }
    return results
  }

  // Single team mention: scan the title for any known team
  const results: TeamLogoResult[] = []
  const sportTeams = sportKey
    ? TEAMS_REGISTRY.filter(t => {
        const canonical = resolveSportKey(sportKey)
        return canonical ? t.sport === canonical : true
      })
    : TEAMS_REGISTRY

  // Sort by name length descending to match longer names first
  const sorted = [...sportTeams].sort((a, b) => b.shortName.length - a.shortName.length)
  const titleLower = title.toLowerCase()
  const found = new Set<string>()

  for (const team of sorted) {
    if (found.size >= 2) break
    if (found.has(team.abbreviation)) continue

    const checks = [team.shortName.toLowerCase(), team.name.toLowerCase()]
    const logo = resolveLogoUrl(team)
    if (checks.some(c => titleLower.includes(c)) && logo) {
      found.add(team.abbreviation)
      results.push({ name: team.shortName, abbreviation: team.abbreviation, logoUrl: logo })
    }
  }

  return results
}
