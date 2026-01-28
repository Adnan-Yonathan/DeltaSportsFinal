import { NextResponse } from 'next/server'
import { fetchOdds } from '@/lib/api/odds-api'

export const runtime = 'nodejs'
export const maxDuration = 20

const WARMUP_SPORTS = ['basketball_nba', 'americanfootball_nfl']

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race<T | null>([
      promise,
      new Promise<null>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`warmup timeout after ${ms}ms`)), ms)
      }) as Promise<null>,
    ])
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function GET() {
  const started = Date.now()
  const results = await Promise.allSettled(
    WARMUP_SPORTS.map(sport =>
      withTimeout(
        fetchOdds(sport, ['h2h', 'spreads', 'totals'], {
          live: false,
          forceProvider: 'sportsbettingdime',
        }),
        4000
      )
    )
  )

  const warmed = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({
    warmed,
    durationMs: Date.now() - started,
  })
}
