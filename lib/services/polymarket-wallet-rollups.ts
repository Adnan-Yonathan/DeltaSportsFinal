import { createServiceClient } from '@/lib/supabase/service'
import { probabilityToAmericanOdds } from '@/lib/utils/statistics'
import {
  type AllowedPolymarketSportLabel,
  isAllowedPolymarketSportLabel,
} from '@/lib/services/polymarket-sports'

type TradeRow = {
  wallet: string
  slug: string
  event_slug?: string | null
  sport_label?: string | null
  title?: string | null
  outcome?: string | null
  outcome_index: number | null
  side: string | null
  size: number | null
  price: number | null
  trade_time: string
  trade_ts: number
}

type MarketOutcomeRow = {
  slug: string
  resolved: boolean | null
  winning_outcome_index: number | null
  resolved_at: string | null
}

type WalletRollupResult = {
  wallet: string
  marketsProcessed: number
  marketsResolved: number
  totalRealizedPnl: number
  totalWins: number
  totalLosses: number
  totalPushes: number
  dailyRows: number
  openPositions: number
  riskAdjustedScore: number
  qualificationStatus: 'qualified' | 'watchlist' | 'excluded'
}

type RollupSummary = {
  walletsProcessed: number
  results: WalletRollupResult[]
}

type WalletTrackingState = 'auto' | 'manual_include' | 'manual_exclude'

type DailyEntry = { pnl: number; wins: number; losses: number; pushes: number }

type PositionState = {
  position: number
  costTotal: number
  lastTradeTime: string | null
  outcome: string | null
  title: string | null
  sportLabel: string | null
  eventSlug: string | null
  slug: string
  outcomeIndex: number
}

type RealizedPnlEntry = { dateKey: string; pnl: number }

type WalletRollupComputation = {
  marketRows: Array<Record<string, unknown>>
  openPositionRows: Array<Record<string, unknown>>
  daily: Map<string, DailyEntry>
  totalRealizedPnl: number
  totalWins: number
  totalLosses: number
  totalPushes: number
  marketsResolved: number
  settledTrades: number
  grossProfit: number
  grossLoss: number
  roiLifetime: number
  winRate: number
  profitFactor: number
  maxDrawdown: number
  consistency90d: number
  sampleQuality: number
  openNotional: number
  openPositionsCount: number
  totalBuyNotional: number
  lastTradeTime: string | null
}

type WalletComputationContext = {
  wallet: string
  trackingState: WalletTrackingState
  computation: WalletRollupComputation
}

type WalletSportComputationContext = {
  wallet: string
  sportLabel: AllowedPolymarketSportLabel
  trackingState: WalletTrackingState
  computation: WalletRollupComputation
}

const EASTERN_TIMEZONE = 'America/New_York'
const RISK_SCORE_DECIMALS = 6
const PROFIT_FACTOR_CAP = 10

const round = (value: number, decimals = 6) => {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(decimals))
}

const getEasternDateKey = (value: Date | string | number) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

const parseNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const resolveResult = (netWinning: number, netLosing: number) => {
  if (netWinning > netLosing) return 'win'
  if (netWinning < netLosing) return 'loss'
  return 'push'
}

const addDaily = (
  map: Map<string, DailyEntry>,
  dateKey: string,
  values: { pnl?: number; win?: boolean; loss?: boolean; push?: boolean }
) => {
  const entry = map.get(dateKey) ?? { pnl: 0, wins: 0, losses: 0, pushes: 0 }
  if (Number.isFinite(values.pnl)) entry.pnl += Number(values.pnl)
  if (values.win) entry.wins += 1
  if (values.loss) entry.losses += 1
  if (values.push) entry.pushes += 1
  map.set(dateKey, entry)
}

