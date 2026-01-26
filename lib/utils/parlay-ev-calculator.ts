/**
 * Parlay EV Calculator
 *
 * Utilities for calculating EV on parlay bets, including:
 * - Combined probability calculation
 * - Minimum odds needed for target EV
 * - Best book selection per leg
 */

import { americanToDecimal, decimalToAmerican } from './odds'
import { calculateImpliedProbabilityDecimal } from './ev-calculator'

export interface ParlayLeg {
  id: string
  game: string
  gameId: string
  market: string
  selection: string
  point?: number
  consensusProbability: number // True probability from consensus
  bestBook: string
  bestOdds: number // American odds
  allBooks: Array<{ bookmaker: string; odds: number }>
}

export interface ParlayEVResult {
  combinedProbability: number
  currentCombinedOdds: number // American odds
  minOddsForTargetEV: number // American odds needed for target EV
  currentEV: number // Current EV percentage
  evGap: number // Difference between current and min odds (in American format)
  meetsTarget: boolean
}

/**
 * Calculate combined true probability for a parlay
 * Multiplies the consensus probabilities of each leg
 */
export function calculateCombinedProbability(legs: ParlayLeg[]): number {
  if (legs.length === 0) return 0
  return legs.reduce((acc, leg) => acc * leg.consensusProbability, 1)
}

/**
 * Calculate minimum decimal odds needed to achieve target EV
 * Formula: minDecimalOdds = (1 + targetEV) / trueProbability
 *
 * @param trueProbability - Combined true probability (0-1)
 * @param targetEV - Target EV percentage (e.g., 3 for 3%)
 * @returns American odds needed for target EV
 */
export function calculateMinOddsForTargetEV(trueProbability: number, targetEV: number = 3): number {
  if (trueProbability <= 0 || trueProbability >= 1) return 0

  // Convert EV from percentage to decimal (3% -> 0.03)
  const evDecimal = targetEV / 100

  // minDecimalOdds = (1 + targetEV) / trueProbability
  const minDecimalOdds = (1 + evDecimal) / trueProbability

  return decimalToAmerican(minDecimalOdds)
}

/**
 * Calculate parlay EV given leg odds and true probability
 *
 * @param legs - Array of parlay legs
 * @param targetEV - Target EV percentage (default 3%)
 * @returns Parlay EV calculation result
 */
export function calculateParlayEV(legs: ParlayLeg[], targetEV: number = 3): ParlayEVResult {
  if (legs.length === 0) {
    return {
      combinedProbability: 0,
      currentCombinedOdds: 0,
      minOddsForTargetEV: 0,
      currentEV: 0,
      evGap: 0,
      meetsTarget: false,
    }
  }

  // Calculate combined probability
  const combinedProbability = calculateCombinedProbability(legs)

  // Calculate current combined odds (multiply decimal odds)
  const currentCombinedDecimal = legs.reduce(
    (acc, leg) => acc * americanToDecimal(leg.bestOdds),
    1
  )
  const currentCombinedOdds = decimalToAmerican(currentCombinedDecimal)

  // Calculate minimum odds for target EV
  const minOddsForTargetEV = calculateMinOddsForTargetEV(combinedProbability, targetEV)

  // Calculate current EV
  // EV = (trueProbability * decimalOdds) - 1, expressed as percentage
  const currentEV = (combinedProbability * currentCombinedDecimal - 1) * 100

  // Calculate gap (difference in American odds)
  const evGap = minOddsForTargetEV - currentCombinedOdds

  return {
    combinedProbability,
    currentCombinedOdds,
    minOddsForTargetEV,
    currentEV,
    evGap,
    meetsTarget: currentEV >= targetEV,
  }
}

/**
 * Find the best book for each leg from a list of allowed books
 *
 * @param legs - Array of parlay legs with all book odds
 * @param allowedBooks - List of book keys that are allowed
 * @returns Legs with updated bestBook and bestOdds from allowed books only
 */
export function findBestBookPerLeg(
  legs: ParlayLeg[],
  allowedBooks: string[]
): ParlayLeg[] {
  const allowedSet = new Set(allowedBooks.map(b => b.toLowerCase()))

  return legs.map(leg => {
    // Filter to only allowed books
    const filteredBooks = leg.allBooks.filter(b =>
      allowedSet.has(b.bookmaker.toLowerCase())
    )

    if (filteredBooks.length === 0) {
      return leg // Keep original if no allowed books have this bet
    }

    // Find the best odds among allowed books
    const best = filteredBooks.reduce((max, current) =>
      current.odds > max.odds ? current : max
    )

    return {
      ...leg,
      bestBook: best.bookmaker,
      bestOdds: best.odds,
    }
  })
}

/**
 * Calculate implied probability from combined parlay odds
 */
export function calculateParlayImpliedProbability(americanOdds: number): number {
  const decimal = americanToDecimal(americanOdds)
  return 1 / decimal
}

/**
 * Format probability as percentage string
 */
export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`
}

/**
 * Calculate EV for a single opportunity against consensus
 */
export function calculateOpportunityEV(
  consensusProbability: number,
  bookOdds: number
): number {
  if (!Number.isFinite(consensusProbability) || !Number.isFinite(bookOdds)) {
    return 0
  }
  const decimal = americanToDecimal(bookOdds)
  return (consensusProbability * decimal - 1) * 100
}
