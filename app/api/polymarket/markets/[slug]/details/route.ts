import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { probabilityToAmericanOdds } from '@/lib/utils/statistics'

const POLYMARKET_GAMMA = 'https://gamma-api.polymarket.com'
const POLYMARKET_CLOB = 'https://clob.polymarket.com'
const ORDERBOOK_LEVEL_LIMIT = 40
const HISTORY_LIMIT = 160

type PolymarketBook = {
  bids?: Array<{ price: string | number; size: string | number }>
  asks?: Array<{ price: string | number; size: string | number }>
}

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeProbability = (value: unknown) => {
  const numeric = toNumber(value)
  if (numeric == null) return null
  if (numeric <= 1) return numeric
  if (numeric <= 100) return numeric / 100
  return null
}

const toPriceCents = (value: unknown) => {
  const probability = normalizeProbability(value)
  if (probability == null) return null
  return Math.round(probability * 100)
}

const toAmericanOdds = (priceCents: number | null) => {
  if (priceCents == null) return null
  const probability = priceCents / 100
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return null
  return probabilityToAmericanOdds(probability)
}

const parseArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const fetchMarketBySlug = async (slug: string) => {
  const url = new URL(`${POLYMARKET_GAMMA}/markets`)
  url.searchParams.set('slug', slug)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return null
  const raw = await res.json()
  const rows = Array.isArray(raw?.value) ? raw.value : Array.isArray(raw) ? raw : []
  return rows[0] ?? null
}

const fetchOrderbook = async (tokenId: string) => {
  const url = new URL(`${POLYMARKET_CLOB}/book`)
  url.searchParams.set('token_id', tokenId)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as PolymarketBook
}

const mapOrderbookLevels = (
  levels: Array<{ price: string | number; size: string | number }> | undefined
) => {
  return (levels ?? [])
    .slice(0, ORDERBOOK_LEVEL_LIMIT)
    .map((level) => {
      const probability = normalizeProbability(level.price)
      const size = toNumber(level.size)
      if (probability == null || size == null || size <= 0) return null
      const notional = probability * size
      return {
        price_cents: Math.round(probability * 100),
        size,
        notional,
      }
    })
    .filter(Boolean) as Array<{ price_cents: number; size: number; notional: number }>
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = String(params.slug ?? '').trim()
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
    }

    const searchParams = new URL(request.url).searchParams
    const requestedOutcomeIndex = Number(searchParams.get('outcomeIndex') ?? '0')
    const selectedOutcomeIndex = Number.isFinite(requestedOutcomeIndex)
      ? Math.max(0, Math.floor(requestedOutcomeIndex))
      : 0

    const market = await fetchMarketBySlug(slug)
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    const outcomes = parseArray(market.outcomes).map((value) => String(value))
    const outcomePrices = parseArray(market.outcomePrices)
    const tokenIds = parseArray(market.clobTokenIds).map((value) => String(value))

    const resolvedOutcomes = outcomes.map((label, index) => {
      const priceCents = toPriceCents(outcomePrices[index])
      return {
        outcome_index: index,
        label,
        token_id: tokenIds[index] ?? null,
        price_cents: priceCents,
        american_odds: toAmericanOdds(priceCents),
      }
    })

    const outcomesWithBooks = await Promise.all(
      resolvedOutcomes.map(async (outcome) => {
        if (!outcome.token_id) {
          return {
            ...outcome,
            orderbook: {
              bids: [],
              asks: [],
            },
          }
        }
        const book = await fetchOrderbook(outcome.token_id)
        const bids = mapOrderbookLevels(book?.bids)
        const asks = mapOrderbookLevels(book?.asks)
        return {
          ...outcome,
          orderbook: {
            bids,
            asks,
            total_bid_notional: bids.reduce((sum, row) => sum + row.notional, 0),
            total_ask_notional: asks.reduce((sum, row) => sum + row.notional, 0),
          },
        }
      })
    )

    const supabase = createServiceClient()
    const { data: historyRows } = (await supabase
      .from('polymarket_wallet_trades' as any)
      .select('trade_time, trade_ts, price, size, notional, side')
      .eq('slug', slug)
      .eq('outcome_index', selectedOutcomeIndex)
      .eq('is_sports', true)
      .order('trade_ts', { ascending: false })
      .limit(HISTORY_LIMIT)) as unknown as {
      data: Array<{
        trade_time: string | null
        trade_ts: number | null
        price: number | null
        size: number | null
        notional: number | null
        side: 'BUY' | 'SELL' | null
      }> | null
    }

    const lineMovementHistory = (historyRows ?? [])
      .map((row) => {
        const priceCents = toPriceCents(row.price)
        if (priceCents == null) return null
        return {
          timestamp: row.trade_time,
          trade_ts: row.trade_ts,
          side: row.side ?? 'BUY',
          price_cents: priceCents,
          american_odds: toAmericanOdds(priceCents),
          size: toNumber(row.size),
          notional: toNumber(row.notional),
          source: 'tracked_trade',
        }
      })
      .filter(Boolean)
      .reverse() as Array<{
      timestamp: string | null
      trade_ts: number | null
      side: string
      price_cents: number
      american_odds: number | null
      size: number | null
      notional: number | null
      source: 'tracked_trade'
    }>

    const selectedOutcome =
      outcomesWithBooks.find((row) => row.outcome_index === selectedOutcomeIndex) ?? null
    const firstPoint = lineMovementHistory[0] ?? null
    const lastPoint = lineMovementHistory[lineMovementHistory.length - 1] ?? null
    const movementCents =
      firstPoint && lastPoint ? lastPoint.price_cents - firstPoint.price_cents : null

    return NextResponse.json(
      {
        slug,
        market_id: market.id ?? null,
        title: market.question ?? market.title ?? slug,
        selected_outcome_index: selectedOutcomeIndex,
        selected_outcome_label: selectedOutcome?.label ?? null,
        outcomes: outcomesWithBooks,
        line_movement_history: lineMovementHistory,
        line_movement_summary: {
          points: lineMovementHistory.length,
          first_price_cents: firstPoint?.price_cents ?? null,
          last_price_cents: lastPoint?.price_cents ?? selectedOutcome?.price_cents ?? null,
          move_cents: movementCents,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
        },
      }
    )
  } catch (error) {
    console.error('[polymarket/markets/:slug/details] error:', error)
    return NextResponse.json({ error: 'Failed to load market details' }, { status: 500 })
  }
}
