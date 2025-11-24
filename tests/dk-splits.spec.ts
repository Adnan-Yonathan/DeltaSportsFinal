import assert from 'node:assert/strict'
import { inferSharpPublic, formatMarketSummary, type DraftKingsSplitMarket } from '../lib/services/dk-splits'

const makeMarket = (overrides?: Partial<DraftKingsSplitMarket>): DraftKingsSplitMarket => ({
  market: 'spread',
  outcomes: [
    { label: 'Away', ticketsPct: 70, handlePct: 45, line: -3.5 },
    { label: 'Home', ticketsPct: 30, handlePct: 55, line: 3.5 },
  ],
  ...overrides,
})

const inference = inferSharpPublic(makeMarket())
assert.equal(inference.publicSide, 'Away')
assert.equal(inference.sharpSide, 'Home')
assert.equal(inference.confidence, 'moderate')

const summary = formatMarketSummary(makeMarket(), inference)
assert.ok(summary.includes('Away'))
assert.ok(summary.includes('Home'))
assert.ok(summary.toLowerCase().includes('sharp'))
assert.ok(summary.toLowerCase().includes('public'))

const consensusInference = inferSharpPublic(
  makeMarket({
    outcomes: [
      { label: 'Away', ticketsPct: 52, handlePct: 54 },
      { label: 'Home', ticketsPct: 48, handlePct: 46 },
    ],
  })
)
assert.equal(consensusInference.confidence, 'none')

console.log('dk-splits inference tests passed')
