import { NextRequest, NextResponse } from 'next/server'
import {
  ATTRIBUTION_ACCESS_COOKIE_NAME,
  ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
} from '@/lib/attribution'

export const runtime = 'nodejs'

const LOCK_PASSWORD = process.env.ATTRIBUTION_PAGE_PASSWORD || 'Adnan@1511'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { password?: string }
  const password = typeof body.password === 'string' ? body.password : ''

  if (password !== LOCK_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(ATTRIBUTION_ACCESS_COOKIE_NAME, 'granted', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
  })

  return response
}

