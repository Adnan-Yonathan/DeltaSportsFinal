import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  AFFILIATE_COOKIE_MAX_AGE_SECONDS,
  AFFILIATE_COOKIE_NAME,
  AFFILIATE_SESSION_COOKIE_NAME,
  normalizeAffiliateCode,
} from '@/lib/affiliate'

export const runtime = 'nodejs'

const hashValue = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex')

const buildRedirectResponse = (request: NextRequest) => {
  const redirectUrl = new URL('/checkout?source=affiliate', request.url)
  return NextResponse.redirect(redirectUrl)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const response = buildRedirectResponse(request)
  const code = normalizeAffiliateCode(params?.code)
  if (!code) {
    return response
  }

  const supabase = createServiceClient()
  const db = supabase as any

  const { data: affiliate } = await db
    .from('affiliates')
    .select('code,status')
    .eq('code', code)
    .maybeSingle()

  if (!affiliate || affiliate.status !== 'active') {
    return response
  }

  const existingSessionId = request.cookies.get(AFFILIATE_SESSION_COOKIE_NAME)?.value
  const sessionId = existingSessionId || crypto.randomUUID()
  const forwardedFor = request.headers.get('x-forwarded-for') || ''
  const ip = forwardedFor.split(',')[0]?.trim() || request.headers.get('x-real-ip') || ''
  const userAgent = request.headers.get('user-agent') || ''

  try {
    await db.from('affiliate_clicks').insert({
      code,
      session_id: sessionId,
      ip_hash: ip ? hashValue(ip) : null,
      user_agent_hash: userAgent ? hashValue(userAgent) : null,
    })
  } catch (error) {
    console.warn('[AFFILIATE] Failed to persist affiliate click:', error)
  }

  response.cookies.set(AFFILIATE_COOKIE_NAME, code, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: AFFILIATE_COOKIE_MAX_AGE_SECONDS,
  })

  if (!existingSessionId) {
    response.cookies.set(AFFILIATE_SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: AFFILIATE_COOKIE_MAX_AGE_SECONDS,
    })
  }

  return response
}
