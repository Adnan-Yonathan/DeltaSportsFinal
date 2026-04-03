import { cookies } from 'next/headers'
import AttributionUnlockForm from '@/components/attribution/unlock-form'
import { ATTRIBUTION_ACCESS_COOKIE_NAME } from '@/lib/attribution'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TrialAttributionRow = {
  id: string
  user_id: string
  trial_status: string
  channel: string
  source: string | null
  medium: string | null
  campaign: string | null
  landing_path: string | null
  referrer_host: string | null
  affiliate_code: string | null
  trial_started_at: string | null
  created_at: string
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'n/a'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return 'n/a'
  return new Date(parsed).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const percent = (value: number, total: number) => {
  if (!total) return '0.0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

export default async function AttributionPage() {
  const cookieStore = cookies()
  const unlocked = cookieStore.get(ATTRIBUTION_ACCESS_COOKIE_NAME)?.value === 'granted'

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-black px-4 py-8">
        <AttributionUnlockForm />
      </main>
    )
  }

  const db = createServiceClient() as any
  const { data, error } = await db
    .from('trial_attributions')
    .select('id,user_id,trial_status,channel,source,medium,campaign,landing_path,referrer_host,affiliate_code,trial_started_at,created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const rows: TrialAttributionRow[] = Array.isArray(data) ? (data as TrialAttributionRow[]) : []

  const byChannel = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.channel || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const bySource = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.source || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.trial_status || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const topChannels = Object.entries(byChannel).sort((a, b) => b[1] - a[1]).slice(0, 12)
  const topSources = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 20)
  const statusBreakdown = Object.entries(byStatus).sort((a, b) => b[1] - a[1])

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Attribution Dashboard</h1>
            <p className="mt-1 text-sm text-white/65">
              Trial source tracking across affiliate, blog, search, social, referral, and direct traffic.
            </p>
          </div>
          <form method="post" action="/api/attribution/lock">
            <button
              type="submit"
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/80 hover:border-white/40"
            >
              Lock page
            </button>
          </form>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            Failed to load attribution data: {error.message}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Tracked trials</div>
            <div className="mt-2 text-2xl font-semibold">{rows.length}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Active</div>
            <div className="mt-2 text-2xl font-semibold">{byStatus.active || 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Trialing</div>
            <div className="mt-2 text-2xl font-semibold">{byStatus.trialing || 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Affiliate</div>
            <div className="mt-2 text-2xl font-semibold">{byChannel.affiliate || 0}</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">By channel</h2>
            <div className="mt-3 space-y-2">
              {topChannels.map(([channel, count]) => (
                <div key={channel} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
                  <span className="capitalize">{channel.replace(/_/g, ' ')}</span>
                  <span className="text-white/80">{count} ({percent(count, rows.length)})</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">By source</h2>
            <div className="mt-3 space-y-2">
              {topSources.map(([source, count]) => (
                <div key={source} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
                  <span>{source}</span>
                  <span className="text-white/80">{count} ({percent(count, rows.length)})</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">Trial status</h2>
            <div className="mt-3 space-y-2">
              {statusBreakdown.map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
                  <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                  <span className="text-white/80">{count} ({percent(count, rows.length)})</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">Latest trial attributions</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1080px] w-full text-left text-sm text-white/85">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                <tr>
                  <th className="pb-2">Created</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Channel</th>
                  <th className="pb-2">Source</th>
                  <th className="pb-2">Medium</th>
                  <th className="pb-2">Campaign</th>
                  <th className="pb-2">Landing</th>
                  <th className="pb-2">Referrer</th>
                  <th className="pb-2">Affiliate</th>
                  <th className="pb-2">User ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="py-2 pr-3">{formatDate(row.created_at)}</td>
                    <td className="py-2 pr-3">{row.trial_status || 'n/a'}</td>
                    <td className="py-2 pr-3">{row.channel || 'n/a'}</td>
                    <td className="py-2 pr-3">{row.source || 'n/a'}</td>
                    <td className="py-2 pr-3">{row.medium || 'n/a'}</td>
                    <td className="py-2 pr-3">{row.campaign || 'n/a'}</td>
                    <td className="py-2 pr-3">{row.landing_path || 'n/a'}</td>
                    <td className="py-2 pr-3">{row.referrer_host || 'n/a'}</td>
                    <td className="py-2 pr-3">{row.affiliate_code || 'n/a'}</td>
                    <td className="py-2 pr-3 text-xs text-white/60">{row.user_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

