import { NextResponse } from 'next/server'
import { fetchOdds } from '@/lib/api/odds-api'
import { fetchAvailableBookmakers } from '@/lib/api/the-odds-api'

export const dynamic = 'force-dynamic'
export const revalidate = 600

const BOOKMAKER_CACHE_TTL_MS = 24 * 60 * 60 * 1000
let cachedBookmakers: any[] | null = null
let cachedBookmakersAt = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport') || 'nba'
  const booksParam = searchParams.get('books')
  const listBooks = searchParams.get('listBooks') === 'true'

  try {
    // If requesting list of available bookmakers
    if (listBooks) {
      const now = Date.now()
      if (cachedBookmakers && now - cachedBookmakersAt < BOOKMAKER_CACHE_TTL_MS) {
        return NextResponse.json({ bookmakers: cachedBookmakers })
      }
      const bookmakers = await fetchAvailableBookmakers()
      cachedBookmakers = bookmakers
      cachedBookmakersAt = now
      return NextResponse.json({ bookmakers })
    }

    // Parse selected books if provided
    const selectedBooks = booksParam
      ? booksParam.split(',').map(b => b.trim()).filter(Boolean)
      : undefined

    // Fetch odds from The Odds API
    const games = await fetchOdds(sport, ['h2h', 'spreads', 'totals'], {
      revalidateSeconds: 600,
      bookmakers: selectedBooks,
    })

    // Get unique bookmakers from the response
    const bookmakersInResponse = new Set<string>()
    games.forEach(game => {
      game.bookmakers.forEach(bk => {
        bookmakersInResponse.add(bk.key)
      })
    })

    return NextResponse.json({
      games,
      sport,
      bookCount: bookmakersInResponse.size,
      booksFound: Array.from(bookmakersInResponse),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[LINE-SHOPPING API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch odds' },
      { status: 500 }
    )
  }
}
