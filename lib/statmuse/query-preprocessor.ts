/**
 * Query preprocessor that extracts player/team names from common query patterns.
 * This runs BEFORE OpenAI function calling to ensure correct parameter extraction.
 */


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
  /what\s+(?:are|is)\s+(?:the\s+)?([a-z\s]+?)\s+(?:team\s+)?stats/i,
  /show\s+(?:me\s+)?(?:the\s+)?([a-z\s]+?)\s+(?:team\s+)?stats/i,
  /^([a-z\s]+?)\s+(?:team\s+)?stats$/i,
]

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const normalizeToken = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]/g, '')

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z\s]/g, '')
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

// Team nickname/abbreviation mappings for better matching
const TEAM_ALIASES: Record<string, string[]> = {
  'Atlanta Hawks': ['hawks', 'atl', 'atlanta'],
  'Boston Celtics': ['celtics', 'bos', 'boston', 'cs'],
  'Brooklyn Nets': ['nets', 'bkn', 'brooklyn', 'brk'],
  'Charlotte Hornets': ['hornets', 'cha', 'charlotte', 'cho'],
  'Chicago Bulls': ['bulls', 'chi', 'chicago'],
  'Cleveland Cavaliers': ['cavaliers', 'cavs', 'cle', 'cleveland'],
  'Dallas Mavericks': ['mavericks', 'mavs', 'dal', 'dallas'],
  'Denver Nuggets': ['nuggets', 'den', 'denver'],
  'Detroit Pistons': ['pistons', 'det', 'detroit'],
  'Golden State Warriors': ['warriors', 'gsw', 'dubs', 'golden state', 'gs'],
  'Houston Rockets': ['rockets', 'hou', 'houston'],
  'Indiana Pacers': ['pacers', 'ind', 'indiana'],
  'Los Angeles Clippers': ['clippers', 'lac', 'la clippers'],
  'Los Angeles Lakers': ['lakers', 'lal', 'la lakers'],
  'Memphis Grizzlies': ['grizzlies', 'grizz', 'mem', 'memphis'],
  'Miami Heat': ['heat', 'mia', 'miami'],
  'Milwaukee Bucks': ['bucks', 'mil', 'milwaukee'],
  'Minnesota Timberwolves': ['timberwolves', 'wolves', 'min', 'minnesota', 'twolves'],
  'New Orleans Pelicans': ['pelicans', 'pels', 'nop', 'new orleans'],
  'New York Knicks': ['knicks', 'nyk', 'new york', 'ny'],
  'Oklahoma City Thunder': ['thunder', 'okc', 'oklahoma city', 'oklahoma'],
  'Orlando Magic': ['magic', 'orl', 'orlando'],
  'Philadelphia 76ers': ['76ers', 'sixers', 'phi', 'philly', 'philadelphia'],
  'Phoenix Suns': ['suns', 'phx', 'pho', 'phoenix'],
  'Portland Trail Blazers': ['trail blazers', 'blazers', 'por', 'portland'],
  'Sacramento Kings': ['kings', 'sac', 'sacramento'],
  'San Antonio Spurs': ['spurs', 'sas', 'san antonio'],
  'Toronto Raptors': ['raptors', 'raps', 'tor', 'toronto'],
  'Utah Jazz': ['jazz', 'uta', 'utah'],
  'Washington Wizards': ['wizards', 'wiz', 'was', 'washington'],
}

function findTeamByAlias(query: string): string | null {
  const normalized = normalizeToken(query)

  for (const [fullName, aliases] of Object.entries(TEAM_ALIASES)) {
    for (const alias of aliases) {
      if (normalized.includes(normalizeToken(alias))) {
        return fullName
      }
    }
  }

  return null
}

function findTeamInQuery(query: string): string | null {
  // First try alias matching (includes abbreviations, nicknames)
  const aliasMatch = findTeamByAlias(query)
  if (aliasMatch) return aliasMatch

  return null
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

  // Check for game recommendation
  for (const pattern of GAME_RECOMMENDATION_PATTERNS) {
    if (pattern.test(lower)) {
      return { type: 'game_recommendation', tool: 'get_game_recommendations' }
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

export function preprocessQuery(query: string): PreprocessedQuery {
  const result: PreprocessedQuery = {
    originalQuery: query,
    matched: false,
  }

  // Detect sport
  result.sport = detectSport(query)

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

    // Try to extract team for team-based queries
    if (['ats', 'injuries', 'schedule'].includes(detection.type)) {
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

  // Try to find any team or player mention
  const foundTeam = findTeamInQuery(query)
  const foundPlayer = findPlayerInQuery(query)

  if (foundPlayer) {
    result.playerName = foundPlayer
    result.queryType = 'player_stats'
    result.matched = true
    return result
  }

  if (foundTeam) {
    result.teamName = foundTeam
    result.queryType = 'team_stats'
    result.matched = true
    return result
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
  }

  if (hints.length === 0) {
    return query
  }

  return `${query}\n\n[HINTS: ${hints.join(' | ')}]`
}
