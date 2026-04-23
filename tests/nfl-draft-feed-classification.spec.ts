import assert from 'node:assert/strict'
import {
  isNflDraftKalshiMarket,
  resolveKalshiDraftEventDate,
  resolveNflDraftKalshiSport,
} from '../lib/services/kalshi-draft'
import {
  isNflDraftPolymarketMarket,
  resolveNflDraftSportKeyFromPolymarketEvent,
} from '../lib/services/polymarket-draft'

assert.equal(
  isNflDraftPolymarketMarket('2026-pro-football-draft-3rd-overall-pick'),
  true
)
assert.equal(
  isNflDraftPolymarketMarket('Will Drew Allar be the third pick in the 2026 NFL Draft?'),
  true
)
assert.equal(isNflDraftPolymarketMarket('nba-lakers-celtics-2026-04-22'), false)

assert.equal(
  resolveNflDraftSportKeyFromPolymarketEvent({
    category: 'Sports',
    title: '2026 Pro Football Draft: 2nd Overall Pick',
    seriesSlug: 'nfl-draft',
    tags: [
      { slug: 'sports', label: 'Sports' },
      { slug: 'nfl', label: 'NFL' },
    ],
  }),
  'nfl'
)

assert.equal(
  resolveNflDraftSportKeyFromPolymarketEvent({
    category: 'Sports',
    title: 'Pro Football Draft: Any team to trade into Top 10?',
    tags: [{ slug: 'football', label: 'Football' }],
  }),
  'nfl'
)

assert.equal(
  isNflDraftPolymarketMarket('pro-football-draft-top-10-pick-traded'),
  true
)
assert.equal(
  isNflDraftPolymarketMarket('NFL Draft 2026: First Overall Pick'),
  true
)
assert.equal(isNflDraftPolymarketMarket('nfl-chiefs-broncos-2026-10-01'), false)

assert.equal(
  isNflDraftKalshiMarket('KXNFLDRAFT-FIRSTPICK', '2026 NFL Draft: First overall pick'),
  true
)
assert.equal(
  isNflDraftKalshiMarket('KXNFLGAME-26SEP14DALPHI', 'Cowboys vs Eagles'),
  false
)
assert.equal(resolveNflDraftKalshiSport('KXNFLDRAFT-FIRSTPICK'), 'NFL')
assert.equal(
  resolveKalshiDraftEventDate('2026-04-23T23:00:00Z', '2026-04-24T00:00:00Z'),
  '2026-04-23T23:00:00.000Z'
)
assert.equal(resolveKalshiDraftEventDate(undefined, null), undefined)

console.log('nfl-draft-feed-classification tests passed')
