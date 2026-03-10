'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Component as TimelineComponent, type TimelineEvent } from '@/components/ui/timeline-component'

const WORKFLOW_STEPS: TimelineEvent[] = [
  {
    year: 'Step 1',
    title: 'Find sharp bets worth your attention',
    description:
      'Use live market signals to isolate high-conviction spots where sharp activity and price movement suggest real opportunity.',
  },
  {
    year: 'Step 2',
    title: 'Shop the best price across sportsbooks',
    description:
      'Compare available odds across books and exchanges, then take the best number instead of accepting the first line you see.',
  },
  {
    year: 'Step 3',
    title: 'Place only profitable bets',
    description:
      'Execute only when the number still offers edge. If price drifts outside your range, pass and wait for better entry.',
  },
  {
    year: 'Step 4',
    title: 'Repeat with discipline',
    description:
      'Track closing line value and outcomes over time so your process improves and long-term profitability compounds.',
  },
]

export function InsiderComparison() {
  return (
    <section className="relative">
      <div className="mb-8 flex flex-col gap-3 text-center sm:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
          Workflow
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          How it works
        </h2>
        <p className="mx-auto max-w-3xl text-sm text-white/70 sm:text-base">
          Use a simple four-step process to turn signal discovery into consistent execution.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/60 p-5 shadow-[0_24px_90px_rgba(16,185,129,0.12)] backdrop-blur sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 insider-grid opacity-30" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 insider-scanlines opacity-25" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-24 bg-[radial-gradient(circle_at_25%_25%,rgba(52,211,153,0.16),transparent_45%),radial-gradient(circle_at_75%_35%,rgba(56,189,248,0.10),transparent_50%)]"
        />

        <TimelineComponent events={WORKFLOW_STEPS} className="relative z-10 max-w-none px-0 py-2" />

        <div className="relative z-10 mt-5 flex justify-center border-t border-white/10 pt-5">
          <Link
            href="/auth/signup"
            className="inline-flex w-full max-w-md items-center justify-center gap-3 rounded-full border border-emerald-400/35 bg-black/70 px-5 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200 shadow-[0_18px_50px_rgba(16,185,129,0.18)] backdrop-blur hover:border-emerald-300/70 hover:text-emerald-100 sm:w-auto sm:max-w-none sm:tracking-[0.35em]"
          >
            <span>Start your free trial</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
