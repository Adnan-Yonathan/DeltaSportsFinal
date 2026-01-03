/**
 * Cross-Market EV Service
 *
 * Scans betting markets across multiple sportsbooks to find +EV opportunities
 * where books disagree significantly on odds.
 */

import { fetchOdds } from '@/lib/api/odds-api'
import { fetchSbdGamePropsList, type SbdLeague } from '@/lib/api/sbd'
import { OddsGame, Bookmaker, OddsMarket, OddsOutcome, MARKETS, SPORTS } from '@/lib/types/odds'
import {
  BookOdds,
  EVOpportunity,
  findMarketConsensus,
  calculateEV,
  calculateImpliedProbabilityDecimal,
  rankByEV,
} from '@/lib/utils/ev-calculator'
import { formatAmericanOdds } from '@/lib/utils/odds'

export interface CrossMarketEVOptions {
  sports?: string[] // Which sports to scan
  minEV?: number // Minimum EV threshold for team markets (default 3%)
  minPropEV?: number // Minimum EV threshold for player props (default 3%)
  minBooks?: number // Minimum books required for consensus (default 2)
  markets?: string[] // Which markets to include
  limit?: number // Max opportunities to return
  includeProps?: boolean // Include player props (today only)
  propMarkets?: string[] // Which prop markets to include
}

const DEFAULT_OPTIONS: Required<CrossMarketEVOptions> = {
  sports: [SPORTS.NBA, SPORTS.NCAA_BB, SPORTS.NFL, SPORTS.MLB, SPORTS.NHL],
  minEV: 3, // 3% for team markets
  minPropEV: 3, // 3% for player props
  minBooks: 2,
  markets: [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS],
  limit: 50, // Increased limit
  includeProps: true,
  propMarkets: [], // Empty = all markets
}

const MAX_POSITIVE_ODDS = 500
const MAX_ODDS = 1000

const withinOddsCaps = (odds: number): boolean => {
  if (!Number.isFinite(odds)) return false
  if (odds > MAX_ODDS) return false
  if (odds > 0 && odds > MAX_POSITIVE_ODDS) return false
  return true
}

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length

const buildSelectionKey = (outcome: OddsOutcome): string =>
  outcome.point !== undefined ? `${outcome.name}_${outcome.point}` : outcome.name

