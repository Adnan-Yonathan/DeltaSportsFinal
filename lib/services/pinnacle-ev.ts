/**
 * Pinnacle-Based EV Calculator
 *
 * Uses Pinnacle as the sharp baseline for calculating expected value.
 * Pinnacle is widely considered the sharpest bookmaker with the lowest vig,
 * making their lines the closest to "true" probability.
 */

import { fetchOdds } from '@/lib/api/odds-api'
import { americanToDecimal, impliedProbability } from '@/lib/utils/odds'
import { AVAILABLE_BOOKS, getBookApiKeys, type BookKey } from '@/lib/config/books'

export interface PinnacleEVOpportunity {
  game: string
  gameId: string
  homeTeam: string
  awayTeam: string
  market: string // h2h, spreads, totals
  selection: string
  point?: number

  // Pinnacle reference (sharp baseline)
  pinnacleOdds: number
  pinnacleImpliedProb: number

  // User's book (where to bet)
  betBook: string
  betOdds: number
  betImpliedProb: number

  // EV calculation
  ev: number // Percentage
  edge: number // Prob difference in percentage points

  commenceTime: string
  sport: string
}

export interface FindPinnacleEVOptions {
  sports: string[]
  userBooks: BookKey[] // Books user bets at
  minEV?: number // Minimum EV% threshold (default 2)
  markets?: string[]
  includeProps?: boolean
}

const PINNACLE_BOOK_KEY = 'pinnacle'
const PINNACLE_API_KEY = 'pinnacle'

const SUPPORTED_SPORTS = [
  'basketball_nba',
  'basketball_ncaab',
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'icehockey_nhl',
  'baseball_mlb',
]

const DEFAULT_MARKETS = ['h2h', 'spreads', 'totals']

/**
 * Calculate EV using Pinnacle's implied probability as the true probability
 */
function calculatePinnacleEV(pinnacleProbability: number, betOdds: number): number {
  if (!Number.isFinite(pinnacleProbability) || !Number.isFinite(betOdds)) {
    return 0
  }
  const stake = 1
  const profit = betOdds > 0 ? betOdds / 100 : betOdds < 0 ? 100 / Math.abs(betOdds) : 0
  const ev = pinnacleProbability * profit - (1 - pinnacleProbability) * stake
  return ev * 100
}

/**
 * Remove vig from Pinnacle odds to get fair probability
 * Using the basic method: divide each implied prob by total implied prob
 */
function devigorize(odds1: number, odds2: number): { fairProb1: number; fairProb2: number } {
  const implied1 = impliedProbability(odds1) / 100
  const implied2 = impliedProbability(odds2) / 100
  const total = implied1 + implied2

  if (total === 0) return { fairProb1: 0.5, fairProb2: 0.5 }

  return {
    fairProb1: implied1 / total,
    fairProb2: implied2 / total,
  }
}

/**
 * Normalize bookmaker name for matching
 */
function normalizeBookName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Check if a book name matches a target book key
 */
function bookMatches(bookName: string, targetKey: string): boolean {
  const normalized = normalizeBookName(bookName)
  const targetNormalized = normalizeBookName(targetKey)

  // Direct match
  if (normalized === targetNormalized) return true

  // Common variations
  const variations: Record<string, string[]> = {
    pinnacle: ['pinnacle', 'pinnaclesports'],
    fanduel: ['fanduel', 'fd'],
    draftkings: ['draftkings', 'dk'],
    betmgm: ['betmgm', 'mgm'],
    caesars: ['caesars', 'williamhill', 'williamhillus'],
    bet365: ['bet365'],
    betrivers: ['betrivers', 'sugarhouse'],
    pointsbet: ['pointsbet', 'pointsbetus'],
  }

  const targetVariations = variations[targetNormalized] || [targetNormalized]
  return targetVariations.some((v) => normalized.includes(v) || v.includes(normalized))
}

/**
 * Find EV opportunities using Pinnacle as the sharp baseline
 */
