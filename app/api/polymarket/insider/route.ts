import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInsiderFeed, MIN_INSIDER_SCORE } from '@/lib/services/polymarket-insider'
import { normalizePolymarketSportFilter } from '@/lib/services/polymarket-sports'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request) {
  return NextResponse.json(
    { error: 'Insider Feed is temporarily unavailable' },
    { status: 503 },
  )
}
