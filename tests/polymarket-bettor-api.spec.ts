import assert from 'node:assert/strict'
import { GET as getLeaderboard } from '../app/api/polymarket/bettors/leaderboard/route'
import { GET as getFeed } from '../app/api/polymarket/bettors/feed/route'
import { GET as getPositions } from '../app/api/polymarket/bettors/[wallet]/positions/route'
import {
  ALL_SPORTS_FILTER,
  normalizePolymarketSportFilter,
} from '../lib/services/polymarket-sports'

const assertInvalidSport = async (path: string, fn: () => Promise<Response>) => {
  const response = await fn()
  assert.equal(
    response.status,
    400,
    `expected ${path} invalid sport filter to return 400`
  )
}

const run = async () => {
  assert.equal(normalizePolymarketSportFilter(undefined), ALL_SPORTS_FILTER)
  assert.equal(normalizePolymarketSportFilter('all'), ALL_SPORTS_FILTER)
  assert.equal(normalizePolymarketSportFilter('nba'), 'NBA')
  assert.equal(normalizePolymarketSportFilter('esports'), 'ESPORTS')

  await assertInvalidSport('/api/polymarket/bettors/leaderboard', async () =>
    getLeaderboard(
      new Request(
        'http://localhost/api/polymarket/bettors/leaderboard?sport=POLITICS'
      )
    )
  )

  await assertInvalidSport('/api/polymarket/bettors/feed', async () =>
    getFeed(
      new Request('http://localhost/api/polymarket/bettors/feed?sport=POLITICS')
    )
  )

  await assertInvalidSport('/api/polymarket/bettors/[wallet]/positions', async () =>
    getPositions(
      new Request(
        'http://localhost/api/polymarket/bettors/0xabc/positions?sport=POLITICS'
      ),
      { params: { wallet: '0xabc' } }
    )
  )

  console.log('polymarket-bettor-api tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
