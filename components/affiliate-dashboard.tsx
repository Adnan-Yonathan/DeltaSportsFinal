'use client'

import { useEffect, useMemo, useState } from 'react'

type AffiliateStats = {
  totalReferrals: number
  paidReferrals: number
  activeReferrals: number
  trialingReferrals: number
  totalRevenueCents: number
  lifetimeCommissionCents: number
  availableCommissionCents: number
  requestedCommissionCents: number
  paidCommissionCents: number
}

type AffiliateReferral = {
  id: string
  referred_user_id?: string
  referred_email?: string | null
  subscriber_status?: string | null
  lifetime_revenue_cents?: number | null
  lifetime_commission_cents?: number | null
  created_at?: string | null
}

type AffiliatePayoutRequest = {
  id: string
  amount_cents: number
  status: string
  created_at?: string | null
}

type AffiliateDashboardPayload = {
  affiliate: {
    code: string
    status: string
  }
  referralUrl: string
  stats: AffiliateStats
  referrals: AffiliateReferral[]
  payoutRequests: AffiliatePayoutRequest[]
}

const formatMoney = (cents?: number | null) =>
  `$${((cents ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatDate = (value?: string | null) => {
  if (!value) return 'n/a'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return 'n/a'
  return new Date(parsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
    <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</div>
    <div className="mt-2 text-xl font-semibold text-white">{value}</div>
  </div>
)

export default function AffiliateDashboard() {
  const [data, setData] = useState<AffiliateDashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null)

  const loadDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/affiliate/dashboard', { cache: 'no-store' })
      const payload = (await res.json().catch(() => ({}))) as AffiliateDashboardPayload & {
        error?: string
      }
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to load affiliate dashboard')
      }
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load affiliate dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const availableCents = useMemo(() => data?.stats?.availableCommissionCents ?? 0, [data])

  const handleCopy = async () => {
    if (!data?.referralUrl) return
    try {
      await navigator.clipboard.writeText(data.referralUrl)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 1500)
    }
  }

  const handlePayoutRequest = async () => {
    setPayoutLoading(true)
    setPayoutMessage(null)
    try {
      const res = await fetch('/api/affiliate/payout-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to request payout')
      }
      setPayoutMessage('Payout request submitted.')
      await loadDashboard()
    } catch (err) {
      setPayoutMessage(err instanceof Error ? err.message : 'Failed to request payout')
    } finally {
      setPayoutLoading(false)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">Loading affiliate dashboard...</div>
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-sm text-red-100">
        {error || 'Failed to load affiliate dashboard.'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Affiliate Code</div>
            <div className="mt-1 text-2xl font-semibold text-white">{data.affiliate.code}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-white/85 hover:border-emerald-300/60"
            >
              {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy link'}
            </button>
            <a
              href={data.referralUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-white/85 hover:border-emerald-300/60"
            >
              Open link
            </a>
          </div>
        </div>
        <div className="mt-3 break-all text-xs text-white/65">{data.referralUrl}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Referrals" value={String(data.stats.totalReferrals)} />
        <StatCard label="Active Referrals" value={String(data.stats.activeReferrals)} />
        <StatCard label="Trialing Referrals" value={String(data.stats.trialingReferrals)} />
        <StatCard label="Paid Referrals" value={String(data.stats.paidReferrals)} />
        <StatCard label="Total Revenue" value={formatMoney(data.stats.totalRevenueCents)} />
        <StatCard label="Lifetime Commission" value={formatMoney(data.stats.lifetimeCommissionCents)} />
        <StatCard label="Available" value={formatMoney(data.stats.availableCommissionCents)} />
        <StatCard label="Paid Out" value={formatMoney(data.stats.paidCommissionCents)} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Payouts</div>
            <div className="mt-1 text-lg font-semibold text-white">Available now: {formatMoney(availableCents)}</div>
            <div className="mt-1 text-xs text-white/60">Minimum payout request is $50.00</div>
          </div>
          <button
            type="button"
            disabled={payoutLoading || availableCents < 5000}
            onClick={handlePayoutRequest}
            className="rounded-lg border border-emerald-300/60 bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {payoutLoading ? 'Requesting...' : 'Request payout'}
          </button>
        </div>
        {payoutMessage ? <div className="mt-3 text-sm text-white/80">{payoutMessage}</div> : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Recent Referrals</div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm text-white/80">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-white/45">
              <tr>
                <th className="pb-2">User</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Revenue</th>
                <th className="pb-2">Commission</th>
                <th className="pb-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(data.referrals ?? []).slice(0, 12).map((referral) => (
                <tr key={referral.id} className="border-t border-white/10">
                  <td className="py-2">{referral.referred_email || referral.referred_user_id || 'Unknown'}</td>
                  <td className="py-2">{referral.subscriber_status || 'pending'}</td>
                  <td className="py-2">{formatMoney(referral.lifetime_revenue_cents)}</td>
                  <td className="py-2">{formatMoney(referral.lifetime_commission_cents)}</td>
                  <td className="py-2">{formatDate(referral.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
