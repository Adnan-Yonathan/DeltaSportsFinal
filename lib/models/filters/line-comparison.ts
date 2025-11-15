/**
 * Line Comparison Filter
 * Compares spread/total lines to find better values
 */

import {
  LineComparisonFilter,
  OddsData,
  FilterExecutionContext,
} from '../research-model-types'

/**
 * Apply line comparison filter
 * Example: "Find spreads 1.0 points better than average"
 */
export async function applyLineComparisonFilter(
  opportunity: OddsData,
  filter: LineComparisonFilter,
  allOddsForEvent: OddsData[],
  context: FilterExecutionContext
): Promise<boolean> {
  const { condition } = filter

  // Only applicable to spreads and totals
  if (!['spreads', 'totals'].includes(opportunity.market)) {
    return false
  }

  // Must have a line value
  if (opportunity.line === undefined || opportunity.line === null) {
    return false
  }

  // Get all lines for the same market and selection
  const relevantOdds = allOddsForEvent.filter(
    o => o.market === opportunity.market && o.selection === opportunity.selection && o.line !== undefined
  )

  if (relevantOdds.length === 0) {
    return false // No comparison data available
  }

  // Calculate comparison line based on compareAgainst
  let comparisonLine: number | null = null

  switch (condition.compareAgainst) {
    case 'average':
      comparisonLine = calculateAverageLine(relevantOdds)
      break

    case 'pinnacle':
      comparisonLine = getPinnacleLine(relevantOdds)
      break

    case 'specific_book':
      if (!condition.book) {
        throw new Error('Book name required for specific_book comparison')
      }
      comparisonLine = getBookLine(relevantOdds, condition.book)
      break

    case 'consensus':
      // Use median for consensus (more robust to outliers)
      comparisonLine = calculateMedianLine(relevantOdds)
      break

    case 'opening':
      // TODO: Implement opening line tracking
      // For now, fall back to average
      comparisonLine = calculateAverageLine(relevantOdds)
      break

    default:
      throw new Error(`Unknown comparison target: ${condition.compareAgainst}`)
  }

  if (comparisonLine === null) {
    return false // Comparison value not available
  }

  // Calculate line advantage
  const advantage = calculateLineAdvantage(
    opportunity.line,
    comparisonLine,
    condition.marketType,
    opportunity.selection || ''
  )

  // Apply the operator and threshold
  return evaluateComparison(advantage, condition.operator, condition.threshold)
}

/**
 * Calculate average line across all books
 */
function calculateAverageLine(odds: OddsData[]): number | null {
  const validLines = odds.map(o => o.line).filter(l => typeof l === 'number' && isFinite(l)) as number[]
  if (validLines.length === 0) return null

  const sum = validLines.reduce((total, val) => total + val, 0)
  return sum / validLines.length
}

/**
 * Calculate median line (more robust to outliers)
 */
function calculateMedianLine(odds: OddsData[]): number | null {
  const validLines = odds.map(o => o.line).filter(l => typeof l === 'number' && isFinite(l)) as number[]
  if (validLines.length === 0) return null

  const sorted = [...validLines].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  } else {
    return sorted[mid]
  }
}

/**
 * Get Pinnacle line (closing line proxy)
 */
function getPinnacleLine(odds: OddsData[]): number | null {
  const pinnacle = odds.find(o => o.book.toLowerCase().includes('pinnacle'))
  return pinnacle?.line || null
}

/**
 * Get line from a specific book
 */
function getBookLine(odds: OddsData[], bookName: string): number | null {
  const normalizedSearch = bookName.toLowerCase().trim()
  const book = odds.find(o =>
    o.book.toLowerCase().includes(normalizedSearch) ||
    normalizedSearch.includes(o.book.toLowerCase())
  )
  return book?.line || null
}

/**
 * Calculate line advantage considering market type and selection
 * For spreads: More positive is better for favorites, more negative for underdogs
 * For totals: Depends on over/under selection
 */
function calculateLineAdvantage(
  currentLine: number,
  comparisonLine: number,
  marketType: 'spread' | 'total',
  selection: string
): number {
  const rawDiff = currentLine - comparisonLine

  if (marketType === 'spread') {
    // For spreads, the interpretation depends on favorite vs underdog
    // A more favorable spread for favorites is less negative (or more positive)
    // A more favorable spread for underdogs is more positive
    // We'll use absolute difference and let the user define direction in threshold
    return rawDiff
  } else {
    // For totals, depends on Over/Under
    const isOver = selection.toLowerCase().includes('over')
    const isUnder = selection.toLowerCase().includes('under')

    if (isOver) {
      // For Over bets, higher line is worse, lower is better
      return -rawDiff // Invert so positive advantage means better value
    } else if (isUnder) {
      // For Under bets, lower line is worse, higher is better
      return rawDiff
    } else {
      // If can't determine, use raw difference
      return rawDiff
    }
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
