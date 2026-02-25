import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

type SignUpPayload = {
  email?: string
  password?: string
}

export async function POST(request: Request) {
  // Temporary testing path:
  // allow creating email/password users without email verification.
  const allowDirectSignup =
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_DIRECT_EMAIL_SIGNUP === 'true'

  if (!allowDirectSignup) {
    return NextResponse.json(
      { error: 'Email sign-ups are disabled in production.' },
      { status: 403 }
    )
  }

  let payload: SignUpPayload
  try {
    payload = (await request.json()) as SignUpPayload
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const email = payload.email?.trim().toLowerCase()
  const password = payload.password

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required.' },
      { status: 400 }
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 }
    )
  }

  try {
    const supabase = createServiceClient()
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Direct signup failed:', error)
    return NextResponse.json(
      { error: 'Failed to create account.' },
      { status: 500 }
    )
  }
}
