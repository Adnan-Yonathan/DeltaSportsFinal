/**
 * Query preprocessor that extracts player/team names from common query patterns.
 * This runs BEFORE OpenAI function calling to ensure correct parameter extraction.
 */

import { TEAMS_REGISTRY } from '@/lib/data/teams-registry'

export type QueryType =
  | 'player_stats'
  | 'team_stats'
  | 'player_vs_opponent'
  | 'threshold'
  | 'prop_ranking'
  | 'ats'
  | 'injuries'
  | 'live_scores'
  | 'schedule'
  | 'leaderboard'
  | 'betting_splits'
  | 'game_recommendation'
  | 'line_shopping'
  | 'matchup'
  | 'best_bet'
  | 'matchup_analysis'
  | 'sharp_money'
  | 'unknown'

export type SportType = 'nba' | 'nfl' | 'mlb' | 'nhl' | 'ncaab' | 'cfb' | 'unknown'

export interface PreprocessedQuery {
  /** Original query text */
  originalQuery: string
  /** Detected player name (if any) */
  playerName?: string
  /** Detected team name (if any) */
  teamName?: string
  /** Second team for matchups */
  opponentTeam?: string
  /** Detected stats being requested */
  stats?: string[]
  /** Query type */
  queryType?: QueryType
  /** Whether preprocessing found a match */
  matched: boolean
  /** For prop_ranking queries: the prop type detected */
  propType?: string
  /** For prop_ranking/threshold queries: the threshold detected */
  propThreshold?: number
  /** Detected sport */
  sport?: SportType
  /** Stat type for leaderboard queries */
  leaderboardStat?: string
  /** Suggested tool to use */
  suggestedTool?: string
}

// ============================================================
// SPORT DETECTION PATTERNS
// ============================================================

const SPORT_PATTERNS: { sport: SportType; patterns: RegExp[] }[] = [
  {
    sport: 'nfl',
    patterns: [
      /\b(nfl|football|quarterback|qb|touchdown|yards|rushing|passing|receivers?|wr|rb|te|defense|sack)\b/i,
      /\b(chiefs|eagles|bills|49ers|cowboys|ravens|bengals|lions|dolphins|jets|patriots|packers|chargers|seahawks|vikings|broncos|raiders|bears|browns|steelers|saints|buccaneers|rams|cardinals|falcons|panthers|commanders|giants|jaguars|texans|colts|titans)\b/i,
    ],
  },
  {
    sport: 'mlb',
    patterns: [
      /\b(mlb|baseball|pitcher|batting|era|rbi|home\s*runs?|strikeouts?|innings?|pitching)\b/i,
      /\b(yankees|dodgers|astros|braves|mets|phillies|padres|mariners|guardians|orioles|rangers|rays|twins|blue\s*jays|red\s*sox|cubs|cardinals|brewers|diamondbacks|marlins|giants|reds|pirates|rockies|royals|tigers|angels|athletics|nationals|white\s*sox)\b/i,
    ],
  },
  {
    sport: 'nhl',
    patterns: [
      /\b(nhl|hockey|goalie|puck|ice|slap\s*shot|power\s*play|penalty)\b/i,
      /\b(bruins|avalanche|panthers|hurricanes|devils|rangers|maple\s*leafs|oilers|stars|knights|wild|jets|kings|flames|lightning|kraken|blues|senators|red\s*wings|canucks|islanders|penguins|capitals|predators|sabres|flyers|ducks|coyotes|sharks|blackhawks|canadiens|blue\s*jackets)\b/i,
    ],
  },
  {
    sport: 'ncaab',
    patterns: [
      /\b(ncaab|college\s*basketball|march\s*madness|ncaa\s*basketball)\b/i,
    ],
  },
  {
    sport: 'cfb',
    patterns: [
      /\b(cfb|college\s*football|ncaa\s*football)\b/i,
    ],
  },
]

function detectSport(query: string): SportType {
  const lower = query.toLowerCase()

  for (const { sport, patterns } of SPORT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) {
        return sport
      }
    }
  }

  // Check for NBA-specific terms or default to NBA
  if (/\b(nba|basketball|three[- ]?pointer|dunk|rebound|assist)\b/i.test(lower)) {
    return 'nba'
  }

  // Check if query mentions an NBA team or player
  const teamMatch = findTeamInQuery(query)
  const playerMatch = findPlayerInQuery(query)
  if (teamMatch || playerMatch) {
    return 'nba'
  }

  return 'unknown'
}

// ============================================================
// QUERY TYPE PATTERNS
// ============================================================

/**
 * ATS (Against The Spread) patterns
 */
const ATS_PATTERNS = [
  /\b(ats|against\s+the\s+spread)\s+(record|history|stats?|performance)/i,
  /\bats\b/i,
  /\b(cover|covers|covering)\s+(the\s+)?spread/i,
  /\bspread\s+(record|history|performance)/i,
  /\b(do|does|how\s+do)\s+.+\s+(cover|ats|against\s+the\s+spread)/i,
  /\b(best|worst|top)\s+(ats|spread\s+covering)\s+teams?/i,
  /\b(home|away|road)\s+ats/i,
  /\bats\s+(home|away|road|as\s+favorite|as\s+underdog)/i,
]

