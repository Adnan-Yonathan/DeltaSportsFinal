import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  persistAttributionEvent,
  persistAttributionTouches,
  resolveAttributionSnapshotFromRequest,
} from '@/lib/services/attribution'

export const runtime = 'nodejs'

const isSafePath = (value: unknown) => {
  if (typeof value !== 'string') return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.includes('://')) return false
  if (value.includes('\\')) return false
  return true
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { path?: string }
    const snapshot = resolveAttributionSnapshotFromRequest(req)
    const landingPath = isSafePath(body.path) ? body.path : req.nextUrl.pathname
    const serviceSupabase = createServiceClient()

    await persistAttributionTouches(serviceSupabase as any, null, snapshot)
    await persistAttributionEvent(serviceSupabase as any, {
      eventName: 'page_view',
      snapshot,
      landingPath,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.warn('[ATTRIBUTION_TOUCH] Failed to record page view:', error)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
