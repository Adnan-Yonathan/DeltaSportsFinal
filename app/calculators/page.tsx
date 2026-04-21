import Link from "next/link"
import { SimpleHeader } from "@/components/ui/simple-header"
import CalculatorsClient from "./calculators-client"
import { OddsMatrixSurface } from "@/components/ui/odds-matrix-surface"
import { getPublishedCalculators } from "@/lib/calculators/registry"

export default function CalculatorsPage() {
  const published = getPublishedCalculators()
  return (
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.26} className="opacity-90" />
      <SimpleHeader
        rightSlot={
          <Link
            href="/"
            className="hidden sm:inline-flex items-center rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
          >
            Back to tools
          </Link>
        }
      />
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-black/55 p-6 text-left backdrop-blur sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            Calculators
          </p>
          <h1 className="mt-3 font-hero text-3xl font-bold tracking-tight sm:text-4xl">
            Betting math, simplified.
          </h1>
          <p className="mt-3 text-sm text-white/70 sm:text-base">
            Run quick calculations for edges, payouts, and conversions without
            leaving Delta.
          </p>
        </div>
        {published.length > 0 && (
          <div className="mt-8 rounded-3xl border border-emerald-500/20 bg-black/55 p-6 backdrop-blur sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
              Deep-dive guides
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">Individual calculator guides</h2>
            <p className="mt-2 text-sm text-white/60">
              Each guide includes the formula, a worked example, common mistakes, and how sharp
              bettors actually use the tool.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {published.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/calculators/${c.slug}`}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/80 transition-colors hover:border-emerald-400/40 hover:text-white"
                  >
                    <span>{c.name} Calculator</span>
                    <span className="text-emerald-300">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-8">
          <CalculatorsClient />
        </div>
      </main>
    </div>
  )
}
