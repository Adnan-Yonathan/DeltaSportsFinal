/**
 * Cross-Market EV Service
 *
 * Scans betting markets across multiple sportsbooks to find +EV opportunities
 * where books disagree significantly on odds.
 */

import { fetchOdds } from '@/lib/api/odds-api'
import { fetchSbdPlayerProps, type SbdLeague } from '@/lib/api/sbd'
import { OddsGame, Bookmaker, OddsMarket, MARKETS, SPORTS } from '@/lib/types/odds'
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
  minEV?: number // Minimum EV threshold (default 2%)
  minBooks?: number // Minimum books required for consensus (default 3)
  markets?: string[] // Which markets to include
  limit?: number // Max opportunities to return
  includeProps?: boolean // Include player props (today only)
  propMarkets?: string[] // Which prop markets to include
}

const DEFAULT_OPTIONS: Required<CrossMarketEVOptions> = {
  sports: [SPORTS.NBA, SPORTS.NFL, SPORTS.MLB, SPORTS.NHL],
  minEV: 2,
  minBooks: 3,
  markets: [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS],
  limit: 20,
  includeProps: true,
  propMarkets: ['points', 'rebounds', 'assists', 'threes'],
}

// Map sport keys to SBD league format
const SPORT_TO_SBD_LEAGUE: Record<string, SbdLeague> = {
  [SPORTS.NBA]: 'nba',
  [SPORTS.NFL]: 'nfl',
  [SPORTS.MLB]: 'mlb',
  [SPORTS.NHL]: 'nhl',
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
  if (opts.includeProps) {
    const propOpportunities = await findPlayerPropEVOpportunities(
      opts.sports,
      opts.minEV,
      opts.minBooks,
      opts.propMarkets
    )
    allOpportunities.push(...propOpportunities)
  }

  // Rank by EV and limit results
  const ranked = rankByEV(allOpportunities)
  return ranked.slice(0, opts.limit)
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

    for (const [selectionKey, bookOdds] of outcomesBySelection.entries()) {
      // Skip if not enough books for reliable consensus
      if (bookOdds.length < minBooks) {
        continue
      }

      const consensus = findMarketConsensus(bookOdds)

      // Find the best odds available
      const bestBook = bookOdds.reduce((best, current) =>
        current.odds > best.odds ? current : best
      )

      // Calculate EV using consensus probability
      const ev = calculateEV(consensus.impliedProbability, bestBook.odds)

      // Debug: Log promising opportunities (EV > 0)
      if (ev > 0) {
        console.log(`[CROSS-MARKET-EV] ${selectionKey}: best=${bestBook.bookmaker} ${bestBook.odds}, consensus=${consensus.averageOdds.toFixed(0)}, EV=${ev.toFixed(2)}%, books=${bookOdds.length}`)
      }

      if (ev >= minEV) {
        // Parse selection key to extract name and point
        const { name, point } = parseSelectionKey(selectionKey)

        // Calculate edge
        const bestImplied = calculateImpliedProbabilityDecimal(bestBook.odds)
        const edgePercent = (consensus.impliedProbability - bestImplied) * 100

        opportunities.push({
          game: gameDescription,
          gameId: game.id,
          market: formatMarketName(marketKey),
          selection: name,
          point,
          bestBook: bestBook.bookmaker,
          bestOdds: bestBook.odds,
          consensus,
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
      const selectionKey =
        outcome.point !== undefined ? `${outcome.name}_${outcome.point}` : outcome.name

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
 * Find +EV opportunities in player props (today's games only)
 */
async function findPlayerPropEVOpportunities(
  sports: string[],
  minEV: number,
  minBooks: number,
  propMarkets: string[]
): Promise<EVOpportunity[]> {
  const opportunities: EVOpportunity[] = []

  for (const sport of sports) {
    const league = SPORT_TO_SBD_LEAGUE[sport]
    if (!league) continue

    try {
      // Fetch player props from SBD
      const propsData = await fetchSbdPlayerProps(league, {
        markets: propMarkets,
        limit: 100, // Limit to prevent huge payloads
      })

      if (!propsData || !Array.isArray(propsData)) {
        console.log(`[CROSS-MARKET-EV] No props data for ${league}`)
        continue
      }

      // Filter to today's games only
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

      for (const prop of propsData) {
        // Check if game is today
        const gameTime = prop.game_time ? new Date(prop.game_time) : null
        if (gameTime && (gameTime < todayStart || gameTime >= todayEnd)) {
          continue
        }

        // Collect odds from different books for this prop
        const bookOdds: BookOdds[] = []
        const books = prop.books || prop.sportsbooks || []

        for (const book of books) {
          const bookName = book.name || book.book || book.sportsbook
          const overOdds = book.over_odds || book.over || book.odds_over
          const underOdds = book.under_odds || book.under || book.odds_under
          const line = book.line || book.point || prop.line

          if (overOdds && bookName) {
            bookOdds.push({
              bookmaker: bookName,
              odds: overOdds,
              point: line,
            })
          }
        }

        if (bookOdds.length < minBooks) continue

        // Calculate consensus and find best odds
        const consensus = findMarketConsensus(bookOdds)
        const bestBook = bookOdds.reduce((best, current) =>
          current.odds > best.odds ? current : best
        )

        const ev = calculateEV(consensus.impliedProbability, bestBook.odds)

        if (ev >= minEV) {
          const playerName = prop.player_name || prop.player || 'Unknown'
          const propType = prop.market || prop.prop_type || prop.stat || 'Prop'
          const line = bestBook.point || prop.line || 0
          const gameDesc = prop.matchup || prop.game || `${prop.away_team || ''} @ ${prop.home_team || ''}`

          const bestImplied = calculateImpliedProbabilityDecimal(bestBook.odds)
          const edgePercent = (consensus.impliedProbability - bestImplied) * 100

          opportunities.push({
            game: gameDesc.trim() || 'Today',
            gameId: prop.game_id || prop.event_id || '',
            market: `${playerName} ${propType}`,
            selection: 'Over',
            point: line,
            bestBook: bestBook.bookmaker,
            bestOdds: bestBook.odds,
            consensus,
            ev: Math.round(ev * 10) / 10,
            edgePercent: Math.round(edgePercent * 10) / 10,
            allBooks: bookOdds,
            commenceTime: prop.game_time || new Date().toISOString(),
          })
        }
      }

      console.log(`[CROSS-MARKET-EV] Found ${opportunities.length} prop opportunities for ${league}`)
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
    lines.push('| Bet | Book | Best Odds | Consensus | EV | Edge |')
    lines.push('|-----|------|-----------|-----------|-----|------|')

    for (const opp of teamMarkets) {
      const oddsStr = formatAmericanOdds(opp.bestOdds)
      const consensusStr = formatAmericanOdds(Math.round(opp.consensus.averageOdds))
      const pointStr = opp.point !== undefined ? ` ${opp.point > 0 ? '+' : ''}${opp.point}` : ''
      const betDesc = `${opp.game.split(' @ ')[0]?.split(' ').pop() || opp.selection}${pointStr} (${opp.market})`

      lines.push(`| ${betDesc} | ${opp.bestBook} | ${oddsStr} | ${consensusStr} | **+${opp.ev.toFixed(1)}%** | ${opp.edgePercent.toFixed(1)}% |`)
    }
    lines.push('')
  }

  // Player props table
  if (propMarkets.length > 0) {
    lines.push('### Player Props (Today Only)\n')
    lines.push('| Player Prop | Book | Best Odds | Consensus | EV | Edge |')
    lines.push('|-------------|------|-----------|-----------|-----|------|')

    for (const opp of propMarkets) {
      const oddsStr = formatAmericanOdds(opp.bestOdds)
      const consensusStr = formatAmericanOdds(Math.round(opp.consensus.averageOdds))
      const pointStr = opp.point !== undefined ? ` o${opp.point}` : ''
      const betDesc = `${opp.market}${pointStr}`

      lines.push(`| ${betDesc} | ${opp.bestBook} | ${oddsStr} | ${consensusStr} | **+${opp.ev.toFixed(1)}%** | ${opp.edgePercent.toFixed(1)}% |`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push(`_${opportunities.length} opportunities found. EV = (Consensus Prob × Best Odds Payout) - 1_`)

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
