import { NextRequest, NextResponse } from 'next/server'
import { findPinnacleEVOpportunities } from '@/lib/services/pinnacle-ev'
import { DEFAULT_SELECTED_BOOKS, type BookKey } from '@/lib/config/books'
import { fetchTheOddsApiSports } from '@/lib/api/the-odds-api'

export const dynamic = 'force-dynamic'

const SUPPORTED_SPORTS = [
  'basketball_nba',
  'basketball_ncaab',
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'icehockey_nhl',
  'baseball_mlb',
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

    // Determine sports to scan
    let sports: string[] = []
    if (sport && sport !== 'all') {
      sports = [sport]
    } else {
      try {
        const available = await fetchTheOddsApiSports()
        sports = (available || [])
          .filter((entry) => entry.active && !entry.has_outrights)
          .map((entry) => entry.key)
      } catch (error) {
        console.warn('[API /ev-bets] Failed to load active sports, using defaults.', error)
        sports = SUPPORTED_SPORTS
      }
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

    return NextResponse.json({
      data: opportunities,
      count: opportunities.length,
      filters: {
        sports,
        markets,
        minEV,
        userBooks,
      },
    })
  } catch (error) {
    console.error('[API /ev-bets] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch EV opportunities.' },
      { status: 500 }
    )
  }
}
