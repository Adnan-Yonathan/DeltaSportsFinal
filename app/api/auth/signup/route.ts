import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Email/password sign-ups are disabled. Please continue with Google.' },
    { status: 403 }
  )
}
