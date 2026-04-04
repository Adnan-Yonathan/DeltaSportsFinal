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

type AttributionTouchRow = {
  session_id: string
  touch_kind: 'first_touch' | 'last_touch'
  channel: string
  source: string | null
}

type AttributionEventRow = {
  id: string
  event_name: string
  session_id: string
  user_id: string | null
  stripe_customer_id: string | null
  channel: string
  source: string | null
  landing_path: string | null
  occurred_at: string
  metadata: Record<string, unknown> | null
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
  const [trialResult, touchResult, eventResult] = await Promise.all([
    db
      .from('trial_attributions')
      .select(
        'id,user_id,trial_status,channel,source,medium,campaign,landing_path,referrer_host,affiliate_code,trial_started_at,created_at'
      )
      .order('created_at', { ascending: false })
      .limit(500),
    db
      .from('attribution_touches')
      .select('session_id,touch_kind,channel,source')
      .order('occurred_at', { ascending: false })
      .limit(5000),
    db
      .from('attribution_events')
      .select(
        'id,event_name,session_id,user_id,stripe_customer_id,channel,source,landing_path,occurred_at,metadata'
      )
      .order('occurred_at', { ascending: false })
      .limit(5000),
  ])

  const trialRows: TrialAttributionRow[] = Array.isArray(trialResult.data)
    ? (trialResult.data as TrialAttributionRow[])
    : []
  const touchRows: AttributionTouchRow[] = Array.isArray(touchResult.data)
    ? (touchResult.data as AttributionTouchRow[])
    : []
  const eventRows: AttributionEventRow[] = Array.isArray(eventResult.data)
    ? (eventResult.data as AttributionEventRow[])
    : []

  const firstTouchRows = touchRows.filter((row) => row.touch_kind === 'first_touch')
  const pageViewEvents = eventRows.filter((row) => row.event_name === 'page_view')
  const portalEvents = eventRows.filter((row) => row.event_name === 'stripe_portal_opened')

  const visitorSessions = new Set<string>()
  for (const row of firstTouchRows) {
    if (row.session_id) visitorSessions.add(row.session_id)
  }
  for (const row of pageViewEvents) {
    if (row.session_id) visitorSessions.add(row.session_id)
  }

  const acquisitionRows = firstTouchRows.length
    ? firstTouchRows
    : trialRows.map((row) => ({
        session_id: row.id,
        touch_kind: 'first_touch' as const,
        channel: row.channel,
        source: row.source,
      }))

  const byChannel = acquisitionRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.channel || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const bySource = acquisitionRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.source || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const byStatus = trialRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.trial_status || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const portalCustomers = new Set(
    portalEvents
      .map((row) => (row.stripe_customer_id ? String(row.stripe_customer_id) : ''))
      .filter(Boolean)
  )
  const portalUsers = new Set(
    portalEvents
      .map((row) => (row.user_id ? String(row.user_id) : ''))
      .filter(Boolean)
  )

  const topChannels = Object.entries(byChannel).sort((a, b) => b[1] - a[1]).slice(0, 12)
  const topSources = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 20)
  const statusBreakdown = Object.entries(byStatus).sort((a, b) => b[1] - a[1])

  const errors = [trialResult.error, touchResult.error, eventResult.error]
    .filter((item): item is { message: string } => Boolean(item))
    .map((item) => item.message)

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Attribution Dashboard</h1>
            <p className="mt-1 text-sm text-white/65">
              Full-funnel source tracking across visitors, Stripe portal customers, and trials.
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

        {errors.length ? (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            Failed to load attribution data: {errors.join(' | ')}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Unique visitors</div>
            <div className="mt-2 text-2xl font-semibold">{visitorSessions.size}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Page views</div>
            <div className="mt-2 text-2xl font-semibold">{pageViewEvents.length}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Portal opens</div>
            <div className="mt-2 text-2xl font-semibold">{portalEvents.length}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Portal customers</div>
            <div className="mt-2 text-2xl font-semibold">{portalCustomers.size}</div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Tracked trials</div>
            <div className="mt-2 text-2xl font-semibold">{trialRows.length}</div>
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
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Portal users</div>
            <div className="mt-2 text-2xl font-semibold">{portalUsers.size}</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">Visitor channel mix</h2>
            <div className="mt-3 space-y-2">
              {topChannels.map(([channel, count]) => (
                <div key={channel} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
                  <span className="capitalize">{channel.replace(/_/g, ' ')}</span>
                  <span className="text-white/80">{count} ({percent(count, acquisitionRows.length)})</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">Visitor source mix</h2>
            <div className="mt-3 space-y-2">
              {topSources.map(([source, count]) => (
                <div key={source} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
                  <span>{source}</span>
                  <span className="text-white/80">{count} ({percent(count, acquisitionRows.length)})</span>
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
                  <span className="text-white/80">{count} ({percent(count, trialRows.length)})</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">Latest portal events</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-sm text-white/85">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                <tr>
                  <th className="pb-2">Occurred</th>
                  <th className="pb-2">Channel</th>
                  <th className="pb-2">Source</th>
                  <th className="pb-2">Flow</th>
                  <th className="pb-2">Landing</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">User ID</th>
                </tr>
              </thead>
              <tbody>
                {portalEvents.slice(0, 150).map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="py-2 pr-3">{formatDate(row.occurred_at)}</td>
                    <td className="py-2 pr-3">{row.channel || 'n/a'}</td>
                    <td className="py-2 pr-3">{row.source || 'n/a'}</td>
                    <td className="py-2 pr-3">{typeof row.metadata?.flow === 'string' ? row.metadata.flow : 'n/a'}</td>
                    <td className="py-2 pr-3">{row.landing_path || 'n/a'}</td>
                    <td className="py-2 pr-3 text-xs text-white/60">{row.stripe_customer_id || 'n/a'}</td>
                    <td className="py-2 pr-3 text-xs text-white/60">{row.user_id || 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

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
                {trialRows.map((row) => (
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
