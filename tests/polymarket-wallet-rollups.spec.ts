import assert from 'node:assert/strict'
import {
  computeRiskAdjustedScoreByWallet,
  computeSportRollupMapFromTrades,
  computeWalletRollupFromTrades,
} from '../lib/services/polymarket-wallet-rollups'

const now = Date.now()
const iso = (offsetMinutes: number) => new Date(now + offsetMinutes * 60_000).toISOString()

const trades = [
  {
    wallet: '0xabc',
    slug: 'market-1',
    event_slug: 'market-1',
    sport_label: 'NBA',
    title: 'Lakers vs Celtics',
    outcome: 'Yes',
    outcome_index: 0,
    side: 'BUY',
    size: 10,
    price: 0.4,
    trade_time: iso(-60),
    trade_ts: Math.floor((now - 60 * 60_000) / 1000),
  },
  {
    wallet: '0xabc',
    slug: 'market-1',
    event_slug: 'market-1',
    sport_label: 'NBA',
    title: 'Lakers vs Celtics',
    outcome: 'Yes',
    outcome_index: 0,
    side: 'SELL',
    size: 2,
    price: 0.6,
    trade_time: iso(-50),
    trade_ts: Math.floor((now - 50 * 60_000) / 1000),
  },
  {
    wallet: '0xabc',
    slug: 'market-1',
    event_slug: 'market-1',
    sport_label: 'NBA',
    title: 'Lakers vs Celtics',
    outcome: 'No',
    outcome_index: 1,
    side: 'BUY',
    size: 5,
    price: 0.3,
    trade_time: iso(-45),
    trade_ts: Math.floor((now - 45 * 60_000) / 1000),
  },
  {
    wallet: '0xabc',
    slug: 'market-2',
    event_slug: 'market-2',
    sport_label: 'NFL',
    title: 'Chiefs vs Bills',
    outcome: 'Over',
    outcome_index: 0,
    side: 'BUY',
    size: 4,
    price: 0.55,
    trade_time: iso(-30),
    trade_ts: Math.floor((now - 30 * 60_000) / 1000),
  },
]

const outcomesBySlug = new Map([
  [
    'market-1',
    {
      slug: 'market-1',
      resolved: true,
      winning_outcome_index: 0,
      resolved_at: iso(-20),
    },
  ],
])

const result = computeWalletRollupFromTrades(trades, outcomesBySlug)

assert.equal(result.marketsResolved, 1)
assert.equal(result.totalWins, 1)
assert.equal(result.totalLosses, 0)
assert.equal(result.totalPushes, 0)
assert.equal(result.settledTrades, 3)
assert.equal(result.openPositionsCount, 1)

assert.ok(Math.abs(result.totalRealizedPnl - 3.7) < 1e-6, `expected totalRealizedPnl ~3.7, got ${result.totalRealizedPnl}`)
assert.ok(Math.abs(result.grossProfit - 5.2) < 1e-6, `expected grossProfit ~5.2, got ${result.grossProfit}`)
assert.ok(Math.abs(result.grossLoss - 1.5) < 1e-6, `expected grossLoss ~1.5, got ${result.grossLoss}`)
assert.ok(Math.abs(result.openNotional - 2.2) < 1e-6, `expected openNotional ~2.2, got ${result.openNotional}`)
assert.ok(Math.abs(result.roiLifetime - 0.480519) < 1e-4, `expected roiLifetime ~0.4805, got ${result.roiLifetime}`)
assert.ok(Math.abs(result.profitFactor - 3.466667) < 1e-4, `expected profitFactor ~3.4667, got ${result.profitFactor}`)

const open = result.openPositionRows[0] as Record<string, unknown>
assert.equal(open.slug, 'market-2')
assert.ok(Math.abs(Number(open.net_shares) - 4) < 1e-6)
assert.ok(Math.abs(Number(open.stake_usd) - 2.2) < 1e-6)
assert.ok(Math.abs(Number(open.potential_payout_usd) - 4) < 1e-6)

const noisyTrades = [
  ...trades,
  {
    wallet: '0xabc',
    slug: 'market-3',
    event_slug: 'market-3',
    sport_label: 'POLITICS',
    title: 'Election market',
    outcome: 'Candidate A',
    outcome_index: 0,
    side: 'BUY',
    size: 12,
    price: 0.5,
    trade_time: iso(-25),
    trade_ts: Math.floor((now - 25 * 60_000) / 1000),
  },
  {
    wallet: '0xabc',
    slug: 'market-4',
    event_slug: 'market-4',
    sport_label: 'ESPORTS',
    title: 'CS2 Final',
    outcome: 'Team A',
    outcome_index: 0,
    side: 'BUY',
    size: 8,
    price: 0.45,
    trade_time: iso(-22),
    trade_ts: Math.floor((now - 22 * 60_000) / 1000),
  },
] as any[]

const sportRollups = computeSportRollupMapFromTrades(noisyTrades, outcomesBySlug as any)
assert.ok(sportRollups.has('NBA'))
assert.ok(sportRollups.has('NFL'))
assert.ok(sportRollups.has('ESPORTS'))
assert.equal(sportRollups.has('POLITICS' as any), false)

const nbaRollup = sportRollups.get('NBA')
assert.ok(nbaRollup, 'expected NBA sport rollup')
assert.ok(
  Math.abs((nbaRollup?.totalRealizedPnl ?? 0) - 3.7) < 1e-6,
  `expected NBA totalRealizedPnl ~3.7, got ${nbaRollup?.totalRealizedPnl}`
)

const scoreMap = computeRiskAdjustedScoreByWallet([
  {
    wallet: 'wallet-a',
    trackingState: 'auto',
    computation: {
      ...result,
      totalRealizedPnl: 2000,
      roiLifetime: 0.21,
      consistency90d: 0.71,
      sampleQuality: 0.82,
      profitFactor: 2.4,
      maxDrawdown: 220,
    },
  },
  {
    wallet: 'wallet-b',
    trackingState: 'auto',
    computation: {
      ...result,
      totalRealizedPnl: 600,
      roiLifetime: 0.08,
      consistency90d: 0.45,
      sampleQuality: 0.63,
      profitFactor: 1.2,
      maxDrawdown: 900,
    },
  },
])

assert.ok(
  (scoreMap.get('wallet-a') ?? 0) > (scoreMap.get('wallet-b') ?? 0),
  'expected higher sport-context metrics to produce higher risk score'
)

console.log('polymarket-wallet-rollups tests passed')
