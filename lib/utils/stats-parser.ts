/**
 * Utility to detect and parse player/team stats from AI-formatted text responses
 */

import { searchPlayer } from '@/lib/sports-stats-api'

export interface ParsedPlayerStats {
  type: 'player'
  name: string
  team: string
  position?: string
  sport: string
  season?: string
  headshot?: string
  stats: Record<string, number | string>
  originalText: string
}

export interface ParsedTeamStats {
  type: 'team'
  team: string
  sport: string
  wins: number
  losses: number
  winPct: number
  stats: Record<string, number | string | null>
  originalText: string
}

export interface PropOdds {
  best: number
  bestBook: string
  allBooks?: Array<{
    book: string
    odds: number
  }>
}

export interface PropMarket {
  line: number | string
  over: PropOdds
  under: PropOdds
}

export interface ParsedPlayerProps {
  type: 'props'
  player: string
  team?: string
  teamAbbr?: string
  position?: string
  sport: string
  game?: string
  headshot?: string
  markets: Record<string, PropMarket>
  originalText: string
}

export interface BookmakerOdds {
  price: number // American odds (-110, +150)
  point?: number // For spreads/totals (4.5, 225.5)
  url?: string // Deep link to bookmaker
}

export interface ParsedMarket {
  outcomes: Array<{
    label: string // team name or "Over"/"Under"
    bookmakers: Record<string, BookmakerOdds> // bookmaker name -> odds
  }>
}

export interface ParsedGameOdds {
  type: 'game_odds'
  sport: string
  awayTeam: string
  homeTeam: string
  awayLogo?: string
  homeLogo?: string
  gameTime: string
  markets: {
    moneyline?: ParsedMarket
    spreads?: ParsedMarket
    totals?: ParsedMarket
  }
  originalText: string
}

export interface ParsedTeamInsights {
  type: 'team_insights'
  sport: string
  awayTeam: string
  homeTeam: string
  awayLogo?: string
  homeLogo?: string
  awayStats: {
    streak: string
    last10: string
    ppg: string
    papg: string
    fgPct: string
    threePct: string
    reb: string
    ast: string
    blk: string
    stl: string
  }
  homeStats: {
    streak: string
    last10: string
    ppg: string
    papg: string
    fgPct: string
    threePct: string
    reb: string
    ast: string
    blk: string
    stl: string
  }
  originalText: string
}

export type ParsedStats = ParsedPlayerStats | ParsedTeamStats | ParsedPlayerProps | ParsedGameOdds | ParsedTeamInsights

/**
 * Detect if text contains formatted player stats
 * Pattern: "Name | Team | Position | Season YYYY-YY"
 */