/**
 * Injury patterns
 */
const INJURY_PATTERNS = [
  /\b(injur|injured|injuries|injury\s+report|injury\s+list)\b/i,
  /\b(who'?s|who\s+is)\s+(out|injured|questionable|doubtful|probable)/i,
  /\b(out|questionable|doubtful|probable|gtd|day-to-day)\b.*\b(for|on)\b/i,
  /\b(health|healthy|status)\s+(report|update|check)/i,
  /\b(missing|sitting\s+out|ruled\s+out|dnp)\b/i,
  /\b(availability|available)\b/i,
]

/**
 * Live scores patterns
 */
const LIVE_SCORE_PATTERNS = [
  /\b(score|scores|scoring)\b/i,
  /\b(live|current|right\s+now|currently)\s+(game|score|play)/i,
  /\bwhat'?s?\s+(the\s+)?(score|happening)/i,
  /\b(games?\s+)?(today|tonight|on\s+now|playing|live)\b/i,
  /\b(who'?s|who\s+is)\s+(playing|winning|leading)/i,
  /\bare\s+there\s+(any\s+)?games/i,
  /\b(halftime|quarter|period|inning)\s+(score|update)/i,
]

/**
 * Schedule/rest patterns
 */
const SCHEDULE_PATTERNS = [
  /\b(back[- ]?to[- ]?back|b2b)\b/i,
  /\b(road\s+trip|home\s+stand|schedule)\b/i,
  /\b(rest|rested|tired|fatigue|fatigued)\b/i,
  /\b(travel|traveling|flew|flight)\b/i,
  /\b(days?\s+off|days?\s+rest)\b/i,
  /\b(last\s+game|previous\s+game|played\s+yesterday)\b/i,
  /\bscheduled?\s+(advantage|disadvantage|spot)\b/i,
]

/**
 * Leaderboard patterns
 */
const LEADERBOARD_PATTERNS = [
  /\b(who\s+)?lead(s|ing|ers?)?\s+(the\s+)?(league|nba|nfl|mlb|nhl)\s+(in|for)/i,
  /\b(top|best|highest|most)\s+(\d+\s+)?(scorers?|rebounders?|passers?|shooters?)/i,
  /\bleague\s+leaders?\s+(in|for)/i,
  /\b(scoring|rebounding|assist|steals?|blocks?)\s+leaders?/i,
  /\bwho\s+(has|averages?)\s+the\s+(most|highest|best)/i,
  /\b(rank|ranking|rankings)\s+(players?|teams?)\s+by/i,
  /\bmost\s+(points|rebounds|assists|steals|blocks|threes|3s|home\s*runs?|touchdowns?|yards)/i,
]

/**
 * Player vs opponent patterns
 */
const PLAYER_VS_OPPONENT_PATTERNS = [
  /(.+?)\s+(?:vs?|versus|against|playing|matchup\s+(?:vs?|against)?)\s+(?:the\s+)?(.+)/i,
  /(.+?)\s+stats?\s+(?:vs?|versus|against)\s+(?:the\s+)?(.+)/i,
  /\bhow\s+(?:does|do|did)\s+(.+?)\s+(?:perform|do|play)\s+(?:vs?|versus|against)\s+(?:the\s+)?(.+)/i,
  /(.+?)\s+(?:performance|history)\s+(?:vs?|versus|against)\s+(?:the\s+)?(.+)/i,
]

/**
 * Threshold/counting patterns (e.g., "how many 40-point games")
 */
const THRESHOLD_PATTERNS = [
  /how\s+many\s+(\d+)[+\-]?\s*[- ]?(point|pts?|rebound|reb|assist|ast|three|3|steal|block)\s*(games?)?/i,
  /(\d+)[+]?\s*[- ]?(point|pts?|rebound|reb|assist|ast)\s+games?\s+(has|does|did)\s+(.+)/i,
  /times?\s+(.+?)\s+(?:scored?|had|got|recorded?)\s+(\d+)\+?/i,
  /games?\s+(?:where|with|when)\s+(.+?)\s+(?:scored?|had|got)\s+(\d+)\+?/i,
  /\b(double[- ]?double|triple[- ]?double)s?\s+(?:by|for|has)\b/i,
  /\bhow\s+many\s+(double[- ]?double|triple[- ]?double)s?/i,
]

/**
 * Betting splits patterns
 */
const BETTING_SPLITS_PATTERNS = [
  /\b(betting|public|sharp|money)\s+(splits?|action|percentage|%)/i,
  /\b(where|what)\s+(is\s+)?(the\s+)?(money|public|sharps?)\s+(on|betting)/i,
  /\b(fade|fading)\s+(the\s+)?public/i,
  /\bcontrarian\s+(play|bet|pick)/i,
  /\bsharp\s+(action|money|bets?|play)/i,
]

/**
 * Line shopping patterns
 */
const LINE_SHOPPING_PATTERNS = [
  /\b(shop|compare)\s+(the\s+)?(lines?|odds|spreads?|prices?)/i,
  /\bbest\s+(odds|line|price|spread)\s+(on|for|at)/i,
  /\b(which|what)\s+book\s+has\s+(the\s+)?(best|better)/i,
  /\bline\s+shopping/i,
  /\b(best|better)\s+(price|odds)\s+(for|on)/i,
  /\bcompare\s+(books?|sportsbooks?|bookmakers?)/i,
  /\b(where|which)\s+(can|should)\s+I\s+(get|find)\s+(the\s+)?(best|better)/i,
  /\b(draftkings|fanduel|betmgm|caesars|bet365)\s+vs\s+(draftkings|fanduel|betmgm|caesars|bet365)/i,
  /\bodds\s+comparison/i,
  /\b(best|better)\s+(book|sportsbook)\s+for/i,
]

/**
 * Matchup patterns (two teams adjacent without vs)
 */
const MATCHUP_PATTERNS = [
  /^([a-z0-9]+)\s+([a-z0-9]+)\s*(spread|total|odds?|line|moneyline|ml|ou|over\s*under)?$/i,
  /\b([a-z0-9]+)\s+([a-z0-9]+)\s+game\b/i,
  /\b([a-z0-9]+)\s+([a-z0-9]+)\s+matchup\b/i,
  /\banalyz[ei]\s+([a-z0-9]+)\s+([a-z0-9]+)\b/i,
]

/**
 * Game recommendation patterns
 */
const GAME_RECOMMENDATION_PATTERNS = [
  /\b(what|calculate|project|fair)\s+(should|is)\s+(the\s+)?(spread|line|total|over\s*\/?\s*under)/i,
  /\b(model|projected?|fair)\s+(spread|line|total)/i,
  /\b(edge|value)\s+(on|in|for)\s+.+\s+(game|spread|total)/i,
  /\btarget\s+(spread|line|total)/i,
  /\b(over\s*\/?\s*under|o\s*\/?\s*u)\s+(projection|target|fair)/i,
]

/**
 * Best bet patterns - single game betting recommendation
 */
const BEST_BET_PATTERNS = [
  /\bbest\s+bet\b/i,
  /\bbest\s+pick\b/i,
  /\bwho\s+wins\b/i,
  /\bwhat('s| is)\s+the\s+play\b/i,
  /\bshould\s+i\s+bet\b/i,
  /\bwhat\s+to\s+bet\b/i,
  /\block\s+of\s+the\s+(day|night|week)\b/i,
  /\bgive\s+me\s+a\s+(bet|pick|play)\b/i,
  /\bwho\s+(do\s+you|should\s+i)\s+(like|take|bet)\b/i,
  /\bwhat('s| is)\s+your\s+(pick|play|lean)\b/i,
]

/**
 * Sharp money patterns - professional bettor action
 */
const SHARP_MONEY_PATTERNS = [
  /\bsharp\s+(money|action|side|play|bettors?)\b/i,
  /\bsmart\s+money\b/i,
  /\bwise\s*guy(s)?\b/i,
  /\breverse\s+line\s+move(ment)?\b/i,
  /\brlm\b/i,
  /\bsteam\s+move\b/i,
  /\bprofessional\s+(money|bettors?|action)\b/i,
  /\bsyndicate\b/i,
  /\bline\s+move(ment)?\s+(toward|against|opposite)\b/i,
  /\bwhere('s| is| are)\s+(the\s+)?(sharps?|pros?|professionals?)\b/i,
]

/**
 * Matchup analysis patterns - comprehensive game breakdown
 */
const MATCHUP_ANALYSIS_PATTERNS = [
  /\b(full|detailed|deep|comprehensive)\s+(analysis|breakdown)\b/i,
  /\banalyze\s+(the\s+)?(matchup|game)\b/i,
  /\bmatchup\s+analysis\b/i,
  /\bgame\s+analysis\b/i,
  /\bbreakdown\s+(of\s+)?(the\s+)?(matchup|game)\b/i,
  /\btell\s+me\s+(about|everything)\s+(the\s+)?(matchup|game)\b/i,
]

/**
 * Prop ranking patterns
 */
const PROP_RANKING_PATTERNS = [
  /which\s+player\s+(?:is\s+)?(?:most\s+)?likely\s+to\s+(?:hit|score|get|make)\s+(\d+)\+?\s+(threes?|three[- ]?pointers?|3s?|3pm|points?|pts|rebounds?|reb|assists?|ast)/i,
  /who\s+(?:has\s+the\s+)?(?:best|highest)\s+chance\s+(?:of\s+)?(?:hitting|scoring|getting|making)\s+(\d+)\+?\s+(threes?|three[- ]?pointers?|3s?|3pm|points?|pts|rebounds?|reb|assists?|ast)/i,
  /rank\s+players?\s+(?:by\s+)?(?:probability|likelihood|chance)\s+(?:of\s+)?(?:hitting|scoring|getting)\s+(\d+)\+?\s+(threes?|three[- ]?pointers?|3s?|3pm|points?|pts|rebounds?|reb|assists?|ast)/i,
  /top\s+(?:\d+\s+)?players?\s+(?:to\s+)?(?:hit|go)\s+over\s+(\d+\.?\d*)\s+(threes?|three[- ]?pointers?|3s?|3pm|points?|pts|rebounds?|reb|assists?|ast)/i,
  /best\s+(?:\d+\s+)?players?\s+(?:for|to\s+hit)\s+(\d+)\+?\s+(threes?|three[- ]?pointers?|3s?|3pm|points?|pts|rebounds?|reb|assists?|ast)/i,
  /players?\s+(?:most\s+)?likely\s+to\s+(?:hit|score|get|make)\s+(\d+)\+?\s+(threes?|three[- ]?pointers?|3s?|3pm|points?|pts|rebounds?|reb|assists?|ast)/i,
  /who'?s?\s+(?:going\s+)?(?:hitting|making|scoring)\s+(\d+)\+?\s+(threes?|three[- ]?pointers?|3s?|points?|rebounds?|assists?)/i,
]

/**
 * Player stat patterns
 */
const PLAYER_STAT_PATTERNS = [
  /what\s+(?:are|is|\'s)\s+([a-z\s]+?)(?:\'?s?)?\s+(?:stats|averaging|season stats|numbers)/i,
  /show\s+(?:me\s+)?([a-z\s]+?)(?:\'?s?)?\s+stats/i,
  /^([a-z\s]+)\s+stats(?:\s+(?:this|for|the)\s+season)?$/i,
  /^([a-z\s]+)\'s\s+stats/i,
  /how\s+many\s+(?:points|rebounds|assists|steals|blocks)\s+(?:does|has)\s+([a-z\s]+?)\s+(?:average|have|get)/i,
  /what\'s\s+([a-z\s]+?)(?:\'?s?)?\s+(?:ppg|rpg|apg|points|rebounds|assists|shooting|fg%|3p%)/i,
  /^([a-z\s]+?)\s+(?:season\s+)?averages?$/i,
  /^([a-z\s]+?)\s+(?:ppg|rpg|apg|mpg|pts|points|rebounds|assists|steals|blocks|fg%|3p%|3pt%|ft%|ts%|efg%|turnovers?|tov|reb|ast|stl|blk)\b/i,
  /^([a-z\s]+?)\s+(?:points per game|rebounds per game|assists per game|steals per game|blocks per game|minutes per game|field goal %|three point %|free throw %|true shooting %|effective fg %)\b/i,
]

/**
 * Team stat patterns
 */
const TEAM_STAT_PATTERNS = [
  /what\s+(?:are|is)\s+(?:the\s+)?([a-z0-9\s]+?)\s+(?:team\s+)?stats/i,
  /show\s+(?:me\s+)?(?:the\s+)?([a-z0-9\s]+?)\s+(?:team\s+)?stats/i,
  /^([a-z0-9\s]+?)\s+(?:team\s+)?stats$/i,
]

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const normalizeToken = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]/g, '')

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '')
}

function normalizePropType(rawPropType: string): string {
  const prop = rawPropType.toLowerCase().trim()
  if (/threes?|three[- ]?pointers?|3s?|3pm/i.test(prop)) return 'threes'
  if (/points?|pts/i.test(prop)) return 'points'
  if (/rebounds?|reb/i.test(prop)) return 'rebounds'
  if (/assists?|ast/i.test(prop)) return 'assists'
  if (/steals?|stl/i.test(prop)) return 'steals'
  if (/blocks?|blk/i.test(prop)) return 'blocks'
  return prop
}

// ============================================================
// TEAM DETECTION USING REGISTRY
// Uses TEAMS_REGISTRY (500+ teams across all sports) for team matching
// ============================================================

interface TeamMatch {
  name: string
  sport: string
  position: number
  aliasLength: number
}

/**
 * Find all teams mentioned in a query.
 * Returns up to 2 teams sorted by position in query.
 * Also detects sport from matched team.
 */
function findTeamsInQuery(query: string): { team1?: string; team2?: string; sport?: SportType } {
  const normalized = normalizeToken(query)
  const matches: TeamMatch[] = []

  for (const team of TEAMS_REGISTRY) {
    // Check aliases first (most specific)
    for (const alias of team.aliases) {
      const aliasNorm = normalizeToken(alias)
      if (aliasNorm.length < 2) continue // Skip very short aliases

      const pos = normalized.indexOf(aliasNorm)
      if (pos !== -1) {
        // Check if already found this team (prefer longer alias matches)
        const existing = matches.find((m) => m.name === team.name)
        if (!existing || existing.aliasLength < aliasNorm.length) {
          if (existing) {
            matches.splice(matches.indexOf(existing), 1)
          }
          matches.push({ name: team.name, sport: team.sport, position: pos, aliasLength: aliasNorm.length })
        }
        break
      }
    }

    // Also check abbreviation if not already matched
    if (team.abbreviation && team.abbreviation.length >= 2) {
      const abbrevNorm = normalizeToken(team.abbreviation)
      // Use word boundary check for abbreviations to avoid false matches
      const abbrevPattern = new RegExp(`\\b${abbrevNorm}\\b`)
      if (abbrevPattern.test(normalized)) {
        const pos = normalized.indexOf(abbrevNorm)
        const existing = matches.find((m) => m.name === team.name)
        if (!existing) {
          matches.push({ name: team.name, sport: team.sport, position: pos, aliasLength: abbrevNorm.length })
        }
      }
    }
  }

  // Sort by position in query
  matches.sort((a, b) => a.position - b.position)

  // Remove duplicates (same team matched multiple times)
  const uniqueMatches = matches.filter((m, i, arr) => arr.findIndex((x) => x.name === m.name) === i)

  if (uniqueMatches.length === 0) {
    return {}
  }

  // Map sport key to SportType
  const mapSport = (sportKey: string): SportType => {
    if (sportKey.includes('nba')) return 'nba'
    if (sportKey.includes('nfl')) return 'nfl'
    if (sportKey.includes('mlb')) return 'mlb'
    if (sportKey.includes('nhl')) return 'nhl'
    if (sportKey.includes('ncaab')) return 'ncaab'
    if (sportKey.includes('ncaaf')) return 'cfb'
    return 'unknown'
  }

  if (uniqueMatches.length === 1) {
    return {
      team1: uniqueMatches[0].name,
      sport: mapSport(uniqueMatches[0].sport),
    }
  }

  // Two or more teams found
  return {
    team1: uniqueMatches[0].name,
    team2: uniqueMatches[1].name,
    sport: mapSport(uniqueMatches[0].sport),
  }
}

/**
 * Legacy function - wraps findTeamsInQuery for backward compatibility.
 * Returns just the first team name.
 */
function findTeamInQuery(query: string): string | null {
  const result = findTeamsInQuery(query)
  return result.team1 || null
}

function findPlayerInQuery(query: string): string | null {
  const nameMatch = query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/)
  if (nameMatch?.[1]) return nameMatch[1]
  return null
}

function extractLeaderboardStat(query: string): string | null {
  const lower = query.toLowerCase()

  if (/\b(scoring|points?|pts|ppg)\b/.test(lower)) return 'points'
  if (/\b(rebounding|rebounds?|reb|rpg)\b/.test(lower)) return 'rebounds'
  if (/\b(assists?|ast|apg)\b/.test(lower)) return 'assists'
  if (/\b(steals?|stl|spg)\b/.test(lower)) return 'steals'
  if (/\b(blocks?|blk|bpg)\b/.test(lower)) return 'blocks'
  if (/\b(threes?|3s|3pm|three[- ]?pointers?)\b/.test(lower)) return 'threes'
  if (/\b(fg%|field\s*goal|shooting)\b/.test(lower)) return 'fg_pct'
  if (/\b(3p%|three[- ]?point\s*%)\b/.test(lower)) return 'three_pct'
  if (/\b(minutes?|mpg)\b/.test(lower)) return 'minutes'

  return null
}

// ============================================================
// QUERY TYPE DETECTION
// ============================================================

function detectQueryType(query: string): { type: QueryType; tool?: string; extra?: Record<string, any> } {
  const lower = query.toLowerCase()

  // Check for prop ranking first (most specific)
  for (const pattern of PROP_RANKING_PATTERNS) {
    const match = query.match(pattern)
    if (match && match[1] && match[2]) {
      const threshold = parseFloat(match[1])
      const propType = normalizePropType(match[2])
      if (!isNaN(threshold)) {
        return {
          type: 'prop_ranking',
          tool: 'get_ranked_players_by_prop_threshold',
          extra: { propType, threshold: Math.ceil(threshold) }
        }
      }
    }
  }

  // Check for threshold/counting queries
  for (const pattern of THRESHOLD_PATTERNS) {
    if (pattern.test(lower)) {
      return { type: 'threshold', tool: 'getPlayerThresholdGames' }
    }
  }

  // Check for ATS queries
  for (const pattern of ATS_PATTERNS) {
    if (pattern.test(lower)) {
      return { type: 'ats', tool: 'getTeamAtsAnalysis' }
    }
  }

  // Check for injury queries
  for (const pattern of INJURY_PATTERNS) {
    if (pattern.test(lower)) {
      return { type: 'injuries', tool: 'getInjuries' }
    }
  }

  // Check for live score queries
  for (const pattern of LIVE_SCORE_PATTERNS) {
    if (pattern.test(lower)) {
      return { type: 'live_scores', tool: 'getLiveScores' }
    }
  }

  // Check for schedule/rest queries
  for (const pattern of SCHEDULE_PATTERNS) {
    if (pattern.test(lower)) {
      return { type: 'schedule', tool: 'getTeamScheduleContext' }
    }
  }

  // Check for leaderboard queries
  for (const pattern of LEADERBOARD_PATTERNS) {
    if (pattern.test(lower)) {
      const stat = extractLeaderboardStat(query)
      return { type: 'leaderboard', tool: 'getLeaderboard', extra: { stat } }
    }
  }

  // Check for betting splits
  for (const pattern of BETTING_SPLITS_PATTERNS) {
    if (pattern.test(lower)) {
      return { type: 'betting_splits', tool: 'get_betting_splits' }
    }
  }

  // Check for line shopping
  for (const pattern of LINE_SHOPPING_PATTERNS) {
    if (pattern.test(lower)) {
      return { type: 'line_shopping', tool: 'get_odds_comparison' }
    }
  }

  // Check for game recommendation
  for (const pattern of GAME_RECOMMENDATION_PATTERNS) {
    if (pattern.test(lower)) {
      return { type: 'game_recommendation', tool: 'get_game_recommendations' }
    }
  }

  // Check for best bet with matchup indicator (two teams)
  const hasMatchupIndicator = /\b(vs\.?|versus|@|against)\b/i.test(lower)
  for (const pattern of BEST_BET_PATTERNS) {
    if (pattern.test(lower)) {
      // If has matchup indicator, route to unified analysis
      if (hasMatchupIndicator) {
        return {
          type: 'best_bet',
          tool: 'analyze_bet_market',
          extra: { hasMatchup: true }
        }
      }
      // Slate-wide best bet (no specific matchup)
      return {
        type: 'best_bet',
        tool: 'get_slate_edge_detection',
        extra: { hasMatchup: false }
      }
    }
  }

  // Check for sharp money queries
  for (const pattern of SHARP_MONEY_PATTERNS) {
    if (pattern.test(lower)) {
      return {
        type: 'sharp_money',
        tool: 'get_slate_edge_detection',
        extra: { focusSharp: true }
      }
    }
  }

  // Check for comprehensive matchup analysis
  for (const pattern of MATCHUP_ANALYSIS_PATTERNS) {
    if (pattern.test(lower) && hasMatchupIndicator) {
      return {
        type: 'matchup_analysis',
        tool: 'analyze_bet_market',
        extra: { comprehensive: true }
      }
    }
  }

  // Check for player vs opponent
  for (const pattern of PLAYER_VS_OPPONENT_PATTERNS) {
    const match = query.match(pattern)
    if (match) {
      const player = findPlayerInQuery(match[1])
      const opponent = findTeamInQuery(match[2])
      if (player && opponent) {
        return {
          type: 'player_vs_opponent',
          tool: 'getPlayerVsOpponent',
          extra: { player, opponent }
        }
      }
    }
  }

  // Check for matchup patterns (two teams adjacent without "vs")
  // e.g., "heat hawks", "lakers celtics spread"
  const teamsResult = findTeamsInQuery(query)
  if (teamsResult.team1 && teamsResult.team2) {
    // Detected two teams - this is a matchup query
    return {
      type: 'matchup',
      tool: 'get_game_recommendations',
      extra: { team1: teamsResult.team1, team2: teamsResult.team2, sport: teamsResult.sport }
    }
  }

  return { type: 'unknown' }
}

// ============================================================
// STAT INDEX BUILDING
// ============================================================

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
  variants.add(spaced.replace(/\bper game\b/gi, 'pg'))
  variants.add(spaced.replace(/\bopponent\b/gi, 'opp'))
  variants.add(spaced.replace(/\bthree\b/gi, '3'))
  variants.add(spaced.replace(/\bfield goal\b/gi, 'fg'))
  variants.add(spaced.replace(/\bfree throw\b/gi, 'ft'))
  variants.add(spaced.replace(/\bturnovers\b/gi, 'tov'))
  variants.add(spaced.replace(/\bassists\b/gi, 'ast'))
  variants.add(spaced.replace(/\brebounds\b/gi, 'reb'))
  variants.add(spaced.replace(/\bpoints\b/gi, 'pts'))

  if (normalizeToken(spaced).includes('pointspergame')) variants.add('ppg')
  if (normalizeToken(spaced).includes('reboundspergame')) variants.add('rpg')
  if (normalizeToken(spaced).includes('assistspergame')) variants.add('apg')
  if (normalizeToken(spaced).includes('minutespergame')) variants.add('mpg')
  if (normalizeToken(spaced).includes('offensiverating')) variants.add('ortg')
  if (normalizeToken(spaced).includes('defensiverating')) variants.add('drtg')

  return Array.from(variants)
}

const TEAM_STAT_KEYS = [
  'pointsForPerGame',
  'pointsAgainstPerGame',
  'offensiveRating',
  'defensiveRating',
  'netRating',
  'pace',
  'fieldGoalPct',
  'threePointPct',
  'freeThrowPct',
  'reboundsPerGame',
  'assistsPerGame',
  'opponentThreeMadePerGame',
  'opponentReboundsPerGame',
  'opponentAssistsPerGame',
]

const PLAYER_STAT_KEYS = [
  'PTS',
  'REB',
  'AST',
  'THREE_PM',
  'MPG',
  'USG_PERCENT',
  'BPM',
]

const TEAM_STAT_INDEX = TEAM_STAT_KEYS.map((key) => ({
  key,
  variants: expandStatVariants(key),
}))

const PLAYER_STAT_INDEX = PLAYER_STAT_KEYS.map((key) => ({
  key,
  variants: expandStatVariants(key),
}))

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

function extractPlayerName(query: string): string | undefined {
  const normalized = normalize(query)

  for (const pattern of PLAYER_STAT_PATTERNS) {
    const match = normalized.match(pattern)
    if (match && match[1]) {
      const extracted = match[1].trim()
      const stopWords = ['stats', 'for', 'the', 'this', 'season', 'averaging', 'average', 'show', 'me', 'what', 'are', 'is']
      const cleaned = extracted.split(/\s+/).filter(word => !stopWords.includes(word)).join(' ')

      if (cleaned.length > 1) {
        return cleaned
      }
    }
  }

  return undefined
}

function extractTeamName(query: string): string | undefined {
  const normalized = normalize(query)

  for (const pattern of TEAM_STAT_PATTERNS) {
    const match = normalized.match(pattern)
    if (match && match[1]) {
      const extracted = match[1].trim()
      const team = findTeamInQuery(extracted)
      if (team) return team
    }
  }

  return undefined
}

// ============================================================
// MAIN PREPROCESSING FUNCTION
// ============================================================

interface TaggedTeamInput {
  id: string
  name: string
  displayName: string
  sport: string
  position: { start: number; end: number }
}

interface PreprocessOptions {
  taggedTeams?: TaggedTeamInput[]
}

export function preprocessQuery(query: string, options: PreprocessOptions = {}): PreprocessedQuery {
  const { taggedTeams } = options
  const result: PreprocessedQuery = {
    originalQuery: query,
    matched: false,
  }

  // If we have tagged teams, use them directly for team detection
  if (taggedTeams && taggedTeams.length > 0) {
    const firstTag = taggedTeams[0]
    result.teamName = firstTag.name

    // Get sport from tagged team
    const tagSport = firstTag.sport.toLowerCase()
    if (tagSport.includes('nba') || tagSport === 'basketball_nba') result.sport = 'nba'
    else if (tagSport.includes('nfl') || tagSport === 'americanfootball_nfl') result.sport = 'nfl'
    else if (tagSport.includes('mlb') || tagSport === 'baseball_mlb') result.sport = 'mlb'
    else if (tagSport.includes('nhl') || tagSport === 'icehockey_nhl') result.sport = 'nhl'
    else if (tagSport.includes('ncaab') || tagSport === 'basketball_ncaab') result.sport = 'ncaab'
    else if (tagSport.includes('ncaaf') || tagSport === 'americanfootball_ncaaf') result.sport = 'cfb'

    // If second tagged team, use as opponent
    if (taggedTeams.length > 1) {
      result.opponentTeam = taggedTeams[1].name
    }

    console.log('[PREPROCESSOR] Using tagged teams:', {
      teamName: result.teamName,
      sport: result.sport,
      opponentTeam: result.opponentTeam,
    })
  }

  // Detect sport (will be overridden by tagged team sport if available)
  if (!result.sport) {
    result.sport = detectSport(query)
  }

  // Detect query type and suggested tool
  const detection = detectQueryType(query)

  if (detection.type !== 'unknown') {
    result.queryType = detection.type
    result.suggestedTool = detection.tool
    result.matched = true

    // Handle specific query type extras
    if (detection.type === 'prop_ranking' && detection.extra) {
      result.propType = detection.extra.propType
      result.propThreshold = detection.extra.threshold
    }

    if (detection.type === 'player_vs_opponent' && detection.extra) {
      result.playerName = detection.extra.player
      result.opponentTeam = detection.extra.opponent
    }

    if (detection.type === 'leaderboard' && detection.extra) {
      result.leaderboardStat = detection.extra.stat
    }

    // Try to extract team for team-based queries (only if not already tagged)
    if (['ats', 'injuries', 'schedule'].includes(detection.type) && !result.teamName) {
      result.teamName = findTeamInQuery(query) || undefined
    }

    return result
  }

  // Fall back to player/team stat patterns
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

  // If we already have a tagged team, use that for team_stats detection
  const teamName = result.teamName || extractTeamName(query)
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

  // Try to find any team or player mention (only if not already tagged)
  const foundPlayer = findPlayerInQuery(query)
  if (foundPlayer) {
    result.playerName = foundPlayer
    result.queryType = 'player_stats'
    result.matched = true
    return result
  }

  // Use multi-team detection to find both teams (for matchups) and sport
  if (!result.teamName) {
    const teamsResult = findTeamsInQuery(query)
    if (teamsResult.team1) {
      result.teamName = teamsResult.team1
      result.matched = true

      // If sport was detected from team registry, use it
      if (teamsResult.sport && teamsResult.sport !== 'unknown') {
        result.sport = teamsResult.sport
      }

      // If two teams found (matchup), route to game_recommendation
      if (teamsResult.team2) {
        result.opponentTeam = teamsResult.team2
        result.queryType = 'game_recommendation'
        return result
      }

      result.queryType = 'team_stats'
      return result
    }
  }

  const foundTeam = result.teamName
  if (foundTeam) {
    result.teamName = foundTeam
    result.queryType = 'team_stats'
    result.matched = true
    return result
  }

  // If we have tagged teams but no other match, still mark as matched
  if (taggedTeams && taggedTeams.length > 0) {
    result.matched = true
  }

  result.queryType = 'unknown'
  return result
}

// ============================================================
// QUERY ENHANCEMENT FOR LLM
// ============================================================

export function enhanceQueryForLLM(query: string, preprocessed: PreprocessedQuery): string {
  if (!preprocessed.matched) {
    return query
  }

  const hints: string[] = []

  // Sport hint
  if (preprocessed.sport && preprocessed.sport !== 'unknown') {
    hints.push(`Sport: ${preprocessed.sport.toUpperCase()}`)
  }

  // Query type specific hints
  switch (preprocessed.queryType) {
    case 'prop_ranking':
      if (preprocessed.propType && preprocessed.propThreshold) {
        hints.push(`Use get_ranked_players_by_prop_threshold with propType="${preprocessed.propType}" and threshold=${preprocessed.propThreshold}`)
      }
      break

    case 'ats':
      hints.push(`Use getTeamAtsAnalysis for ATS/spread analysis`)
      if (preprocessed.teamName) hints.push(`Team: "${preprocessed.teamName}"`)
      break

    case 'injuries':
      hints.push(`Use getInjuries for injury report`)
      if (preprocessed.teamName) hints.push(`Team: "${preprocessed.teamName}"`)
      break

    case 'live_scores':
      hints.push(`Use getLiveScores for current games/scores`)
      break

    case 'schedule':
      hints.push(`Use getTeamScheduleContext or getTeamBackToBackSplit for schedule/rest analysis`)
      if (preprocessed.teamName) hints.push(`Team: "${preprocessed.teamName}"`)
      break

    case 'leaderboard':
      hints.push(`Use getLeaderboard for league leaders`)
      if (preprocessed.leaderboardStat) hints.push(`Stat: "${preprocessed.leaderboardStat}"`)
      break

    case 'betting_splits':
      hints.push(`Use get_betting_splits for public/sharp betting action`)
      break

    case 'game_recommendation':
      hints.push(`Use get_game_recommendations for projected spreads/totals`)
      break

    case 'player_vs_opponent':
      hints.push(`Use getPlayerVsOpponent for matchup analysis`)
      if (preprocessed.playerName) hints.push(`Player: "${preprocessed.playerName}"`)
      if (preprocessed.opponentTeam) hints.push(`Opponent: "${preprocessed.opponentTeam}"`)
      break

    case 'threshold':
      hints.push(`Use getPlayerThresholdGames for counting stat threshold games`)
      if (preprocessed.playerName) hints.push(`Player: "${preprocessed.playerName}"`)
      break

    case 'player_stats':
      if (preprocessed.playerName) hints.push(`Player: "${preprocessed.playerName}"`)
      break

    case 'team_stats':
      if (preprocessed.teamName) hints.push(`Team: "${preprocessed.teamName}"`)
      break

    case 'best_bet':
      hints.push(`Use analyze_bet_market for comprehensive game analysis with odds, ATS, splits, and model projections`)
      if (preprocessed.teamName) hints.push(`Team: "${preprocessed.teamName}"`)
      if (preprocessed.opponentTeam) hints.push(`Opponent: "${preprocessed.opponentTeam}"`)
      break

    case 'matchup_analysis':
      hints.push(`Use analyze_bet_market for detailed matchup breakdown with stats, trends, injuries, and betting context`)
      if (preprocessed.teamName) hints.push(`Team: "${preprocessed.teamName}"`)
      if (preprocessed.opponentTeam) hints.push(`Opponent: "${preprocessed.opponentTeam}"`)
      break

    case 'sharp_money':
      hints.push(`Use get_slate_edge_detection to find sharp money signals, reverse line movements, and professional bettor action`)
      break
  }

  if (hints.length === 0) {
    return query
  }

  return `${query}\n\n[HINTS: ${hints.join(' | ')}]`
}
