/**
 * Test Multi-Source Betting Splits Aggregation
 *
 * Quick test script to validate the betting splits pipeline
 * without saving to database.
 *
 * Run: npm run test:betting-splits
 */

import { testAggregator } from '../lib/providers/betting-splits/aggregator'

async function main() {
  try {
    await testAggregator()
    process.exit(0)
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  }
}

main()
