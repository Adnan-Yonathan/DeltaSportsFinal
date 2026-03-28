import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createServiceClient } from '@/lib/supabase/service'
import { buildAffiliateReferralPath } from '@/lib/affiliate'
import { ensureAffiliateProfile } from '@/lib/services/affiliate-program'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const toInteger = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

const sumBy = (rows: Array<Record<string, unknown>>, key: string, statuses?: string[]) =>
  rows.reduce((total, row) => {
    const rowStatus = String(row.status ?? '')
    if (statuses && !statuses.includes(rowStatus)) return total
    return total + toInteger(row[key])
  }, 0)

const isMissingColumnError = (error: any, columnName: string) => {
  const message = String(error?.message ?? '').toLowerCase()
  const column = columnName.toLowerCase()
  return message.includes(column) && message.includes('does not exist')
}

const isMissingAnyColumnError = (error: any, columnNames: string[]) =>
  columnNames.some((columnName) => isMissingColumnError(error, columnName))

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient<any>({ cookies })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const serviceSupabase = createServiceClient()
    const db = serviceSupabase as any
    const affiliate = await ensureAffiliateProfile(serviceSupabase as any, user.id)

    const fetchAttributions = async () => {
      const enrichedSelect =
        'id,code,referred_user_id,subscription_id,status,created_at,converted_at,paid_at,subscriber_status,last_invoice_paid_at,amount_cents,lifetime_revenue_cents,lifetime_commission_cents'
      const legacySelect =
        'id,code,referred_user_id,subscription_id,status,created_at,converted_at,paid_at,trial_end_at,amount_cents'

      const primary = await db
        .from('affiliate_attributions')
        .select(enrichedSelect)
        .eq('code', affiliate.code)
        .order('created_at', { ascending: false })
        .limit(500)

      if (
        primary.error &&
        isMissingAnyColumnError(primary.error, [
          'subscriber_status',
          'last_invoice_paid_at',
          'lifetime_revenue_cents',
          'lifetime_commission_cents',
        ])
      ) {
        const fallback = await db
          .from('affiliate_attributions')
          .select(legacySelect)
          .eq('code', affiliate.code)
          .order('created_at', { ascending: false })
          .limit(500)
        return { data: fallback.data, error: fallback.error, legacySchema: true as const }
      }

      return { data: primary.data, error: primary.error, legacySchema: false as const }
    }

    const fetchPayoutRequests = async () => {
      const enrichedSelect = 'id,affiliate_code,amount_cents,status,created_at,processed_at,notes'
      const legacySelect = 'id,affiliate_code,amount_cents,status,created_at'

      const primary = await db
        .from('affiliate_payout_requests')
        .select(enrichedSelect)
        .eq('affiliate_code', affiliate.code)
        .order('created_at', { ascending: false })
        .limit(200)

      if (primary.error && isMissingAnyColumnError(primary.error, ['processed_at', 'notes'])) {
        const fallback = await db
          .from('affiliate_payout_requests')
          .select(legacySelect)
          .eq('affiliate_code', affiliate.code)
          .order('created_at', { ascending: false })
          .limit(200)
        return { data: fallback.data, error: fallback.error, legacySchema: true as const }
      }

      return { data: primary.data, error: primary.error, legacySchema: false as const }
    }

    const [
      attributionResult,
      { data: commissions, error: commError },
      payoutRequestResult,
    ] = await Promise.all([
      fetchAttributions(),
      db
        .from('affiliate_commissions')
        .select(
          'id,affiliate_code,attribution_id,referred_user_id,subscription_id,stripe_invoice_id,invoice_amount_cents,commission_rate_bps,commission_amount_cents,status,earned_at,paid_at,payout_request_id'
        )
        .eq('affiliate_code', affiliate.code)
        .order('earned_at', { ascending: false })
        .limit(1000),
      fetchPayoutRequests(),
    ])

    const { data: attributions, error: attrError } = attributionResult
    const { data: payoutRequests, error: payoutError } = payoutRequestResult

    if (attrError || commError || payoutError) {
      throw new Error(attrError?.message || commError?.message || payoutError?.message || 'Failed to load affiliate dashboard')
    }

    const attributionRows = (attributions ?? []) as Array<Record<string, unknown>>
    const commissionRows = (commissions ?? []) as Array<Record<string, unknown>>
    const payoutRows = (payoutRequests ?? []) as Array<Record<string, unknown>>

    const referredUserIds = Array.from(
      new Set(attributionRows.map((row) => String(row.referred_user_id ?? '')).filter(Boolean))
    )

    const userEmailById = new Map<string, string | null>()
    if (referredUserIds.length) {
      const { data: referredUsers, error: usersError } = await db
        .from('users')
        .select('id,email,created_at')
        .in('id', referredUserIds)

      if (!usersError && Array.isArray(referredUsers)) {
        for (const row of referredUsers) {
          userEmailById.set(String(row.id), row.email ? String(row.email) : null)
        }
      }
    }

    const totalRevenueCents = sumBy(attributionRows, 'lifetime_revenue_cents')
    const lifetimeCommissionCents = sumBy(commissionRows, 'commission_amount_cents', [
      'earned',
      'requested',
      'paid',
      'reversed',
    ])

    const availableCommissionCents = sumBy(commissionRows, 'commission_amount_cents', ['earned'])
    const requestedCommissionCents = sumBy(commissionRows, 'commission_amount_cents', ['requested'])
    const paidCommissionCents = sumBy(commissionRows, 'commission_amount_cents', ['paid'])

    const resolveSubscriberStatus = (row: Record<string, unknown>) => {
      const modernStatus = String(row.subscriber_status ?? '').toLowerCase()
      if (modernStatus) return modernStatus
      const legacyStatus = String(row.status ?? '').toLowerCase()
      if (legacyStatus === 'pending') return 'trialing'
      if (legacyStatus === 'earned' || legacyStatus === 'paid') return 'active'
      return legacyStatus || 'pending'
    }

    const enrichedAttributions: Array<Record<string, unknown>> = attributionRows.map((row) => {
      const referredUserId = String(row.referred_user_id ?? '')
      return {
        ...row,
        subscriber_status: resolveSubscriberStatus(row),
        referred_email: userEmailById.get(referredUserId) ?? null,
      }
    })

    const paidReferrals = enrichedAttributions.filter(
      (row) => toInteger(row.lifetime_revenue_cents) > 0
    ).length

    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return NextResponse.json({
      affiliate,
      referralPath: buildAffiliateReferralPath(affiliate.code),
      referralUrl: `${origin}${buildAffiliateReferralPath(affiliate.code)}`,
      stats: {
        totalReferrals: enrichedAttributions.length,
        paidReferrals,
        activeReferrals: enrichedAttributions.filter((row) => row.subscriber_status === 'active').length,
        trialingReferrals: enrichedAttributions.filter((row) => row.subscriber_status === 'trialing').length,
        totalRevenueCents,
        lifetimeCommissionCents,
        availableCommissionCents,
        requestedCommissionCents,
        paidCommissionCents,
      },
      referrals: enrichedAttributions,
      commissions: commissionRows,
      payoutRequests: payoutRows,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load affiliate dashboard' },
      { status: 500 }
    )
  }
}
