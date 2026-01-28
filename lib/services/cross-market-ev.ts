/**
 * Cross-Market EV Service
 *
 * Scans betting markets across multiple sportsbooks to find +EV opportunities
 * where books disagree significantly on odds.
 */

import { fetchOdds } from '@/lib/api/odds-api'
import { fetchSbdGamePropsList, fetchSbdPlayerProps, type SbdLeague } from '@/lib/api/sbd'
import { OddsGame, Bookmaker, OddsMarket, OddsOutcome, MARKETS, SPORTS } from '@/lib/types/odds'
import {
  BookOdds,
  EVOpportunity,
  findMarketConsensus,
  calculateEV,
  calculateImpliedProbabilityDecimal,
  rankByEV,
} from '@/lib/utils/ev-calculator'
import { decimalToAmerican, formatAmericanOdds } from '@/lib/utils/odds'

export interface CrossMarketEVOptions {
  sports?: string[] // Which sports to scan
  minEV?: number // Minimum EV threshold for team markets (default 3%)
  minPropEV?: number // Minimum EV threshold for player props (default 3%)
  minBooks?: number // Minimum books required for consensus (default 2)
  markets?: string[] // Which markets to include
  limit?: number // Max opportunities to return
  maxPositiveOdds?: number // Max allowed positive odds for opportunities
  includeProps?: boolean // Include player props (today only)
  propMarkets?: string[] // Which prop markets to include
  slateMode?: 'today' | 'next' | 'all' // Team market filtering mode
  date?: string // Optional YYYY-MM-DD override (America/New_York)
  timeZone?: string // Timezone for date filtering (default America/New_York)
  compareBooks?: string[] // Books to use for consensus calculation (optional)
  placeAtBooks?: string[] // Books where opportunities must exist (optional)
}

const DEFAULT_OPTIONS: Required<CrossMarketEVOptions> = {
  sports: [
    SPORTS.NBA,
    SPORTS.NCAA_BB,
    SPORTS.NCAA_FB,
    SPORTS.NFL,
    SPORTS.MLB,
    SPORTS.NHL,
  ],
  minEV: 2.5, // 2.5% for team markets
  minPropEV: 2.5, // 2.5% for player props
  minBooks: 2,
  markets: [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS],
  limit: 50, // Increased limit
  maxPositiveOdds: 1000,
  includeProps: true,
  propMarkets: [], // Empty = all markets
  slateMode: 'next',
  date: '',
  timeZone: 'America/New_York',
  compareBooks: [], // Empty = use all books for consensus
  placeAtBooks: [], // Empty = show opportunities from all books
}

const normalizeBookKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const isBookAllowed = (bookKey: string, allowedBooks: string[]): boolean => {
  if (allowedBooks.length === 0) return true
  const normalized = normalizeBookKey(bookKey)
  return allowedBooks.some(b => normalizeBookKey(b) === normalized)
}

const MAX_POSITIVE_ODDS = 1000
const MAX_ODDS = 100000

const withinOddsCaps = (odds: number, maxPositiveOdds: number): boolean => {
  if (!Number.isFinite(odds)) return false
  if (odds > MAX_ODDS) return false
  if (odds > 0 && odds > maxPositiveOdds) return false
  return true
}

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length

const buildSelectionKey = (outcome: OddsOutcome): string =>
  outcome.point !== undefined ? `${outcome.name}_${outcome.point}` : outcome.name

const isPredictionMarketBook = (bookName?: string | null) => {
  if (!bookName) return false
  const normalized = bookName.toLowerCase()
  return normalized.includes('polymarket') || normalized.includes('kalshi')
}