const processOutcomeTrades = (trades: TradeRow[], outcomeIndex: number, slug: string): {
  state: PositionState
  realized: RealizedPnlEntry[]
  buyNotional: number
} => {
  const sorted = [...trades].sort((a, b) => (a.trade_ts ?? 0) - (b.trade_ts ?? 0))
  let position = 0
  let costTotal = 0
  let buyNotional = 0
  let lastTradeTime: string | null = null
  const realized: RealizedPnlEntry[] = []

  for (const trade of sorted) {
    const size = parseNumber(trade.size)
    const price = parseNumber(trade.price)
    if (size == null || price == null || size <= 0) continue
    const dateKey = getEasternDateKey(trade.trade_time)
    if (!dateKey) continue

    const side = String(trade.side ?? '').toUpperCase()
    if (side === 'BUY') {
      position += size
      costTotal += size * price
      buyNotional += size * price
      lastTradeTime = trade.trade_time
      continue
    }

    if (side === 'SELL') {
      if (position <= 0) continue
      const sellSize = Math.min(size, position)
      const avgCost = position > 0 ? costTotal / position : 0
      const pnl = (price - avgCost) * sellSize
      realized.push({ dateKey, pnl })
      position -= sellSize
      costTotal -= avgCost * sellSize
      if (position <= 0) {
        position = 0
        costTotal = 0
      }
      lastTradeTime = trade.trade_time
    }
  }

  const latestTrade = sorted[sorted.length - 1]
  return {
    state: {
      position,
      costTotal,
      lastTradeTime: lastTradeTime ?? latestTrade?.trade_time ?? null,
      outcome: latestTrade?.outcome ?? null,
      title: latestTrade?.title ?? null,
      sportLabel: latestTrade?.sport_label ?? null,
      eventSlug: latestTrade?.event_slug ?? null,
      slug,
      outcomeIndex,
    },
    realized,
    buyNotional,
  }
}

const computeMaxDrawdown = (daily: Map<string, DailyEntry>) => {
  const sortedDates = Array.from(daily.keys()).sort((a, b) => a.localeCompare(b))
  let cumulative = 0
  let peak = 0
  let maxDrawdown = 0

  for (const dateKey of sortedDates) {
    const pnl = daily.get(dateKey)?.pnl ?? 0
    cumulative += pnl
    if (cumulative > peak) peak = cumulative
    const drawdown = peak - cumulative
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  return maxDrawdown
}

const computeConsistency90d = (daily: Map<string, DailyEntry>) => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffKey = getEasternDateKey(cutoff)
  if (!cutoffKey) return 0

  const recent = Array.from(daily.entries()).filter(([dateKey]) => dateKey >= cutoffKey)
  if (!recent.length) return 0

  const positiveDays = recent.filter(([, entry]) => entry.pnl > 0).length
  return positiveDays / recent.length
}

const percentileByWallet = (
  contexts: WalletComputationContext[],
  valueAccessor: (ctx: WalletComputationContext) => number
) => {
  const scored = contexts
    .map((ctx) => ({ wallet: ctx.wallet, value: valueAccessor(ctx) }))
    .sort((a, b) => a.value - b.value)

  const map = new Map<string, number>()
  const n = scored.length
  if (n === 0) return map
  if (n === 1) {
    map.set(scored[0].wallet, 1)
    return map
  }

  for (let i = 0; i < scored.length; i += 1) {
    map.set(scored[i].wallet, i / (n - 1))
  }
  return map
}

const filterStrictSportsTrades = (trades: TradeRow[]) =>
  trades.filter((trade) =>
    isAllowedPolymarketSportLabel(trade.sport_label ?? null)
  )

export const computeRiskAdjustedScoreByWallet = (
  contexts: WalletComputationContext[]
) => {
  const pnlPct = percentileByWallet(contexts, (ctx) => ctx.computation.totalRealizedPnl)
  const roiPct = percentileByWallet(contexts, (ctx) => ctx.computation.roiLifetime)
  const consistencyPct = percentileByWallet(contexts, (ctx) => ctx.computation.consistency90d)
  const samplePct = percentileByWallet(contexts, (ctx) => ctx.computation.sampleQuality)
  const profitFactorPct = percentileByWallet(contexts, (ctx) =>
    Math.min(ctx.computation.profitFactor, PROFIT_FACTOR_CAP)
  )
  const drawdownPct = percentileByWallet(contexts, (ctx) => ctx.computation.maxDrawdown)

  const scores = new Map<string, number>()
  for (const ctx of contexts) {
    const pnlScore = pnlPct.get(ctx.wallet) ?? 0
    const roiScore = roiPct.get(ctx.wallet) ?? 0
    const consistencyScore = consistencyPct.get(ctx.wallet) ?? 0
    const sampleScore = samplePct.get(ctx.wallet) ?? 0
    const profitFactorScore = profitFactorPct.get(ctx.wallet) ?? 0
    const drawdownPenalty = drawdownPct.get(ctx.wallet) ?? 0

    const riskAdjustedScore = round(
      100 *
        (
          pnlScore * 0.3 +
          roiScore * 0.2 +
          consistencyScore * 0.15 +
          sampleScore * 0.15 +
          profitFactorScore * 0.1 +
          (1 - drawdownPenalty) * 0.1
        ),
      RISK_SCORE_DECIMALS
    )

    scores.set(ctx.wallet, riskAdjustedScore)
  }

  return scores
}

