import assert from 'node:assert/strict'
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

console.log('nfl-draft-feed-classification tests passed')
