import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

type PlanKey =
  | 'pro_trial'
  | 'pro_monthly'
  | 'pro_annual'
  | 'unlimited_monthly'
  | 'unlimited_annual'

const PLAN_MAP: Record<PlanKey, { tier: 'pro' | 'unlimited'; label: string }> = {
  pro_trial: { tier: 'pro', label: 'Pro Trial' },
  pro_monthly: { tier: 'pro', label: 'Pro Monthly' },
  pro_annual: { tier: 'pro', label: 'Pro Annual' },
  unlimited_monthly: { tier: 'unlimited', label: 'Unlimited Monthly' },
  unlimited_annual: { tier: 'unlimited', label: 'Unlimited Annual' },
}

const MEMBERSHIP_DAYS = 7

const verifyStripeSignature = (payload: string, signatureHeader: string, secret: string) => {
  const elements = signatureHeader.split(',')
  const timestamp = elements.find((el) => el.startsWith('t='))?.split('=')[1]
  const signatures = elements
    .filter((el) => el.startsWith('v1='))
    .map((el) => el.split('=')[1])

  if (!timestamp || signatures.length === 0) return false

  const signedPayload = `${timestamp}.${payload}`
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex')

  return signatures.some((sig) => {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  })
}

const parseClientReference = (value?: string | null) => {
  if (!value) return null
  const [userId, planKey] = value.split(':')
  if (!userId || !planKey) return null
  return { userId, planKey: planKey as PlanKey }
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !secret) {
    return NextResponse.json({ error: 'Missing Stripe signature or secret' }, { status: 400 })
  }

  const payload = await req.text()
  const isValid = verifyStripeSignature(payload, signature, secret)

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(payload)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data?.object
  const clientReference = parseClientReference(session?.client_reference_id)
  if (!clientReference) {
    return NextResponse.json({ received: true, warning: 'Missing client_reference_id' })
  }

  const plan = PLAN_MAP[clientReference.planKey]
  if (!plan) {
    return NextResponse.json({ received: true, warning: 'Unknown plan key' })
  }

  const supabase = createServiceClient()
  const startedAt = new Date()
  const expiresAt = new Date(startedAt)
  expiresAt.setUTCDate(expiresAt.getUTCDate() + MEMBERSHIP_DAYS)

  const { error: authError } = await supabase.auth.admin.updateUserById(
    clientReference.userId,
    {
      user_metadata: {
        membership_tier: plan.tier,
        membership_plan: clientReference.planKey,
        membership_started_at: startedAt.toISOString(),
        membership_expires_at: expiresAt.toISOString(),
      },
    }
  )

  if (authError) {
    return NextResponse.json({ error: 'Failed to update membership metadata' }, { status: 500 })
  }

  // Update users table - use type assertion for Supabase schema compatibility
  const usersUpdate = supabase.from('users') as any
  await usersUpdate
    .update({
      subscription_tier: plan.tier,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientReference.userId)

  return NextResponse.json({ received: true })
}
