import assert from 'node:assert/strict'

import { buildFinalPropOrderbookItems } from '../lib/services/prop-orderbooks-selection'

type SourceKey = 'kalshi' | 'polymarket' | 'novig' | 'prophetx'

const makeItem = (
  source: SourceKey,
  id: string,
  notional: number,
  sportKey: string = 'basketball_nba'
) => ({
  id,
  source,
  sportKey,
  marketTitle: id,
  sharpLiquidityNotional: notional,
  sides: [],
})

const kalshi = Array.from({ length: 60 }, (_, idx) =>
  makeItem('kalshi', `kalshi-${idx + 1}`, 2200 - idx * 15)
)
const polymarket = Array.from({ length: 120 }, (_, idx) =>
  makeItem('polymarket', `poly-${idx + 1}`, 80 - idx * 0.5)
)

const selected = buildFinalPropOrderbookItems({
  sportFilter: 'all',
  requestedLimit: 80,
  kalshiItems: kalshi,
  polymarketItems: polymarket,
  exchangeItems: [],
})

assert.equal(selected.length, 80, 'Selection should respect requested limit')
const kalshiCount = selected.filter((item) => item.source === 'kalshi').length
assert.ok(
  kalshiCount >= 60,
  `Expected high-liquidity Kalshi entries to persist, received ${kalshiCount}`
)

for (const item of kalshi) {
  assert.ok(
    selected.some((selectedItem) => selectedItem.id === item.id),
    `Expected pinned Kalshi item to remain: ${item.id}`
  )
}

console.log('prop orderbooks selection tests passed')
