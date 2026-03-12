import assert from 'node:assert/strict'
import {
  buildBettorFeedTradePayload,
  compareFeedTradeCandidates,
  diversifyFeedTradeCandidates,
  filterAndRankProfitableSummaries,
  isProfitableSummaryEligible,
  isUpcomingPolymarketEventDate,
  normalizePolymarketBettorEligibility,
} from '../lib/services/polymarket-bettor-feed'

const now = Date.now()
const isoDaysAgo = (days: number) => new Date(now - days * 24 * 60 * 60_000).toISOString()

const buildSummary = (overrides: Record<string, unknown> = {}) => ({
  wallet: '0xabc',
  total_realized_pnl: 1200,
  total_wins: 0,
  total_losses: 0,
  total_pushes: 0,
  settled_markets: 0,
  settled_trades: 0,
  gross_profit: 0,
  gross_loss: 0,
  roi_lifetime: 0.11,
  win_rate: 0,
  profit_factor: 0,
  max_drawdown: 0,
  consistency_90d: 0,
  sample_quality: 0,
  risk_adjusted_score: 50,
  qualification_status: 'watchlist' as const,
  qualification_reason: null,
  open_positions_count: 0,
  open_notional: 0,
  trade_count: 42,
  buy_trade_count: 24,
  sell_trade_count: 18,
  avg_bet_size: 180,
  median_bet_size: 140,
  last_trade_time: isoDaysAgo(7),
  last_computed_at: isoDaysAgo(1),
  ...overrides,
})

