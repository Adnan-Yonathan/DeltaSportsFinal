import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SimpleHeader } from '@/components/ui/simple-header'
import { OddsMatrixSurface } from '@/components/ui/odds-matrix-surface'
import { COMPETITORS } from '@/lib/blog/competitor-data'

export const metadata: Metadata = {
  title: 'Delta Sports vs Competitors | Sharp Money Tool Comparisons',
  description:
    'Compare Delta Sports to OddsJam, Upside Tools, Action Network, and more. See how exchange orderbook reading and whale detection stack up against other sports betting tools.',
  alternates: {
    canonical: 'https://deltasports.app/vs',
  },
}

export default function VsIndexPage() {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.28} className="opacity-90" />
      <SimpleHeader widthClass="max-w-5xl" />

      <div className="relative z-10 mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-10">
        <header className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            Comparisons
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Delta Sports vs Other Sharp Betting Tools
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
            See how Delta's exchange orderbook reading, whale detection, and sharp money tracking
            compare to the other tools in the market.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMPETITORS.map((competitor) => (
            <Link key={competitor.slug} href={`/vs/${competitor.slug}`}>
              <div className="group rounded-3xl border border-white/10 bg-black/50 p-5 backdrop-blur transition-colors hover:border-emerald-400/35">
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/45">
                  {competitor.category}
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  Delta vs {competitor.name}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/55">
                  {competitor.metaDescription}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200/80 group-hover:text-emerald-200">
                  <span>Compare</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
