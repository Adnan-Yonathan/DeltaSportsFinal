import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createServiceClient } from '@/lib/supabase/service'
import { ensureAffiliateProfile } from '@/lib/services/affiliate-program'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIN_PAYOUT_CENTS = 5_000

const toInteger = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient<any>({ cookies })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceSupabase = createServiceClient()
  const db = serviceSupabase as any

  try {
    const affiliate = await ensureAffiliateProfile(serviceSupabase as any, user.id)
    const body = await req.json().catch(() => ({}))
    const requestedAmountCents = toInteger(body?.amountCents)

    const { data: earnedRows, error: earnedError } = await db
      .from('affiliate_commissions')
      .select('id,commission_amount_cents,earned_at')
      .eq('affiliate_code', affiliate.code)
      .eq('status', 'earned')
      .order('earned_at', { ascending: true })

    if (earnedError) {
      throw new Error(earnedError.message || 'Failed to load earned commissions')
    }

    const earned = Array.isArray(earnedRows) ? earnedRows : []
    const totalAvailableCents = earned.reduce(
      (sum: number, row: any) => sum + toInteger(row.commission_amount_cents),
      0
    )

    if (totalAvailableCents < MIN_PAYOUT_CENTS) {
      return NextResponse.json(
        {
          error: `Minimum payout threshold is $${(MIN_PAYOUT_CENTS / 100).toFixed(2)}.`,
          totalAvailableCents,
        },
        { status: 400 }
      )
    }

    const targetAmountCents =
      requestedAmountCents > 0 ? Math.min(requestedAmountCents, totalAvailableCents) : totalAvailableCents

    if (targetAmountCents < MIN_PAYOUT_CENTS) {
      return NextResponse.json(
        {
          error: `Requested amount must be at least $${(MIN_PAYOUT_CENTS / 100).toFixed(2)}.`,
          totalAvailableCents,
        },
        { status: 400 }
      )
    }

    let running = 0
    const selectedCommissionIds: string[] = []
    for (const row of earned) {
      if (running >= targetAmountCents) break
      const amount = toInteger(row.commission_amount_cents)
      if (amount <= 0) continue
      running += amount
      selectedCommissionIds.push(String(row.id))
    }

    if (!selectedCommissionIds.length) {
      return NextResponse.json({ error: 'No payable commissions found.' }, { status: 400 })
    }

    const { data: payoutRequest, error: insertError } = await db
      .from('affiliate_payout_requests')
      .insert({
        affiliate_code: affiliate.code,
        user_id: user.id,
        amount_cents: running,
        status: 'pending',
      })
      .select('id,affiliate_code,user_id,amount_cents,status,created_at')
      .single()

    if (insertError || !payoutRequest) {
      throw new Error(insertError?.message || 'Failed to create payout request')
    }

    const { error: updateError } = await db
      .from('affiliate_commissions')
      .update({
        status: 'requested',
        payout_request_id: payoutRequest.id,
        updated_at: new Date().toISOString(),
      })
      .in('id', selectedCommissionIds)

    if (updateError) {
      throw new Error(updateError.message || 'Failed to reserve commissions for payout request')
    }

    return NextResponse.json({
      success: true,
      payoutRequest,
      selectedCommissionCount: selectedCommissionIds.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payout request' },
      { status: 500 }
    )
  }
}