export const computeSportRollupMapFromTrades = (
  trades: TradeRow[],
  outcomesBySlug: Map<string, MarketOutcomeRow>
) => {
  const strictSportsTrades = filterStrictSportsTrades(trades)
  const strictTradesBySport = new Map<AllowedPolymarketSportLabel, TradeRow[]>()

  for (const trade of strictSportsTrades) {
    const sportLabel = (trade.sport_label ?? '').toUpperCase()
    if (!isAllowedPolymarketSportLabel(sportLabel)) continue
    if (!strictTradesBySport.has(sportLabel)) {
      strictTradesBySport.set(sportLabel, [])
    }
    strictTradesBySport.get(sportLabel)?.push(trade)
  }

  const sportRollups = new Map<AllowedPolymarketSportLabel, WalletRollupComputation>()
  strictTradesBySport.forEach((sportTrades, sportLabel) => {
    sportRollups.set(sportLabel, computeWalletRollupFromTrades(sportTrades, outcomesBySlug))
  })

  return sportRollups
}

const resolveQualification = ({
  trackingState,
  settledMarkets,
  totalRealizedPnl,
}: {
  trackingState: WalletTrackingState
  settledMarkets: number
  totalRealizedPnl: number
}): { status: 'qualified' | 'watchlist' | 'excluded'; reason: string } => {
  if (trackingState === 'manual_exclude') {
    return { status: 'excluded', reason: 'manual_exclude override' }
  }
  if (trackingState === 'manual_include') {
    return { status: 'qualified', reason: 'manual_include override' }
  }

  if (settledMarkets < 150 && totalRealizedPnl < 10000) {
    return {
      status: 'watchlist',
      reason: 'Needs >=150 settled markets and >=$10,000 realized sports P/L',
    }
  }
  if (settledMarkets < 150) {
    return { status: 'watchlist', reason: 'Needs >=150 settled markets' }
  }
  if (totalRealizedPnl < 10000) {
    return { status: 'watchlist', reason: 'Needs >=$10,000 realized sports P/L' }
  }

  return { status: 'qualified', reason: 'Meets lifetime qualification thresholds' }
}

