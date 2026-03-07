import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react'
import { SimpleHeader } from '@/components/ui/simple-header'
import { OddsMatrixSurface } from '@/components/ui/odds-matrix-surface'
import { getCompetitorBySlug } from '@/lib/blog/competitor-data'

const competitor = getCompetitorBySlug('oddsjam')!

export const metadata: Metadata = {
  title: 'OddsJam Alternative | Delta Sports – Exchange Orderbooks & Sharp Money',
  description:
    'The best OddsJam alternative for sharp bettors. Delta Sports reads exchange orderbooks, tracks whale bets, and surfaces sharp money signals — starting at $24.99/week.',
  alternates: {
    canonical: 'https://deltasports.app/oddsjam-alternative',
  },
  openGraph: {
    title: 'OddsJam Alternative | Delta Sports – Exchange Orderbooks & Sharp Money',
    description:
      'The best OddsJam alternative for sharp bettors. Delta Sports reads exchange orderbooks, tracks whale bets, and surfaces sharp money signals — starting at $24.99/week.',
    type: 'website',
  },
  twitter: {
    title: 'OddsJam Alternative | Delta Sports – Exchange Orderbooks & Sharp Money',
    description:
      'The best OddsJam alternative for sharp bettors. Delta Sports reads exchange orderbooks, tracks whale bets, and surfaces sharp money signals — starting at $24.99/week.',
  },
}

export default function OddsJamAlternativePage() {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.30} className="opacity-90" />
      <SimpleHeader widthClass="max-w-5xl" />

      <div className="relative z-10 mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-10">

        {/* Hero */}
        <header className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            OddsJam Alternative
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            The OddsJam Alternative Built Around Sharp Money
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
            OddsJam focuses on no-vig EV and odds comparison. Delta is built differently — exchange
            orderbooks, real-time whale bets, and sharp money signals from Kalshi and Polymarket.
            If you want to follow where the sharp money actually is, not just find line discrepancies,
            Delta is the alternative.
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
              See pricing
            </Link>
          </div>
        </header>

        {/* Why bettors look for an OddsJam alternative */}
        <section className="rounded-3xl border border-white/10 bg-black/45 p-6">
          <h2 className="text-xl font-semibold text-white">
            Why Bettors Look for an OddsJam Alternative
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

        {/* What Delta does instead */}
        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-6">
          <h2 className="text-xl font-semibold text-white">What Delta Does Instead</h2>
          <ul className="mt-4 space-y-3">
            {competitor.deltaAdvantages.map((adv) => (
              <li key={adv} className="flex gap-3 text-sm text-white/80">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{adv}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Key differences */}
        <section className="rounded-3xl border border-white/10 bg-black/45 p-6">
          <h2 className="text-xl font-semibold text-white">OddsJam vs Delta: Key Differences</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.25em] text-white/40">
                  <th className="pb-3 text-left font-medium">Feature</th>
                  <th className="pb-3 text-center font-medium">OddsJam</th>
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
                      ) : row.deltaWins ? (
                        <span className="font-medium text-emerald-300">{row.delta === 'Yes' ? <CheckCircle className="mx-auto h-4 w-4 text-emerald-400" /> : row.delta}</span>
                      ) : (
                        <span className="text-white/60">{row.delta}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pricing callout */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-black/45 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/40">OddsJam pricing</p>
            <p className="mt-2 text-2xl font-bold text-white">$150–$250</p>
            <p className="text-sm text-white/50">/month</p>
            <p className="mt-3 text-sm text-white/60">
              Full-featured access to their positive EV and arb tooling.
            </p>
          </div>
          <div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/5 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200/60">Delta Sports pricing</p>
            <p className="mt-2 text-2xl font-bold text-white">$24.99</p>
            <p className="text-sm text-emerald-200/60">/week · $79/month · $299/year</p>
            <p className="mt-3 text-sm text-white/70">
              Exchange orderbooks, whale feed, sharp props, and AI projections. 7-day free trial.
            </p>
          </div>
        </section>

        {/* Verdict */}
        <section className="rounded-3xl border border-white/10 bg-black/45 p-6">
          <h2 className="text-xl font-semibold text-white">Which One Is Right for You?</h2>
          <p className="mt-3 text-sm leading-7 text-white/80">{competitor.verdict}</p>
          <Link
            href={`/vs/${competitor.slug}`}
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80 hover:text-emerald-200"
          >
            <span>See the full comparison</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        {/* CTA */}
        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-8 text-center">
          <h2 className="text-2xl font-bold text-white">Try the alternative. 7 days free.</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/65">
            Exchange orderbooks, whale bet detection, sharp props, and AI market projections.
            No credit card required to start.
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

      </div>
    </div>
  )
}
