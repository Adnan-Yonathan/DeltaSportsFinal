'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type WorkflowStep = {
  step: string
  title: string
  body: string
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    step: 'Step 1',
    title: 'Find sharp bets worth your attention',
    body: 'Use live market signals to isolate high-conviction spots where sharp activity and price movement suggest real opportunity.',
  },
  {
    step: 'Step 2',
    title: 'Shop the best price across sportsbooks',
    body: 'Compare available odds across books and exchanges, then take the best number instead of accepting the first line you see.',
  },
  {
    step: 'Step 3',
    title: 'Place only profitable bets',
    body: 'Execute only when the number still offers edge. If price drifts outside your range, pass and wait for better entry.',
  },
  {
    step: 'Step 4',
    title: 'Repeat with discipline',
    body: 'Track closing line value and outcomes over time so your process improves and long-term profitability compounds.',
  },
]

export function InsiderComparison() {
  const reduceMotion = useReducedMotion()

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

        <div className="relative z-10 pl-6 sm:pl-8">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-emerald-300/35 sm:left-3" />
          <div className="space-y-4">
            {WORKFLOW_STEPS.map((item, index) => (
              <motion.article
                key={item.step}
                initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className="relative rounded-2xl border border-white/10 bg-black/55 p-5"
              >
                <span className="absolute -left-[26px] top-6 h-3 w-3 rounded-full border border-emerald-200/80 bg-emerald-400/80 shadow-[0_0_16px_rgba(52,211,153,0.55)] sm:-left-[31px]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
                  {item.step}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{item.body}</p>
              </motion.article>
            ))}
          </div>
        </div>

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