export async function detectPlayerStats(text: string): Promise<ParsedPlayerStats | null> {
  // Look for player stat pattern: Name | Team | Position | Season
  const headerPattern = /^([^|\n]+)\s*\|\s*([^|\n]+)\s*\|\s*([^|\n]+)(?:\s*\|\s*Season\s+([^\n]+))?/m
  const match = text.match(headerPattern)

  if (!match) return null

  const name = match[1].trim()
  const team = match[2].trim()
  const position = match[3].trim()
  const season = match[4]?.trim()

  // Extract stats (lines starting with "- Stat Name: Value")
  const statPattern = /-\s*([^:\n]+):\s*([^\n]+)/g
  const stats: Record<string, number | string> = {}

  let statMatch
  while ((statMatch = statPattern.exec(text)) !== null) {
    const key = statMatch[1].trim()
    const value = statMatch[2].trim()

    // Handle compound stats (e.g., "- Passing: 250, 2 TD, 1 INT" or "- GP: 50 | G: 20 | A: 30")
    if (value.includes('|')) {
      // NHL style: "GP: 50 | G: 20 | A: 30"
      const parts = value.split('|')
      for (const part of parts) {
        const innerMatch = part.trim().match(/^([^:]+):\s*(.+)/)
        if (innerMatch) {
          const innerKey = innerMatch[1].trim().toUpperCase().replace(/\s+/g, '_')
          let innerValue: number | string = innerMatch[2].trim()
          if (typeof innerValue === 'string') {
            const numMatch = innerValue.match(/^([\d.]+)/)
            if (numMatch) {
              const num = parseFloat(numMatch[1])
              if (!isNaN(num)) {
                innerValue = num
              }
            }
          }
          stats[innerKey] = innerValue
        }
      }
    } else if (value.includes(',')) {
      // NFL/MLB style: "250, 2 TD, 1 INT" or "AVG/OBP/SLG: .300/.400/.500"
      // Just store as-is for display
      stats[key.toUpperCase().replace(/\s+/g, '_')] = value
    } else {
      // Simple stat: try to parse as number
      const statKey = key.toUpperCase().replace(/\s+/g, '_')
      let statValue: number | string = value

      const numMatch = value.match(/^([\d.]+)/)
      if (numMatch) {
        const num = parseFloat(numMatch[1])
        if (!isNaN(num)) {
          statValue = num
        }
      }

      stats[statKey] = statValue
    }
  }

  // Detect sport from context or stats
  let sport = 'basketball_nba' // default
  const textLower = text.toLowerCase()

  if (
    textLower.includes('nfl') ||
    stats.PASSING ||
    stats.RUSHING ||
    stats.RECEIVING ||
    stats.PASSING_YARDS ||
    stats.RUSHING_YARDS
  ) {
    sport = 'americanfootball_nfl'
  } else if (textLower.includes('mlb') || stats.AVG || stats.ERA || stats.HR || stats.WHIP) {
    sport = 'baseball_mlb'
  } else if (textLower.includes('nhl') || stats.GOALS || stats.ASSISTS || stats.GP || stats.PTS) {
    sport = 'icehockey_nhl'
  } else if (textLower.includes('nba') || stats.PPG || stats.RPG || stats.APG) {
    sport = 'basketball_nba'
  }

  // Only return if we found at least 1 stat
  if (Object.keys(stats).length < 1) return null

  // Fetch player headshot from API
  let headshot: string | undefined
  try {
    const playerData = await searchPlayer(name, sport)
    if (playerData?.headshot) {
      headshot = playerData.headshot
    }
  } catch (error) {
    // Silently fail - headshot is optional
    console.warn('Failed to fetch player headshot:', error)
  }

  return {
    type: 'player',
    name,
    team,
    position,
    sport,
    season,
    headshot,
    stats,
    originalText: text,
  }
}

/**
 * Detect if text contains formatted team stats
 * Pattern: "Team Name: W-L (Win%)"
 */
export function detectTeamStats(text: string): ParsedTeamStats | null {
  // Look for team pattern: "Team: 25-10 (71.4%)"
  const teamPattern = /^([^:\n]+):\s*(\d+)-(\d+)\s*\((\d+\.?\d*)%?\)/m
  const match = text.match(teamPattern)

  if (!match) return null

  const team = match[1].trim()
  const wins = parseInt(match[2])
  const losses = parseInt(match[3])
  const winPct = parseFloat(match[4]) / 100

  // Try to parse JSON stats block if present
  let stats: Record<string, number | string | null> = {}
  const jsonMatch = text.match(/\{[\s\S]*?\}/)
  if (jsonMatch) {
    try {
      stats = JSON.parse(jsonMatch[0])
    } catch (e) {
      // JSON parse failed, extract key-value pairs manually
    }
  }

  // Extract additional stats from bullet points
  const statPattern = /-?\s*([^:]+):\s*([^\n]+)/g
  let statMatch
  while ((statMatch = statPattern.exec(text)) !== null) {
    const key = statMatch[1].trim().replace(/\s+/g, '')
    let value: number | string | null = statMatch[2].trim()

    // Try to parse as number
    if (typeof value === 'string') {
      const numMatch = value.match(/^([\d.]+)/)
      if (numMatch) {
        const num = parseFloat(numMatch[1])
        if (!isNaN(num)) {
          value = num
        }
      }
    }

    if (!stats[key]) {
      stats[key] = value
    }
  }

  // Detect sport
  let sport = 'basketball_nba' // default
  const textLower = text.toLowerCase()

  if (textLower.includes('nfl')) {
    sport = 'americanfootball_nfl'
  } else if (textLower.includes('mlb')) {
    sport = 'baseball_mlb'
  } else if (textLower.includes('nhl')) {
    sport = 'icehockey_nhl'
  } else if (textLower.includes('nba')) {
    sport = 'basketball_nba'
  }

  return {
    type: 'team',
    team,
    sport,
    wins,
    losses,
    winPct,
    stats,
    originalText: text,
  }
}

