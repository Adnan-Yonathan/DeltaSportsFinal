/**
 * Query preprocessor that extracts player/team names from common query patterns.
 * This runs BEFORE OpenAI function calling to ensure correct parameter extraction.
 */

import { findNbaStaticPlayer } from '@/lib/nba-static-stats'
import { findStaticNbaTeam } from '@/lib/nba-static-team-stats'

export interface PreprocessedQuery {
  /** Original query text */
  originalQuery: string
  /** Detected player name (if any) */
  playerName?: string
  /** Detected team name (if any) */
  teamName?: string
  /** Detected stats being requested */
  stats?: string[]
  /** Query type */
  queryType?: 'player_stats' | 'team_stats' | 'player_vs_opponent' | 'threshold' | 'unknown'
  /** Whether preprocessing found a match */
  matched: boolean
}

/**
 * Common player stat query patterns:
 * - "what are lebrons stats"
 * - "show me curry's stats"
 * - "lebron james stats this season"
 * - "how many points does luka average"
 * - "what's giannis averaging"
 */
const PLAYER_STAT_PATTERNS = [
  // "what are/is [player] stats/averaging"
  /what\s+(?:are|is|\'s)\s+([a-z\s]+?)(?:\'?s?)?\s+(?:stats|averaging|season stats|numbers)/i,
  // "show me [player] stats"
  /show\s+(?:me\s+)?([a-z\s]+?)(?:\'?s?)?\s+stats/i,
  // "[player] stats"
  /^([a-z\s]+)\s+stats(?:\s+(?:this|for|the)\s+season)?$/i,
  // "[player]'s stats"
  /^([a-z\s]+)\'s\s+stats/i,
  // "how many [stat] does [player] average/have"
  /how\s+many\s+(?:points|rebounds|assists|steals|blocks)\s+(?:does|has)\s+([a-z\s]+?)\s+(?:average|have|get)/i,
  // "what's [player] [stat]"
  /what\'s\s+([a-z\s]+?)(?:\'?s?)?\s+(?:ppg|rpg|apg|points|rebounds|assists|shooting|fg%|3p%)/i,
  // "[player] averages" / "[player] season averages"
  /^([a-z\s]+?)\s+(?:season\s+)?averages?$/i,
]

/**
 * Common team stat query patterns:
 * - "lakers stats"
 * - "show me celtics team stats"
 * - "what are the warriors stats"
 */
const TEAM_STAT_PATTERNS = [
  // "what are/is [team] stats"
  /what\s+(?:are|is)\s+(?:the\s+)?([a-z\s]+?)\s+(?:team\s+)?stats/i,
  // "show me [team] stats"
  /show\s+(?:me\s+)?(?:the\s+)?([a-z\s]+?)\s+(?:team\s+)?stats/i,
  // "[team] stats"
  /^([a-z\s]+?)\s+(?:team\s+)?stats$/i,
]

/**
 * Normalize text for matching (remove special chars, lowercase)
 */
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z\s]/g, '')
}

/**
 * Extract player name from query using pattern matching
 */
function extractPlayerName(query: string): string | undefined {
  const normalized = normalize(query)

  for (const pattern of PLAYER_STAT_PATTERNS) {
    const match = normalized.match(pattern)
    if (match && match[1]) {
      const extracted = match[1].trim()

      // Filter out common stop words that aren't player names
      const stopWords = ['stats', 'for', 'the', 'this', 'season', 'averaging', 'average', 'show', 'me', 'what', 'are', 'is']
      const cleaned = extracted.split(/\s+/).filter(word => !stopWords.includes(word)).join(' ')

      if (cleaned.length > 1) {
        // Verify this player exists in our data
        const player = findNbaStaticPlayer(cleaned)
        if (player) {
          console.log('[PREPROCESSOR] Extracted player name:', cleaned, '→ found:', player.name)
          return cleaned
        }
      }
    }
  }

  return undefined
}

/**
 * Extract team name from query using pattern matching
 */
function extractTeamName(query: string): string | undefined {
  const normalized = normalize(query)

  for (const pattern of TEAM_STAT_PATTERNS) {
    const match = normalized.match(pattern)
    if (match && match[1]) {
      const extracted = match[1].trim()

      // Verify this team exists in our data
      const teams = findStaticNbaTeam(extracted)
      if (teams && teams.length > 0) {
        console.log('[PREPROCESSOR] Extracted team name:', extracted, '→ found:', teams[0].team)
        return extracted
      }
    }
  }

  return undefined
}

/**
 * Preprocess a query to extract player/team names and query intent.
 * This helps ensure correct parameter extraction before OpenAI function calling.
 */
export function preprocessQuery(query: string): PreprocessedQuery {
  const result: PreprocessedQuery = {
    originalQuery: query,
    matched: false,
  }

  // Try to extract player name
  const playerName = extractPlayerName(query)
  if (playerName) {
    result.playerName = playerName
    result.queryType = 'player_stats'
    result.matched = true
    return result
  }

  // Try to extract team name
  const teamName = extractTeamName(query)
  if (teamName) {
    result.teamName = teamName
    result.queryType = 'team_stats'
    result.matched = true
    return result
  }

  // No match found
  result.queryType = 'unknown'
  return result
}

/**
 * Enhance a query with extracted information.
 * This adds explicit hints to the query to help OpenAI extract correct parameters.
 */
export function enhanceQueryForLLM(query: string, preprocessed: PreprocessedQuery): string {
  if (!preprocessed.matched) {
    return query
  }

  // For player stats queries, append a hint
  if (preprocessed.queryType === 'player_stats' && preprocessed.playerName) {
    return `${query}\n\n[HINT: This query is about player "${preprocessed.playerName}"]`
  }

  // For team stats queries, append a hint
  if (preprocessed.queryType === 'team_stats' && preprocessed.teamName) {
    return `${query}\n\n[HINT: This query is about team "${preprocessed.teamName}"]`
  }

  return query
}
