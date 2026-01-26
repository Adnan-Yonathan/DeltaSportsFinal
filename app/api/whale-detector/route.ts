import { NextResponse } from 'next/server'
import {
  DEFAULT_LIMIT,
  DEFAULT_MIN_NOTIONAL,
  fetchWhaleTrades,
} from '@/lib/services/whale-detector'
import {
  fetchPropLiquiditySignals,
  mapLiquiditySignalsToSharpTrades,
} from '@/lib/services/prop-liquidity-detector'
import { createServiceClient } from '@/lib/supabase/service'
import { storeWhaleTrades } from '@/lib/services/whale-trades-daily'

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
  })
  try {
    return (await Promise.race([promise, timeoutPromise])) as T | null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

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
  const includeLiquidity = searchParams.get('includeLiquidity') === 'true'

  const trades = await fetchWhaleTrades({
    limit,
    minNotional,
    since,
  })

  // Store trades to daily database (fire-and-forget, non-blocking)
  if (trades.length > 0) {
    storeWhaleTrades(trades).catch((error) => {
      console.warn('[Whale Detector] Failed to store trades to daily db:', error)
    })
  }

  let enrichedTrades = trades
  let liquidityTrades: any[] = []
  if (includeLiquidity) {
    try {
      const signals = await withTimeout(
        fetchPropLiquiditySignals({ sportKey: 'all' }),
        6000
      )
      if (signals) {
        liquidityTrades = mapLiquiditySignalsToSharpTrades(signals)
      }
    } catch (error) {
      console.warn('[Whale Detector] Failed to load prop liquidity signals:', error)
    }
  }

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

  return NextResponse.json(
    {
      trades: includeLiquidity ? [...enrichedTrades, ...liquidityTrades] : enrichedTrades,
    },
    {
      headers: includeLiquidity
        ? {
            'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
          }
        : undefined,
    }
  )
}
