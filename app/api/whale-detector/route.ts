import { NextResponse } from 'next/server'
import {
  DEFAULT_LIMIT,
  DEFAULT_MIN_NOTIONAL,
  fetchWhaleTrades,
} from '@/lib/services/whale-detector'

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

  return NextResponse.json({
    trades,
  })
}
