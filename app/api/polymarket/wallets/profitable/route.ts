import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { computePolymarketWalletRollups, computeWalletRollupFromTrades } from '@/lib/services/polymarket-wallet-rollups'

const PAGE_SIZE = 5000
const MAX_ROWS = 200000

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const minTrades = Number(searchParams.get('minTrades') ?? 50)
  const days = Number(searchParams.get('days') ?? 30)
  const minProfit = Number(searchParams.get('minProfit') ?? 25000)
  const maxRefresh = Number(searchParams.get('maxRefresh') ?? 25)
  const maxRowsParam = Number(searchParams.get('maxRows') ?? MAX_ROWS)
  const maxWalletsParam = Number(searchParams.get('maxWallets') ?? 100)

  const minTradesValue = Number.isFinite(minTrades) ? Math.max(1, minTrades) : 50
  const daysValue = Number.isFinite(days) ? Math.max(1, days) : 30
  const minProfitValue = Number.isFinite(minProfit) ? minProfit : 25000
  const maxRefreshValue = Number.isFinite(maxRefresh) ? Math.max(0, maxRefresh) : 25
  const maxRowsValue = Number.isFinite(maxRowsParam)
    ? Math.max(1000, Math.min(maxRowsParam, MAX_ROWS))
    : MAX_ROWS
  const maxWalletsValue = Number.isFinite(maxWalletsParam)
    ? Math.max(1, Math.min(maxWalletsParam, 500))
    : 100

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysValue)

  const supabase = createServiceClient()
  const walletCounts = new Map<string, number>()
  let offset = 0
  let totalFetched = 0

  while (true) {
    const { data, error } = await supabase
      .from('polymarket_wallet_trades' as any)
      .select('wallet')
      .eq('is_sports', true)
      .gte('trade_time', cutoff.toISOString())
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) break

    for (const row of data as Array<{ wallet?: string }>) {
      if (!row.wallet) continue
      walletCounts.set(row.wallet, (walletCounts.get(row.wallet) ?? 0) + 1)
    }

    totalFetched += data.length
    offset += PAGE_SIZE
    if (data.length < PAGE_SIZE || totalFetched >= maxRowsValue) break
  }

  const activeWallets = Array.from(walletCounts.entries())
    .filter(([, count]) => count >= minTradesValue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxWalletsValue)
    .map(([wallet]) => wallet)

  if (activeWallets.length === 0) {
    return NextResponse.json({
      cutoff: cutoff.toISOString(),
      minTrades: minTradesValue,
      minProfit: minProfitValue,
      wallets: [],
    })
  }

  const walletChunks = chunkArray(activeWallets, 200)
  const summaries: Array<{
    wallet: string
    total_realized_pnl: number
    last_computed_at: string
  }> = []

  let summaryUnavailable = false
  for (const chunk of walletChunks) {
    const { data, error } = await supabase
      .from('polymarket_wallet_summary' as any)
      .select(
        'wallet, total_realized_pnl, last_computed_at'
      )
      .in('wallet', chunk)
    if (error) {
      if (error.message?.includes('schema cache')) {
        summaryUnavailable = true
        break
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (data) summaries.push(...(data as any))
  }

  const summaryByWallet = new Map(
    summaries.map((row) => [row.wallet, row])
  )
  const missingWallets = activeWallets.filter((wallet) => !summaryByWallet.has(wallet))

  if (!summaryUnavailable && missingWallets.length > 0 && maxRefreshValue > 0) {
    const refreshTargets = missingWallets.slice(0, maxRefreshValue)
    for (const wallet of refreshTargets) {
      await computePolymarketWalletRollups({ wallet })
    }

    summaries.length = 0
    summaryByWallet.clear()

    for (const chunk of walletChunks) {
      const { data, error } = await supabase
        .from('polymarket_wallet_summary' as any)
        .select(
          'wallet, total_realized_pnl, last_computed_at'
        )
        .in('wallet', chunk)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (data) summaries.push(...(data as any))
    }

    for (const row of summaries) {
      summaryByWallet.set(row.wallet, row)
    }
  }

  const dailyPnlByWallet = new Map<string, number>()
  if (!summaryUnavailable) {
    for (const chunk of walletChunks) {
      const { data, error } = await supabase
        .from('polymarket_wallet_daily_pnl' as any)
        .select('wallet, realized_pnl')
        .in('wallet', chunk)
        .gte('pnl_date', cutoff.toISOString().slice(0, 10))
      if (error) {
        if (error.message?.includes('schema cache')) {
          summaryUnavailable = true
          break
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      for (const row of (data ?? []) as Array<{ wallet: string; realized_pnl: number }>) {
        if (!row.wallet) continue
        dailyPnlByWallet.set(
          row.wallet,
          (dailyPnlByWallet.get(row.wallet) ?? 0) + Number(row.realized_pnl ?? 0)
        )
      }
    }
  }

  if (summaryUnavailable) {
    const rollupByWallet = new Map<
      string,
      { totalRealizedPnl: number; dailyPnl: Map<string, { pnl: number; wins: number; losses: number; pushes: number }> }
    >()

    for (const wallet of activeWallets) {
      const { data: trades, error: tradeError } = (await supabase
        .from('polymarket_wallet_trades' as any)
        .select('wallet, slug, outcome_index, side, size, price, trade_time, trade_ts')
        .eq('wallet', wallet)
        .eq('is_sports', true)
        .order('trade_ts', { ascending: true })) as unknown as {
        data: Array<{
          wallet: string
          slug: string
          outcome_index: number | null
          side: string | null
          size: number | null
          price: number | null
          trade_time: string
          trade_ts: number
        }> | null
        error: { message?: string } | null
      }
      if (tradeError || !trades || trades.length === 0) {
        rollupByWallet.set(wallet, { totalRealizedPnl: 0, dailyPnl: new Map() })
        continue
      }

      const slugs = Array.from(new Set(trades.map((trade) => trade.slug))).filter(Boolean)
      const { data: outcomesData, error: outcomesError } = (await supabase
        .from('polymarket_market_outcomes' as any)
        .select('slug, resolved, winning_outcome_index, resolved_at')
        .in('slug', slugs)) as unknown as {
        data: Array<{ slug: string; resolved: boolean | null; winning_outcome_index: number | null; resolved_at: string | null }> | null
        error: { message?: string } | null
      }
      if (outcomesError) {
        return NextResponse.json({ error: outcomesError.message }, { status: 500 })
      }

      const outcomesBySlug = new Map<string, { slug: string; resolved: boolean | null; winning_outcome_index: number | null; resolved_at: string | null }>()
      outcomesData?.forEach((row) => {
        if (row.slug) outcomesBySlug.set(row.slug, row)
      })

      const { daily, totalRealizedPnl } = computeWalletRollupFromTrades(trades, outcomesBySlug)
      rollupByWallet.set(wallet, { totalRealizedPnl, dailyPnl: daily })
    }

    for (const wallet of activeWallets) {
      const rollup = rollupByWallet.get(wallet)
      if (!rollup) continue
      summaryByWallet.set(wallet, {
        wallet,
        total_realized_pnl: rollup.totalRealizedPnl,
        last_computed_at: new Date().toISOString(),
      })
      let pnl30d = 0
      for (const [dateKey, entry] of rollup.dailyPnl.entries()) {
        if (dateKey >= cutoff.toISOString().slice(0, 10)) {
          pnl30d += entry.pnl
        }
      }
      dailyPnlByWallet.set(wallet, pnl30d)
    }
  }

  const results = activeWallets
    .map((wallet) => {
      const summary = summaryByWallet.get(wallet)
      return {
        wallet,
        trades_30d: walletCounts.get(wallet) ?? 0,
        total_realized_pnl: summary?.total_realized_pnl ?? 0,
        pnl_30d: dailyPnlByWallet.get(wallet) ?? 0,
        last_computed_at: summary?.last_computed_at ?? null,
      }
    })
    .filter((row) => row.total_realized_pnl >= minProfitValue)
    .sort((a, b) => b.total_realized_pnl - a.total_realized_pnl)

  const profitableWallets = results.map((row) => row.wallet)
  const openTradesByWallet = new Map<string, Array<{
    slug: string
    net_winning_shares: number | null
    net_losing_shares: number | null
    last_trade_time: string | null
    title: string | null
    outcome: string | null
    outcome_index: number | null
    side: string | null
    size: number | null
    price: number | null
  }>>()

  if (profitableWallets.length > 0) {
    const marketRows: Array<{
      wallet: string
      slug: string
      net_winning_shares: number | null
      net_losing_shares: number | null
    }> = []

    for (const chunk of chunkArray(profitableWallets, 200)) {
      const { data, error } = await supabase
        .from('polymarket_wallet_market_results' as any)
        .select('wallet, slug, net_winning_shares, net_losing_shares')
        .eq('resolved', false)
        .in('wallet', chunk)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (data) marketRows.push(...(data as any))
    }

    const slugSet = new Set<string>()
    for (const row of marketRows) {
      const netWinning = Number(row.net_winning_shares ?? 0)
      const netLosing = Number(row.net_losing_shares ?? 0)
      if (netWinning <= 0 && netLosing <= 0) continue
      if (row.slug) slugSet.add(row.slug)
      if (!openTradesByWallet.has(row.wallet)) openTradesByWallet.set(row.wallet, [])
      openTradesByWallet.get(row.wallet)!.push({
        slug: row.slug,
        net_winning_shares: row.net_winning_shares ?? null,
        net_losing_shares: row.net_losing_shares ?? null,
        last_trade_time: null,
        title: null,
        outcome: null,
        outcome_index: null,
        side: null,
        size: null,
        price: null,
      })
    }

    const slugs = Array.from(slugSet)
    const tradeIndex = new Map<string, {
      title: string | null
      trade_time: string | null
      outcome: string | null
      outcome_index: number | null
      side: string | null
      size: number | null
      price: number | null
    }>()
    for (const chunk of chunkArray(slugs, 200)) {
      const { data, error } = await supabase
        .from('polymarket_wallet_trades' as any)
        .select('wallet, slug, title, trade_time, outcome, outcome_index, side, size, price')
        .in('wallet', profitableWallets)
        .in('slug', chunk)
        .eq('is_sports', true)
        .order('trade_time', { ascending: false })
        .limit(5000)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      for (const row of (data ?? []) as Array<{
        wallet: string
        slug: string
        title?: string | null
        trade_time?: string | null
        outcome?: string | null
        outcome_index?: number | null
        side?: string | null
        size?: number | null
        price?: number | null
      }>) {
        const key = `${row.wallet}:${row.slug}`
        if (!tradeIndex.has(key)) {
          tradeIndex.set(key, {
            title: row.title ?? null,
            trade_time: row.trade_time ?? null,
            outcome: row.outcome ?? null,
            outcome_index: row.outcome_index ?? null,
            side: row.side ?? null,
            size: row.size ?? null,
            price: row.price ?? null,
          })
        }
      }
    }

    for (const [wallet, trades] of openTradesByWallet.entries()) {
      trades.forEach((tradeRow) => {
        const key = `${wallet}:${tradeRow.slug}`
        const trade = tradeIndex.get(key)
        if (trade) {
          tradeRow.title = trade.title
          tradeRow.last_trade_time = trade.trade_time
          tradeRow.outcome = trade.outcome
          tradeRow.outcome_index = trade.outcome_index
          tradeRow.side = trade.side
          tradeRow.size = trade.size
          tradeRow.price = trade.price
        }
      })
      trades.sort((a, b) => {
        const at = a.last_trade_time ? new Date(a.last_trade_time).getTime() : 0
        const bt = b.last_trade_time ? new Date(b.last_trade_time).getTime() : 0
        return bt - at
      })
      openTradesByWallet.set(wallet, trades.slice(0, 10))
    }
  }

  return NextResponse.json({
    cutoff: cutoff.toISOString(),
    minTrades: minTradesValue,
    minProfit: minProfitValue,
    maxWallets: maxWalletsValue,
    wallets: results.map((row) => ({
      wallet: row.wallet,
      total_realized_pnl: row.total_realized_pnl,
      pnl_30d: row.pnl_30d,
      open_trades: openTradesByWallet.get(row.wallet) ?? [],
    })),
  })
}