export const computeWalletRollupFromTrades = (
  trades: TradeRow[],
  outcomesBySlug: Map<string, MarketOutcomeRow>
): WalletRollupComputation => {
  const tradesBySlug = new Map<string, TradeRow[]>()
  trades.forEach((trade) => {
    if (!trade.slug) return
    if (!tradesBySlug.has(trade.slug)) tradesBySlug.set(trade.slug, [])
    tradesBySlug.get(trade.slug)!.push(trade)
  })

  const daily = new Map<string, DailyEntry>()
  const marketRows: Array<Record<string, unknown>> = []
  const openPositionRows: Array<Record<string, unknown>> = []
  let totalRealizedPnl = 0
  let totalWins = 0
  let totalLosses = 0
  let totalPushes = 0
  let marketsResolved = 0
  let settledTrades = 0
  let grossProfit = 0
  let grossLoss = 0
  let openNotional = 0
  let totalBuyNotional = 0
  let lastTradeTime: string | null = null

  const applyRealizedEntries = (entries: RealizedPnlEntry[]) => {
    entries.forEach((entry) => {
      addDaily(daily, entry.dateKey, { pnl: entry.pnl })
      totalRealizedPnl += entry.pnl
      if (entry.pnl >= 0) grossProfit += entry.pnl
      else grossLoss += Math.abs(entry.pnl)
    })
  }

  for (const [slug, slugTrades] of tradesBySlug.entries()) {
    const byOutcome = new Map<number, TradeRow[]>()
    slugTrades.forEach((trade) => {
      const outcomeIndex = trade.outcome_index
      if (outcomeIndex == null) return
      if (!byOutcome.has(outcomeIndex)) byOutcome.set(outcomeIndex, [])
      byOutcome.get(outcomeIndex)!.push(trade)
      if (!lastTradeTime || trade.trade_time > lastTradeTime) {
        lastTradeTime = trade.trade_time
      }
    })

    const outcomePositions = new Map<number, PositionState>()
    const sellRealized: RealizedPnlEntry[] = []

    for (const [outcomeIndex, outcomeTrades] of byOutcome.entries()) {
      const processed = processOutcomeTrades(outcomeTrades, outcomeIndex, slug)
      outcomePositions.set(outcomeIndex, processed.state)
      sellRealized.push(...processed.realized)
      totalBuyNotional += processed.buyNotional
    }

    applyRealizedEntries(sellRealized)

    const outcome = outcomesBySlug.get(slug)
    const resolved = Boolean(outcome?.resolved)
    const winningIndex =
      outcome?.winning_outcome_index != null ? Number(outcome.winning_outcome_index) : null
    const resolvedAt = outcome?.resolved_at ?? null

    let netWinning = 0
    let netLosing = 0

    for (const [outcomeIndex, positionInfo] of outcomePositions.entries()) {
      if (winningIndex != null && outcomeIndex === winningIndex) {
        netWinning += positionInfo.position
      } else {
        netLosing += positionInfo.position
      }
    }

    if (resolved && winningIndex != null) {
      marketsResolved += 1
      settledTrades += slugTrades.length

      const settlementRealized: RealizedPnlEntry[] = []
      for (const [outcomeIndex, positionInfo] of outcomePositions.entries()) {
        const position = positionInfo.position
        const costTotal = positionInfo.costTotal
        if (position <= 0) continue
        const avgCost = costTotal / position
        const settlementPrice = outcomeIndex === winningIndex ? 1 : 0
        const pnl = (settlementPrice - avgCost) * position
        const resolvedDateKey = resolvedAt ? getEasternDateKey(resolvedAt) : null
        if (resolvedDateKey) {
          settlementRealized.push({ dateKey: resolvedDateKey, pnl })
        }
      }
      applyRealizedEntries(settlementRealized)

      const result = resolveResult(netWinning, netLosing)
      if (result === 'win') totalWins += 1
      else if (result === 'loss') totalLosses += 1
      else totalPushes += 1

      const resultDateKey = resolvedAt ? getEasternDateKey(resolvedAt) : null
      if (resultDateKey) {
        addDaily(daily, resultDateKey, {
          win: result === 'win',
          loss: result === 'loss',
          push: result === 'push',
        })
      }

      marketRows.push({
        wallet: slugTrades[0]?.wallet,
        slug,
        resolved: true,
        winning_outcome_index: winningIndex,
        net_winning_shares: round(netWinning),
        net_losing_shares: round(netLosing),
        result,
        realized_pnl: round(
          sellRealized.reduce((sum, entry) => sum + entry.pnl, 0) +
            (outcomePositions.size
              ? Array.from(outcomePositions.entries()).reduce((acc, [outcomeIndex, positionInfo]) => {
                  if (positionInfo.position <= 0) return acc
                  const avgCost = positionInfo.costTotal / positionInfo.position
                  const settlementPrice = outcomeIndex === winningIndex ? 1 : 0
                  return acc + (settlementPrice - avgCost) * positionInfo.position
                }, 0)
              : 0)
        ),
        resolved_at: resolvedAt,
        updated_at: new Date().toISOString(),
      })
    } else {
      marketRows.push({
        wallet: slugTrades[0]?.wallet,
        slug,
        resolved: false,
        winning_outcome_index: winningIndex,
        net_winning_shares: round(netWinning),
        net_losing_shares: round(netLosing),
        result: null,
        realized_pnl: round(sellRealized.reduce((sum, entry) => sum + entry.pnl, 0)),
        resolved_at: null,
        updated_at: new Date().toISOString(),
      })

      for (const [, positionInfo] of outcomePositions.entries()) {
        if (positionInfo.position <= 0) continue
        const avgEntryPrice = positionInfo.costTotal / positionInfo.position
        const avgEntryAmericanOdds =
          avgEntryPrice > 0 && avgEntryPrice < 1
            ? probabilityToAmericanOdds(avgEntryPrice)
            : null
        const stakeUsd = positionInfo.costTotal
        const potentialPayoutUsd = positionInfo.position
        openNotional += stakeUsd
        openPositionRows.push({
          wallet: slugTrades[0]?.wallet,
          slug,
          event_slug: positionInfo.eventSlug,
          sport_label: positionInfo.sportLabel,
          title: positionInfo.title,
          outcome: positionInfo.outcome,
          outcome_index: positionInfo.outcomeIndex,
          net_shares: round(positionInfo.position),
          avg_entry_price: round(avgEntryPrice),
          avg_entry_american_odds: avgEntryAmericanOdds,
          stake_usd: round(stakeUsd),
          potential_payout_usd: round(potentialPayoutUsd),
          last_trade_time: positionInfo.lastTradeTime,
          updated_at: new Date().toISOString(),
        })
      }
    }
  }

  const totalClosedMarkets = totalWins + totalLosses + totalPushes
  const roiLifetime = totalBuyNotional > 0 ? totalRealizedPnl / totalBuyNotional : 0
  const winRate = totalClosedMarkets > 0 ? totalWins / totalClosedMarkets : 0
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? PROFIT_FACTOR_CAP : 0
  const consistency90d = computeConsistency90d(daily)
  const sampleQuality = Math.min(1, Math.sqrt(marketsResolved / 300))
  const maxDrawdown = computeMaxDrawdown(daily)

  return {
    marketRows,
    openPositionRows,
    daily,
    totalRealizedPnl: round(totalRealizedPnl),
    totalWins,
    totalLosses,
    totalPushes,
    marketsResolved,
    settledTrades,
    grossProfit: round(grossProfit),
    grossLoss: round(grossLoss),
    roiLifetime: round(roiLifetime),
    winRate: round(winRate),
    profitFactor: round(Math.min(profitFactor, PROFIT_FACTOR_CAP)),
    maxDrawdown: round(maxDrawdown),
    consistency90d: round(consistency90d),
    sampleQuality: round(sampleQuality),
    openNotional: round(openNotional),
    openPositionsCount: openPositionRows.length,
    totalBuyNotional: round(totalBuyNotional),
    lastTradeTime,
  }
}