const buildNoVigConsensusBySelection = (
  bookmakers: Bookmaker[],
  marketKey: string
): Map<string, { impliedProbability: number; bookCount: number }> => {
  const selectionProbabilities = new Map<string, number[]>()

  for (const bookmaker of bookmakers) {
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
  [SPORTS.NFL]: 'nfl',
  [SPORTS.MLB]: 'mlb',
  [SPORTS.NHL]: 'nhl',
}

// Sport-specific prop markets for filtering
const SPORT_PROP_MARKETS: Partial<Record<SbdLeague, string[]>> = {
  nba: ['points', 'rebounds', 'assists', 'threes', 'steals', 'blocks', 'pra', 'points_rebounds', 'points_assists', 'rebounds_assists', 'blocks_steals'],
  nfl: ['passing_yards', 'passing_touchdowns', 'passing_completions', 'passing_attempts', 'interceptions', 'rushing_yards', 'rushing_touchdowns', 'receiving_yards', 'receptions', 'receiving_touchdowns', 'anytime_td', 'carries', 'longest_rush', 'longest_reception', 'longest_completion'],
  mlb: ['hits', 'total_bases', 'rbis', 'runs', 'strikeouts', 'home_runs'],
  nhl: ['points', 'goals', 'assists', 'shots', 'blocked_shots', 'saves', 'powerplay_points'],
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
      const games = await fetchOdds(sport, opts.markets, { revalidateSeconds: 60 })
      return { sport, games }
    } catch (error) {
      console.error(`[CROSS-MARKET-EV] Failed to fetch ${sport}:`, error)
      return { sport, games: [] as OddsGame[] }
    }
  })

  const results = await Promise.all(sportPromises)

  // Debug: Log what we got
  for (const { sport, games } of results) {
    console.log(`[CROSS-MARKET-EV] ${sport}: ${games.length} games`)
    if (games.length > 0) {
      const sample = games[0]
      console.log(`[CROSS-MARKET-EV] Sample: ${sample.away_team} @ ${sample.home_team}, ${sample.bookmakers.length} bookmakers`)
    }
  }

  // Analyze each game for team markets
  for (const { sport, games } of results) {
    for (const game of games) {
      const gameOpps = analyzeGameForEV(game, opts.minEV, opts.minBooks, opts.markets)
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
  const filtered = ranked.filter((opp) => withinOddsCaps(opp.bestOdds))
  return filtered.slice(0, opts.limit)
}

/**
 * Analyze a single game for EV opportunities across all markets
 */
function analyzeGameForEV(
  game: OddsGame,
  minEV: number,
  minBooks: number,
  markets: string[]
): EVOpportunity[] {
  const opportunities: EVOpportunity[] = []
  const gameDescription = `${game.away_team} @ ${game.home_team}`

  for (const marketKey of markets) {
    // Collect all outcomes for this market across books
    const outcomesBySelection = collectOutcomesBySelection(game.bookmakers, marketKey)
    const noVigConsensusBySelection = buildNoVigConsensusBySelection(game.bookmakers, marketKey)

    for (const [selectionKey, bookOdds] of outcomesBySelection.entries()) {
      // Skip if not enough books for reliable consensus
      if (bookOdds.length < minBooks) {
        continue
      }

      const consensus = findMarketConsensus(bookOdds)
      const noVig = noVigConsensusBySelection.get(selectionKey)
      const consensusProbability =
        noVig && noVig.bookCount > 0 ? noVig.impliedProbability : consensus.impliedProbability

      // Find the best odds available
      const bestBook = bookOdds.reduce((best, current) =>
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
          consensus: { ...consensus, impliedProbability: consensusProbability },
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
  if (cleaned.includes('shots on goal')) return 'shots'
  if (cleaned.includes('total shots') || (cleaned.includes('shots') && !cleaned.includes('blocked'))) return 'shots'
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

  // Map sports to SBD leagues for props
  // MLB is in offseason, NCAAMB has no props available
  const propsLeagues: SbdLeague[] = sports
    .map((s) => SPORT_TO_SBD_LEAGUE[s])
    .filter((league): league is SbdLeague =>
      league != null && ['nba', 'nfl', 'nhl'].includes(league)
    )

  console.log(`[CROSS-MARKET-EV] Checking props for leagues: ${propsLeagues.join(', ')}`)

  for (const league of propsLeagues) {
    try {
      console.log(`[CROSS-MARKET-EV] Fetching player props for ${league}...`)

      // Fetch player props from SBD using the game props list API
      // Note: NFL/NHL APIs don't support the limit parameter (returns 500 error)
      // NBA supports limit up to 500
      const propsData = await fetchSbdGamePropsList(league, {
        ...(league === 'nba' ? { limit: 500 } : {}),
      })

      // Handle response format
      const props = Array.isArray(propsData) ? propsData : Array.isArray(propsData?.data) ? propsData.data : []

      console.log(`[CROSS-MARKET-EV] Props response for ${league}: ${props.length} entries`)

      if (props.length === 0) {
        console.log(`[CROSS-MARKET-EV] No props data for ${league}`)
        continue
      }

      // Get allowed markets for this sport (use sport-specific or all if propMarkets is empty)
      const allowedMarkets = propMarkets.length > 0 ? propMarkets : SPORT_PROP_MARKETS[league] || []

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
          const line = Number(
            odds?.over_points ??
              odds?.under_points ??
              sportsbook?.over_points ??
              sportsbook?.under_points
          )

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
          const bookOdds: BookOdds[] = []
          const noVigProbs: number[] = []

          for (const [bookName, odds] of lineBooks.entries()) {
            if (odds.over && Number.isFinite(odds.over)) {
              bookOdds.push({
                bookmaker: bookName,
                odds: odds.over,
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

          if (bookOdds.length < minBooks) {
            continue
          }

          propsWithEnoughBooks++

          // Calculate consensus and find best odds (all at the same line now)
          const consensus = findMarketConsensus(bookOdds)
          const consensusProbability = noVigProbs.length
            ? average(noVigProbs)
            : consensus.impliedProbability
          const bestBook = bookOdds.reduce((best, current) =>
            current.odds > best.odds ? current : best
          )

          const ev = calculateEV(consensusProbability, bestBook.odds)

          if (ev >= minEV) {
            const team = entry?.player?.team || ''
            const leagueLabel = league.toUpperCase()

            const bestImplied = calculateImpliedProbabilityDecimal(bestBook.odds)
            const edgePercent = (consensusProbability - bestImplied) * 100

            console.log(`[CROSS-MARKET-EV] Found ${league} prop EV: ${playerName} ${marketKey} o${line} @ ${bestBook.bookmaker} ${bestBook.odds}, EV=${ev.toFixed(1)}% (${bookOdds.length} books at same line)`)

            opportunities.push({
              game: team ? `${team} (${leagueLabel})` : leagueLabel,
              gameId: entry?.sport_event?.id || entry?.sde_id || '',
              market: `${playerName} ${marketKey}`,
              selection: 'Over',
              point: line,
              bestBook: bestBook.bookmaker,
              bestOdds: bestBook.odds,
              consensus: { ...consensus, impliedProbability: consensusProbability },
              ev: Math.round(ev * 10) / 10,
              edgePercent: Math.round(edgePercent * 10) / 10,
              allBooks: bookOdds,
              commenceTime: new Date().toISOString(),
            })
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
  lines.push('_Plays where sportsbooks disagree, creating potential value._\n')

  // Separate props from team markets for organization
  const teamMarkets = opportunities.filter(o =>
    ['Moneyline', 'Spread', 'Total'].includes(o.market)
  )
  const propMarkets = opportunities.filter(o =>
    !['Moneyline', 'Spread', 'Total'].includes(o.market)
  )

  // Team markets table
  if (teamMarkets.length > 0) {
    lines.push('### Team Markets\n')
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

  // Player props table
  if (propMarkets.length > 0) {
    lines.push('### Player Props (Today Only)\n')
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
