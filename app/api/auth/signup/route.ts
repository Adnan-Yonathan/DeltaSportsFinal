import { NextResponse } from 'next/server'

export async function POST() {
  // Email/password signups are intentionally disabled.
  // We keep the route to avoid breaking older clients, but always reject.
  return NextResponse.json(
    { error: 'Email sign-ups are disabled. Please sign up with Google.' },
    { status: 403 }
  )
}
