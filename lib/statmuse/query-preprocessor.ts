/**
 * Query preprocessor that extracts player/team names from common query patterns.
 * This runs BEFORE OpenAI function calling to ensure correct parameter extraction.
 */

import { findNbaStaticPlayer, getStaticNbaPlayers } from '@/lib/nba-static-stats'
import { findStaticNbaTeam, getStaticNbaTeams } from '@/lib/nba-static-team-stats'

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
  // "[player] ppg/points" style
  /^([a-z\s]+?)\s+(?:ppg|rpg|apg|mpg|pts|points|rebounds|assists|steals|blocks|fg%|3p%|3pt%|ft%|ts%|efg%|turnovers?|tov|reb|ast|stl|blk)\b/i,
  // "[player] points per game" style
  /^([a-z\s]+?)\s+(?:points per game|rebounds per game|assists per game|steals per game|blocks per game|minutes per game|field goal %|three point %|free throw %|true shooting %|effective fg %)\b/i,
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

type TeamStatRequest = { teamName: string; statLabel: string }

const normalizeToken = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]/g, '')

const expandStatVariants = (key: string, baseLabel?: string): string[] => {
  const variants = new Set<string>()
  const raw = baseLabel || key
  const spaced = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  variants.add(raw)
  variants.add(spaced)
  variants.add(spaced.replace(/\bpercent\b/gi, 'pct'))
  variants.add(spaced.replace(/\bpct\b/gi, 'percent'))
  variants.add(spaced.replace(/\bper game\b/gi, 'per game'))
  variants.add(spaced.replace(/\bper game\b/gi, 'pg'))
  variants.add(spaced.replace(/\bopponent\b/gi, 'opp'))
  variants.add(spaced.replace(/\bopponents\b/gi, 'opp'))
  variants.add(spaced.replace(/\bthree\b/gi, '3'))
  variants.add(spaced.replace(/\btwo\b/gi, '2'))
  variants.add(spaced.replace(/\bagainst\b/gi, 'allowed'))
  variants.add(spaced.replace(/\bopponent\b/gi, 'allowed'))
  variants.add(spaced.replace(/\bfield goal\b/gi, 'fg'))
  variants.add(spaced.replace(/\bfree throw\b/gi, 'ft'))
  variants.add(spaced.replace(/\bturnovers\b/gi, 'tov'))
  variants.add(spaced.replace(/\bassists\b/gi, 'ast'))
  variants.add(spaced.replace(/\brebounds\b/gi, 'reb'))
  variants.add(spaced.replace(/\bpoints\b/gi, 'pts'))
  variants.add(spaced.replace(/\bminutes\b/gi, 'min'))
  variants.add(spaced.replace(/\bpercentage\b/gi, 'pct'))

  if (normalizeToken(spaced).includes('pointspergame')) variants.add('ppg')
  if (normalizeToken(spaced).includes('reboundspergame')) variants.add('rpg')
  if (normalizeToken(spaced).includes('assistspergame')) variants.add('apg')
  if (normalizeToken(spaced).includes('minutespergame')) variants.add('mpg')
  if (normalizeToken(spaced).includes('offensiverating')) variants.add('ortg')
  if (normalizeToken(spaced).includes('defensiverating')) variants.add('drtg')
  if (normalizeToken(spaced).includes('netrating')) variants.add('netrtg')
  if (normalizeToken(spaced).includes('effectivfgpct')) variants.add('efg%')
  if (normalizeToken(spaced).includes('trueshootingpct')) variants.add('ts%')
  if (normalizeToken(spaced).includes('threepointpct')) variants.add('3p%')
  if (normalizeToken(spaced).includes('threepm')) variants.add('3pm')
  if (normalizeToken(spaced).includes('threepa')) variants.add('3pa')
  if (normalizeToken(spaced).includes('fieldgoalpct')) variants.add('fg%')
  if (normalizeToken(spaced).includes('freethrowpct')) variants.add('ft%')
  if (normalizeToken(spaced).includes('marginofvictory')) variants.add('mov')
  if (normalizeToken(spaced).includes('strengthofschedule')) variants.add('sos')
  if (normalizeToken(spaced).includes('simpleratingsystem')) variants.add('srs')

  return Array.from(variants)
}

const buildTeamStatIndex = () => {
  const teams = getStaticNbaTeams()
  const sample = teams[0]?.stats || {}
  return Object.keys(sample).map((key) => ({
    key,
    variants: expandStatVariants(key),
  }))
}