export const computePolymarketWalletRollups = async ({
  wallet,
}: {
  wallet?: string
}): Promise<RollupSummary> => {
  const supabase = createServiceClient()
  const walletQuery = supabase
    .from('polymarket_wallets' as any)
    .select('wallet, tracking_state')

  const { data: wallets, error: walletError } = wallet
    ? await walletQuery.eq('wallet', wallet)
    : await walletQuery

  if (walletError || !wallets) {
    console.warn('[Polymarket Rollups] Failed to load wallets:', walletError)
    return { walletsProcessed: 0, results: [] }
  }

  const contexts: WalletComputationContext[] = []
  const sportContexts: WalletSportComputationContext[] = []

  for (const walletRow of wallets as Array<{ wallet: string; tracking_state?: WalletTrackingState | null }>) {
    const trackingState = (walletRow.tracking_state ?? 'auto') as WalletTrackingState
    const { data: trades, error: tradeError } = (await supabase
      .from('polymarket_wallet_trades' as any)
      .select(
        'wallet, slug, event_slug, sport_label, title, outcome, outcome_index, side, size, price, trade_time, trade_ts'
      )
      .eq('wallet', walletRow.wallet)
      .eq('is_sports', true)
      .order('trade_ts', { ascending: true })) as unknown as {
      data: TradeRow[] | null
      error: { message?: string } | null
    }

    if (tradeError || !trades) {
      console.warn('[Polymarket Rollups] Failed to load trades:', tradeError)
      continue
    }

    const slugs = Array.from(new Set(trades.map((trade) => trade.slug))).filter(Boolean)
    const outcomesBySlug = new Map<string, MarketOutcomeRow>()
    if (slugs.length > 0) {
      const { data: outcomes } = (await supabase
        .from('polymarket_market_outcomes' as any)
        .select('slug, resolved, winning_outcome_index, resolved_at')
        .in('slug', slugs)) as unknown as {
        data: MarketOutcomeRow[] | null
        error: { message?: string } | null
      }

      outcomes?.forEach((row) => {
        if (row.slug) outcomesBySlug.set(row.slug, row)
      })
    }

    const computation = computeWalletRollupFromTrades(trades, outcomesBySlug)
    const sportRollups = computeSportRollupMapFromTrades(trades, outcomesBySlug)

    await supabase
      .from('polymarket_wallet_market_results' as any)
      .delete()
      .eq('wallet', walletRow.wallet)

    if (computation.marketRows.length > 0) {
      const { error: marketError } = await supabase
        .from('polymarket_wallet_market_results' as any)
        .upsert(computation.marketRows as any, { onConflict: 'wallet,slug' } as any)
      if (marketError) {
        console.warn('[Polymarket Rollups] Failed to upsert market results:', marketError)
      }
    }

    await supabase
      .from('polymarket_wallet_daily_pnl' as any)
      .delete()
      .eq('wallet', walletRow.wallet)

    const dailyRows = Array.from(computation.daily.entries()).map(([dateKey, entry]) => ({
      wallet: walletRow.wallet,
      pnl_date: dateKey,
      realized_pnl: round(entry.pnl),
      wins: entry.wins,
      losses: entry.losses,
      pushes: entry.pushes,
      updated_at: new Date().toISOString(),
    }))

    if (dailyRows.length > 0) {
      const { error: dailyError } = await supabase
        .from('polymarket_wallet_daily_pnl' as any)
        .upsert(dailyRows as any, { onConflict: 'wallet,pnl_date' } as any)
      if (dailyError) {
        console.warn('[Polymarket Rollups] Failed to upsert daily pnl:', dailyError)
      }
    }

    await supabase
      .from('polymarket_wallet_open_positions' as any)
      .delete()
      .eq('wallet', walletRow.wallet)

    if (computation.openPositionRows.length > 0) {
      const { error: openError } = await supabase
        .from('polymarket_wallet_open_positions' as any)
        .upsert(computation.openPositionRows as any, {
          onConflict: 'wallet,slug,outcome_index',
        } as any)
      if (openError) {
        console.warn('[Polymarket Rollups] Failed to upsert open positions:', openError)
      }
    }

    contexts.push({
      wallet: walletRow.wallet,
      trackingState,
      computation,
    })

    sportRollups.forEach((sportComputation, sportLabel) => {
      sportContexts.push({
        wallet: walletRow.wallet,
        sportLabel,
        trackingState,
        computation: sportComputation,
      })
    })
  }

  const globalRiskScores = computeRiskAdjustedScoreByWallet(contexts)

  const summaryRows: Array<Record<string, unknown>> = []
  const results: WalletRollupResult[] = []

  for (const ctx of contexts) {
    const riskAdjustedScore = globalRiskScores.get(ctx.wallet) ?? 0

    const qualification = resolveQualification({
      trackingState: ctx.trackingState,
      settledMarkets: ctx.computation.marketsResolved,
      totalRealizedPnl: ctx.computation.totalRealizedPnl,
    })

    summaryRows.push({
      wallet: ctx.wallet,
      total_realized_pnl: ctx.computation.totalRealizedPnl,
      total_wins: ctx.computation.totalWins,
      total_losses: ctx.computation.totalLosses,
      total_pushes: ctx.computation.totalPushes,
      settled_markets: ctx.computation.marketsResolved,
      settled_trades: ctx.computation.settledTrades,
      gross_profit: ctx.computation.grossProfit,
      gross_loss: ctx.computation.grossLoss,
      roi_lifetime: ctx.computation.roiLifetime,
      win_rate: ctx.computation.winRate,
      profit_factor: ctx.computation.profitFactor,
      max_drawdown: ctx.computation.maxDrawdown,
      consistency_90d: ctx.computation.consistency90d,
      sample_quality: ctx.computation.sampleQuality,
      risk_adjusted_score: riskAdjustedScore,
      qualification_status: qualification.status,
      qualification_reason: qualification.reason,
      open_positions_count: ctx.computation.openPositionsCount,
      open_notional: ctx.computation.openNotional,
      last_trade_time: ctx.computation.lastTradeTime,
      last_computed_at: new Date().toISOString(),
    })

    results.push({
      wallet: ctx.wallet,
      marketsProcessed: ctx.computation.marketRows.length,
      marketsResolved: ctx.computation.marketsResolved,
      totalRealizedPnl: ctx.computation.totalRealizedPnl,
      totalWins: ctx.computation.totalWins,
      totalLosses: ctx.computation.totalLosses,
      totalPushes: ctx.computation.totalPushes,
      dailyRows: ctx.computation.daily.size,
      openPositions: ctx.computation.openPositionsCount,
      riskAdjustedScore,
      qualificationStatus: qualification.status,
    })
  }

  if (summaryRows.length > 0) {
    const { error: summaryError } = await supabase
      .from('polymarket_wallet_summary' as any)
      .upsert(summaryRows as any, { onConflict: 'wallet' } as any)

    if (summaryError) {
      console.warn('[Polymarket Rollups] Failed to upsert summary:', summaryError)
    }
  }

  const processedWallets = Array.from(new Set(contexts.map((ctx) => ctx.wallet)))
  if (processedWallets.length > 0) {
    const chunkSize = 200
    for (let i = 0; i < processedWallets.length; i += chunkSize) {
      const chunk = processedWallets.slice(i, i + chunkSize)
      await supabase
        .from('polymarket_wallet_sport_summary' as any)
        .delete()
        .in('wallet', chunk)
    }
  }

  const sportSummaryRows: Array<Record<string, unknown>> = []
  const sportGroups = new Map<AllowedPolymarketSportLabel, WalletSportComputationContext[]>()
  for (const ctx of sportContexts) {
    if (!sportGroups.has(ctx.sportLabel)) {
      sportGroups.set(ctx.sportLabel, [])
    }
    sportGroups.get(ctx.sportLabel)?.push(ctx)
  }

  for (const [sportLabel, groupContexts] of sportGroups.entries()) {
    const sportRiskScores = computeRiskAdjustedScoreByWallet(groupContexts)

    for (const ctx of groupContexts) {
      const riskAdjustedScore = sportRiskScores.get(ctx.wallet) ?? 0

      const qualification = resolveQualification({
        trackingState: ctx.trackingState,
        settledMarkets: ctx.computation.marketsResolved,
        totalRealizedPnl: ctx.computation.totalRealizedPnl,
      })

      sportSummaryRows.push({
        wallet: ctx.wallet,
        sport_label: sportLabel,
        total_realized_pnl: ctx.computation.totalRealizedPnl,
        total_wins: ctx.computation.totalWins,
        total_losses: ctx.computation.totalLosses,
        total_pushes: ctx.computation.totalPushes,
        settled_markets: ctx.computation.marketsResolved,
        settled_trades: ctx.computation.settledTrades,
        gross_profit: ctx.computation.grossProfit,
        gross_loss: ctx.computation.grossLoss,
        roi_lifetime: ctx.computation.roiLifetime,
        win_rate: ctx.computation.winRate,
        profit_factor: ctx.computation.profitFactor,
        max_drawdown: ctx.computation.maxDrawdown,
        consistency_90d: ctx.computation.consistency90d,
        sample_quality: ctx.computation.sampleQuality,
        risk_adjusted_score: riskAdjustedScore,
        qualification_status: qualification.status,
        qualification_reason: qualification.reason,
        open_positions_count: ctx.computation.openPositionsCount,
        open_notional: ctx.computation.openNotional,
        last_trade_time: ctx.computation.lastTradeTime,
        last_computed_at: new Date().toISOString(),
      })
    }
  }

  if (sportSummaryRows.length > 0) {
    const { error: sportSummaryError } = await supabase
      .from('polymarket_wallet_sport_summary' as any)
      .upsert(sportSummaryRows as any, { onConflict: 'wallet,sport_label' } as any)

    if (sportSummaryError) {
      console.warn('[Polymarket Rollups] Failed to upsert sport summary:', sportSummaryError)
    }
  }

  return {
    walletsProcessed: results.length,
    results,
  }
}
