/**
 * Odds Comparison Filter
 * Compares odds against average, Pinnacle, or specific book to find value
 */

import {
  OddsComparisonFilter,
  OddsData,
  OddsDataPoint,
  FilterExecutionContext,
} from '../research-model-types'
import { americanToDecimal, decimalToAmerican } from '@/lib/utils/odds'

/**
 * Apply odds comparison filter
 * Example: "Find spreads with odds at least +100 better than Pinnacle"
 */
export async function applyOddsComparisonFilter(
  opportunity: OddsData,
  filter: OddsComparisonFilter,
  allOddsForEvent: OddsData[],
  context: FilterExecutionContext
): Promise<boolean> {
  const { condition } = filter

  // Get all odds for the same market and selection
  const relevantOdds = allOddsForEvent.filter(
    o => o.market === opportunity.market && o.selection === opportunity.selection
  )

  if (relevantOdds.length === 0) {
    return false // No comparison data available
  }

  // Calculate comparison value based on compareAgainst
  let comparisonOdds: number | null = null

  switch (condition.compareAgainst) {
    case 'average':
      comparisonOdds = calculateAverageOdds(relevantOdds)
      break

    case 'pinnacle':
      comparisonOdds = getPinnacleOdds(relevantOdds)
      break

    case 'specific_book':
      if (!condition.book) {
        throw new Error('Book name required for specific_book comparison')
      }
      comparisonOdds = getBookOdds(relevantOdds, condition.book)
      break

    case 'consensus':
      // Consensus uses median instead of average (more robust to outliers)
      comparisonOdds = calculateMedianOdds(relevantOdds)
      break

    case 'opening':
      // TODO: Implement opening line tracking
      // For now, fall back to average
      comparisonOdds = calculateAverageOdds(relevantOdds)
      break

    default:
      throw new Error(`Unknown comparison target: ${condition.compareAgainst}`)
  }

  if (comparisonOdds === null) {
    return false // Comparison value not available
  }

  // Calculate the advantage based on metric
  const metric = condition.metric || 'american'
  const advantage = calculateOddsAdvantage(
    opportunity.odds,
    comparisonOdds,
    metric
  )

  // Apply the operator and threshold
  return evaluateComparison(advantage, condition.operator, condition.threshold)
}

/**
 * Calculate average odds across all books
 */
function calculateAverageOdds(odds: OddsData[]): number | null {
  const validOdds = odds.map(o => o.odds).filter(o => typeof o === 'number' && isFinite(o))
  if (validOdds.length === 0) return null

  const sum = validOdds.reduce((total, val) => total + val, 0)
  return sum / validOdds.length
}

/**
 * Calculate median odds (more robust to outliers)
 */
function calculateMedianOdds(odds: OddsData[]): number | null {
  const validOdds = odds.map(o => o.odds).filter(o => typeof o === 'number' && isFinite(o))
  if (validOdds.length === 0) return null

  const sorted = [...validOdds].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  } else {
    return sorted[mid]
  }
}

/**
 * Get Pinnacle odds (closing line proxy)
 */
function getPinnacleOdds(odds: OddsData[]): number | null {
  const pinnacle = odds.find(o =>
    o.book.toLowerCase().includes('pinnacle')
  )
  return pinnacle ? pinnacle.odds : null
}

/**
 * Get odds from a specific book
 */
function getBookOdds(odds: OddsData[], bookName: string): number | null {
  const normalizedSearch = bookName.toLowerCase().trim()
  const book = odds.find(o =>
    o.book.toLowerCase().includes(normalizedSearch) ||
    normalizedSearch.includes(o.book.toLowerCase())
  )
  return book ? book.odds : null
}

/**
 * Calculate odds advantage in the specified metric
 */
function calculateOddsAdvantage(
  currentOdds: number,
  comparisonOdds: number,
  metric: 'american' | 'decimal' | 'ev_percent'
): number {
  switch (metric) {
    case 'american':
      // Simple difference in American odds
      return currentOdds - comparisonOdds

    case 'decimal':
      // Convert to decimal and calculate percentage difference
      const currentDec = americanToDecimal(currentOdds)
      const comparisonDec = americanToDecimal(comparisonOdds)
      return currentDec - comparisonDec

    case 'ev_percent':
      // Calculate expected value percentage difference
      // EV% = (decimal odds * implied prob of comparison - 1) * 100
      const currentDecimal = americanToDecimal(currentOdds)
      const comparisonDecimal = americanToDecimal(comparisonOdds)
      const impliedProb = 1 / comparisonDecimal
      const ev = (currentDecimal * impliedProb - 1) * 100
      return ev

    default:
      return currentOdds - comparisonOdds
  }
}

/**
 * Evaluate comparison based on operator
 */
function evaluateComparison(
  value: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case 'gt':
      return value > threshold
    case 'gte':
      return value >= threshold
    case 'lt':
      return value < threshold
    case 'lte':
      return value <= threshold
    case 'eq':
      return Math.abs(value - threshold) < 0.01 // Allow small floating point errors
    default:
      throw new Error(`Unknown operator: ${operator}`)
  }
}