const resolveDateRange = (opts: { date?: string; timeZone: string }) => {
  const now = new Date()
  if (opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    const start = new Date(`${opts.date}T00:00:00-05:00`)
    const end = new Date(`${opts.date}T23:59:59-05:00`)
    return { start, end }
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: opts.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [month, day, year] = formatter.format(now).split('/')
  const today = `${year}-${month}-${day}`
  const start = new Date(`${today}T00:00:00-05:00`)
  const end = new Date(`${today}T23:59:59-05:00`)
  return { start, end }
}

const buildDateKey = (value: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(value)
    .split('/')
    .reverse()
    .join('-')

const filterGamesForSlate = (
  games: OddsGame[],
  opts: { date?: string; timeZone: string; mode: 'today' | 'next' }
): OddsGame[] => {
  const now = new Date()
  if (opts.mode === 'today') {
    const { start, end } = resolveDateRange(opts)
    return games.filter((game) => {
      const gameTime = new Date(game.commence_time)
      if (!Number.isFinite(gameTime.getTime())) return false
      return gameTime >= start && gameTime <= end && gameTime >= now
    })
  }

  const windowStart = now
  const candidates = games
    .map((game) => ({ game, time: new Date(game.commence_time) }))
    .filter(({ time }) => Number.isFinite(time.getTime()) && time >= windowStart)
  if (opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    return candidates
      .filter(({ time }) => buildDateKey(time, opts.timeZone) === opts.date)
      .map(({ game }) => game)
  }
  if (candidates.length === 0) return []

  const earliest = candidates.reduce((min, entry) =>
    entry.time < min.time ? entry : min
  )
  const targetDate = buildDateKey(earliest.time, opts.timeZone)
  return candidates
    .filter(({ time }) => buildDateKey(time, opts.timeZone) === targetDate)
    .map(({ game }) => game)
}

const filterOutLiveGames = (games: OddsGame[]) => {
  const now = new Date()
  return games.filter((game) => {
    const gameTime = new Date(game.commence_time)
    if (!Number.isFinite(gameTime.getTime())) return false
    return gameTime >= now
  })
}

const buildNoVigConsensusBySelection = (
  bookmakers: Bookmaker[],
  marketKey: string,
  compareBooks: string[] = []
): Map<string, { impliedProbability: number; bookCount: number }> => {
  const selectionProbabilities = new Map<string, number[]>()

  for (const bookmaker of bookmakers) {
    // Filter to only use compareBooks for consensus if specified
    if (!isBookAllowed(bookmaker.key, compareBooks)) continue

    const market = bookmaker.markets.find((m) => m.key === marketKey)
    if (!market) continue

    const implied = market.outcomes
      .map((outcome) => {
        const prob = calculateImpliedProbabilityDecimal(outcome.price)
        if (!Number.isFinite(prob) || prob <= 0) return null
        return { key: buildSelectionKey(outcome), prob }
      })
      .filter(Boolean) as Array<{ key: string; prob: number }>

    if (implied.length < 2) continue

    const totalProb = implied.reduce((sum, entry) => sum + entry.prob, 0)
    if (!Number.isFinite(totalProb) || totalProb <= 0) continue

    for (const entry of implied) {
      const normalized = entry.prob / totalProb
      const bucket = selectionProbabilities.get(entry.key) || []
      bucket.push(normalized)
      selectionProbabilities.set(entry.key, bucket)
    }
  }

  const consensus = new Map<string, { impliedProbability: number; bookCount: number }>()
  for (const [key, probs] of selectionProbabilities.entries()) {
    if (!probs.length) continue
    consensus.set(key, { impliedProbability: average(probs), bookCount: probs.length })
  }

  return consensus
}

// Map sport keys to SBD league format
const SPORT_TO_SBD_LEAGUE: Record<string, SbdLeague> = {
  [SPORTS.NBA]: 'nba',
  [SPORTS.NCAA_BB]: 'ncaamb',
  [SPORTS.NCAA_FB]: 'ncaafb',
  [SPORTS.NFL]: 'nfl',
  [SPORTS.MLB]: 'mlb',
  [SPORTS.NHL]: 'nhl',
}

// Sport-specific prop markets for filtering
const SPORT_PROP_MARKETS: Partial<Record<SbdLeague, string[]>> = {
  nba: ['points', 'rebounds', 'assists', 'threes', 'steals', 'blocks', 'pra', 'points_rebounds', 'points_assists', 'rebounds_assists', 'blocks_steals'],
  nfl: ['passing_yards', 'passing_touchdowns', 'passing_completions', 'passing_attempts', 'interceptions', 'rushing_yards', 'rushing_touchdowns', 'receiving_yards', 'receptions', 'receiving_touchdowns', 'anytime_td', 'carries', 'longest_rush', 'longest_reception', 'longest_completion'],
  mlb: ['hits', 'total_bases', 'rbis', 'runs', 'strikeouts', 'home_runs'],
  nhl: ['points', 'goals', 'assists', 'shots_on_goal', 'blocked_shots', 'saves', 'powerplay_points'],
  ncaamb: ['points', 'rebounds', 'assists', 'threes'],
  ncaafb: ['passing_yards', 'rushing_yards', 'receiving_yards', 'touchdowns'],
}

/**
 * Scan all markets and find +EV opportunities
 */
export async function findEVOpportunities(
  options: CrossMarketEVOptions = {}
): Promise<EVOpportunity[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const allOpportunities: EVOpportunity[] = []

  // Fetch odds for each sport in parallel
  const sportPromises = opts.sports.map(async (sport) => {
    try {
      const games = await fetchOdds(sport, opts.markets, {
        revalidateSeconds: 1800,
        live: false,
        forceProvider: 'sportsbettingdime',
      })
      return { sport, games }
    } catch (error) {
      console.error(`[CROSS-MARKET-EV] Failed to fetch ${sport}:`, error)
      return { sport, games: [] as OddsGame[] }
    }
  })

  const results = await Promise.all(sportPromises)
  const filteredResults = results.map(({ sport, games }) => {
    if (opts.slateMode === 'all') return { sport, games: filterOutLiveGames(games) }
    const mode = opts.slateMode === 'today' ? 'today' : 'next'
    const filtered = filterOutLiveGames(filterGamesForSlate(games, {
      date: opts.date || undefined,
      timeZone: opts.timeZone,
      mode,
    }))
    return { sport, games: filtered }
  })

  // Debug: Log what we got
  for (const { sport, games } of filteredResults) {
    console.log(`[CROSS-MARKET-EV] ${sport}: ${games.length} games`)
    if (games.length > 0) {
      const sample = games[0]
      console.log(`[CROSS-MARKET-EV] Sample: ${sample.away_team} @ ${sample.home_team}, ${sample.bookmakers.length} bookmakers`)
    }
  }

  // Analyze each game for team markets
  for (const { games } of filteredResults) {
    for (const game of games) {
      const gameOpps = analyzeGameForEV(
        game,
        opts.minEV,
        opts.minBooks,
        opts.markets,
        opts.compareBooks,
        opts.placeAtBooks
      )
      if (gameOpps.length > 0) {
        console.log(`[CROSS-MARKET-EV] Found ${gameOpps.length} opportunities in ${game.away_team} @ ${game.home_team}`)
      }
      allOpportunities.push(...gameOpps)
    }
  }

  // Fetch player props (today only) if enabled
  console.log(`[CROSS-MARKET-EV] includeProps=${opts.includeProps}, minPropEV=${opts.minPropEV}%`)
  if (opts.includeProps) {
    const propOpportunities = await findPlayerPropEVOpportunities(
      opts.sports,
      opts.minPropEV, // Use separate threshold for props
      opts.minBooks,
      opts.propMarkets
    )
    allOpportunities.push(...propOpportunities)
  }

  // Rank by EV and limit results
  const ranked = rankByEV(allOpportunities)
  const maxPositiveOdds = opts.maxPositiveOdds ?? MAX_POSITIVE_ODDS
  const filtered = ranked.filter((opp) => withinOddsCaps(opp.bestOdds, maxPositiveOdds))
  return filtered.slice(0, opts.limit)
}

/**
 * Analyze a single game for EV opportunities across all markets
 */
function analyzeGameForEV(
  game: OddsGame,
  minEV: number,
  minBooks: number,
  markets: string[],
  compareBooks: string[] = [],
  placeAtBooks: string[] = []
): EVOpportunity[] {
  const opportunities: EVOpportunity[] = []
  const gameDescription = `${game.away_team} @ ${game.home_team}`

  for (const marketKey of markets) {
    // Collect all outcomes for this market across books
    const outcomesBySelection = collectOutcomesBySelection(game.bookmakers, marketKey)
    // Build consensus using only compareBooks (if specified)
    const noVigConsensusBySelection = buildNoVigConsensusBySelection(game.bookmakers, marketKey, compareBooks)

    for (const [selectionKey, bookOdds] of outcomesBySelection.entries()) {
      // Filter bookOdds for consensus calculation
      const consensusBookOdds = compareBooks.length > 0
        ? bookOdds.filter(b => isBookAllowed(b.bookmaker, compareBooks))
        : bookOdds

      // Skip if not enough books for reliable consensus
      if (consensusBookOdds.length < minBooks) {
        continue
      }

      const consensus = findMarketConsensus(consensusBookOdds)
      const noVig = noVigConsensusBySelection.get(selectionKey)
      const consensusProbability =
        noVig && noVig.bookCount > 0
          ? noVig.impliedProbability
          : consensus.impliedProbability
      const consensusDisplayOdds =
        noVig && noVig.bookCount > 0 && consensusProbability > 0 && consensusProbability < 1
          ? decimalToAmerican(1 / consensusProbability)
          : consensus.averageOdds

      // Filter to placeAtBooks if specified, otherwise use all books
      const eligibleBookOdds = placeAtBooks.length > 0
        ? bookOdds.filter(b => isBookAllowed(b.bookmaker, placeAtBooks))
        : bookOdds

      // Skip if no eligible books have this selection
      if (eligibleBookOdds.length === 0) continue

      // Find the best odds available from eligible books
      const bestBook = eligibleBookOdds.reduce((best, current) =>
        current.odds > best.odds ? current : best
      )

      // Calculate EV using consensus probability
      const ev = calculateEV(consensusProbability, bestBook.odds)

      // Debug: Log promising opportunities (EV > 0)
      if (ev > 0) {
        console.log(`[CROSS-MARKET-EV] ${selectionKey}: best=${bestBook.bookmaker} ${bestBook.odds}, consensus=${consensus.averageOdds.toFixed(0)}, EV=${ev.toFixed(2)}%, books=${bookOdds.length}`)
      }

      if (ev >= minEV) {
        // Parse selection key to extract name and point
        const { name, point } = parseSelectionKey(selectionKey)

        // Calculate edge
        const bestImplied = calculateImpliedProbabilityDecimal(bestBook.odds)
        const edgePercent = (consensusProbability - bestImplied) * 100

        opportunities.push({
          game: gameDescription,
          gameId: game.id,
          market: formatMarketName(marketKey),
          selection: name,
          point,
          bestBook: bestBook.bookmaker,
          bestOdds: bestBook.odds,
          consensus: {
            ...consensus,
            averageOdds: consensusDisplayOdds,
            medianOdds: consensusDisplayOdds,
            impliedProbability: consensusProbability,
          },
          ev: Math.round(ev * 10) / 10,
          edgePercent: Math.round(edgePercent * 10) / 10,
          allBooks: bookOdds,
          commenceTime: game.commence_time,
        })
      }
    }
  }

  return opportunities
}

/**
 * Collect outcomes by selection across all bookmakers
 */
function collectOutcomesBySelection(
  bookmakers: Bookmaker[],
  marketKey: string
): Map<string, BookOdds[]> {
  const outcomeMap = new Map<string, BookOdds[]>()

  for (const bookmaker of bookmakers) {
    const market = bookmaker.markets.find((m) => m.key === marketKey)
    if (!market) continue

    for (const outcome of market.outcomes) {
      // Create a unique key for this selection (including point for spreads/totals)
      const selectionKey = buildSelectionKey(outcome)

      if (!outcomeMap.has(selectionKey)) {
        outcomeMap.set(selectionKey, [])
      }

      outcomeMap.get(selectionKey)!.push({
        bookmaker: bookmaker.title,
        odds: outcome.price,
        point: outcome.point,
      })
    }
  }

  return outcomeMap
}

/**
 * Parse selection key back into name and point
 */
function parseSelectionKey(key: string): { name: string; point?: number } {
  const lastUnderscore = key.lastIndexOf('_')
  if (lastUnderscore === -1) {
    return { name: key }
  }

  const potentialPoint = key.substring(lastUnderscore + 1)
  const parsed = parseFloat(potentialPoint)

  if (!isNaN(parsed)) {
    return {
      name: key.substring(0, lastUnderscore),
      point: parsed,
    }
  }

  return { name: key }
}

/**
 * Format market key to readable name
 */
function formatMarketName(marketKey: string): string {
  switch (marketKey) {
    case MARKETS.H2H:
      return 'Moneyline'
    case MARKETS.SPREADS:
      return 'Spread'
    case MARKETS.TOTALS:
      return 'Total'
    default:
      return marketKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

/**
 * Normalize market key from SBD format to standard format
 */
function normalizeMarketKey(value: string): string {
  const cleaned = value.toLowerCase().replace(/\(.*?\)/g, '').trim()

  // NBA props
  if (cleaned.includes('points plus assists plus rebounds') || cleaned.includes('pts + reb + ast')) return 'pra'
  if (cleaned.includes('points plus rebounds') || cleaned.includes('pts + reb')) return 'points_rebounds'
  if (cleaned.includes('points plus assists') || cleaned.includes('pts + ast')) return 'points_assists'
  if (cleaned.includes('rebounds plus assists') || cleaned.includes('reb + ast')) return 'rebounds_assists'
  if (cleaned.includes('blocks plus steals')) return 'blocks_steals'
  if (cleaned.includes('3-point') || cleaned.includes('three')) return 'threes'
  if (cleaned.includes('steals')) return 'steals'
  if (cleaned.includes('blocks')) return 'blocks'

  // NFL props
  if (cleaned.includes('pass completions') || cleaned.includes('passing completions')) return 'passing_completions'
  if (cleaned.includes('pass attempts') || cleaned.includes('passing attempts')) return 'passing_attempts'
  if (cleaned.includes('passing yards')) return 'passing_yards'
  if (cleaned.includes('passing tds') || cleaned.includes('passing touchdowns')) return 'passing_touchdowns'
  if (cleaned.includes('passing interceptions') || cleaned.includes('interceptions')) return 'interceptions'
  if (cleaned.includes('rushing yards')) return 'rushing_yards'
  if (cleaned.includes('rushing tds') || cleaned.includes('rushing touchdowns')) return 'rushing_touchdowns'
  if (cleaned.includes('rushing attempts') || cleaned.includes('carries')) return 'carries'
  if (cleaned.includes('longest rush')) return 'longest_rush'
  if (cleaned.includes('longest reception')) return 'longest_reception'
  if (cleaned.includes('longest passing completion') || cleaned.includes('longest completion')) return 'longest_completion'
  if (cleaned.includes('receiving yards')) return 'receiving_yards'
  if (cleaned.includes('receiving tds') || cleaned.includes('receiving touchdowns')) return 'receiving_touchdowns'
  if (cleaned.includes('receptions')) return 'receptions'
  if (cleaned.includes('anytime touchdown') || cleaned.includes('anytime td')) return 'anytime_td'

  // MLB props
  if (cleaned.includes('total bases')) return 'total_bases'
  if (cleaned.includes('hits')) return 'hits'
  if (cleaned.includes('rbis') || cleaned.includes('runs batted')) return 'rbis'
  if (cleaned.includes('runs scored') || cleaned.includes('runs')) return 'runs'
  if (cleaned.includes('strikeouts')) return 'strikeouts'
  if (cleaned.includes('home runs') || cleaned.includes('homers')) return 'home_runs'

  // NHL props
  if (cleaned.includes('power play points') || cleaned.includes('powerplay points')) return 'powerplay_points'
  if (cleaned.includes('shots on goal') || cleaned.includes('shots on goal')) return 'shots_on_goal'
  if (cleaned.includes('total shots') || (cleaned.includes('shots') && !cleaned.includes('blocked'))) return 'shots_on_goal'
  if (cleaned.includes('blocked shots')) return 'blocked_shots'
  if (cleaned.includes('saves')) return 'saves'
  if (cleaned.includes('goals')) return 'goals'

  // Generic fallbacks
  if (cleaned.includes('points')) return 'points'
  if (cleaned.includes('rebounds')) return 'rebounds'
  if (cleaned.includes('assists')) return 'assists'

  return cleaned.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/**
 * Parse American odds from various formats
 */
function parseOddsValue(value: any): number | null {
  if (value == null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  // Convert decimal odds to American if needed
  if (parsed > 1 && parsed < 10) {
    if (parsed >= 2) return Math.round((parsed - 1) * 100)
    return Math.round(-100 / (parsed - 1))
  }
  return Math.round(parsed)
}

const buildGamePropsEntriesFromSbdPlayerProps = (payload: any): any[] => {
  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : []
  const entries: any[] = []

  for (const item of items) {
    const playerName = item?.player?.name
    if (!playerName) continue
    const teamName = item?.player?.team_name || ''
    const competition = item?.competition || {}
    const markets = Array.isArray(item?.markets) ? item.markets : []

    for (const market of markets) {
      const marketName = market?.name || ''
      const books = Array.isArray(market?.books) ? market.books : []
      const sportsbooks: any[] = []

      for (const book of books) {
        const outcomes = Array.isArray(book?.outcomes) ? book.outcomes : []
        const overOutcome = outcomes.find((o: any) => o?.type === 'over')
        const underOutcome = outcomes.find((o: any) => o?.type === 'under')
        if (!overOutcome && !underOutcome) continue

        const total = overOutcome?.total ?? underOutcome?.total
        sportsbooks.push({
          name: book?.name,
          odds: {
            over_american: overOutcome?.odds_american,
            under_american: underOutcome?.odds_american,
            over_points: total,
            under_points: total,
          },
          over_points: total,
          under_points: total,
        })
      }

      if (sportsbooks.length === 0) continue

      entries.push({
        player_name: playerName,
        player: { name: playerName, team: teamName },
        name: marketName,
        sportsbooks,
        sport_event: { id: competition?.id },
        competition,
      })
    }
  }

  return entries
}

const resolvePropLine = (
  odds: any,
  sportsbook: any
): number => {
  const line =
    odds?.over_points ??
    odds?.under_points ??
    odds?.over_goals ??
    odds?.under_goals ??
    odds?.over_assists ??
    odds?.under_assists ??
    odds?.over_shots_on_goal ??
    odds?.under_shots_on_goal ??
    odds?.over_shots ??
    odds?.under_shots ??
    odds?.over_blocked_shots ??
    odds?.under_blocked_shots ??
    odds?.over_saves ??
    odds?.under_saves ??
    odds?.over_powerplay_points ??
    odds?.under_powerplay_points ??
    sportsbook?.over_points ??
    sportsbook?.under_points ??
    sportsbook?.over_goals ??
    sportsbook?.under_goals ??
    sportsbook?.over_assists ??
    sportsbook?.under_assists ??
    sportsbook?.over_shots_on_goal ??
    sportsbook?.under_shots_on_goal ??
    sportsbook?.over_shots ??
    sportsbook?.under_shots ??
    sportsbook?.over_blocked_shots ??
    sportsbook?.under_blocked_shots ??
    sportsbook?.over_saves ??
    sportsbook?.under_saves ??
    sportsbook?.over_powerplay_points ??
    sportsbook?.under_powerplay_points
  return Number(line)
}

/**
 * Find +EV opportunities in player props (today's games only)
 */
async function findPlayerPropEVOpportunities(
  sports: string[],
  minEV: number,
  minBooks: number,
  propMarkets: string[]
): Promise<EVOpportunity[]> {
  console.log(`[CROSS-MARKET-EV] findPlayerPropEVOpportunities called with minEV=${minEV}, minBooks=${minBooks}, sports=${sports.length}`)
  const opportunities: EVOpportunity[] = []

  const propsLeagues: SbdLeague[] = sports
    .map((s) => SPORT_TO_SBD_LEAGUE[s])
    .filter((league): league is SbdLeague =>
      league != null &&
      ['nba', 'nfl', 'nhl', 'ncaamb', 'ncaafb', 'mlb'].includes(league)
    )

  console.log(`[CROSS-MARKET-EV] Checking props for leagues: ${propsLeagues.join(', ')}`)

  for (const league of propsLeagues) {
    try {
      console.log(`[CROSS-MARKET-EV] Fetching player props for ${league}...`)

      // Fetch player props from SBD. NHL uses the player-props endpoint.
      let propsData: any = null
      try {
        propsData = await fetchSbdPlayerProps(league, { limit: 1500 })
      } catch (error) {
        console.warn(`[CROSS-MARKET-EV] Player props fetch failed for ${league}, falling back`, error)
        propsData = await fetchSbdGamePropsList(league)
      }

      // Handle response format
      const normalizePropsPayload = (payload: any) => {
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : []
        if (list.length === 0) {
          return buildGamePropsEntriesFromSbdPlayerProps(payload)
        }
        const sample = list[0]
        if (sample?.markets) {
          return buildGamePropsEntriesFromSbdPlayerProps(payload)
        }
        return list
      }

      const props = normalizePropsPayload(propsData)

      console.log(`[CROSS-MARKET-EV] Props response for ${league}: ${props.length} entries`)

      if (props.length === 0) {
        console.log(`[CROSS-MARKET-EV] No props data for ${league}`)
        continue
      }

      // Get allowed markets for this sport (use sport-specific or all if propMarkets is empty)
      const allowedMarkets = propMarkets.length > 0 ? propMarkets : []

      let propsProcessed = 0
      let propsWithEnoughBooks = 0
      let skippedNoPlayer = 0
      let skippedMarketFilter = 0
      let skippedNotEnoughBooks = 0
      const marketKeysSeen = new Set<string>()

      for (const entry of props) {
        // Get player name
        const playerName = entry?.player_name || entry?.player?.name
        if (!playerName) {
          skippedNoPlayer++
          continue
        }

        // Get and filter market type
        const rawMarketName = entry?.name || ''
        const marketKey = normalizeMarketKey(rawMarketName)
        marketKeysSeen.add(marketKey)

        // Only filter if we have allowed markets defined
        if (allowedMarkets.length > 0 && !allowedMarkets.includes(marketKey)) {
          skippedMarketFilter++
          continue
        }

        propsProcessed++

        // Get sportsbooks array
        const sportsbooks = entry?.sportsbooks || []
        if (!Array.isArray(sportsbooks) || sportsbooks.length < minBooks) {
          skippedNotEnoughBooks++
          continue
        }

        // Collect odds from each sportsbook, grouped by line
        // This ensures we only compare odds at the SAME line (e.g., all o2.5, not o1.5 vs o2.5)
        const oddsByLine = new Map<number, Map<string, { over?: number; under?: number }>>()

        for (const sportsbook of sportsbooks) {
          const bookName = String(sportsbook?.name || '')
          if (!bookName || bookName.toLowerCase() === 'consensus') continue

          const odds = sportsbook?.odds || {}
          const overOdds = parseOddsValue(odds?.over_american ?? odds?.over_decimal ?? sportsbook?.over_odds)
          const underOdds = parseOddsValue(
            odds?.under_american ?? odds?.under_decimal ?? sportsbook?.under_odds
          )
          const line = resolvePropLine(odds, sportsbook)

          if (Number.isFinite(line)) {
            if (!oddsByLine.has(line)) {
              oddsByLine.set(line, new Map())
            }
            const lineBooks = oddsByLine.get(line)!
            const entry = lineBooks.get(bookName) || {}
            if (overOdds && Number.isFinite(overOdds)) entry.over = overOdds
            if (underOdds && Number.isFinite(underOdds)) entry.under = underOdds
            lineBooks.set(bookName, entry)
          }
        }

        // Process each line separately - only compare books offering the SAME line
        for (const [line, lineBooks] of oddsByLine.entries()) {
          const overBookOdds: BookOdds[] = []
          const underBookOdds: BookOdds[] = []
          const noVigProbs: number[] = []

          for (const [bookName, odds] of lineBooks.entries()) {
            if (odds.over && Number.isFinite(odds.over)) {
              overBookOdds.push({
                bookmaker: bookName,
                odds: odds.over,
                point: line,
              })
            }
            if (odds.under && Number.isFinite(odds.under)) {
              underBookOdds.push({
                bookmaker: bookName,
                odds: odds.under,
                point: line,
              })
            }

            if (odds.over && odds.under) {
              const overProb = calculateImpliedProbabilityDecimal(odds.over)
              const underProb = calculateImpliedProbabilityDecimal(odds.under)
              const total = overProb + underProb
              if (Number.isFinite(total) && total > 0) {
                noVigProbs.push(overProb / total)
              }
            }
          }

          const hasEnoughOver = overBookOdds.length >= minBooks
          const hasEnoughUnder = underBookOdds.length >= minBooks
          if (!hasEnoughOver && !hasEnoughUnder) continue

          propsWithEnoughBooks += (hasEnoughOver ? 1 : 0) + (hasEnoughUnder ? 1 : 0)

          const team = entry?.player?.team || ''
          const leagueLabel = league.toUpperCase()
          const consensusOver = hasEnoughOver ? findMarketConsensus(overBookOdds) : null
          const consensusUnder = hasEnoughUnder ? findMarketConsensus(underBookOdds) : null
          const consensusOverProb = noVigProbs.length
            ? average(noVigProbs)
            : consensusOver?.impliedProbability ?? 0
          const consensusUnderProb = noVigProbs.length
            ? 1 - average(noVigProbs)
            : consensusUnder?.impliedProbability ?? 0

          if (hasEnoughOver && consensusOver) {
            const bestBook = overBookOdds.reduce((best, current) =>
              current.odds > best.odds ? current : best
            )
            const ev = calculateEV(consensusOverProb, bestBook.odds)
            if (ev >= minEV) {
              const bestImplied = calculateImpliedProbabilityDecimal(bestBook.odds)
              const edgePercent = (consensusOverProb - bestImplied) * 100
              console.log(`[CROSS-MARKET-EV] Found ${league} prop EV: ${playerName} ${marketKey} o${line} @ ${bestBook.bookmaker} ${bestBook.odds}, EV=${ev.toFixed(1)}% (${overBookOdds.length} books at same line)`)
              opportunities.push({
                game: team ? `${team} (${leagueLabel})` : leagueLabel,
                gameId: entry?.sport_event?.id || entry?.sde_id || '',
                market: `${playerName} ${marketKey}`,
                selection: 'Over',
                point: line,
                bestBook: bestBook.bookmaker,
                bestOdds: bestBook.odds,
                consensus: { ...consensusOver, impliedProbability: consensusOverProb },
                ev: Math.round(ev * 10) / 10,
                edgePercent: Math.round(edgePercent * 10) / 10,
                allBooks: overBookOdds,
                commenceTime: new Date().toISOString(),
              })
            }
          }

          if (hasEnoughUnder && consensusUnder) {
            const bestBook = underBookOdds.reduce((best, current) =>
              current.odds > best.odds ? current : best
            )
            const ev = calculateEV(consensusUnderProb, bestBook.odds)
            if (ev >= minEV) {
              const bestImplied = calculateImpliedProbabilityDecimal(bestBook.odds)
              const edgePercent = (consensusUnderProb - bestImplied) * 100
              console.log(`[CROSS-MARKET-EV] Found ${league} prop EV: ${playerName} ${marketKey} u${line} @ ${bestBook.bookmaker} ${bestBook.odds}, EV=${ev.toFixed(1)}% (${underBookOdds.length} books at same line)`)
              opportunities.push({
                game: team ? `${team} (${leagueLabel})` : leagueLabel,
                gameId: entry?.sport_event?.id || entry?.sde_id || '',
                market: `${playerName} ${marketKey}`,
                selection: 'Under',
                point: line,
                bestBook: bestBook.bookmaker,
                bestOdds: bestBook.odds,
                consensus: { ...consensusUnder, impliedProbability: consensusUnderProb },
                ev: Math.round(ev * 10) / 10,
                edgePercent: Math.round(edgePercent * 10) / 10,
                allBooks: underBookOdds,
                commenceTime: new Date().toISOString(),
              })
            }
          }
        }
      }

      console.log(`[CROSS-MARKET-EV] Props summary for ${league}:`, {
        total: props.length,
        processed: propsProcessed,
        withEnoughBooks: propsWithEnoughBooks,
        opportunities: opportunities.length,
        skipped: { noPlayer: skippedNoPlayer, marketFilter: skippedMarketFilter, notEnoughBooks: skippedNotEnoughBooks },
        marketsFound: Array.from(marketKeysSeen).slice(0, 10),
        allowedMarkets: allowedMarkets.slice(0, 5),
      })
    } catch (error) {
      console.error(`[CROSS-MARKET-EV] Failed to fetch props for ${league}:`, error)
    }
  }

  return opportunities
}

/**
 * Format EV results for chat display (table format)
 */
export function formatEVResults(opportunities: EVOpportunity[]): string {
  if (opportunities.length === 0) {
    return `No +EV opportunities found at this time.

This can happen when:
• Sportsbooks are tightly aligned on odds
• Markets are efficient (no significant disagreements)
• Limited games currently available

Try again later when more games are posted or lines are moving.`
  }

  const lines: string[] = ['## Cross-Market EV Opportunities\n']
  lines.push('_Plays where markets disagree, creating potential value._\n')

  const predictionMarkets = opportunities.filter((opp) =>
    isPredictionMarketBook(opp.bestBook)
  )
  const sportsbookMarkets = opportunities.filter(
    (opp) => !isPredictionMarketBook(opp.bestBook)
  )

  const formatSection = (title: string, entries: EVOpportunity[]) => {
    if (!entries.length) return
    lines.push(`### ${title}\n`)

    const teamMarkets = entries.filter((o) =>
      ['Moneyline', 'Spread', 'Total'].includes(o.market)
    )
    const propMarkets = entries.filter(
      (o) => !['Moneyline', 'Spread', 'Total'].includes(o.market)
    )

    if (teamMarkets.length > 0) {
      lines.push('| Matchup | Bet | Book | Best Odds | Consensus | EV |')
      lines.push('|---------|-----|------|-----------|-----------|-----|')

      for (const opp of teamMarkets) {
        const oddsStr = formatAmericanOdds(opp.bestOdds)
        const consensusStr = formatAmericanOdds(Math.round(opp.consensus.averageOdds))
        const pointStr = opp.point !== undefined ? ` ${opp.point > 0 ? '+' : ''}${opp.point}` : ''
        const betDesc = `${opp.selection}${pointStr} (${opp.market})`

        lines.push(`| ${opp.game} | ${betDesc} | ${opp.bestBook} | ${oddsStr} | ${consensusStr} | **+${opp.ev.toFixed(1)}%** |`)
      }
      lines.push('')
    }

    if (propMarkets.length > 0) {
      lines.push('#### Player Props (Today Only)\n')
      lines.push('| Player Prop | Book | Best Odds | Consensus | EV |')
      lines.push('|-------------|------|-----------|-----------|-----|')

      for (const opp of propMarkets) {
        const oddsStr = formatAmericanOdds(opp.bestOdds)
        const consensusStr = formatAmericanOdds(Math.round(opp.consensus.averageOdds))
        const pointStr = opp.point !== undefined ? ` o${opp.point}` : ''
        const betDesc = `${opp.market}${pointStr}`

        lines.push(`| ${betDesc} | ${opp.bestBook} | ${oddsStr} | ${consensusStr} | **+${opp.ev.toFixed(1)}%** |`)
      }
      lines.push('')
    }
  }

  formatSection('Prediction Market EV Spots', predictionMarkets)
  formatSection('Sportsbook EV Spots', sportsbookMarkets)

  lines.push('---')
  lines.push(
    `_${opportunities.length} opportunities found. EV = (Consensus Prob (de-vig when available) x Best Odds Payout) - 1_`
  )

  return lines.join('\n')
}

/**
 * Quick test function for development
 */
export async function testCrossMarketEV(): Promise<void> {
  console.log('[CROSS-MARKET-EV] Starting test scan...')

  try {
    const opportunities = await findEVOpportunities({
      sports: [SPORTS.NBA],
      minEV: 1.5,
      minBooks: 3,
      limit: 10,
    })

    console.log(`[CROSS-MARKET-EV] Found ${opportunities.length} opportunities`)

    if (opportunities.length > 0) {
      console.log('\n' + formatEVResults(opportunities))
    }
  } catch (error) {
    console.error('[CROSS-MARKET-EV] Test failed:', error)
  }
}
