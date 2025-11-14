import assert from 'node:assert/strict'
import { mapBookmakersIO } from '../lib/api/odds-api'

const samplePayload = {
  FanDuel: [
    {
      name: 'Moneyline',
      odds: [
        {
          home: '1.85',
          away: '2.05',
          draw: '11.0',
        },
      ],
      updatedAt: '2025-01-01T12:30:00Z',
    },
    {
      name: 'Spread',
      odds: [
        {
          home: '1.91',
          away: '1.91',
          hdp: 2.5,
        },
      ],
      updatedAt: '2025-01-01T12:31:00Z',
    },
    {
      name: 'Totals',
      odds: [
        {
          over: '1.95',
          under: '1.85',
          max: 210.5,
        },
      ],
      updatedAt: '2025-01-01T12:32:00Z',
    },
  ],
}

const bookmakers = mapBookmakersIO(samplePayload, 'Boston Celtics', 'Miami Heat')

assert.equal(bookmakers.length, 1, 'Should normalize one bookmaker')
const [fanDuel] = bookmakers
assert.equal(fanDuel.title, 'FanDuel')

const marketKeys = fanDuel.markets.map((m) => m.key).sort()
assert.deepEqual(marketKeys, ['h2h', 'spreads', 'totals'], 'Should map three standard markets')

const moneyline = fanDuel.markets.find((m) => m.key === 'h2h')
assert.ok(moneyline, 'Moneyline market should exist')
assert.ok(moneyline?.outcomes.some((o) => o.name === 'Boston Celtics'), 'Home outcome should exist')
assert.ok(moneyline?.outcomes.some((o) => o.name === 'Miami Heat'), 'Away outcome should exist')

const spreads = fanDuel.markets.find((m) => m.key === 'spreads')
assert.ok(spreads?.outcomes.every((o) => typeof o.point === 'number'), 'Spread outcomes should include points')

const totals = fanDuel.markets.find((m) => m.key === 'totals')
assert.ok(totals?.outcomes.some((o) => o.name === 'Over'), 'Totals should have Over selection')
assert.ok(totals?.outcomes.some((o) => o.name === 'Under'), 'Totals should have Under selection')

console.log('odds-api normalization tests passed')
