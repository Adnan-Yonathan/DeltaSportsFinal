/**
 * Intent classifier for the Guide chat mode.
 * Routes user queries to appropriate pages or inline snippets.
 */

export type GuideIntent =
  | { type: 'PAGE_ROUTE'; pages: PageKey[]; recommendedPage?: PageKey }
  | { type: 'INLINE_SCORE'; team: string; sport: Sport }
  | { type: 'INLINE_STATS'; name: string; entityType: 'player' | 'team'; sport: Sport }
  | { type: 'LINE_MOVEMENT' }
  | { type: 'GAME_INFO'; team?: string; sport?: Sport }
  | { type: 'EDUCATION' }
  | { type: 'ADVICE' }
  | { type: 'OFF_TOPIC' }
  | { type: 'CONVERSATION' }

export type PageKey = 'live-scores' | 'sharp-traders' | 'parlay-predictor' | 'player-projections' | 'market-projections' | 'stats'
export type Sport = 'nba' | 'nfl' | 'mlb' | 'nhl' | 'ncaab' | 'ncaaf'

// Patterns for each intent type
const PATTERNS = {
  // Route to both player + market projections
  bestBets: [
    /best\s*bets?\b/i,  // Word boundary to avoid matching "best betting strategies"
    /top\s*picks?\b/i,
    /what\s*(should|can)\s*i\s*bet/i,
    /who\s*(should|do)\s*(i|you)\s*(bet|like)/i,
    /give\s*me\s*(some\s*)?bets?/i,
    /bets?\s*for\s*today/i,
    /bets?\s*tonight/i,
  ],

  // Route to Sharp Traders
  sharpTraders: [
    /\bev\s*bets?\b/i,
    /positive\s*ev/i,
    /\+ev/i,
    /best\s*value/i,
    /value\s*bets?/i,
    /expected\s*value/i,
    /sharp\s*traders/i,
    /sharp\s*wallets?/i,
    /polymarket\s*wallets?/i,
  ],

  // Route to live-scores (for arbitrage/odds comparison)
  arbitrage: [
    /arbitrage/i,
    /\barb\b/i,
    /sure\s*bet/i,
    /risk[\s-]*free/i,
    /odds\s*comparison/i,
    /compare\s*odds/i,
    /line\s*shopping/i,
    /shop\s*lines/i,
  ],

  // Route to parlay predictor
  parlay: [
    /parlay/i,
    /same\s*game\s*parlay/i,
    /\bsgp\b/i,
    /combo\s*bet/i,
    /multi[\s-]*leg/i,
    /accumulator/i,
  ],

  // Route to player projections
  playerProps: [
    /player\s*props?/i,
    /over\s*under\s+\w+/i,
    /(\w+)\s*(points?|rebounds?|assists?)\s*prop/i,
    /prop\s*(bets?|picks?)/i,
    /player\s*projections?/i,
  ],

  // Route to market projections
  marketAnalysis: [
    /spread/i,
    /total/i,
    /\bedge\b/i,
    /market\s*(analysis|projections?)/i,
    /game\s*(analysis|projections?)/i,
    /matchup\s*analysis/i,
  ],

  // Inline score snippet triggers
  score: [
    /what('s|s| is)\s*(the\s*)?score/i,
    /who('s|s| is)\s*winning/i,
    /how\s*(is|are)\s*(the\s*)?(\w+)\s*(doing|playing)/i,
    /(\w+)\s*game\s*score/i,
    /score\s*(of|for|in)\s*(the\s*)?(\w+)/i,
    /is\s*(the\s*)?(\w+)\s*game\s*(on|playing|live)/i,
  ],

  // Inline stats snippet triggers
  stats: [
    /(\w+)\s*stats?/i,
    /stats?\s*(for|of)\s*(\w+)/i,
    /(\w+)\s*(averages?|ppg|rpg|apg)/i,
    /how\s*(many|much)\s*(points?|rebounds?|assists?)\s*(does|is)\s*(\w+)/i,
    /what('s|s| is)\s*(\w+)\s*(averaging|stats?)/i,
  ],

  // Game info queries (use tools - fetch schedule, lines, times)
  gameInfo: [
    /what('s|s| is| are)\s*(the\s*)?(line|spread|total|odds|over\s*under)/i,
    /what('s|s| is)\s*(the\s*)?game/i,
    /when\s*(do|does|is|are)\s*(the\s*)?\w+\s*(play|game)/i,
    /what\s*time\s*(is|does|do)/i,
    /games?\s*(on\s*)?(today|tonight|tomorrow)/i,
    /schedule\s*(for\s*)?(today|tonight|tomorrow)?/i,
    /(\w+)\s*vs\.?\s*(\w+)/i,
    /(\w+)\s*(playing|plays|game|matchup)/i,
    /tell\s*me\s*about\s*(the\s*)?(\w+)\s*(game|matchup)/i,
  ],

  // Line movement / betting splits (use tools)
  lineMovement: [
    /line\s*movement/i,
    /betting\s*splits?/i,
    /sharp\s*(money|action|bettors?)/i,
    /public\s*(money|betting|action)/i,
    /where('s|s| is)\s*(the\s*)?(smart\s*)?money/i,
    /reverse\s*line\s*movement/i,
    /rlm/i,
    /steam\s*move/i,
  ],

  // Education topics (answer from LLM knowledge)
  education: [
    /what\s*(is|are)\s*(a\s*)?(spread|moneyline|parlay|total|over\s*under|ats|juice|vig|kelly)/i,
    /how\s*(does|do)\s*(spread|moneyline|parlay|betting|odds|juice)/i,
    /explain\s*(spread|moneyline|parlay|betting|odds|ats)/i,
    /what\s*does\s*(-?\d+)\s*(mean|signify)/i,
    /how\s*to\s*(read|understand)\s*odds/i,
    /bankroll\s*management/i,
    /kelly\s*criterion/i,
    /\bclv\b/i,
    /closing\s*line\s*value/i,
  ],

  // General advice and tips (answer from LLM knowledge)
  advice: [
    /betting\s*tips?/i,
    /how\s*(do\s*i|to|can\s*i)\s*(make\s*money|win|profit|beat)/i,
    /how\s*(do\s*i|to|can\s*i)\s*become\s*(a\s*)?(profitable|winning|successful)/i,
    /profitable\s*(bettor|betting|gambler)/i,
    /tips?\s*(for|on)\s*betting/i,
    /betting\s*advice/i,
    /how\s*to\s*bet/i,
    /betting\s*strateg(y|ies)/i,
    /best\s*(betting\s*)?strateg(y|ies)/i,  // "best betting strategies", "best strategies"
    /what('s|s| is)\s*the\s*(best|smartest)\s*way\s*to\s*bet/i,
    /should\s*i\s*bet/i,
    /help\s*me\s*(with\s*)?(betting|bet)/i,
    /any\s*(tips?|advice)/i,
    /how\s*(do|can)\s*(i|you)\s*(find|identify)\s*(value|edges?)/i,
    /beginner\s*tips?/i,
    /new\s*to\s*betting/i,
    /improve\s*(my\s*)?(betting|handicapping)/i,
    /get\s*better\s*at\s*betting/i,
  ],
}

// Sport detection patterns
const SPORT_PATTERNS: Record<Sport, RegExp[]> = {
  nba: [/\bnba\b/i, /basketball/i, /lakers|celtics|warriors|bulls|heat|nets|knicks|suns|bucks|nuggets/i],
  nfl: [/\bnfl\b/i, /football/i, /chiefs|eagles|bills|cowboys|49ers|dolphins|ravens|lions|packers/i],
  mlb: [/\bmlb\b/i, /baseball/i, /yankees|dodgers|astros|braves|phillies|mets|padres|rangers|diamondbacks/i],
  nhl: [/\bnhl\b/i, /hockey/i, /bruins|panthers|oilers|avalanche|rangers|maple\s*leafs|stars|devils|hurricanes/i],
  ncaab: [/\bncaab\b/i, /college\s*basketball/i, /march\s*madness/i],
  ncaaf: [/\bncaaf\b|cfb\b/i, /college\s*football/i],
}

// Extract team/player name from query
function extractEntity(query: string): { name: string; type: 'player' | 'team' } | null {
  // Common patterns for extracting names
  const patterns = [
    /(?:stats?\s*(?:for|of)\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:stats?|averages?)/,
    /(?:score\s*(?:of|for|in)\s*(?:the\s*)?)([A-Z][a-z]+)/,
    /(?:how\s*(?:is|are)\s*(?:the\s*)?)([A-Z][a-z]+)/,
  ]

  for (const pattern of patterns) {
    const match = query.match(pattern)
    if (match?.[1]) {
      const name = match[1].trim()
      // Simple heuristic: team names are usually one word, player names are usually two
      const type = name.split(/\s+/).length >= 2 ? 'player' : 'team'
      return { name, type }
    }
  }

  return null
}

// Detect sport from query
function detectSport(query: string): Sport {
  for (const [sport, patterns] of Object.entries(SPORT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        return sport as Sport
      }
    }
  }
  return 'nba' // Default to NBA
}

// Check if query matches any pattern in a list
function matchesAny(query: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(query))
}

// List of known team names for matching
const TEAM_NAMES = [
  'lakers', 'celtics', 'warriors', 'bulls', 'heat', 'nets', 'knicks', 'suns', 'bucks', 'nuggets',
  'clippers', 'sixers', 'raptors', 'spurs', 'rockets', 'mavericks', 'grizzlies', 'timberwolves',
  'pelicans', 'hawks', 'hornets', 'wizards', 'pistons', 'pacers', 'magic', 'cavaliers', 'thunder',
  'blazers', 'jazz', 'kings', 'chiefs', 'eagles', 'bills', 'cowboys', '49ers', 'dolphins', 'ravens',
  'lions', 'packers', 'bengals', 'jaguars', 'chargers', 'broncos', 'raiders', 'seahawks', 'rams',
  'cardinals', 'bears', 'vikings', 'saints', 'falcons', 'panthers', 'buccaneers', 'commanders',
  'giants', 'jets', 'patriots', 'steelers', 'browns', 'colts', 'texans', 'titans', 'bruins',
  'penguins', 'capitals', 'rangers', 'islanders', 'flyers', 'devils', 'hurricanes', 'lightning',
  'panthers', 'maple leafs', 'canadiens', 'senators', 'sabres', 'red wings', 'blue jackets',
  'predators', 'blackhawks', 'blues', 'wild', 'avalanche', 'stars', 'jets', 'flames', 'oilers',
  'canucks', 'kraken', 'sharks', 'ducks', 'kings', 'golden knights', 'coyotes'
]

// Check if query mentions a specific matchup and extract team names
function extractMatchupTeams(query: string): string[] | null {
  const q = query.toLowerCase()
  const foundTeams: string[] = []

  for (const team of TEAM_NAMES) {
    if (q.includes(team)) {
      foundTeams.push(team)
    }
  }

  // Return if we found at least one team (for single team queries) or two teams (for matchups)
  return foundTeams.length > 0 ? foundTeams : null
}

// Check if query mentions a specific matchup (team vs team or two team names)
function hasSpecificMatchup(query: string): boolean {
  const teams = extractMatchupTeams(query)
  return teams !== null && teams.length >= 1
}

/**
 * Classify the user's query intent for the Guide.
 */
export function classifyGuideIntent(query: string): GuideIntent {
  const q = query.toLowerCase().trim()

  // PRIORITY: If a specific matchup is mentioned, route to GAME_INFO first
  // This catches "best bet in pacers pelicans game" etc.
  if (hasSpecificMatchup(q)) {
    const teams = extractMatchupTeams(q)
    const sport = detectSport(q)
    return {
      type: 'GAME_INFO',
      team: teams?.[0],  // Use first extracted team to filter to that game
      sport,
    }
  }

  // Check for best bets (routes to both projection pages)
  if (matchesAny(q, PATTERNS.bestBets)) {
    return {
      type: 'PAGE_ROUTE',
      pages: ['player-projections', 'market-projections'],
      recommendedPage: 'market-projections',
    }
  }

  // Check for Sharp Traders
  if (matchesAny(q, PATTERNS.sharpTraders)) {
    return {
      type: 'PAGE_ROUTE',
      pages: ['sharp-traders'],
      recommendedPage: 'sharp-traders',
    }
  }

  // Check for arbitrage / odds comparison
  if (matchesAny(q, PATTERNS.arbitrage)) {
    return {
      type: 'PAGE_ROUTE',
      pages: ['live-scores'],
      recommendedPage: 'live-scores',
    }
  }

  // Check for parlay
  if (matchesAny(q, PATTERNS.parlay)) {
    return {
      type: 'PAGE_ROUTE',
      pages: ['parlay-predictor'],
      recommendedPage: 'parlay-predictor',
    }
  }

  // Check for player props
  if (matchesAny(q, PATTERNS.playerProps)) {
    return {
      type: 'PAGE_ROUTE',
      pages: ['player-projections'],
      recommendedPage: 'player-projections',
    }
  }

  // Check for market analysis
  if (matchesAny(q, PATTERNS.marketAnalysis)) {
    return {
      type: 'PAGE_ROUTE',
      pages: ['market-projections'],
      recommendedPage: 'market-projections',
    }
  }

  // Check for live score request (inline snippet)
  if (matchesAny(q, PATTERNS.score)) {
    const entity = extractEntity(query)
    const sport = detectSport(q)
    return {
      type: 'INLINE_SCORE',
      team: entity?.name || '',
      sport,
    }
  }

  // Check for stats request (inline snippet)
  if (matchesAny(q, PATTERNS.stats)) {
    const entity = extractEntity(query)
    const sport = detectSport(q)
    if (entity) {
      return {
        type: 'INLINE_STATS',
        name: entity.name,
        entityType: entity.type,
        sport,
      }
    }
  }

  // Check for game info queries (use tools - schedule, lines, times)
  if (matchesAny(q, PATTERNS.gameInfo)) {
    const entity = extractEntity(query)
    const sport = detectSport(q)
    return {
      type: 'GAME_INFO',
      team: entity?.name,
      sport,
    }
  }

  // Check for line movement (use tools)
  if (matchesAny(q, PATTERNS.lineMovement)) {
    return { type: 'LINE_MOVEMENT' }
  }

  // Check for education topics
  if (matchesAny(q, PATTERNS.education)) {
    return { type: 'EDUCATION' }
  }

  // Check for general advice/tips
  if (matchesAny(q, PATTERNS.advice)) {
    return { type: 'ADVICE' }
  }

  // Default to conversation (let LLM handle)
  return { type: 'CONVERSATION' }
}

/**
 * Generate a response prefix based on intent.
 */
export function getIntentResponsePrefix(intent: GuideIntent): string {
  switch (intent.type) {
    case 'PAGE_ROUTE':
      if (intent.pages.length > 1) {
        return "I can help you find betting opportunities. Here are the best places to look:"
      }
      return "I've got just the place for that:"
    case 'INLINE_SCORE':
      return "Here's the latest on that game:"
    case 'INLINE_STATS':
      return "Here are the stats you're looking for:"
    case 'LINE_MOVEMENT':
      return "Let me check the betting action for you."
    case 'GAME_INFO':
      return "" // Tool will provide the game info
    case 'EDUCATION':
      return "" // LLM will provide the education content
    case 'ADVICE':
      return "" // LLM will provide the advice
    case 'OFF_TOPIC':
      return "I'm focused on sports betting - can I help you find some bets or explain betting concepts instead?"
    case 'CONVERSATION':
      return ""
    default:
      return ""
  }
}