const buildPlayerStatIndex = () => {
  const players = getStaticNbaPlayers()
  const sample = players[0]?.stats || {}
  return Object.keys(sample).map((key) => ({
    key,
    variants: expandStatVariants(key),
  }))
}

const TEAM_STAT_INDEX = buildTeamStatIndex()
const PLAYER_STAT_INDEX = buildPlayerStatIndex()

/**
 * Normalize text for matching (remove special chars, lowercase)
 */
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z\s]/g, '')
}

function findStatRequest(query: string, index: Array<{ key: string; variants: string[] }>): string | null {
  const normalizedQuery = normalizeToken(query)
  for (const entry of index) {
    for (const variant of entry.variants) {
      const token = normalizeToken(variant)
      if (token.length < 3) continue
      if (normalizedQuery.includes(token)) return entry.key
    }
  }
  return null
}

function findTeamInQuery(query: string): string | null {
  const normalizedQuery = normalize(query).replace(/\s+/g, '')
  for (const team of getStaticNbaTeams()) {
    const teamName = normalize(team.team).replace(/\s+/g, '')
    if (!teamName) continue
    if (normalizedQuery.includes(teamName)) return team.team
    const nickname = team.team.split(' ').pop() || team.team
    const nicknameNorm = normalize(nickname).replace(/\s+/g, '')
    if (nicknameNorm && normalizedQuery.includes(nicknameNorm)) return team.team
  }
  return null
}

function findPlayerInQuery(query: string): string | null {
  const normalizedQuery = normalize(query).replace(/\s+/g, '')
  for (const player of getStaticNbaPlayers()) {
    const nameNorm = normalize(player.name).replace(/\s+/g, '')
    if (nameNorm.length >= 4 && normalizedQuery.includes(nameNorm)) return player.name
    const lastName = player.name.split(/\s+/).pop() || ''
    const lastNorm = normalize(lastName).replace(/\s+/g, '')
    if (lastNorm.length >= 4 && normalizedQuery.includes(lastNorm)) return player.name
  }
  return null
}

function extractTeamStatRequest(query: string): TeamStatRequest | null {
  const statLabel = findStatRequest(query, TEAM_STAT_INDEX)
  if (!statLabel) return null

  let candidateTeam = ''
  const normalized = normalize(query)
  const teamMatch = normalized.match(
    /^(?:the\s+)?([a-z\s]+?)\s+(?:ppg|rpg|apg|mpg|net rating|net rtg|ortg|drtg|pace|points per game|points allowed|rebounds per game|assists per game|fg%|3p%|ft%|ts%|efg%)/i
  )
  if (teamMatch && teamMatch[1]) {
    candidateTeam = teamMatch[1].trim()
  }

  const teamGuess = candidateTeam ? findStaticNbaTeam(candidateTeam)[0]?.team : null
  const fallbackTeam = teamGuess || findTeamInQuery(query)
  if (!fallbackTeam) return null

  return { teamName: fallbackTeam, statLabel }
}

function extractPlayerStatRequest(query: string): TeamStatRequest | null {
  const statLabel = findStatRequest(query, PLAYER_STAT_INDEX)
  if (!statLabel) return null
  const playerGuess = extractPlayerName(query)
  const fallbackPlayer = playerGuess || findPlayerInQuery(query)
  if (!fallbackPlayer) return null
  return { teamName: fallbackPlayer, statLabel }
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
    const statLabel = findStatRequest(query, PLAYER_STAT_INDEX)
    if (statLabel) {
      result.stats = [statLabel]
    }
    result.queryType = 'player_stats'
    result.matched = true
    return result
  }

  const playerStat = extractPlayerStatRequest(query)
  if (playerStat) {
    result.playerName = playerStat.teamName
    result.stats = [playerStat.statLabel]
    result.queryType = 'player_stats'
    result.matched = true
    return result
  }

  // Try to extract team name
  const statRequest = extractTeamStatRequest(query)
  if (statRequest) {
    result.teamName = statRequest.teamName
    result.stats = [statRequest.statLabel]
    result.queryType = 'team_stats'
    result.matched = true
    return result
  }

  const teamName = extractTeamName(query)
  if (teamName) {
    result.teamName = teamName
    const statLabel = findStatRequest(query, TEAM_STAT_INDEX)
    if (statLabel) {
      result.stats = [statLabel]
    }
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