export async function findPinnacleEVOpportunities(
  options: FindPinnacleEVOptions
): Promise<PinnacleEVOpportunity[]> {
  const { sports, userBooks, minEV = 2, markets = DEFAULT_MARKETS, includeProps = false } = options

  const opportunities: PinnacleEVOpportunity[] = []

  // Use requested sports if provided, otherwise default to core set
  const targetSports = sports.length > 0 ? sports : SUPPORTED_SPORTS.slice(0, 3)

  // Build bookmakers list: user books + pinnacle (always needed for baseline)
  const bookApiKeys = getBookApiKeys(userBooks)
  const allBooks = new Set([...bookApiKeys, PINNACLE_API_KEY])

  for (const sport of targetSports) {
    try {
      const games = await fetchOdds(sport, markets, {
        bookmakers: Array.from(allBooks).join(','),
        live: false,
        forceProvider: 'the-odds-api',
        revalidateSeconds: 600,
      })

      for (const game of games) {
        if (!game.bookmakers || game.bookmakers.length === 0) continue

        // Find Pinnacle bookmaker
        const pinnacleBook = game.bookmakers.find((bm) =>
          bookMatches(bm.title || bm.key, PINNACLE_API_KEY)
        )

        if (!pinnacleBook) continue // No Pinnacle odds, skip this game

        // Process each market
        for (const market of pinnacleBook.markets || []) {
          const marketKey = market.key

          // Skip if not in requested markets
          if (!markets.some((m) => marketKey.includes(m))) continue

          // Get Pinnacle outcomes for this market
          const pinnacleOutcomes = market.outcomes || []

          // For spreads and totals, we need pairs to devigorize
          if (marketKey === 'spreads' || marketKey === 'totals') {
            processSpreadOrTotalMarket(
              game,
              market,
              pinnacleBook,
              pinnacleOutcomes,
              userBooks,
              minEV,
              opportunities,
              sport
            )
          } else if (marketKey === 'h2h') {
            processMoneylineMarket(
              game,
              market,
              pinnacleBook,
              pinnacleOutcomes,
              userBooks,
              minEV,
              opportunities,
              sport
            )
          }
        }
      }
    } catch (error) {
      console.error(`[Pinnacle EV] Error fetching odds for ${sport}:`, error)
    }
  }

  // Sort by EV descending
  return opportunities.sort((a, b) => b.ev - a.ev)
}

function processMoneylineMarket(
  game: any,
  market: any,
  pinnacleBook: any,
  pinnacleOutcomes: any[],
  userBooks: BookKey[],
  minEV: number,
  opportunities: PinnacleEVOpportunity[],
  sport: string
) {
  if (pinnacleOutcomes.length < 2) return

  // Get home/away outcomes from Pinnacle
  const homeOutcome = pinnacleOutcomes.find(
    (o) => o.name === game.home_team || normalizeBookName(o.name) === normalizeBookName(game.home_team)
  )
  const awayOutcome = pinnacleOutcomes.find(
    (o) => o.name === game.away_team || normalizeBookName(o.name) === normalizeBookName(game.away_team)
  )

  if (!homeOutcome || !awayOutcome) return

  // Devigorize Pinnacle odds to get fair probabilities
  const { fairProb1: homeFairProb, fairProb2: awayFairProb } = devigorize(
    homeOutcome.price,
    awayOutcome.price
  )

  // Check each user book for EV opportunities
  for (const book of game.bookmakers || []) {
    // Skip Pinnacle (we're comparing against it)
    if (bookMatches(book.title || book.key, PINNACLE_API_KEY)) continue

    // Check if this book is in user's list
    const isUserBook = userBooks.some((uk) => bookMatches(book.title || book.key, uk))
    if (!isUserBook) continue

    // Find the same market in this book
    const bookMarket = book.markets?.find((m: any) => m.key === market.key)
    if (!bookMarket) continue

    for (const outcome of bookMarket.outcomes || []) {
      const isHome = outcome.name === game.home_team
      const isAway = outcome.name === game.away_team
      if (!isHome && !isAway) continue

      const fairProb = isHome ? homeFairProb : awayFairProb
      const pinnacleOdds = isHome ? homeOutcome.price : awayOutcome.price

      const ev = calculatePinnacleEV(fairProb, outcome.price)

      if (ev >= minEV) {
        const betImpliedProb = impliedProbability(outcome.price) / 100
        const edge = (fairProb - betImpliedProb) * 100

        opportunities.push({
          game: `${game.away_team} @ ${game.home_team}`,
          gameId: game.id,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          market: 'h2h',
          selection: outcome.name,
          pinnacleOdds,
          pinnacleImpliedProb: fairProb,
          betBook: book.title || book.key,
          betOdds: outcome.price,
          betImpliedProb,
          ev,
          edge,
          commenceTime: game.commence_time,
          sport,
        })
      }
    }
  }
}

