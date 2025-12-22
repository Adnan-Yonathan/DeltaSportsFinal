/**
 * Multi-Source Betting Splits Provider
 *
 * Aggregates public betting percentages from multiple sources:
 * - SportsBettingDime (primary)
 * - ScoresAndOdds.com (secondary)
 *
 * Usage:
 *   import { aggregateBettingSplits } from '@/lib/providers/betting-splits'
 *   const result = await aggregateBettingSplits('basketball', 'nba')
 */

export * from './types'
export * from './aggregator'
export * from './scoresandodds'
export * from './mapper'

// Re-export for convenience
export { aggregateBettingSplits, getBettingSplits, testAggregator } from './aggregator'
export { scrapeScoresAndOddsSplits, testScoresAndOddsScraper } from './scoresandodds'
export { mapBettingSplitToRows, mapBettingSplitsToRows } from './mapper'
