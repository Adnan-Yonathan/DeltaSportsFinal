import Link from "next/link"
import { SimpleHeader } from "@/components/ui/simple-header"
import CalculatorsClient from "./calculators-client"
import { OddsMatrixSurface } from "@/components/ui/odds-matrix-surface"

export default function CalculatorsPage() {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.26} className="opacity-90" />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 insider-grid opacity-50" />
        <div className="absolute inset-0 insider-scanlines opacity-25" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.12),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.10),transparent_50%)]" />
      </div>
      <SimpleHeader
        rightSlot={
          <Link
            href="/chat"
            className="hidden sm:inline-flex items-center rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
          >
            Back to chat
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
        <div className="mt-8">
          <CalculatorsClient />
        </div>
      </main>
    </div>
  )
}