/**
 * Detect if text contains formatted player props
 * Pattern: **PlayerName** (Team, Position) followed by markdown table
 */
export async function detectPlayerProps(text: string, structuredData?: any[]): Promise<ParsedPlayerProps | null> {
  console.log('[PARSER] detectPlayerProps called')
  console.log('[PARSER] Text length:', text.length)
  console.log('[PARSER] Received structured data:', !!structuredData, 'players:', structuredData?.length)

  // If structured data was passed in from parent, check if this block matches a player props pattern
  if (structuredData && structuredData.length > 0) {
    // Check if this block looks like a player props table
    const hasPropsTable = /\|\s*Market\s*\|.*\|\s*Best Over\s*\|/i.test(text)
    if (hasPropsTable) {
      console.log('[PARSER] Using global structured data (skipping markdown fallback)')
      const playerProp = structuredData[0]
      console.log('[PARSER] Using structured data for:', playerProp.player)
      console.log('[PARSER] Markets:', Object.keys(playerProp.markets || {}))

      // Fetch headshot if missing
      let headshot = playerProp.headshot
      if (!headshot) {
        try {
          const playerData = await searchPlayer(
            playerProp.player,
            playerProp.sport || 'basketball_nba'
          )
          if (playerData?.headshot) headshot = playerData.headshot
        } catch (error) {
          console.warn('Failed to fetch headshot:', error)
        }
      }

      return {
        type: 'props',
        player: playerProp.player,
        team: playerProp.team,
        teamAbbr: playerProp.teamAbbr,
        position: playerProp.position,
        sport: playerProp.sport || 'basketball_nba',
        game: playerProp.game,
        headshot,
        markets: playerProp.markets,
        originalText: text,
      }
    }
  }

  // Fallback to markdown parsing
  // Look for player props pattern: **PlayerName** (Team, Position)
  const headerPattern = /\*\*([^*]+)\*\*\s*\(([^,)]+)(?:,\s*([^)]+))?\)/
  const match = text.match(headerPattern)

  if (!match) return null

  const player = match[1].trim()
  const teamInfo = match[2].trim()
  const position = match[3]?.trim()

  // Extract game info if present
  let game: string | undefined
  const gameMatch = text.match(/Game:\s*([^\n]+)/)
  if (gameMatch) {
    game = gameMatch[1].trim()
  }

  // Parse markdown table for markets
  const markets: Record<string, PropMarket> = {}

  // Match table rows: | MARKET | Line | Best Over | Best Under |
  const tableRowPattern = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g
  let rowMatch
  let foundTable = false

  while ((rowMatch = tableRowPattern.exec(text)) !== null) {
    const market = rowMatch[1].trim()
    const line = rowMatch[2].trim()
    const bestOver = rowMatch[3].trim()
    const bestUnder = rowMatch[4].trim()

    // Skip header row
    if (market === 'Market' || market === '---' || market.includes('-')) {
      foundTable = true
      continue
    }

    if (!foundTable) continue

    // Parse odds: "+110 (FanDuel)" or "-130 (DraftKings)"
    const parseOdds = (oddsStr: string): PropOdds | null => {
      const oddsMatch = oddsStr.match(/([+-]?\d+)\s*\(([^)]+)\)/)
      if (oddsMatch) {
        return {
          best: parseInt(oddsMatch[1]),
          bestBook: oddsMatch[2].trim(),
        }
      }
      // Handle cases where book might not be in parentheses
      const simpleMatch = oddsStr.match(/([+-]?\d+)/)
      if (simpleMatch) {
        return {
          best: parseInt(simpleMatch[1]),
          bestBook: 'N/A',
        }
      }
      return null
    }

    const overOdds = parseOdds(bestOver)
    const underOdds = parseOdds(bestUnder)

    if (overOdds && underOdds) {
      // Parse line (could be number or special character)
      const parsedLine = line === '—' || line === '–' ? 'N/A' : parseFloat(line) || line

      markets[market.toLowerCase()] = {
        line: parsedLine,
        over: overOdds,
        under: underOdds,
      }
    }
  }

  // Only return if we found at least one market
  if (Object.keys(markets).length === 0) return null

  // Detect sport from context or market names
  let sport = 'basketball_nba' // default
  const textLower = text.toLowerCase()
  const marketKeys = Object.keys(markets).join(' ')

  if (
    textLower.includes('nfl') ||
    marketKeys.includes('pass_') ||
    marketKeys.includes('rush_') ||
    marketKeys.includes('receiving')
  ) {
    sport = 'americanfootball_nfl'
  } else if (textLower.includes('mlb') || marketKeys.includes('hits') || marketKeys.includes('rbis')) {
    sport = 'baseball_mlb'
  } else if (textLower.includes('nhl') || marketKeys.includes('shots_on_goal')) {
    sport = 'icehockey_nhl'
  } else if (textLower.includes('nba') || marketKeys.includes('points') || marketKeys.includes('rebounds')) {
    sport = 'basketball_nba'
  }

  // Fetch player headshot from API
  let headshot: string | undefined
  try {
    const playerData = await searchPlayer(player, sport)
    if (playerData?.headshot) {
      headshot = playerData.headshot
    }
  } catch (error) {
    console.warn('Failed to fetch player headshot for props:', error)
  }

  return {
    type: 'props',
    player,
    team: teamInfo,
    teamAbbr: teamInfo, // Will be refined if needed
    position,
    sport,
    game,
    headshot,
    markets,
    originalText: text,
  }
}

