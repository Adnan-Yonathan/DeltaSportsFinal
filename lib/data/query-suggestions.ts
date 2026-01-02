/**
 * Query Suggestions Logic
 *
 * Context-aware suggestion engine that analyzes user input and
 * returns relevant phrase completions that trigger tools.
 */

import {
  QuerySuggestion,
  SuggestionContext,
  MATCHUP_SUGGESTIONS,
  TEAM_SUGGESTIONS,
  PLAYER_SUGGESTIONS,
  STARTER_SUGGESTIONS,
  ACTION_SUGGESTIONS,
  EDUCATION_SUGGESTIONS,
  QUERY_STARTERS,
  TRIGGER_WORDS,
  MATCHUP_PATTERN,
} from './suggestion-patterns'

// ============================================================
// TEAM DETECTION (simplified - can be enhanced with teams-registry)
// ============================================================

const NBA_TEAM_KEYWORDS = [
  'lakers', 'celtics', 'warriors', 'heat', 'bulls', 'nets', 'knicks',
  'clippers', 'suns', 'mavericks', 'mavs', 'bucks', 'sixers', '76ers',
  'nuggets', 'grizzlies', 'pelicans', 'timberwolves', 'wolves', 'thunder',
  'blazers', 'trail blazers', 'kings', 'spurs', 'raptors', 'jazz', 'wizards',
  'hawks', 'hornets', 'cavaliers', 'cavs', 'pistons', 'pacers', 'magic',
  'rockets', 'la', 'boston', 'golden state', 'miami', 'chicago', 'brooklyn',
  'new york', 'phoenix', 'dallas', 'milwaukee', 'philadelphia', 'denver',
  'memphis', 'new orleans', 'minnesota', 'oklahoma city', 'okc', 'portland',
  'sacramento', 'san antonio', 'toronto', 'utah', 'washington', 'atlanta',
  'charlotte', 'cleveland', 'detroit', 'indiana', 'orlando', 'houston',
]

const NFL_TEAM_KEYWORDS = [
  'chiefs', 'eagles', '49ers', 'niners', 'bills', 'cowboys', 'ravens',
  'bengals', 'dolphins', 'lions', 'jaguars', 'jags', 'chargers', 'vikings',
  'giants', 'jets', 'packers', 'seahawks', 'commanders', 'bears', 'browns',
  'broncos', 'colts', 'raiders', 'rams', 'saints', 'steelers', 'texans',
  'titans', 'cardinals', 'falcons', 'panthers', 'patriots', 'buccaneers', 'bucs',
]

const ALL_TEAM_KEYWORDS = [...NBA_TEAM_KEYWORDS, ...NFL_TEAM_KEYWORDS]

// ============================================================
// PLAYER DETECTION (basic pattern)
// ============================================================

// Common first names in sports
const PLAYER_FIRST_NAMES = [
  'lebron', 'stephen', 'steph', 'kevin', 'james', 'anthony', 'luka',
  'giannis', 'jayson', 'devin', 'joel', 'nikola', 'damian', 'dame',
  'kyrie', 'kawhi', 'jimmy', 'donovan', 'trae', 'zion', 'ja', 'tyler',
  'bam', 'pascal', 'domantas', 'shai', 'dejounte', 'lamelo', 'cade',
  'patrick', 'travis', 'josh', 'tyreek', 'justin', 'lamar', 'jalen',
]

// Common last names in sports
const PLAYER_LAST_NAMES = [
  'james', 'curry', 'durant', 'harden', 'doncic', 'antetokounmpo',
  'tatum', 'booker', 'embiid', 'jokic', 'lillard', 'irving', 'leonard',
  'butler', 'mitchell', 'young', 'williamson', 'morant', 'herro',
  'adebayo', 'siakam', 'sabonis', 'gilgeous-alexander', 'murray', 'ball',
  'cunningham', 'mahomes', 'kelce', 'allen', 'hill', 'jefferson', 'jackson',
  'hurts', 'diggs', 'adams', 'kupp', 'chase', 'henry', 'cook', 'taylor',
]

// ============================================================
// CONTEXT BUILDING
// ============================================================

/**
 * Detects team names in the input text
 */
function detectTeamsInText(input: string): string[] {
  const normalized = input.toLowerCase()
  const found: string[] = []

  for (const team of ALL_TEAM_KEYWORDS) {
    // Use word boundary matching
    const regex = new RegExp(`\\b${team}\\b`, 'i')
    if (regex.test(normalized)) {
      found.push(team)
    }
  }

  return found
}

/**
 * Detects player names in the input text
 * Uses a simple heuristic: looks for capitalized names or known player names
 */
function detectPlayersInText(input: string): string[] {
  const found: string[] = []
  const normalized = input.toLowerCase()

  // Check for known first names
  for (const firstName of PLAYER_FIRST_NAMES) {
    if (normalized.includes(firstName)) {
      found.push(firstName)
    }
  }

  // Check for known last names
  for (const lastName of PLAYER_LAST_NAMES) {
    if (normalized.includes(lastName)) {
      found.push(lastName)
    }
  }

  // Also check for capitalized word patterns (First Last)
  const capitalizedPattern = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g
  const matches = input.match(capitalizedPattern)
  if (matches) {
    found.push(...matches)
  }

  return [...new Set(found)] // Dedupe
}

