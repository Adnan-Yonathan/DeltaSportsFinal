/**
 * Prop Value Filter
 * Filters player props based on line value, odds, and player/team criteria
 */

import {
  PropValueFilter,
  OddsData,
  PropOddsData,
  FilterExecutionContext,
} from '../research-model-types'

/**
 * Apply prop value filter
 * Example: "Find player points props over 25.5 with odds better than -110"
 */
export async function applyPropValueFilter(
  opportunity: OddsData,
  filter: PropValueFilter,
  allOddsForEvent: OddsData[],
  context: FilterExecutionContext
): Promise<boolean> {
  const { condition } = filter

  // Only applicable to prop markets
  if (!opportunity.market.includes('player') && !isPropMarket(opportunity.market)) {
    return false
  }

  // Cast to PropOddsData if it has prop fields
  const prop = opportunity as PropOddsData

  // Check prop type matches if specified
  if (condition.propType) {
    const normalizedMarket = opportunity.market.toLowerCase().replace(/_/g, ' ')
    const normalizedPropType = condition.propType.toLowerCase().replace(/_/g, ' ')

    if (!normalizedMarket.includes(normalizedPropType) && !normalizedPropType.includes(normalizedMarket)) {
      return false
    }
  }

  // Check player matches if specified
  if (condition.player && prop.player) {
    const normalizedPlayer = prop.player.toLowerCase()
    const normalizedFilter = condition.player.toLowerCase()

    // Support partial matching (e.g., "LeBron" matches "LeBron James")
    if (!normalizedPlayer.includes(normalizedFilter) && !normalizedFilter.includes(normalizedPlayer)) {
      return false
    }
  }

  // Check team matches if specified
  if (condition.team) {
    const normalizedTeam = condition.team.toLowerCase()
    const eventLower = opportunity.event.toLowerCase()

    if (!eventLower.includes(normalizedTeam)) {
      return false
    }
  }

  // Check selection matches if specified
  if (condition.selection) {
    const normalizedSelection = (opportunity.selection || '').toLowerCase()
    if (!normalizedSelection.includes(condition.selection)) {
      return false
    }
  }

  // Check line value
  if (opportunity.line !== undefined && opportunity.line !== null) {
    const linePasses = evaluateComparison(
      opportunity.line,
      condition.lineOperator,
      condition.lineValue
    )
    if (!linePasses) {
      return false
    }
  } else if (prop.propLine !== undefined && prop.propLine !== null) {
    const linePasses = evaluateComparison(
      prop.propLine,
      condition.lineOperator,
      condition.lineValue
    )
    if (!linePasses) {
      return false
    }
  } else {
    // No line available, can't evaluate
    return false
  }

  // Check odds if specified
  if (condition.oddsOperator && condition.oddsValue !== undefined) {
    const oddsPasses = evaluateComparison(
      opportunity.odds,
      condition.oddsOperator,
      condition.oddsValue
    )
    if (!oddsPasses) {
      return false
    }
  }

  return true
}

/**
 * Check if a market is a prop market
 */
function isPropMarket(market: string): boolean {
  const propKeywords = [
    'player',
    'points',
    'rebounds',
    'assists',
    'strikeouts',
    'yards',
    'touchdowns',
    'goals',
    'saves',
    'hits',
    'home_runs',
  ]

  const marketLower = market.toLowerCase()
  return propKeywords.some(keyword => marketLower.includes(keyword))
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
      return Math.abs(value - threshold) < 0.01
    default:
      throw new Error(`Unknown operator: ${operator}`)
  }
}
