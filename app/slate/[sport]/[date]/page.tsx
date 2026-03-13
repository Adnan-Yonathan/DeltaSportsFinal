import type { Metadata } from 'next'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import type { GameEdgeAnalysis } from '@/lib/services/slate-edge-detector'
import {
  buildBlogPath,
  formatEdgeDate,
  getSportLabel,
  resolveSportParam,
} from '@/lib/blog/market-projections'
import { SimpleHeader } from '@/components/ui/simple-header'
import { BlogNavButtons } from '@/components/blog/BlogNavButtons'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageParams = {
  sport: string
  date: string
}

const formatTime = (value?: string | null) => {
  if (!value) return 'TBD'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'TBD'
  return parsed.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const loadSlateEdges = async (sport: string, date: string) => {
  const sportKey = resolveSportParam(sport)
  const supabase = createServiceClient()
  const { data } = (await supabase
    .from('market_projections_cache' as any)
    .select('edges, updated_at')
    .eq('sport', sportKey)
    .single()) as unknown as { data: { edges: GameEdgeAnalysis[]; updated_at: string } | null }

  const edges = data?.edges ?? []
  const filtered = edges.filter((edge) => formatEdgeDate(edge) === date)
  return { edges: filtered, updatedAt: data?.updated_at ?? null }
}

export async function generateMetadata({
  params,
}: {
  params: PageParams
}): Promise<Metadata> {
  const sportLabel = getSportLabel(params.sport)
  const title = `${sportLabel} slate breakdown – ${params.date}`
  const description = `All ${sportLabel} games on ${params.date} with betting breakdowns, line movement, and splits.`
  const today = new Date().toISOString().slice(0, 10)
  const isPast = params.date < today
  return {
    title,
    description,
    ...(isPast && { robots: { index: false, follow: false } }),
    openGraph: { title, description, type: 'website' },
  }
}

export default async function SlatePage({
  params,
}: {
  params: PageParams
}) {
  const { edges, updatedAt } = await loadSlateEdges(params.sport, params.date)
  const sportLabel = getSportLabel(params.sport)

  return (
    <div className="min-h-screen bg-black text-white">
      <SimpleHeader widthClass="max-w-6xl" />
      <div className="px-4 sm:px-6 lg:px-10 pt-24 pb-10 max-w-5xl mx-auto space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            {sportLabel} Slate
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold">
            {sportLabel} betting breakdowns for {params.date}
          </h1>
          <p className="text-sm text-white/70">
            Updated {updatedAt ? new Date(updatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'TBD'}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
            <BlogNavButtons />
            <Link className="text-white/70 hover:text-emerald-200" href="/blog">
              Back to blog
            </Link>
            <Link className="text-white/70 hover:text-emerald-200" href="/">
              Home
            </Link>
          </div>
        </header>

        {edges.length ? (
          <div className="space-y-3">
            {edges.map((edge) => (
              <Link
                key={`${edge.awayTeam}-${edge.homeTeam}-${edge.commenceTime}`}
                href={buildBlogPath(params.sport, params.date, edge.awayTeam, edge.homeTeam)}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-400/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-semibold">
                    {edge.awayTeam} vs {edge.homeTeam}
                  </p>
                  <span className="text-xs text-white/50">
                    {formatTime(edge.commenceTime)}
                  </span>
                </div>
                <p className="text-sm text-white/70">
                  {edge.sharpSignals?.length
                    ? `${edge.sharpSignals.length} sharp signals • ${edge.factors?.length ?? 0} matchup factors`
                    : 'Sharp signals missing • Matchup factors available in full breakdown'}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/60">
            No market projection games found for this slate.
          </p>
        )}
      </div>
    </div>
  )
}
