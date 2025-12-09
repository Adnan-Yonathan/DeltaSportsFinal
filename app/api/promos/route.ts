import { NextRequest, NextResponse } from 'next/server'
import { SPORTSBOOK_PROMOS, filterPromos } from '@/lib/config/sportsbook-promos'
import type { PromoFilterOptions } from '@/lib/types/promos'
import { PROMO_CATEGORIES } from '@/lib/types/promos'

export const runtime = 'nodejs'
export const revalidate = 21600 // 6 hours

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // Build filter options from query parameters
    const filters: PromoFilterOptions = {
      category: searchParams.get('category') as any,
      bookmaker: searchParams.get('bookmaker') || undefined,
      sport: searchParams.get('sport') as any,
      state: searchParams.get('state') || undefined,
      activeOnly: searchParams.get('activeOnly') !== 'false',
    }

    // Filter promos based on options
    const promos = filterPromos(SPORTSBOOK_PROMOS, filters)

    // Calculate category counts
    const categories = Object.values(PROMO_CATEGORIES).map(category => ({
      category,
      count: promos.filter(p => p.category === category).length,
    }))

    return NextResponse.json({
      promos,
      lastUpdated: new Date().toISOString(),
      count: promos.length,
      categories,
      filters,
    })
  } catch (error: any) {
    console.error('[PROMOS] API error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal error' },
      { status: 500 }
    )
  }
}
