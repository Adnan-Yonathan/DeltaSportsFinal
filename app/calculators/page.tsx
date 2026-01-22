import Link from "next/link"
import { SimpleHeader } from "@/components/ui/simple-header"
import CalculatorsClient from "./calculators-client"

export default function CalculatorsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
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
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_rgba(0,0,0,0.2)_55%)] p-6 text-left sm:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">
            Calculators
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Betting math, simplified.
          </h1>
          <p className="mt-3 text-sm text-white/60">
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
