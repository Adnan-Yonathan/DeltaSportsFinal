import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const DEFAULT_MARKETS = ['spread', 'total', 'moneyline'] as const
const BOOK_PRIORITY = ['pinnacle', 'draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365'] as const

type MarketKey = (typeof DEFAULT_MARKETS)[number]

type LinePoint = {
  t: string
  value: number
}

type SeriesResponse = {
  book?: string
  points: LinePoint[]
}

const normalizeBook = (value: string | null | undefined) =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const resolveBookPriority = (book: string) => {
  const normalized = normalizeBook(book)
  const index = BOOK_PRIORITY.findIndex((entry) => normalized.includes(entry))
  return index === -1 ? BOOK_PRIORITY.length : index
}

const coerceNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const gameIds = Array.isArray(body?.gameIds)
      ? body.gameIds.map((id: any) => String(id).trim()).filter(Boolean)
      : []
    const markets = Array.isArray(body?.markets) && body.markets.length
      ? body.markets.map((m: any) => String(m)).filter(Boolean)
      : DEFAULT_MARKETS
    const hours = Number.isFinite(body?.hours) ? Math.min(Math.max(body.hours, 1), 168) : 36
    const lineType = body?.lineType ? String(body.lineType) : 'current'
    const preferredBook = body?.bookmaker ? normalizeBook(body.bookmaker) : ''
    const maxRows = Number.isFinite(body?.limit)
      ? Math.min(Math.max(body.limit, 100), 20000)
      : Math.min(20000, Math.max(800, gameIds.length * 120))

    if (!gameIds.length) {
      return NextResponse.json({ success: true, series: {}, count: 0 })
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const supabase = createServiceClient()

    const { data, error } = (await supabase
      .from('lines')
      .select(
        'odds_api_id, market_type, bookmaker, recorded_at, spread_home, total_line, moneyline_home'
      )
      .in('odds_api_id', gameIds)
      .in('market_type', markets)
      .eq('line_type', lineType)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })
      .limit(maxRows)) as unknown as { data: any[] | null; error: any }

    if (error) {
      console.error('[Line History Batch] Error fetching lines:', error)
      throw error
    }

    const grouped = new Map<string, Map<string, Map<string, LinePoint[]>>>()

    for (const row of data || []) {
      const gameId = String(row.odds_api_id || '')
      const market = String(row.market_type || '') as MarketKey
      const book = normalizeBook(row.bookmaker)
      if (!gameId || !market || !book) continue

      let value: number | null = null
      if (market === 'spread') value = coerceNumber(row.spread_home)
      if (market === 'total') value = coerceNumber(row.total_line)
      if (market === 'moneyline') value = coerceNumber(row.moneyline_home)
      if (value == null) continue

      if (!grouped.has(gameId)) grouped.set(gameId, new Map())
      const marketMap = grouped.get(gameId)!
      if (!marketMap.has(market)) marketMap.set(market, new Map())
      const bookMap = marketMap.get(market)!
      if (!bookMap.has(book)) bookMap.set(book, [])
      bookMap.get(book)!.push({ t: row.recorded_at, value })
    }

    const series: Record<string, Record<string, SeriesResponse>> = {}

    for (const [gameId, marketMap] of grouped.entries()) {
      series[gameId] = {}
      for (const [market, bookMap] of marketMap.entries()) {
        const books = Array.from(bookMap.keys())
        if (!books.length) continue

        let selected = ''
        if (preferredBook && bookMap.has(preferredBook)) {
          selected = preferredBook
        } else {
          selected = books
            .slice()
            .sort((a, b) => {
              const priorityDiff = resolveBookPriority(a) - resolveBookPriority(b)
              if (priorityDiff !== 0) return priorityDiff
              return (bookMap.get(b)?.length || 0) - (bookMap.get(a)?.length || 0)
            })[0]
        }

        const points = (bookMap.get(selected) || []).filter((point) =>
          Number.isFinite(point.value)
        )
        if (!points.length) continue

        series[gameId][market] = {
          book: selected,
          points,
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      series,
    })
  } catch (error: any) {
    console.error('[Line History Batch] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch line history batch', details: error.message },
      { status: 500 }
    )
  }
}
