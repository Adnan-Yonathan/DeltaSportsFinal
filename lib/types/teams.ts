import type { CanonicalSportKey } from '@/lib/identity/sport'

/**
 * A team record in the master teams registry.
 * Contains all data needed for autocomplete, display, and intent classification.
 */
export interface TeamRecord {
  /** ESPN team ID */
  id: string
  /** Full team name, e.g. "Los Angeles Lakers" */
  name: string
  /** Short display name, e.g. "Lakers" */
  shortName: string
  /** Team abbreviation, e.g. "LAL" */
  abbreviation: string
  /** Canonical sport key for routing */
  sport: CanonicalSportKey
  /** Alternative names/spellings for search matching */
  aliases: string[]
  /** ESPN logo URL (optional) */
  logoUrl?: string
  /** Conference name, e.g. "Western" or "Big Ten" */
  conference?: string
  /** Division name, e.g. "Pacific" or "Big Ten East" */
  division?: string
  /** ESPN slug for API lookups */
  espnSlug?: string
}

/**
 * A team that has been tagged/mentioned in a chat message.
 * Contains position info for rendering pills and full team context for intent detection.
 */
export interface TaggedTeam {
  /** ESPN team ID */
  id: string
  /** Full team name */
  name: string
  /** What shows in the pill (usually shortName or abbreviation) */
  displayName: string
  /** Canonical sport key */
  sport: CanonicalSportKey
  /** Position in the raw message text (for serialization) */
  position: {
    start: number
    end: number
  }
}

/**
 * Search result with scoring metadata.
 */
export interface TeamSearchResult extends TeamRecord {
  /** Match quality score (higher = better match) */
  score: number
  /** How the match was found */
  matchType: 'exact' | 'prefix' | 'contains' | 'alias'
}

/**
 * Sport display metadata for disambiguation UI.
 */
export const SPORT_DISPLAY: Record<CanonicalSportKey, { label: string; shortLabel: string }> = {
  basketball_nba: { label: 'NBA', shortLabel: 'NBA' },
  basketball_ncaab: { label: 'College Basketball', shortLabel: 'NCAAB' },
  americanfootball_nfl: { label: 'NFL', shortLabel: 'NFL' },
  americanfootball_ncaaf: { label: 'College Football', shortLabel: 'NCAAF' },
  baseball_mlb: { label: 'MLB', shortLabel: 'MLB' },
  icehockey_nhl: { label: 'NHL', shortLabel: 'NHL' },
}