/**
 * Detect if text contains formatted game odds
 * Pattern: ### NBA - Lakers @ Celtics followed by markdown table
 */
export async function detectGameOdds(text: string): Promise<ParsedGameOdds | null> {
  // Header pattern: ### NBA - Lakers @ Celtics
  const headerPattern = /###\s+([A-Z]+(?:\s+[A-Z]+)?)\s+-\s+([^@\n]+)\s+@\s+([^\n]+)/
  const headerMatch = text.match(headerPattern)

  if (!headerMatch) return null

  const sportLabel = headerMatch[1].trim()
  const awayTeam = headerMatch[2].trim()
  const homeTeam = headerMatch[3].trim()

  // Map sport label to sport key
  const sportMap: Record<string, string> = {
    'NBA': 'basketball_nba',
    'NFL': 'americanfootball_nfl',
    'MLB': 'baseball_mlb',
    'NHL': 'icehockey_nhl',
    'NCAAB': 'basketball_ncaab',
    'NCAAF': 'americanfootball_ncaaf',
  }
  const sport = sportMap[sportLabel] || 'basketball_nba'

  // Extract game time
  const gameTimePattern = /\*\*Game Time:\*\*\s+([^\n]+)/
  const timeMatch = text.match(gameTimePattern)
  const gameTime = timeMatch ? timeMatch[1].trim() : ''

  // Find table section
  const tablePattern = /\|\s*Market\s*\|\s*Team\s*\|(.+)\n\|[\s-|]+\n((?:\|[^\n]+\n)+)/
  const tableMatch = text.match(tablePattern)

  if (!tableMatch) return null

  // Extract bookmaker names and URLs from header
  const bookmakerHeader = tableMatch[1]
  const bookmakerData = bookmakerHeader
    .split('|')
    .map(b => b.trim())
    .filter(b => b.length > 0)
    .map(bookmakerStr => {
      // Parse markdown link format: [Name](URL)
      const linkMatch = bookmakerStr.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (linkMatch) {
        return {
          name: linkMatch[1].trim(),
          url: linkMatch[2].trim()
        }
      }
      // Plain text bookmaker (no link)
      return {
        name: bookmakerStr,
        url: undefined
      }
    })

  const bookmakers = bookmakerData.map(b => b.name)
  const bookmakerUrls = new Map(bookmakerData.map(b => [b.name, b.url]))

  // Parse table rows
  const tableRows = tableMatch[2]
  const markets: ParsedGameOdds['markets'] = {}

  type MarketKey = 'moneyline' | 'spreads' | 'totals'

  const normalizeMarketType = (marketType: string): MarketKey | null => {
    const cleaned = marketType
      .replace(/&nbsp;|&#160;|\u00a0/gi, '')
      .trim()
      .toLowerCase()

    if (!cleaned) return null
    if (cleaned === 'moneyline' || cleaned === 'h2h') return 'moneyline'
    if (cleaned === 'spread' || cleaned === 'spreads') return 'spreads'
    if (cleaned === 'total' || cleaned === 'totals') return 'totals'
    return null
  }

  const rowPattern = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|(.+)\|/g
  let rowMatch: RegExpExecArray | null
  let lastMarketKey: MarketKey | null = null

  while ((rowMatch = rowPattern.exec(tableRows)) !== null) {
    const marketTypeRaw = rowMatch[1]
    const normalizedMarket = normalizeMarketType(marketTypeRaw)
    const marketKey: MarketKey | null = normalizedMarket || lastMarketKey
    if (!marketKey) continue
    lastMarketKey = marketKey

    const teamName = rowMatch[2].trim()
    const oddsValues = rowMatch[3]
      .split('|')
      .map(v => v.trim())
      .filter(v => v.length > 0)

    // Initialize market if not exists
    if (!markets[marketKey]) {
      markets[marketKey] = { outcomes: [] }
    }

    // Find or create outcome for this team
    let outcome = markets[marketKey]!.outcomes.find(o => o.label === teamName)
    if (!outcome) {
      outcome = { label: teamName, bookmakers: {} }
      markets[marketKey]!.outcomes.push(outcome)
    }

    // Parse odds for each bookmaker
    for (let i = 0; i < Math.min(bookmakers.length, oddsValues.length); i++) {
      const bookmakerName = bookmakers[i]
      const oddsStr = oddsValues[i]

      if (!oddsStr || oddsStr === '?' || oddsStr === 'N/A') continue

      // Parse different formats:
      // Moneyline: "-110" or "+150"
      // Spread: "+4.5 (-110)" or "-3.5 (+105)"
      // Total: "225.5 (-110)"

      if (marketKey === 'moneyline') {
        // Simple odds: -110, +150
        const oddsMatch = oddsStr.match(/([+-]?\d+)/)
        if (oddsMatch) {
          outcome.bookmakers[bookmakerName] = {
            price: parseInt(oddsMatch[1]),
            url: bookmakerUrls.get(bookmakerName)
          }
        }
      } else if (marketKey === 'spreads') {
        // Spread format: "+4.5 (-110)"
        const spreadMatch = oddsStr.match(/([+-]?[\d.]+)\s*\(([+-]?\d+)\)/)
        if (spreadMatch) {
          outcome.bookmakers[bookmakerName] = {
            point: parseFloat(spreadMatch[1]),
            price: parseInt(spreadMatch[2]),
            url: bookmakerUrls.get(bookmakerName)
          }
        }
      } else if (marketKey === 'totals') {
        // Total format: "225.5 (-110)"
        const totalMatch = oddsStr.match(/([\d.]+)\s*\(([+-]?\d+)\)/)
        if (totalMatch) {
          outcome.bookmakers[bookmakerName] = {
            point: parseFloat(totalMatch[1]),
            price: parseInt(totalMatch[2]),
            url: bookmakerUrls.get(bookmakerName)
          }
        }
      }
    }
  }

  // Only return if we found at least one market
  if (Object.keys(markets).length === 0) return null

  // Fetch team logos
  const { awayLogo, homeLogo } = await fetchTeamLogos(sport, awayTeam, homeTeam)

  return {
    type: 'game_odds',
    sport,
    awayTeam,
    homeTeam,
    awayLogo,
    homeLogo,
    gameTime,
    markets,
    originalText: text,
  }
}

/**
 * NBA team name to abbreviation mapping for ESPN logo URLs
 */
const NBA_TEAM_ABBR_MAP: Record<string, string> = {
  // Full names
  'atlanta hawks': 'ATL',
  'boston celtics': 'BOS',
  'brooklyn nets': 'BKN',
  'charlotte hornets': 'CHA',
  'chicago bulls': 'CHI',
  'cleveland cavaliers': 'CLE',
  'dallas mavericks': 'DAL',
  'denver nuggets': 'DEN',
  'detroit pistons': 'DET',
  'golden state warriors': 'GS',
  'houston rockets': 'HOU',
  'indiana pacers': 'IND',
  'la clippers': 'LAC',
  'los angeles clippers': 'LAC',
  'la lakers': 'LAL',
  'los angeles lakers': 'LAL',
  'memphis grizzlies': 'MEM',
  'miami heat': 'MIA',
  'milwaukee bucks': 'MIL',
  'minnesota timberwolves': 'MIN',
  'new orleans pelicans': 'NO',
  'new york knicks': 'NY',
  'oklahoma city thunder': 'OKC',
  'orlando magic': 'ORL',
  'philadelphia 76ers': 'PHI',
  'phoenix suns': 'PHX',
  'portland trail blazers': 'POR',
  'sacramento kings': 'SAC',
  'san antonio spurs': 'SA',
  'toronto raptors': 'TOR',
  'utah jazz': 'UTAH',
  'washington wizards': 'WSH',
}

/**
 * Get team abbreviation from team name
 */
function getTeamAbbreviation(teamName: string, sport: string): string | null {
  const normalized = teamName.toLowerCase().trim()

  if (sport === 'basketball_nba' || sport === 'nba') {
    return NBA_TEAM_ABBR_MAP[normalized] || null
  }

  // For other sports, return null for now
  return null
}

/**
 * Fetch team logos from ESPN CDN
 */
async function fetchTeamLogos(
  sport: string,
  awayTeam: string,
  homeTeam: string
): Promise<{ awayLogo?: string; homeLogo?: string }> {
  const awayAbbr = getTeamAbbreviation(awayTeam, sport)
  const homeAbbr = getTeamAbbreviation(homeTeam, sport)

  let awayLogo: string | undefined
  let homeLogo: string | undefined

  if (sport === 'basketball_nba' || sport === 'nba') {
    if (awayAbbr) {
      awayLogo = `https://a.espncdn.com/i/teamlogos/nba/500/${awayAbbr}.png`
    }
    if (homeAbbr) {
      homeLogo = `https://a.espncdn.com/i/teamlogos/nba/500/${homeAbbr}.png`
    }
  }

  return {
    awayLogo,
    homeLogo,
  }
}

/**
 * Detect if text contains formatted team insights table
 * Pattern: | Team | Streak | Last 10 | PPG | PAPG | FG% | 3P% | REB | AST | BLK | STL |
 */
export async function detectTeamInsights(text: string): Promise<ParsedTeamInsights | null> {
  // Detect sport from the header label
  let sport = 'basketball_nba' // default
  const textLower = text.toLowerCase()

  if (textLower.includes('basketball nba') || textLower.includes('basketball_nba')) {
    sport = 'basketball_nba'
  } else if (textLower.includes('basketball ncaab') || textLower.includes('basketball_ncaab')) {
    sport = 'basketball_ncaab'
  } else if (textLower.includes('americanfootball nfl') || textLower.includes('americanfootball_nfl')) {
    sport = 'americanfootball_nfl'
  } else if (textLower.includes('americanfootball ncaaf') || textLower.includes('americanfootball_ncaaf')) {
    sport = 'americanfootball_ncaaf'
  } else if (textLower.includes('icehockey nhl') || textLower.includes('icehockey_nhl')) {
    sport = 'icehockey_nhl'
  } else if (textLower.includes('nba')) {
    sport = 'basketball_nba'
  } else if (textLower.includes('ncaab')) {
    sport = 'basketball_ncaab'
  } else if (textLower.includes('nfl')) {
    sport = 'americanfootball_nfl'
  } else if (textLower.includes('ncaaf')) {
    sport = 'americanfootball_ncaaf'
  } else if (textLower.includes('nhl')) {
    sport = 'icehockey_nhl'
  }

  const isBasketball = sport === 'basketball_nba' || sport === 'basketball_ncaab'
  const isFootball = sport === 'americanfootball_nfl' || sport === 'americanfootball_ncaaf'
  const isHockey = sport === 'icehockey_nhl'

  // Look for team insights table header (sport-specific)
  let headerPattern: RegExp
  if (isBasketball) {
    headerPattern = /\|\s*Team\s*\|\s*Streak\s*\|\s*Last\s*10\s*\|\s*PPG\s*\|\s*PAPG\s*\|\s*FG%\s*\|\s*3P%\s*\|\s*REB\s*\|\s*AST\s*\|\s*BLK\s*\|\s*STL\s*\|/i
  } else if (isFootball) {
    headerPattern = /\|\s*Team\s*\|\s*Streak\s*\|\s*Last\s*10\s*\|\s*PPG\s*\|\s*PAPG\s*\|\s*Off\s*Yds\s*\|\s*Def\s*Yds\s*\|\s*Pass\s*Yds\s*\|\s*Rush\s*Yds\s*\|\s*TO\s*\|\s*Sacks\s*\|/i
  } else if (isHockey) {
    headerPattern = /\|\s*Team\s*\|\s*Streak\s*\|\s*Last\s*10\s*\|\s*GPG\s*\|\s*GAPG\s*\|\s*Shots\s*\|\s*SA\s*\|\s*PP%\s*\|\s*PK%\s*\|\s*FOW%\s*\|\s*Hits\s*\|/i
  } else {
    return null
  }

  if (!headerPattern.test(text)) return null

  // Extract table rows (skip header and separator) - all formats have 11 columns
  const rowPattern = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g

  const matches = [...text.matchAll(rowPattern)]
  const dataRows = matches.filter(match => {
    const firstCol = match[1].trim()
    // Filter out header and separator rows
    return firstCol !== 'Team' && !firstCol.includes('-')
  })

  if (dataRows.length !== 2) return null // Expect exactly 2 teams

  const parseTeamRow = (match: RegExpMatchArray) => ({
    team: match[1].trim(),
    streak: match[2].trim(),
    last10: match[3].trim(),
    stat1: match[4].trim(),
    stat2: match[5].trim(),
    stat3: match[6].trim(),
    stat4: match[7].trim(),
    stat5: match[8].trim(),
    stat6: match[9].trim(),
    stat7: match[10].trim(),
    stat8: match[11].trim(),
  })

  const team1 = parseTeamRow(dataRows[0])
  const team2 = parseTeamRow(dataRows[1])

  // Fetch team logos
  const { awayLogo, homeLogo } = await fetchTeamLogos(sport, team1.team, team2.team)

  // Map stats to appropriate keys based on sport
  let awayStats: any
  let homeStats: any

  if (isBasketball) {
    awayStats = {
      streak: team1.streak,
      last10: team1.last10,
      ppg: team1.stat1,
      papg: team1.stat2,
      fgPct: team1.stat3,
      threePct: team1.stat4,
      reb: team1.stat5,
      ast: team1.stat6,
      blk: team1.stat7,
      stl: team1.stat8,
    }
    homeStats = {
      streak: team2.streak,
      last10: team2.last10,
      ppg: team2.stat1,
      papg: team2.stat2,
      fgPct: team2.stat3,
      threePct: team2.stat4,
      reb: team2.stat5,
      ast: team2.stat6,
      blk: team2.stat7,
      stl: team2.stat8,
    }
  } else if (isFootball) {
    awayStats = {
      streak: team1.streak,
      last10: team1.last10,
      ppg: team1.stat1,
      papg: team1.stat2,
      offYds: team1.stat3,
      defYds: team1.stat4,
      passYds: team1.stat5,
      rushYds: team1.stat6,
      takeaways: team1.stat7,
      sacks: team1.stat8,
    }
    homeStats = {
      streak: team2.streak,
      last10: team2.last10,
      ppg: team2.stat1,
      papg: team2.stat2,
      offYds: team2.stat3,
      defYds: team2.stat4,
      passYds: team2.stat5,
      rushYds: team2.stat6,
      takeaways: team2.stat7,
      sacks: team2.stat8,
    }
  } else if (isHockey) {
    awayStats = {
      streak: team1.streak,
      last10: team1.last10,
      gpg: team1.stat1,
      gapg: team1.stat2,
      shots: team1.stat3,
      shotsAllowed: team1.stat4,
      powerPlayPct: team1.stat5,
      penaltyKillPct: team1.stat6,
      faceoffWinPct: team1.stat7,
      hits: team1.stat8,
    }
    homeStats = {
      streak: team2.streak,
      last10: team2.last10,
      gpg: team2.stat1,
      gapg: team2.stat2,
      shots: team2.stat3,
      shotsAllowed: team2.stat4,
      powerPlayPct: team2.stat5,
      penaltyKillPct: team2.stat6,
      faceoffWinPct: team2.stat7,
      hits: team2.stat8,
    }
  }

  return {
    type: 'team_insights',
    sport,
    awayTeam: team1.team,
    homeTeam: team2.team,
    awayLogo,
    homeLogo,
    awayStats,
    homeStats,
    originalText: text,
  }
}

/**
 * Main function to parse stats from text
 * Returns array of detected stats (could be multiple players/teams)
 */
export async function parseStatsFromText(text: string): Promise<ParsedStats[]> {
  const results: ParsedStats[] = []

  // Extract structured props data from FULL text (if present) to avoid duplicates
  const structuredPropsMatch = text.match(/<!--\s*STRUCTURED_PROPS_DATA:(.*?)\s*-->/)
  let globalPropsData: any[] | undefined
  if (structuredPropsMatch && structuredPropsMatch[1]) {
    try {
      globalPropsData = JSON.parse(structuredPropsMatch[1])
      const playerCount = Array.isArray(globalPropsData) ? globalPropsData.length : 0
      console.log('[parseStatsFromText] Found global structured props data for', playerCount, 'players')
    } catch (error) {
      console.warn('[parseStatsFromText] Failed to parse global structured props data:', error)
    }
  }

  // Split text into potential stat blocks (separated by blank lines)
  const blocks = text.split(/\n\s*\n/)

  for (const block of blocks) {
    if (typeof block === 'string') {
      // Check for game odds first (most specific with header pattern)
      const gameOdds = await detectGameOdds(block)
      if (gameOdds) {
        results.push(gameOdds)
        continue
      }

      // Check for team insights
      const teamInsights = await detectTeamInsights(block)
      if (teamInsights) {
        results.push(teamInsights)
        continue
      }

      // Check for player props - pass global structured data if available
      const playerProps = await detectPlayerProps(block, globalPropsData)
      if (playerProps) {
        results.push(playerProps)
        continue
      }

      // Then check for player stats
      const playerStats = await detectPlayerStats(block)
      if (playerStats) {
        results.push(playerStats)
        continue
      }

      // Finally check for team stats
      const teamStats = detectTeamStats(block)
      if (teamStats) {
        results.push(teamStats)
      }
    }
  }

  return results
}

/**
 * Remove stats text from original message to avoid duplication
 */
export function removeStatsFromText(text: string, parsedStats: ParsedStats[]): string {
  let cleaned = text

  for (const stat of parsedStats) {
    // Remove the original text block
    cleaned = cleaned.replace(stat.originalText, '').trim()
  }

  // Remove the HTML comment containing structured props data
  cleaned = cleaned.replace(/<!--\s*STRUCTURED_PROPS_DATA:[\s\S]*?-->/g, '').trim()

  // Clean up extra newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  return cleaned
}
