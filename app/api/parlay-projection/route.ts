import { NextRequest, NextResponse } from 'next/server'
import { calculateParlayProbability, type ParlayLegInput } from '@/lib/services/parlay-probability-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const legs = Array.isArray(body?.legs) ? (body.legs as ParlayLegInput[]) : []
    const sport = body?.sport

    if (!legs.length) {
      return NextResponse.json({ error: 'At least one leg is required.' }, { status: 400 })
    }

    const result = await calculateParlayProbability(legs, { sport })

    return NextResponse.json({ result })
  } catch (error: any) {
    console.error('[PARLAY_PROJECTION] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to calculate parlay projection.' },
      { status: 500 }
    )
  }
}
