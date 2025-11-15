import { NextRequest, NextResponse } from 'next/server'
import { ingestTeamStats } from '@/lib/services/team-stats-ingestor'

export const runtime = 'nodejs'

function parseSportsList(value: unknown): string[] | undefined {
  if (!value) return undefined
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : null))
      .filter((entry): entry is string => Boolean(entry))
    return normalized.length ? normalized : undefined
  }

  if (typeof value === 'string') {
    const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
    return parts.length ? parts : undefined
  }

  return undefined
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.warn('[TEAM-STATS] Missing CRON_SECRET environment variable')
    return false
  }

  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const sports = parseSportsList(body?.sports)
    const result = await ingestTeamStats({ sports })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[TEAM-STATS] Ingestion failed:', error)
    return NextResponse.json(
      { error: 'Failed to ingest team stats', details: error?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sports = parseSportsList(req.nextUrl.searchParams.get('sports'))
    const result = await ingestTeamStats({ sports })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[TEAM-STATS] Manual ingestion failed:', error)
    return NextResponse.json(
      { error: 'Failed to ingest team stats', details: error?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}
