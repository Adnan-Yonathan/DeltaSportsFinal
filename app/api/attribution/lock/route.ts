import { NextRequest, NextResponse } from 'next/server'
import { ATTRIBUTION_ACCESS_COOKIE_NAME } from '@/lib/attribution'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/attribution', req.url))
  response.cookies.delete(ATTRIBUTION_ACCESS_COOKIE_NAME)
  return response
}

