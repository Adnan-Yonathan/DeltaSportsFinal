import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const minProfit = Number(searchParams.get('minProfit') ?? 25000)
  const maxWalletsParam = Number(searchParams.get('maxWallets') ?? 100)
  const days = Number(searchParams.get('days') ?? 30)
  const minTrades = Number(searchParams.get('minTrades') ?? 50)

  const minProfitValue = Number.isFinite(minProfit) ? minProfit : 25000
  const maxWallets = Number.isFinite(maxWalletsParam)
    ? Math.max(1, Math.min(maxWalletsParam, 500))
    : 100
  const daysValue = Number.isFinite(days) ? Math.max(1, days) : 30
  const minTradesValue = Number.isFinite(minTrades) ? Math.max(1, minTrades) : 50

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysValue)
  const cutoffDate = cutoff.toISOString().slice(0, 10)

  const supabase = createServiceClient()

  const { data: summaries, error: summaryError } = (await supabase
    .from('polymarket_wallet_summary' as any)
    .select(
      'wallet, total_realized_pnl, risk_adjusted_score, qualification_status, last_computed_at'
    )
    .neq('qualification_status', 'excluded')
    .gte('total_realized_pnl', minProfitValue)
    .order('total_realized_pnl', { ascending: false })
    .limit(maxWallets)) as unknown as {
    data: Array<{
      wallet: string
      total_realized_pnl: number
      risk_adjusted_score: number
      qualification_status: 'qualified' | 'watchlist' | 'excluded'
      last_computed_at: string | null
    }> | null
    error: { message?: string } | null
  }

  if (summaryError) {
    return NextResponse.json({ error: summaryError.message }, { status: 500 })
  }

  const wallets = (summaries ?? []).map((row) => row.wallet)
  if (!wallets.length) {
    return NextResponse.json({
      cutoff: cutoff.toISOString(),
      minTrades: minTradesValue,
      minProfit: minProfitValue,
      maxWallets,
      wallets: [],
    })
  }

  const { data: dailyRows, error: dailyError } = (await supabase
    .from('polymarket_wallet_daily_pnl' as any)
    .select('wallet, realized_pnl, pnl_date')
    .in('wallet', wallets)
    .gte('pnl_date', cutoffDate)) as unknown as {
    data: Array<{ wallet: string; realized_pnl: number; pnl_date: string }> | null
    error: { message?: string } | null
  }

  if (dailyError) {
    return NextResponse.json({ error: dailyError.message }, { status: 500 })
  }

  const pnl30dByWallet = new Map<string, number>()
  const trades30dByWallet = new Map<string, number>()
  for (const row of dailyRows ?? []) {
    if (!row.wallet) continue
    pnl30dByWallet.set(row.wallet, (pnl30dByWallet.get(row.wallet) ?? 0) + Number(row.realized_pnl ?? 0))
  }

  const { data: tradeCounts, error: tradeCountError } = (await supabase
    .from('polymarket_wallet_trades' as any)
    .select('wallet')
    .in('wallet', wallets)
    .eq('is_sports', true)
    .gte('trade_time', cutoff.toISOString())) as unknown as {
    data: Array<{ wallet: string }> | null
    error: { message?: string } | null
  }

  if (tradeCountError) {
    return NextResponse.json({ error: tradeCountError.message }, { status: 500 })
  }

  for (const row of tradeCounts ?? []) {
    if (!row.wallet) continue
    trades30dByWallet.set(row.wallet, (trades30dByWallet.get(row.wallet) ?? 0) + 1)
  }

  const filteredWallets = wallets.filter((wallet) => (trades30dByWallet.get(wallet) ?? 0) >= minTradesValue)

  const { data: openRows, error: openError } = (await supabase
    .from('polymarket_wallet_open_positions' as any)
    .select('wallet, slug, title, outcome, outcome_index, net_shares, stake_usd, avg_entry_price, avg_entry_american_odds, last_trade_time')
    .in('wallet', filteredWallets)
    .order('last_trade_time', { ascending: false })) as unknown as {
    data: Array<{
      wallet: string
      slug: string
      title: string | null
      outcome: string | null
      outcome_index: number | null
      net_shares: number | null
      stake_usd: number | null
      avg_entry_price: number | null
      avg_entry_american_odds: number | null
      last_trade_time: string | null
    }> | null
    error: { message?: string } | null
  }

  if (openError) {
    return NextResponse.json({ error: openError.message }, { status: 500 })
  }

  const openTradesByWallet = new Map<string, Array<Record<string, unknown>>>()
  for (const row of openRows ?? []) {
    if (!row.wallet) continue
    if (!openTradesByWallet.has(row.wallet)) openTradesByWallet.set(row.wallet, [])
    const arr = openTradesByWallet.get(row.wallet)!
    if (arr.length >= 10) continue
    arr.push({
      slug: row.slug,
      title: row.title,
      outcome: row.outcome,
      outcome_index: row.outcome_index,
      net_winning_shares: row.net_shares,
      net_losing_shares: 0,
      last_trade_time: row.last_trade_time,
      side: 'BUY',
      size: row.net_shares,
      price: row.avg_entry_price,
      avg_entry_american_odds: row.avg_entry_american_odds,
      stake_usd: row.stake_usd,
    })
  }

  const summaryByWallet = new Map((summaries ?? []).map((row) => [row.wallet, row]))

  return NextResponse.json({
    cutoff: cutoff.toISOString(),
    minTrades: minTradesValue,
    minProfit: minProfitValue,
    maxWallets,
    wallets: filteredWallets.map((wallet) => ({
      wallet,
      total_realized_pnl: Number(summaryByWallet.get(wallet)?.total_realized_pnl ?? 0),
      pnl_30d: Number(pnl30dByWallet.get(wallet) ?? 0),
      risk_adjusted_score: Number(summaryByWallet.get(wallet)?.risk_adjusted_score ?? 0),
      qualification_status: summaryByWallet.get(wallet)?.qualification_status ?? 'watchlist',
      last_computed_at: summaryByWallet.get(wallet)?.last_computed_at ?? null,
      open_trades: openTradesByWallet.get(wallet) ?? [],
    })),
  })
}
