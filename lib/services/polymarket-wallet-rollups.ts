import { createServiceClient } from '@/lib/supabase/service'

type TradeRow = {
  wallet: string
  slug: string
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
}

type RollupSummary = {
  walletsProcessed: number
  results: WalletRollupResult[]
}

const EASTERN_TIMEZONE = 'America/New_York'

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
  if (netWinning > 0 && netLosing <= 0) return 'win'
  if (netWinning <= 0 && netLosing > 0) return 'loss'
  return 'push'
}

const addDaily = (
  map: Map<string, { pnl: number; wins: number; losses: number; pushes: number }>,
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

const processOutcomeTrades = (trades: TradeRow[]) => {
  let position = 0
  let costTotal = 0
  const realized: Array<{ dateKey: string; pnl: number }> = []

  for (const trade of trades) {
    const size = parseNumber(trade.size)
    const price = parseNumber(trade.price)
    if (size == null || price == null || size <= 0) continue
    const dateKey = getEasternDateKey(trade.trade_time)
    if (!dateKey) continue

    const side = String(trade.side ?? '').toUpperCase()
    if (side === 'BUY') {
      position += size
      costTotal += size * price
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
    }
  }

  return { position, costTotal, realized }
}

const processWalletTrades = (
  trades: TradeRow[],
  outcomesBySlug: Map<string, MarketOutcomeRow>
) => {
  const tradesBySlug = new Map<string, TradeRow[]>()
  trades.forEach((trade) => {
    if (!trade.slug) return
    if (!tradesBySlug.has(trade.slug)) tradesBySlug.set(trade.slug, [])
    tradesBySlug.get(trade.slug)!.push(trade)
  })

  const daily = new Map<string, { pnl: number; wins: number; losses: number; pushes: number }>()
  const marketRows: Array<Record<string, unknown>> = []
  let totalRealizedPnl = 0
  let totalWins = 0
  let totalLosses = 0
  let totalPushes = 0
  let marketsResolved = 0

  for (const [slug, slugTrades] of tradesBySlug.entries()) {
    const byOutcome = new Map<number, TradeRow[]>()
    slugTrades.forEach((trade) => {
      const outcomeIndex = trade.outcome_index
      if (outcomeIndex == null) return
      if (!byOutcome.has(outcomeIndex)) byOutcome.set(outcomeIndex, [])
      byOutcome.get(outcomeIndex)!.push(trade)
    })

    const outcomePositions = new Map<number, { position: number; costTotal: number }>()
    const sellRealized: Array<{ dateKey: string; pnl: number }> = []

    for (const [outcomeIndex, outcomeTrades] of byOutcome.entries()) {
      const processed = processOutcomeTrades(outcomeTrades)
      outcomePositions.set(outcomeIndex, {
        position: processed.position,
        costTotal: processed.costTotal,
      })
      sellRealized.push(...processed.realized)
    }

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

    sellRealized.forEach((entry) => addDaily(daily, entry.dateKey, { pnl: entry.pnl }))
    let realizedPnl = sellRealized.reduce((sum, entry) => sum + entry.pnl, 0)

    if (resolved && winningIndex != null) {
      const settlementRealized: Array<{ dateKey: string; pnl: number }> = []
      marketsResolved += 1
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
      settlementRealized.forEach((entry) => addDaily(daily, entry.dateKey, { pnl: entry.pnl }))
      realizedPnl += settlementRealized.reduce((sum, entry) => sum + entry.pnl, 0)

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

      totalRealizedPnl += realizedPnl

      marketRows.push({
        wallet: slugTrades[0]?.wallet,
        slug,
        resolved: true,
        winning_outcome_index: winningIndex,
        net_winning_shares: netWinning,
        net_losing_shares: netLosing,
        result,
        realized_pnl: realizedPnl,
        resolved_at: resolvedAt,
        updated_at: new Date().toISOString(),
      })
    } else {
      totalRealizedPnl += realizedPnl
      marketRows.push({
        wallet: slugTrades[0]?.wallet,
        slug,
        resolved: false,
        winning_outcome_index: winningIndex,
        net_winning_shares: netWinning,
        net_losing_shares: netLosing,
        result: null,
        realized_pnl: realizedPnl,
        resolved_at: null,
        updated_at: new Date().toISOString(),
      })
    }
  }

  return {
    marketRows,
    daily,
    totalRealizedPnl,
    totalWins,
    totalLosses,
    totalPushes,
    marketsResolved,
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
    .select('wallet')
  const { data: wallets, error: walletError } = wallet
    ? await walletQuery.eq('wallet', wallet)
    : await walletQuery

  if (walletError || !wallets) {
    console.warn('[Polymarket Rollups] Failed to load wallets:', walletError)
    return { walletsProcessed: 0, results: [] }
  }

  const results: WalletRollupResult[] = []

  for (const walletRow of wallets as Array<{ wallet: string }>) {
    const { data: trades, error: tradeError } = (await supabase
      .from('polymarket_wallet_trades' as any)
      .select(
        'wallet, slug, outcome_index, side, size, price, trade_time, trade_ts'
      )
      .eq('wallet', walletRow.wallet)
      .eq('is_sports', true)
      .order('trade_ts', { ascending: true })) as unknown as {
      data: TradeRow[] | null
      error: { message?: string } | null
    }

    if (tradeError || !trades || trades.length === 0) {
      results.push({
        wallet: walletRow.wallet,
        marketsProcessed: 0,
        marketsResolved: 0,
        totalRealizedPnl: 0,
        totalWins: 0,
        totalLosses: 0,
        totalPushes: 0,
        dailyRows: 0,
      })
      continue
    }

    const slugs = Array.from(new Set(trades.map((trade) => trade.slug))).filter(Boolean)
    const { data: outcomes } = (await supabase
      .from('polymarket_market_outcomes' as any)
      .select('slug, resolved, winning_outcome_index, resolved_at')
      .in('slug', slugs)) as unknown as {
      data: MarketOutcomeRow[] | null
      error: { message?: string } | null
    }

    const outcomesBySlug = new Map<string, MarketOutcomeRow>()
    outcomes?.forEach((row) => {
      if (row.slug) outcomesBySlug.set(row.slug, row)
    })

    const {
      marketRows,
      daily,
      totalRealizedPnl,
      totalWins,
      totalLosses,
      totalPushes,
      marketsResolved,
    } = processWalletTrades(trades, outcomesBySlug)

    if (marketRows.length > 0) {
      const { error: marketError } = await supabase
        .from('polymarket_wallet_market_results' as any)
        .upsert(marketRows as any, { onConflict: 'wallet,slug' } as any)
      if (marketError) {
        console.warn('[Polymarket Rollups] Failed to upsert market results:', marketError)
      }
    }

    await supabase
      .from('polymarket_wallet_daily_pnl' as any)
      .delete()
      .eq('wallet', walletRow.wallet)

    const dailyRows = Array.from(daily.entries()).map(([dateKey, entry]) => ({
      wallet: walletRow.wallet,
      pnl_date: dateKey,
      realized_pnl: entry.pnl,
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

    const { error: summaryError } = await supabase
      .from('polymarket_wallet_summary' as any)
      .upsert(
        [
          {
            wallet: walletRow.wallet,
            total_realized_pnl: totalRealizedPnl,
            total_wins: totalWins,
            total_losses: totalLosses,
            total_pushes: totalPushes,
            last_computed_at: new Date().toISOString(),
          },
        ] as any,
        { onConflict: 'wallet' } as any
      )
    if (summaryError) {
      console.warn('[Polymarket Rollups] Failed to upsert summary:', summaryError)
    }

    results.push({
      wallet: walletRow.wallet,
      marketsProcessed: marketRows.length,
      marketsResolved,
      totalRealizedPnl,
      totalWins,
      totalLosses,
      totalPushes,
      dailyRows: dailyRows.length,
    })
  }

  return {
    walletsProcessed: results.length,
    results,
  }
}
