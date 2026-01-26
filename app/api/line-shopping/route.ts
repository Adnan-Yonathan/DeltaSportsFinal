import { NextResponse } from 'next/server'
import { fetchLineShoppingOdds, fetchAvailableBookmakers } from '@/lib/api/the-odds-api'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport') || 'nba'
  const booksParam = searchParams.get('books')
  const listBooks = searchParams.get('listBooks') === 'true'

  try {
    // If requesting list of available bookmakers
    if (listBooks) {
      const bookmakers = await fetchAvailableBookmakers()
      return NextResponse.json({ bookmakers })
    }

    // Parse selected books if provided
    const selectedBooks = booksParam
      ? booksParam.split(',').map(b => b.trim()).filter(Boolean)
      : undefined

    // Fetch odds from The Odds API
    const games = await fetchLineShoppingOdds(sport, selectedBooks)

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
