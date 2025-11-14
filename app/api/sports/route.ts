import { NextResponse } from 'next/server'
import { listSports } from '@/lib/api/odds-api'

export const runtime = 'edge'

export async function GET() {
  try {
    const sports = await listSports()
    return NextResponse.json({
      count: sports.length,
      sports,
    })
  } catch (error: any) {
    console.error('[SPORTS] Failed to fetch sports:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch sports' },
      { status: error?.statusCode || 500 }
    )
  }
}
