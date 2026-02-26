import assert from 'node:assert/strict'

import {
  parseCacheAgeMs,
  shouldPersistPropOrderbooksSnapshot,
} from '../lib/services/prop-orderbooks-cache-guard'

type SourceKey = 'kalshi' | 'polymarket' | 'novig' | 'prophetx'

const makeItem = (source: SourceKey, id: string, notional: number) => ({
  source,
  id,
  sharpLiquidityNotional: notional,
  sides: [],
})

const existing = [
  ...Array.from({ length: 40 }, (_, idx) => makeItem('kalshi', `k-${idx + 1}`, 1800 - idx * 10)),
  ...Array.from({ length: 40 }, (_, idx) =>
    makeItem('polymarket', `p-${idx + 1}`, 120 - idx)
  ),
]

const degraded = [
  ...Array.from({ length: 5 }, (_, idx) => makeItem('kalshi', `k2-${idx + 1}`, 300 - idx * 10)),
  ...Array.from({ length: 75 }, (_, idx) =>
    makeItem('polymarket', `p2-${idx + 1}`, 90 - idx * 0.5)
  ),
]

const healthy = [
  ...Array.from({ length: 34 }, (_, idx) =>
    makeItem('kalshi', `k3-${idx + 1}`, 1750 - idx * 11)
  ),
  ...Array.from({ length: 46 }, (_, idx) =>
    makeItem('polymarket', `p3-${idx + 1}`, 110 - idx * 0.8)
  ),
]

assert.equal(
  shouldPersistPropOrderbooksSnapshot(existing, degraded),
  false,
  'Degraded snapshot should not overwrite cache'
)
assert.equal(
  shouldPersistPropOrderbooksSnapshot(existing, healthy),
  true,
  'Healthy snapshot should be persisted'
)

const now = Date.now()
const tenSecondsAgoIso = new Date(now - 10_000).toISOString()
const age = parseCacheAgeMs(tenSecondsAgoIso, now)
assert.ok(age != null && age >= 9_000 && age <= 11_000, 'Cache age parser should return ms delta')
assert.equal(parseCacheAgeMs(null, now), null, 'Cache age parser should handle null values')

console.log('prop orderbooks cache guard tests passed')
