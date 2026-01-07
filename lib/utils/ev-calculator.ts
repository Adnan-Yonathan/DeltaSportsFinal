/**
 * Expected Value (EV) Calculator for Cross-Market Analysis
 *
 * Identifies +EV opportunities where sportsbooks disagree on odds,
 * allowing bettors to find value by betting at outlier books.
 */

import { americanToDecimal, impliedProbability, formatAmericanOdds } from './odds'

export interface BookOdds {
  bookmaker: string
  odds: number // American odds
  point?: number // For spreads/totals
}

export interface MarketConsensus {
  averageOdds: number
  medianOdds: number
  impliedProbability: number // Based on average odds
  bookCount: number
}

export interface EVOpportunity {
  game: string
  gameId: string
  market: string
  selection: string
  point?: number
  bestBook: string
  bestOdds: number
  consensus: MarketConsensus
  ev: number // Expected value percentage
  edgePercent: number // How much better than consensus
  allBooks: BookOdds[]
  commenceTime: string
}

/**
 * Calculate implied probability from American odds
 * Returns as decimal (0-1) not percentage
 */
export function calculateImpliedProbabilityDecimal(americanOdds: number): number {
  return impliedProbability(americanOdds) / 100
}

/**
 * Calculate expected value for a bet (1-unit stake)
 * EV = (p × profit) - ((1 - p) × stake)
 * @param trueProbability - The "true" probability (from market consensus)
 * @param americanOdds - The odds being offered
 * @returns EV as a percentage (positive = +EV)
 */
export function calculateEV(trueProbability: number, americanOdds: number): number {
  if (!Number.isFinite(trueProbability) || !Number.isFinite(americanOdds)) {
    return 0
  }
  const stake = 1
  const odds = Number(americanOdds)
  const profit =
    odds > 0 ? odds / 100 : odds < 0 ? 100 / Math.abs(odds) : 0
  const ev = trueProbability * profit - (1 - trueProbability) * stake
  return ev * 100
}

/**
 * Calculate market consensus from multiple bookmaker odds
 */
export function findMarketConsensus(bookOdds: BookOdds[]): MarketConsensus {
  if (bookOdds.length === 0) {
    return {
      averageOdds: 0,
      medianOdds: 0,
      impliedProbability: 0,
      bookCount: 0,
    }
  }

  // Convert to decimal for averaging (American odds don't average linearly)
  const decimalOdds = bookOdds.map((b) => americanToDecimal(b.odds))
  const avgDecimal = decimalOdds.reduce((a, b) => a + b, 0) / decimalOdds.length

  // For median, sort and pick middle
  const sortedDecimal = [...decimalOdds].sort((a, b) => a - b)
  const mid = Math.floor(sortedDecimal.length / 2)
  const medianDecimal =
    sortedDecimal.length % 2 === 0
      ? (sortedDecimal[mid - 1] + sortedDecimal[mid]) / 2
      : sortedDecimal[mid]

  // Convert back to American for display
  const avgAmerican = decimalToAmericanSafe(avgDecimal)
  const medianAmerican = decimalToAmericanSafe(medianDecimal)

  // Implied probability from average
  const avgImpliedProb = 1 / avgDecimal

  return {
    averageOdds: avgAmerican,
    medianOdds: medianAmerican,
    impliedProbability: avgImpliedProb,
    bookCount: bookOdds.length,
  }
}

/**
 * Safe conversion from decimal to American odds
 */
function decimalToAmericanSafe(decimalOdds: number): number {
  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100)
  } else if (decimalOdds > 1) {
    return Math.round(-100 / (decimalOdds - 1))
  }
  return -110 // Default fallback
}

/**
 * Find outlier books offering significantly better odds than consensus
 * @param bookOdds - Array of odds from different books
 * @param minEVThreshold - Minimum EV% to qualify as an opportunity (default 2%)
 */
export function identifyEVOpportunities(
  bookOdds: BookOdds[],
  minEVThreshold: number = 2
): { book: BookOdds; ev: number; edge: number }[] {
  if (bookOdds.length < 2) return []

  const consensus = findMarketConsensus(bookOdds)
  const opportunities: { book: BookOdds; ev: number; edge: number }[] = []

  for (const book of bookOdds) {
    // Use consensus implied probability as "true" probability
    const ev = calculateEV(consensus.impliedProbability, book.odds)

    if (ev >= minEVThreshold) {
      // Calculate edge: difference between book's implied prob and consensus
      const bookImplied = calculateImpliedProbabilityDecimal(book.odds)
      const edge = (consensus.impliedProbability - bookImplied) * 100

      opportunities.push({ book, ev, edge })
    }
  }

  return opportunities.sort((a, b) => b.ev - a.ev)
}

/**
 * Format EV opportunity for display
 */
export function formatEVOpportunity(opp: EVOpportunity): string {
  const oddsStr = formatAmericanOdds(opp.bestOdds)
  const consensusStr = formatAmericanOdds(Math.round(opp.consensus.averageOdds))
  const pointStr = opp.point !== undefined ? ` ${opp.point > 0 ? '+' : ''}${opp.point}` : ''

  const lines = [
    `${opp.selection}${pointStr} @ ${opp.bestBook} (${oddsStr})`,
    `   Market Consensus: ${consensusStr} | EV: +${opp.ev.toFixed(1)}%`,
    `   ${opp.allBooks.length} books compared`,
  ]

  return lines.join('\n')
}

/**
 * Rank opportunities by expected value
 */
export function rankByEV(opportunities: EVOpportunity[]): EVOpportunity[] {
  return [...opportunities].sort((a, b) => b.ev - a.ev)
}
