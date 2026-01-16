import { NextResponse } from 'next/server'
import {
  DEFAULT_LIMIT,
  DEFAULT_MIN_NOTIONAL,
  fetchWhaleTrades,
} from '@/lib/services/whale-detector'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitRaw = Number(searchParams.get('limit') ?? DEFAULT_LIMIT)
  const minNotionalRaw = Number(
    searchParams.get('minNotional') ?? DEFAULT_MIN_NOTIONAL
  )
  const limit = Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT
  const minNotional = Number.isFinite(minNotionalRaw)
    ? minNotionalRaw
    : DEFAULT_MIN_NOTIONAL
  const since = searchParams.get('since')

  const trades = await fetchWhaleTrades({
    limit,
    minNotional,
    since,
  })

  let enrichedTrades = trades

  const polymarketTrades = trades.filter(
    (trade) => trade.source === 'polymarket' && trade.proxyWallet && trade.slug
  )
  if (polymarketTrades.length > 0) {
    try {
      const supabase = createServiceClient()
      const wallets = Array.from(
        new Set(polymarketTrades.map((trade) => String(trade.proxyWallet).toLowerCase()))
      )
      const slugs = Array.from(
        new Set(polymarketTrades.map((trade) => String(trade.slug)))
      )

      const { data } = (await supabase
        .from('polymarket_wallet_market_results' as any)
        .select('wallet, slug, result, realized_pnl')
        .in('wallet', wallets)
        .in('slug', slugs)) as unknown as {
        data: Array<{
          wallet: string
          slug: string
          result: 'win' | 'loss' | 'push' | null
          realized_pnl: number | null
        }> | null
      }

      const resultMap = new Map<string, { result: string | null; pnl: number | null }>()
      data?.forEach((row) => {
        const key = `${row.wallet}:${row.slug}`
        resultMap.set(key, { result: row.result, pnl: row.realized_pnl })
      })

      enrichedTrades = trades.map((trade) => {
        if (trade.source !== 'polymarket' || !trade.proxyWallet || !trade.slug) {
          return trade
        }
        const key = `${String(trade.proxyWallet).toLowerCase()}:${trade.slug}`
        const hit = resultMap.get(key)
        if (!hit) return trade
        return {
          ...trade,
          result: hit.result ?? undefined,
          pnl: Number.isFinite(hit.pnl) ? hit.pnl : undefined,
        }
      })
    } catch (error) {
      console.warn('[Whale Detector] Failed to enrich wallet results:', error)
    }
  }

  return NextResponse.json({
    trades: enrichedTrades,
  })
}
