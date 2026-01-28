import { NextRequest, NextResponse } from 'next/server'
import { findPinnacleEVOpportunities } from '@/lib/services/pinnacle-ev'
import { DEFAULT_SELECTED_BOOKS, type BookKey } from '@/lib/config/books'
export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 10 * 60 * 1000
type CacheEntry = { ts: number; payload: any }
const responseCache = new Map<string, CacheEntry>()

const buildCacheKey = (params: {
  minEV: number
  sport: string | null
  market: string | null
  books: string | null
}) =>
  JSON.stringify({
    minEV: params.minEV,
    sport: params.sport ?? 'all',
    market: params.market ?? 'all',
    books: params.books ?? '',
  })

const SUPPORTED_SPORTS = [
  'basketball_nba',
  'basketball_ncaab',
  'americanfootball_nfl',
  'icehockey_nhl',
]

const DEFAULT_MARKETS = ['h2h', 'spreads', 'totals']

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url)
    const minEV = parseFloat(searchParams.get('minEV') || '3')
    const sport = searchParams.get('sport')
    const market = searchParams.get('market')
    const booksParam = searchParams.get('books')
    const cacheKey = buildCacheKey({
      minEV,
      sport,
      market,
      books: booksParam,
    })

    const cached = responseCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json({ ...cached.payload, cached: true })
    }

    // Determine sports to scan
    let sports: string[] = []
    if (sport && sport !== 'all') {
      sports = [sport]
    } else {
      sports = SUPPORTED_SPORTS
    }
    sports = sports.filter((entry) => SUPPORTED_SPORTS.includes(entry))
    if (sports.length === 0) {
      sports = SUPPORTED_SPORTS
    }

    // Determine markets to include
    let markets: string[]
    if (market && market !== 'all') {
      markets = [market]
    } else {
      markets = DEFAULT_MARKETS
    }

    // Parse user books
    let userBooks: BookKey[]
    if (booksParam) {
      userBooks = booksParam.split(',').filter(Boolean) as BookKey[]
    } else {
      userBooks = DEFAULT_SELECTED_BOOKS
    }

    // Find EV opportunities
    const opportunities = await findPinnacleEVOpportunities({
      sports,
      userBooks,
      minEV: isNaN(minEV) ? 3 : minEV,
      markets,
      includeProps: false, // Props disabled for now
    })

    const payload = {
      data: opportunities,
      count: opportunities.length,
      filters: {
        sports,
        markets,
        minEV,
        userBooks,
      },
      updatedAt: new Date().toISOString(),
      cached: false,
    }
    responseCache.set(cacheKey, { ts: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[API /ev-bets] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch EV opportunities.' },
      { status: 500 }
    )
  }
}
