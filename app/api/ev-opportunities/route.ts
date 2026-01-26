import { NextRequest, NextResponse } from 'next/server'
import { findEVOpportunities } from '@/lib/services/cross-market-ev'
import { MARKETS, SPORTS } from '@/lib/types/odds'

export const dynamic = 'force-dynamic'

// Book configurations
const COMPARE_BOOKS = [
  { key: 'fanduel', label: 'FanDuel' },
  { key: 'draftkings', label: 'DraftKings' },
  { key: 'betmgm', label: 'BetMGM' },
  { key: 'caesars', label: 'Caesars' },
  { key: 'bet365', label: 'Bet365' },
  { key: 'betrivers', label: 'BetRivers' },
  { key: 'pinnacle', label: 'Pinnacle' },
]

const PLACE_AT_BOOKS = [
  ...COMPARE_BOOKS,
  { key: 'kalshi', label: 'Kalshi' },
  { key: 'polymarket', label: 'Polymarket' },
]

const SUPPORTED_SPORTS = [
  { key: SPORTS.NFL, label: 'NFL' },
  { key: SPORTS.NBA, label: 'NBA' },
  { key: SPORTS.NCAA_BB, label: 'NCAAB' },
  { key: SPORTS.NCAA_FB, label: 'CFB' },
  { key: SPORTS.NHL, label: 'NHL' },
  { key: SPORTS.MLB, label: 'MLB' },
]

const BET_TYPES = [
  { key: MARKETS.H2H, label: 'Moneyline' },
  { key: MARKETS.SPREADS, label: 'Spread' },
  { key: MARKETS.TOTALS, label: 'Total' },
  { key: 'player_prop', label: 'Player Props' },
]

export async function GET(request: NextRequest) {
  // Parse query params
  const { searchParams } = new URL(request.url)

  const compareBooks = searchParams.get('compareBooks')?.split(',').filter(Boolean) ||
    COMPARE_BOOKS.map(b => b.key)

  const placeAtBooks = searchParams.get('placeAtBooks')?.split(',').filter(Boolean) ||
    PLACE_AT_BOOKS.map(b => b.key)

  const sports = searchParams.get('sports')?.split(',').filter(Boolean) ||
    SUPPORTED_SPORTS.map(s => s.key)

  const betTypes = searchParams.get('betTypes')?.split(',').filter(Boolean) ||
    BET_TYPES.map(t => t.key)

  const minEV = parseFloat(searchParams.get('minEV') || '2.5') || 2.5
  const limit = parseInt(searchParams.get('limit') || '100', 10) || 100

  // Determine which team markets to include
  const teamMarkets = betTypes
    .filter(t => t !== 'player_prop')
    .filter(t => [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS].includes(t as any))

  const includeProps = betTypes.includes('player_prop')

  try {
    // Use the existing findEVOpportunities which supports compareBooks/placeAtBooks
    const opportunities = await findEVOpportunities({
      sports,
      minEV,
      minPropEV: minEV,
      minBooks: 2,
      markets: teamMarkets.length > 0 ? teamMarkets : [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS],
      limit,
      includeProps,
      slateMode: 'next',
      compareBooks,
      placeAtBooks,
    })

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      data: opportunities,
      meta: {
        compareBooks,
        placeAtBooks,
        sports,
        betTypes,
        minEV,
        count: opportunities.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load EV opportunities.'
    console.error('[EV-OPPORTUNITIES] Error:', error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
