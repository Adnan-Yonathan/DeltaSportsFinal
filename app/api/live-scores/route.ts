import { NextResponse } from 'next/server'
import { getAllLiveScores } from '@/lib/espn-api'

export async function GET() {
  try {
    const scores = await getAllLiveScores()

    return NextResponse.json({
      scores,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching live scores:', error)
    return NextResponse.json(
      { error: 'Failed to fetch live scores' },
      { status: 500 }
    )
  }
}

export const revalidate = 30 // Revalidate every 30 seconds
