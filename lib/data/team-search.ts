import { TEAMS_REGISTRY } from './teams-registry'
import type { TeamRecord, TeamSearchResult } from '@/lib/types/teams'
import type { CanonicalSportKey } from '@/lib/identity/sport'
import { SPORT_DISPLAY } from '@/lib/types/teams'

/**
 * Normalize a string for fuzzy matching.
 * Removes special characters, converts to lowercase, trims whitespace.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calculate match score between query and target string.
 * Higher scores = better matches.
 */
function calculateScore(query: string, target: string, matchType: 'exact' | 'prefix' | 'contains' | 'alias'): number {
  const normalizedQuery = normalize(query)
  const normalizedTarget = normalize(target)

  // Base scores by match type
  const baseScores: Record<string, number> = {
    exact: 100,
    prefix: 80,
    contains: 50,
    alias: 40,
  }

  let score = baseScores[matchType]

  // Bonus for shorter targets (more specific matches)
  const lengthRatio = normalizedQuery.length / normalizedTarget.length
  score += Math.min(lengthRatio * 20, 20)

  // Bonus for exact case match (slight preference)
  if (query === target) {
    score += 5
  }

  return score
}

/**
 * Check if query matches a team's fields.
 * Returns the match type and the matched field, or null if no match.
 */
function matchTeam(query: string, team: TeamRecord): { matchType: 'exact' | 'prefix' | 'contains' | 'alias'; matchedField: string } | null {
  const normalizedQuery = normalize(query)

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return null
  }

  // Check exact matches first (highest priority)
  const fieldsToCheck = [
    team.name,
    team.shortName,
    team.abbreviation,
  ]

  for (const field of fieldsToCheck) {
    const normalizedField = normalize(field)
    if (normalizedField === normalizedQuery) {
      return { matchType: 'exact', matchedField: field }
    }
  }

  // Check prefix matches
  for (const field of fieldsToCheck) {
    const normalizedField = normalize(field)
    if (normalizedField.startsWith(normalizedQuery)) {
      return { matchType: 'prefix', matchedField: field }
    }
  }

  // Check alias exact and prefix matches
  for (const alias of team.aliases) {
    const normalizedAlias = normalize(alias)
    if (normalizedAlias === normalizedQuery) {
      return { matchType: 'alias', matchedField: alias }
    }
    if (normalizedAlias.startsWith(normalizedQuery)) {
      return { matchType: 'alias', matchedField: alias }
    }
  }

  // Check contains matches (lowest priority)
  for (const field of fieldsToCheck) {
    const normalizedField = normalize(field)
    if (normalizedField.includes(normalizedQuery)) {
      return { matchType: 'contains', matchedField: field }
    }
  }

  // Check alias contains
  for (const alias of team.aliases) {
    const normalizedAlias = normalize(alias)
    if (normalizedAlias.includes(normalizedQuery)) {
      return { matchType: 'contains', matchedField: alias }
    }
  }

  return null
}

/**
 * Search teams by query string.
 * Returns ranked results with match scores.
 *
 * @param query - Search query (min 2 characters)
 * @param options - Optional filters
 * @param options.limit - Max results to return (default: 10)
 * @param options.sport - Filter by sport
 * @param options.prioritizePro - Give pro teams higher scores than college (default: true)
 */
export function searchTeams(
  query: string,
  options: {
    limit?: number
    sport?: CanonicalSportKey
    prioritizePro?: boolean
  } = {}
): TeamSearchResult[] {
  const { limit = 10, sport, prioritizePro = true } = options

  if (!query || query.length < 2) {
    return []
  }

  const results: TeamSearchResult[] = []

  for (const team of TEAMS_REGISTRY) {
    // Filter by sport if specified
    if (sport && team.sport !== sport) {
      continue
    }

    const match = matchTeam(query, team)
    if (!match) {
      continue
    }

    let score = calculateScore(query, match.matchedField, match.matchType)

    // Pro team priority bonus
    if (prioritizePro) {
      const isProTeam = ['basketball_nba', 'americanfootball_nfl', 'baseball_mlb', 'icehockey_nhl'].includes(team.sport)
      if (isProTeam) {
        score += 15
      }
    }

    results.push({
      ...team,
      score,
      matchType: match.matchType,
    })
  }

  // Sort by score (descending) then by name (alphabetically)
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return a.name.localeCompare(b.name)
  })

  return results.slice(0, limit)
}

/**
 * Get display label for a team including sport disambiguation if needed.
 * Used when multiple sports have teams with similar names.
 *
 * @param team - The team record
 * @param disambiguate - Whether to add sport suffix (default: false)
 */
export function getTeamDisplayLabel(team: TeamRecord, disambiguate = false): string {
  if (!disambiguate) {
    return team.shortName
  }

  const sportLabel = SPORT_DISPLAY[team.sport]?.shortLabel || team.sport
  return `${team.shortName} (${sportLabel})`
}

/**
 * Check if a query might match multiple sports.
 * Useful for deciding whether to show sport badges in UI.
 */
export function hasMultipleSportMatches(query: string): boolean {
  const results = searchTeams(query, { limit: 20 })
  const sports = new Set(results.map((r) => r.sport))
  return sports.size > 1
}

/**
 * Group search results by sport for organized display.
 */
export function groupResultsBySport(results: TeamSearchResult[]): Map<CanonicalSportKey, TeamSearchResult[]> {
  const groups = new Map<CanonicalSportKey, TeamSearchResult[]>()

  for (const result of results) {
    const existing = groups.get(result.sport) || []
    existing.push(result)
    groups.set(result.sport, existing)
  }

  return groups
}

/**
 * Find exact team by ID and sport.
 */
export function findTeamById(id: string, sport?: CanonicalSportKey): TeamRecord | undefined {
  return TEAMS_REGISTRY.find((t) => t.id === id && (!sport || t.sport === sport))
}

/**
 * Find team by exact name match (useful for intent classifier integration).
 */
export function findTeamByExactName(name: string, sport?: CanonicalSportKey): TeamRecord | undefined {
  const normalized = normalize(name)
  return TEAMS_REGISTRY.find((t) => {
    if (sport && t.sport !== sport) return false
    return (
      normalize(t.name) === normalized ||
      normalize(t.shortName) === normalized ||
      t.aliases.some((a) => normalize(a) === normalized)
    )
  })
}
