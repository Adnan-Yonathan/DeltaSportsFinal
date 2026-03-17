import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshInsiderFeedCache } from '@/lib/services/insider-feed-direct'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * POST /api/polymarket/insider/backfill
 * Manually triggers the Insider Feed direct-API pipeline for authenticated users.
 * Fetches top wallets from Polymarket leaderboard, computes open sports positions,
 * scores them, and upserts to insider_feed_cache.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  try {
    const result = await refreshInsiderFeedCache()

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
      ...result,
    })
  } catch (err: any) {
    console.error('[Insider Backfill] Error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