/**
 * Gets the last word in the input (for trigger word matching)
 */
function getLastWord(input: string): string {
  const trimmed = input.trim()
  const words = trimmed.split(/\s+/)
  return words[words.length - 1] || ''
}

/**
 * Finds if input starts with a known query starter
 */
function findQueryStarter(input: string): string | null {
  const normalized = input.toLowerCase().trim()

  for (const starter of QUERY_STARTERS) {
    if (normalized.startsWith(starter)) {
      return starter
    }
  }

  return null
}

/**
 * Finds if the last word matches a trigger word
 */
function findActionWord(word: string): string | null {
  const normalized = word.toLowerCase()

  if (TRIGGER_WORDS.includes(normalized)) {
    return normalized
  }

  return null
}

/**
 * Builds context from user input
 */
export function buildSuggestionContext(
  input: string,
  taggedTeams: Array<{ name: string }> = []
): SuggestionContext {
  const trimmed = input.trim()

  return {
    hasMatchup: MATCHUP_PATTERN.test(trimmed),
    teams: [
      ...taggedTeams.map(t => t.name),
      ...detectTeamsInText(trimmed),
    ],
    players: detectPlayersInText(trimmed),
    triggerWord: getLastWord(trimmed),
    fullText: trimmed,
    starterPhrase: findQueryStarter(trimmed) || undefined,
  }
}

// ============================================================
// SUGGESTION FILTERING & RANKING
// ============================================================

/**
 * Sort by priority (descending), dedupe by phrase, and limit results
 */
function sortAndLimit(suggestions: QuerySuggestion[], limit: number): QuerySuggestion[] {
  // Dedupe by phrase
  const seen = new Set<string>()
  const deduped = suggestions.filter(s => {
    const key = s.phrase.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Sort by priority descending
  deduped.sort((a, b) => b.priority - a.priority)

  return deduped.slice(0, limit)
}

/**
 * Main suggestion engine
 * Returns up to 6 context-aware suggestions
 */
export function getSuggestions(
  input: string,
  context?: SuggestionContext,
  limit: number = 6
): QuerySuggestion[] {
  // Build context if not provided
  const ctx = context || buildSuggestionContext(input)

  // Don't show suggestions for very short inputs (let user type more)
  if (ctx.fullText.length < 2) {
    return []
  }

  const results: QuerySuggestion[] = []

  // 1. Matchup suggestions (highest priority when "vs" detected)
  if (ctx.hasMatchup) {
    results.push(...MATCHUP_SUGGESTIONS)
  }

  // 2. Query starter suggestions (e.g., "what is", "show me")
  if (ctx.starterPhrase) {
    const starterSuggestions = STARTER_SUGGESTIONS[ctx.starterPhrase]
    if (starterSuggestions) {
      results.push(...starterSuggestions)
    }

    // Also check education suggestions for learning-oriented starters
    const educationSuggestions = EDUCATION_SUGGESTIONS[ctx.starterPhrase]
    if (educationSuggestions) {
      results.push(...educationSuggestions)
    }
  }

  // 3. Action word suggestions (e.g., "edge", "props", "ats")
  const actionWord = findActionWord(ctx.triggerWord)
  if (actionWord) {
    const actionSuggestions = ACTION_SUGGESTIONS[actionWord]
    if (actionSuggestions) {
      results.push(...actionSuggestions)
    }
  }

  // 4. Team-specific suggestions (when team detected)
  if (ctx.teams.length > 0 && !ctx.hasMatchup) {
    results.push(...TEAM_SUGGESTIONS)
  }

  // 5. Player-specific suggestions (when player detected)
  if (ctx.players.length > 0) {
    results.push(...PLAYER_SUGGESTIONS)
  }

  // 6. If no specific context detected but user is typing, show general starters
  if (results.length === 0 && ctx.fullText.length >= 3) {
    // Check if any trigger word is being typed (partial match)
    const partialTrigger = TRIGGER_WORDS.find(tw =>
      tw.startsWith(ctx.triggerWord.toLowerCase()) && ctx.triggerWord.length >= 2
    )
    if (partialTrigger) {
      const partialSuggestions = ACTION_SUGGESTIONS[partialTrigger]
      if (partialSuggestions) {
        // Adjust suggestions to include the full trigger word
        const adjusted = partialSuggestions.map(s => ({
          ...s,
          phrase: `${partialTrigger.slice(ctx.triggerWord.length)} ${s.phrase}`.trim(),
        }))
        results.push(...adjusted)
      }
    }
  }

  return sortAndLimit(results, limit)
}

// ============================================================
// UTILITY EXPORTS
// ============================================================

export { detectTeamsInText, detectPlayersInText, findQueryStarter, findActionWord }
