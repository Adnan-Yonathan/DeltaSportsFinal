import Link from 'next/link'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import type { GameEdgeAnalysis } from '@/lib/services/slate-edge-detector'
import {
  buildSlatePath,
  formatEdgeDate,
  getSportLabel,
} from '@/lib/blog/market-projections'
import { SimpleHeader } from '@/components/ui/simple-header'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SportSlateSummary = {
  sport: string
  date: string | null
  gameCount: number
  updatedAt: string | null
}

type SlateRow = {
  sport: string
  date: string
  gameCount: number
  updatedAt: string | null
}

const getLatestDate = (edges: GameEdgeAnalysis[]) => {
  let latest: string | null = null
  for (const edge of edges) {
    const date = formatEdgeDate(edge)
    if (!date) continue
    if (!latest || date > latest) latest = date
  }
  return latest
}

export const metadata: Metadata = {
  title: 'Delta Sports Blog',
  description:
    'Daily betting breakdowns powered by market projections, including line movement and splits.',
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const supabase = createServiceClient()
  const { data } = (await supabase
    .from('market_projections_cache' as any)
    .select('sport, edges, updated_at')) as unknown as {
    data: Array<{ sport: string; edges: GameEdgeAnalysis[]; updated_at: string }> | null
  }

  const sportParam = Array.isArray(searchParams?.sport)
    ? searchParams?.sport[0]
    : searchParams?.sport

  const summaries: SportSlateSummary[] = (data ?? []).map((row) => {
    const edges = row.edges ?? []
    return {
      sport: row.sport,
      date: getLatestDate(edges),
      gameCount: edges.length,
      updatedAt: row.updated_at ?? null,
    }
  })

  const slates: SlateRow[] = []
  for (const row of data ?? []) {
    const byDate = new Map<string, number>()
    for (const edge of row.edges ?? []) {
      const date = formatEdgeDate(edge)
      if (!date) continue
      byDate.set(date, (byDate.get(date) ?? 0) + 1)
    }
    for (const [date, gameCount] of byDate.entries()) {
      slates.push({
        sport: row.sport,
        date,
        gameCount,
        updatedAt: row.updated_at ?? null,
      })
    }
  }

  const sports = summaries
    .map((summary) => summary.sport)
    .sort((a, b) => a.localeCompare(b))

  const filteredSlates = sportParam
    ? slates.filter((slate) => slate.sport === sportParam)
    : slates

  const recentSlates = filteredSlates
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12)

  return (
    <div className="min-h-screen bg-black text-white">
      <SimpleHeader widthClass="max-w-6xl" />
      <div className="px-4 sm:px-6 lg:px-10 pt-24 pb-12 max-w-5xl mx-auto space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Delta Sports Blog
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold">
            Market projection breakdowns
          </h1>
          <p className="text-sm text-white/70 max-w-2xl">
            Every game in our market projections gets a breakdown. If data is missing,
            the post calls it out explicitly.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Filter by sport</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/blog"
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition ${
                !sportParam
                  ? 'border-emerald-400/60 text-emerald-200'
                  : 'border-white/10 text-white/70 hover:border-emerald-500/40 hover:text-emerald-200'
              }`}
            >
              All
            </Link>
            {sports.map((sport) => (
              <Link
                key={sport}
                href={`/blog?sport=${sport}`}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition ${
                  sportParam === sport
                    ? 'border-emerald-400/60 text-emerald-200'
                    : 'border-white/10 text-white/70 hover:border-emerald-500/40 hover:text-emerald-200'
                }`}
              >
                {getSportLabel(sport)}
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Latest slates</h2>
          {recentSlates.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {recentSlates.map((slate) => (
                <div
                  key={`${slate.sport}-${slate.date}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                      {getSportLabel(slate.sport)}
                    </p>
                    <p className="text-xl font-semibold">
                      Slate for {slate.date}
                    </p>
                  </div>
                  <p className="text-sm text-white/60">
                    {slate.gameCount} games • Updated{' '}
                    {slate.updatedAt
                      ? new Date(slate.updatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })
                      : 'TBD'}
                  </p>
                  <Link
                    href={buildSlatePath(slate.sport, slate.date)}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:border-emerald-500/40 hover:text-emerald-200 transition-colors"
                  >
                    View slate
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/60">No market projection data available.</p>
          )}
        </section>

        {!sportParam && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Sports overview</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {summaries.length ? (
                summaries.map((summary) => (
                  <div
                    key={summary.sport}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                        {getSportLabel(summary.sport)}
                      </p>
                      <p className="text-xl font-semibold">
                        {summary.date ? `Latest slate: ${summary.date}` : 'No slate available'}
                      </p>
                    </div>
                    <p className="text-sm text-white/60">
                      {summary.gameCount} games • Updated{' '}
                      {summary.updatedAt
                        ? new Date(summary.updatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })
                        : 'TBD'}
                    </p>
                    {summary.date ? (
                      <Link
                        href={buildSlatePath(summary.sport, summary.date)}
                        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:border-emerald-500/40 hover:text-emerald-200 transition-colors"
                      >
                        View slate
                      </Link>
                    ) : (
                      <span className="text-xs text-white/50">Slate missing.</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/60">No market projection data available.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