const run = async () => {
  assert.equal(normalizePolymarketBettorEligibility(undefined), 'profitable')
  assert.equal(normalizePolymarketBettorEligibility('qualified'), 'qualified')

  assert.equal(isProfitableSummaryEligible(buildSummary()), true)
  assert.equal(
    isProfitableSummaryEligible(buildSummary({ total_realized_pnl: -10 })),
    false
  )
  assert.equal(
    isProfitableSummaryEligible(buildSummary({ roi_lifetime: -0.01 })),
    false
  )
  assert.equal(
    isProfitableSummaryEligible(buildSummary({ buy_trade_count: 19 })),
    false
  )
  assert.equal(
    isProfitableSummaryEligible(buildSummary({ last_trade_time: isoDaysAgo(45) })),
    false
  )
  assert.equal(isUpcomingPolymarketEventDate('2999-12-31T20:00:00.000Z'), true)
  assert.equal(isUpcomingPolymarketEventDate('2000-01-01T20:00:00.000Z'), false)
  assert.equal(isUpcomingPolymarketEventDate('2999-12-31'), true)
  assert.equal(isUpcomingPolymarketEventDate(undefined), false)

  const ranked = filterAndRankProfitableSummaries([
    buildSummary({ wallet: 'wallet-a', roi_lifetime: 0.08, total_realized_pnl: 5000 }),
    buildSummary({ wallet: 'wallet-b', roi_lifetime: 0.22, total_realized_pnl: 1500 }),
    buildSummary({ wallet: 'wallet-c', roi_lifetime: 0.22, total_realized_pnl: 7000 }),
    buildSummary({ wallet: 'wallet-d', buy_trade_count: 10 }),
  ])

  assert.deepEqual(
    ranked.map((row) => row.wallet),
    ['wallet-c', 'wallet-b', 'wallet-a'],
    'expected profitable summaries to rank by ROI, then P/L'
  )

  const prioritizedTrades = [
    {
      row: {
        wallet: 'wallet-a',
        transaction_hash: '0x1',
        trade_time: isoDaysAgo(3),
        trade_ts: Math.floor((now - 3 * 24 * 60 * 60_000) / 1000),
        side: 'BUY' as const,
        size: 200,
        price: 0.6,
        notional: 120,
        slug: 'nba-later',
        event_slug: 'nba-later',
        title: 'Later game',
        outcome: 'Later',
        outcome_index: 0,
        sport_label: 'NBA',
      },
      eventDate: '2026-03-14T23:00:00.000Z',
    },
    {
      row: {
        wallet: 'wallet-b',
        transaction_hash: '0x2',
        trade_time: isoDaysAgo(5),
        trade_ts: Math.floor((now - 5 * 24 * 60 * 60_000) / 1000),
        side: 'BUY' as const,
        size: 500,
        price: 0.5,
        notional: 250,
        slug: 'nba-soon-big',
        event_slug: 'nba-soon-big',
        title: 'Sooner bigger game',
        outcome: 'Soon Big',
        outcome_index: 0,
        sport_label: 'NBA',
      },
      eventDate: '2026-03-11T23:00:00.000Z',
    },
    {
      row: {
        wallet: 'wallet-c',
        transaction_hash: '0x3',
        trade_time: isoDaysAgo(1),
        trade_ts: Math.floor((now - 1 * 24 * 60 * 60_000) / 1000),
        side: 'BUY' as const,
        size: 300,
        price: 0.5,
        notional: 150,
        slug: 'nba-soon-small',
        event_slug: 'nba-soon-small',
        title: 'Sooner smaller game',
        outcome: 'Soon Small',
        outcome_index: 0,
        sport_label: 'NBA',
      },
      eventDate: '2026-03-11T23:00:00.000Z',
    },
  ].sort(compareFeedTradeCandidates)

  assert.deepEqual(
    prioritizedTrades.map((entry) => entry.row.wallet),
    ['wallet-b', 'wallet-c', 'wallet-a'],
    'expected feed candidates to rank by nearest event, then biggest bet'
  )

  const payload = buildBettorFeedTradePayload({
    row: {
      wallet: 'wallet-c',
      transaction_hash: '0xhash',
      trade_time: isoDaysAgo(1),
      trade_ts: Math.floor((now - 24 * 60 * 60_000) / 1000),
      side: 'BUY',
      size: 40,
      price: 0.72,
      notional: 28.8,
      slug: 'nba-gsw-uta-2026-03-10',
      event_slug: 'nba-gsw-uta-2026-03-10',
      title: 'Golden State Warriors vs Utah Jazz',
      outcome: 'Golden State Warriors',
      outcome_index: 0,
      sport_label: 'NBA',
    },
    profile: {
      wallet: 'wallet-c',
      display_name: 'Wallet C',
    },
    sportSummary: buildSummary({
      wallet: 'wallet-c',
      roi_lifetime: 0.22,
      total_realized_pnl: 7000,
      trade_count: 120,
      buy_trade_count: 85,
      sell_trade_count: 35,
      sport_label: 'NBA',
    }),
    globalSummary: buildSummary({
      wallet: 'wallet-c',
      roi_lifetime: 0.18,
      total_realized_pnl: 12000,
      trade_count: 180,
      buy_trade_count: 110,
      sell_trade_count: 70,
    }),
    currentPriceCents: null,
    eventDate: '2026-03-10T23:00:00.000Z',
  })

  assert.equal(payload.display_name, 'Wallet C')
  assert.equal(payload.side, 'BUY')
  assert.equal(payload.entry_american_odds, -257)
  assert.equal(payload.current_price_cents, null)
  assert.equal(payload.current_american_odds, null)
  assert.equal(payload.price_move_cents, null)
  assert.equal(payload.eventDate, '2026-03-10T23:00:00.000Z')
  assert.equal(payload.trade_count, 120)
  assert.equal(payload.buy_trade_count, 85)
  assert.equal(payload.global_trade_count, 180)
  assert.equal(payload.global_roi_lifetime, 0.18)
  assert.equal(payload.avg_bet_size, 180)
  assert.equal(payload.median_bet_size, 140)
  assert.equal(payload.bet_size_vs_avg_label, 'below_average')
  assert.equal(payload.sport_avg_bet_size, 180)
  assert.equal(payload.global_avg_bet_size, 180)
  assert.equal(payload.bet_strength_score, 25)

  const diversified = diversifyFeedTradeCandidates(
    [
      {
        row: {
          wallet: 'wallet-a',
          transaction_hash: 'a-1',
          trade_time: isoDaysAgo(1),
          trade_ts: Math.floor((now - 1 * 24 * 60 * 60_000) / 1000),
          side: 'BUY' as const,
          size: 20,
          price: 0.5,
          notional: 10,
          slug: 'slug-a-1',
          event_slug: 'slug-a-1',
          title: 'A one',
          outcome: 'A',
          outcome_index: 0,
          sport_label: 'NBA',
        },
        eventDate: '2026-03-13T23:00:00.000Z',
      },
      {
        row: {
          wallet: 'wallet-a',
          transaction_hash: 'a-2',
          trade_time: isoDaysAgo(2),
          trade_ts: Math.floor((now - 2 * 24 * 60 * 60_000) / 1000),
          side: 'BUY' as const,
          size: 20,
          price: 0.5,
          notional: 10,
          slug: 'slug-a-2',
          event_slug: 'slug-a-2',
          title: 'A two',
          outcome: 'A',
          outcome_index: 0,
          sport_label: 'NBA',
        },
        eventDate: '2026-03-13T23:00:00.000Z',
      },
      {
        row: {
          wallet: 'wallet-b',
          transaction_hash: 'b-1',
          trade_time: isoDaysAgo(1),
          trade_ts: Math.floor((now - 1 * 24 * 60 * 60_000) / 1000),
          side: 'BUY' as const,
          size: 20,
          price: 0.5,
          notional: 10,
          slug: 'slug-b-1',
          event_slug: 'slug-b-1',
          title: 'B one',
          outcome: 'B',
          outcome_index: 0,
          sport_label: 'NBA',
        },
        eventDate: '2026-03-13T23:00:00.000Z',
      },
    ],
    3
  )

  assert.deepEqual(
    diversified.map((entry) => entry.row.transaction_hash),
    ['a-1', 'b-1', 'a-2']
  )

  console.log('polymarket-bettor-feed tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
