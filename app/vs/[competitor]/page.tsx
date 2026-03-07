import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle, XCircle } from 'lucide-react'
import { SimpleHeader } from '@/components/ui/simple-header'
import { OddsMatrixSurface } from '@/components/ui/odds-matrix-surface'
import { COMPETITORS, getCompetitorBySlug } from '@/lib/blog/competitor-data'

type PageProps = {
  params: { competitor: string }
}

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ competitor: c.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const competitor = getCompetitorBySlug(params.competitor)
  if (!competitor) return { title: 'Comparison | Delta Sports' }

  return {
    title: competitor.metaTitle,
    description: competitor.metaDescription,
    alternates: {
      canonical: `https://deltasports.app/vs/${competitor.slug}`,
    },
    openGraph: {
      title: competitor.metaTitle,
      description: competitor.metaDescription,
      type: 'website',
    },
    twitter: {
      title: competitor.metaTitle,
      description: competitor.metaDescription,
    },
  }
}

export default function CompetitorPage({ params }: PageProps) {
  const competitor = getCompetitorBySlug(params.competitor)
  if (!competitor) notFound()

  const deltaWinCount = competitor.comparisonRows.filter((r) => r.deltaWins).length

  return (
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.30} className="opacity-90" />
      <SimpleHeader widthClass="max-w-5xl" />

      <div className="relative z-10 mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-10">

        {/* Hero */}
        <header className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            {competitor.name} vs Delta Sports
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {competitor.heroHeadline}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
            {competitor.heroSubhead}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex rounded-full bg-emerald-500/20 border border-emerald-400/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 transition hover:border-emerald-300 hover:text-white"
            >
              Try Delta free for 7 days
            </Link>
            <Link
              href="/pricing"
              className="inline-flex rounded-full border border-white/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              View pricing
            </Link>
          </div>
        </header>

        {/* What they are */}
        <section className="rounded-3xl border border-white/10 bg-black/45 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/50">
            About {competitor.name}
          </p>
          <p className="mt-3 text-sm leading-7 text-white/80">{competitor.theirPitch}</p>
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-white/45">Category: </span>
              <span className="text-white/80">{competitor.category}</span>
            </div>
            <div>
              <span className="text-white/45">Pricing: </span>
              <span className="text-white/80">{competitor.theirPricing}</span>
            </div>
            <div>
              <span className="text-white/45">Focus: </span>
              <span className="text-white/80">{competitor.theirFocus}</span>
            </div>
          </div>
        </section>

        {/* Comparison table */}
        <section className="rounded-3xl border border-white/10 bg-black/45 p-6">
          <h2 className="text-xl font-semibold text-white">
            Delta Sports vs {competitor.name}: Feature Comparison
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Delta wins {deltaWinCount} of {competitor.comparisonRows.length} categories
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.25em] text-white/40">
                  <th className="pb-3 text-left font-medium">Feature</th>
                  <th className="pb-3 text-center font-medium">{competitor.name}</th>
                  <th className="pb-3 text-center font-medium">Delta Sports</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {competitor.comparisonRows.map((row) => (
                  <tr key={row.feature} className={row.deltaWins ? 'bg-emerald-500/5' : ''}>
                    <td className="py-3 pr-4 text-white/80">{row.feature}</td>
                    <td className="py-3 text-center">
                      {row.them === 'No' ? (
                        <XCircle className="mx-auto h-4 w-4 text-white/25" />
                      ) : (
                        <span className="text-white/60">{row.them}</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      {row.delta === 'No' ? (
                        <XCircle className="mx-auto h-4 w-4 text-white/25" />
                      ) : (
                        <span className={row.deltaWins ? 'text-emerald-300 font-medium' : 'text-white/60'}>
                          {row.deltaWins && row.delta !== 'Yes' ? (
                            row.delta
                          ) : row.deltaWins ? (
                            <CheckCircle className="mx-auto h-4 w-4 text-emerald-400" />
                          ) : (
                            row.delta
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Where they fall short */}
        <section className="rounded-3xl border border-white/10 bg-black/45 p-6">
          <h2 className="text-xl font-semibold text-white">
            Where {competitor.name} Falls Short
          </h2>
          <ul className="mt-4 space-y-3">
            {competitor.weaknesses.map((w) => (
              <li key={w} className="flex gap-3 text-sm text-white/75">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/60" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Why bettors switch */}
        <section className="rounded-3xl border border-white/10 bg-black/45 p-6">
          <h2 className="text-xl font-semibold text-white">
            Why Bettors Switch to Delta
          </h2>
          <div className="mt-5 space-y-5">
            {competitor.switchReasons.map((reason) => (
              <div key={reason.title} className="flex gap-4">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-white">{reason.title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/70">{reason.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Delta advantages */}
        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-6">
          <h2 className="text-xl font-semibold text-white">What Delta Does Differently</h2>
          <ul className="mt-4 space-y-3">
            {competitor.deltaAdvantages.map((adv) => (
              <li key={adv} className="flex gap-3 text-sm text-white/80">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{adv}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Verdict */}
        <section className="rounded-3xl border border-white/10 bg-black/45 p-6">
          <h2 className="text-xl font-semibold text-white">The Bottom Line</h2>
          <p className="mt-3 text-sm leading-7 text-white/80">{competitor.verdict}</p>
        </section>

        {/* CTA */}
        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-emerald-200/70">
            Ready to try the alternative?
          </p>
          <h2 className="mt-3 text-2xl font-bold text-white">
            7 days free. No credit card required.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/65">
            Exchange orderbooks, whale bet detection, sharp props, and AI projections.
            Plans start at $24.99/week after your trial.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex rounded-full bg-emerald-500/20 border border-emerald-400/60 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 transition hover:border-emerald-300 hover:text-white"
            >
              Start free trial
            </Link>
            <Link
              href="/tools"
              className="inline-flex rounded-full border border-white/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              See the tools
            </Link>
          </div>
        </section>

        {/* Internal links to other comparisons */}
        <section className="rounded-3xl border border-white/10 bg-black/45 p-6">
          <h2 className="text-base font-semibold text-white/70">More comparisons</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {COMPETITORS.filter((c) => c.slug !== competitor.slug).map((c) => (
              <Link
                key={c.slug}
                href={`/vs/${c.slug}`}
                className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/60 transition hover:border-emerald-400/40 hover:text-emerald-200"
              >
                Delta vs {c.name}
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