function processSpreadOrTotalMarket(
  game: any,
  market: any,
  pinnacleBook: any,
  pinnacleOutcomes: any[],
  userBooks: BookKey[],
  minEV: number,
  opportunities: PinnacleEVOpportunity[],
  sport: string
) {
  // Group outcomes by point value for spreads/totals
  const outcomesByPoint = new Map<number, any[]>()

  for (const outcome of pinnacleOutcomes) {
    const point = outcome.point ?? 0
    if (!outcomesByPoint.has(point)) {
      outcomesByPoint.set(point, [])
    }
    outcomesByPoint.get(point)!.push(outcome)
  }

  // Process each point value
  for (const [point, outcomes] of outcomesByPoint) {
    if (outcomes.length < 2) continue

    let side1: any, side2: any

    if (market.key === 'totals') {
      side1 = outcomes.find((o) => o.name === 'Over')
      side2 = outcomes.find((o) => o.name === 'Under')
    } else {
      // Spreads - find home and away
      side1 = outcomes.find(
        (o) => o.name === game.home_team || normalizeBookName(o.name) === normalizeBookName(game.home_team)
      )
      side2 = outcomes.find(
        (o) => o.name === game.away_team || normalizeBookName(o.name) === normalizeBookName(game.away_team)
      )
    }

    if (!side1 || !side2) continue

    const { fairProb1, fairProb2 } = devigorize(side1.price, side2.price)

    // Check each user book
    for (const book of game.bookmakers || []) {
      if (bookMatches(book.title || book.key, PINNACLE_API_KEY)) continue

      const isUserBook = userBooks.some((uk) => bookMatches(book.title || book.key, uk))
      if (!isUserBook) continue

      const bookMarket = book.markets?.find((m: any) => m.key === market.key)
      if (!bookMarket) continue

      // Find matching point value
      const bookOutcomes = (bookMarket.outcomes || []).filter(
        (o: any) => Math.abs((o.point ?? 0) - point) < 0.5
      )

      for (const outcome of bookOutcomes) {
        const isSide1 =
          market.key === 'totals'
            ? outcome.name === 'Over'
            : outcome.name === game.home_team
        const isSide2 =
          market.key === 'totals'
            ? outcome.name === 'Under'
            : outcome.name === game.away_team

        if (!isSide1 && !isSide2) continue

        const fairProb = isSide1 ? fairProb1 : fairProb2
        const pinnacleOdds = isSide1 ? side1.price : side2.price

        const ev = calculatePinnacleEV(fairProb, outcome.price)

        if (ev >= minEV) {
          const betImpliedProb = impliedProbability(outcome.price) / 100
          const edge = (fairProb - betImpliedProb) * 100

          opportunities.push({
            game: `${game.away_team} @ ${game.home_team}`,
            gameId: game.id,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            market: market.key,
            selection: outcome.name,
            point: outcome.point,
            pinnacleOdds,
            pinnacleImpliedProb: fairProb,
            betBook: book.title || book.key,
            betOdds: outcome.price,
            betImpliedProb,
            ev,
            edge,
            commenceTime: game.commence_time,
            sport,
          })
        }
      }
    }
  }
}

/**
 * Get a summary of EV opportunities by sport
 */
export function summarizeEVBySport(opportunities: PinnacleEVOpportunity[]): Record<string, number> {
  const summary: Record<string, number> = {}
  for (const opp of opportunities) {
    summary[opp.sport] = (summary[opp.sport] || 0) + 1
  }
  return summary
}

/**
 * Format EV opportunity for display
 */
export function formatPinnacleEVOpportunity(opp: PinnacleEVOpportunity): string {
  const formatOdds = (o: number) => (o > 0 ? `+${o}` : `${o}`)
  const pointStr = opp.point != null ? ` ${opp.point > 0 ? '+' : ''}${opp.point}` : ''

  return [
    `+${opp.ev.toFixed(1)}% EV | ${opp.selection}${pointStr} @ ${opp.betBook} (${formatOdds(opp.betOdds)})`,
    `Pinnacle: ${formatOdds(opp.pinnacleOdds)} (${(opp.pinnacleImpliedProb * 100).toFixed(1)}% fair)`,
    `Edge: ${opp.edge.toFixed(1)}%`,
  ].join('\n')
}
