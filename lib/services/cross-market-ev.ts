/**
 * Cross-Market EV Service
 *
 * Scans betting markets across multiple sportsbooks to find +EV opportunities
 * where books disagree significantly on odds.
 */

import { fetchOdds } from '@/lib/api/odds-api'
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
}

const DEFAULT_OPTIONS: Required<CrossMarketEVOptions> = {
  sports: [SPORTS.NBA, SPORTS.NFL, SPORTS.MLB, SPORTS.NHL],
  minEV: 2,
  minBooks: 3,
  markets: [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS],
  limit: 20,
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

  // Analyze each game
  for (const { sport, games } of results) {
    for (const game of games) {
      const gameOpps = analyzeGameForEV(game, opts.minEV, opts.minBooks, opts.markets)
      if (gameOpps.length > 0) {
        console.log(`[CROSS-MARKET-EV] Found ${gameOpps.length} opportunities in ${game.away_team} @ ${game.home_team}`)
      }
      allOpportunities.push(...gameOpps)
    }
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
 * Format EV results for chat display
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

  const lines: string[] = ['**Cross-Market EV Opportunities**\n']
  lines.push('_Plays where sportsbooks disagree on odds, creating potential value._\n')

  let currentGame = ''

  for (let i = 0; i < opportunities.length; i++) {
    const opp = opportunities[i]

    // Group by game
    if (opp.game !== currentGame) {
      if (currentGame !== '') lines.push('')
      lines.push(`**${opp.game}**`)
      currentGame = opp.game
    }

    const oddsStr = formatAmericanOdds(opp.bestOdds)
    const consensusStr = formatAmericanOdds(Math.round(opp.consensus.averageOdds))
    const pointStr =
      opp.point !== undefined ? ` ${opp.point > 0 ? '+' : ''}${opp.point}` : ''

    lines.push(`${i + 1}. ${opp.selection}${pointStr} (${opp.market})`)
    lines.push(`   📍 ${opp.bestBook}: ${oddsStr}`)
    lines.push(`   📊 Consensus: ${consensusStr} (${opp.consensus.bookCount} books)`)
    lines.push(`   ✅ **EV: +${opp.ev.toFixed(1)}%**`)
  }

  lines.push('\n---')
  lines.push(
    '_EV calculated by comparing best available odds vs market consensus. Higher EV = more value._'
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
