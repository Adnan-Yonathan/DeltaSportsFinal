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
import { OddsMatrixSurface } from '@/components/ui/odds-matrix-surface'
import { CardSpotlight } from '@/components/ui/card-spotlight'
import { ArrowRight } from 'lucide-react'
import { SEO_BLOG_TOPICS } from '@/lib/blog/seo-topics'

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
  title: 'Sharp Betting Blog | Market Projections & Line Analysis | Delta Sports',
  description:
    'Daily sharp money breakdowns: market projections, line movement analysis, reverse line movement, and betting edges across NBA, NFL, NHL, and MLB.',
  alternates: {
    canonical: 'https://deltasports.app/blog',
  },
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
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.32} className="opacity-90" />
      <SimpleHeader widthClass="max-w-6xl" />
      <div className="relative z-10 mx-auto max-w-5xl space-y-10 px-4 pb-12 pt-20 sm:px-6 sm:pt-24 lg:px-10">
        <header className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            Delta Blog
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Market projection breakdowns
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
            Every game in our market projections gets a breakdown. If data is missing,
            the post calls it out explicitly.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Featured betting guides</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {SEO_BLOG_TOPICS.map((topic) => (
              <Link key={topic.slug} href={`/blog/insights/${topic.slug}`}>
                <CardSpotlight
                  className="relative rounded-3xl border border-white/10 bg-black/55 p-5 backdrop-blur transition-colors hover:border-emerald-400/35"
                  color="rgba(16,185,129,0.10)"
                  radius={360}
                >
                  <div aria-hidden className="pointer-events-none absolute inset-0 insider-grid opacity-15" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/55">
                      SEO Guide
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">{topic.title}</p>
                    <p className="mt-3 text-sm text-white/60">{topic.metaDescription}</p>
                    <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/90">
                      <span>Read guide</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </CardSpotlight>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Filter by sport</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="/blog"
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition ${
                !sportParam
                  ? 'border-emerald-400/60 text-emerald-200 bg-emerald-400/10'
                  : 'border-white/10 text-white/70 hover:border-emerald-500/40 hover:text-emerald-200'
              }`}
            >
              All
            </Link>
            {sports.map((sport) => (
              <Link
                key={sport}
                href={`/blog?sport=${sport}`}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition ${
                  sportParam === sport
                    ? 'border-emerald-400/60 text-emerald-200 bg-emerald-400/10'
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
                <Link key={`${slate.sport}-${slate.date}`} href={buildSlatePath(slate.sport, slate.date)}>
                  <CardSpotlight
                    className="relative rounded-3xl border border-white/10 bg-black/55 p-5 backdrop-blur transition-colors hover:border-emerald-400/35"
                    color="rgba(16,185,129,0.10)"
                    radius={360}
                  >
                    <div aria-hidden className="pointer-events-none absolute inset-0 insider-grid opacity-15" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/55">
                        {getSportLabel(slate.sport)}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">Slate for {slate.date}</p>
                      <p className="mt-3 text-sm text-white/60">
                        {slate.gameCount} games - Updated{' '}
                        {slate.updatedAt
                          ? new Date(slate.updatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })
                          : 'TBD'}
                      </p>
                      <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/90">
                        <span>View slate</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </CardSpotlight>
                </Link>
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
                  <CardSpotlight
                    key={summary.sport}
                    className="relative rounded-3xl border border-white/10 bg-black/55 p-5 backdrop-blur"
                    color="rgba(56,189,248,0.08)"
                    radius={340}
                  >
                    <div aria-hidden className="pointer-events-none absolute inset-0 insider-grid opacity-15" />
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/55">
                          {getSportLabel(summary.sport)}
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {summary.date ? `Latest slate: ${summary.date}` : 'No slate available'}
                        </p>
                      </div>
                      <p className="text-sm text-white/60">
                        {summary.gameCount} games - Updated{' '}
                        {summary.updatedAt
                          ? new Date(summary.updatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })
                          : 'TBD'}
                      </p>
                      {summary.date ? (
                        <Link
                          href={buildSlatePath(summary.sport, summary.date)}
                          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/90 hover:text-emerald-100"
                        >
                          <span>View slate</span>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      ) : (
                        <span className="text-xs text-white/50">Slate missing.</span>
                      )}
                    </div>
                  </CardSpotlight>
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
