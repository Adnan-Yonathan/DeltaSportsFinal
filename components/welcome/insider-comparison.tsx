'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Check, Minus } from 'lucide-react'

type Row = {
  label: string
  patchwork: {
    headline: string
    detail: string
    tone: 'warn' | 'neutral'
  }
  delta: {
    headline: string
    detail: string
    tone: 'good'
  }
}

const ROWS: Row[] = [
  {
    label: 'Workflow',
    patchwork: {
      headline: 'Multiple tools, broken flow',
      detail: 'Jump between dashboards, tabs, and spreadsheets to complete one decision.',
      tone: 'warn',
    },
    delta: {
      headline: 'One toolchain',
      detail: 'Projections, props, whales, and research in a single pipeline.',
      tone: 'good',
    },
  },
  {
    label: 'Signal confirmation',
    patchwork: {
      headline: 'Hard to verify intent',
      detail: 'You can see odds, but confirming conviction usually lives elsewhere.',
      tone: 'warn',
    },
    delta: {
      headline: 'Confirm with money',
      detail: 'Cross-check edges against Whale Feed in the same workflow.',
      tone: 'good',
    },
  },
  {
    label: 'Speed',
    patchwork: {
      headline: 'Slow execution',
      detail: 'By the time you stitch data together, the number can move.',
      tone: 'warn',
    },
    delta: {
      headline: 'Seconds to edge',
      detail: 'Start at Sharp Projections or Sharp Props, then validate fast.',
      tone: 'good',
    },
  },
  {
    label: 'Cost',
    patchwork: {
      headline: 'Stack tax',
      detail: 'Often requires multiple subscriptions to cover all angles.',
      tone: 'neutral',
    },
    delta: {
      headline: 'Consolidated',
      detail: 'One membership replaces the patchwork for the core insider workflow.',
      tone: 'good',
    },
  },
]

function StatusPill({
  tone,
}: {
  tone: 'warn' | 'neutral' | 'good'
}) {
  if (tone === 'good') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-200">
        <Check className="h-3.5 w-3.5" />
        optimized
      </span>
    )
  }

  if (tone === 'warn') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
        <Minus className="h-3.5 w-3.5" />
        friction
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
      <Minus className="h-3.5 w-3.5" />
      varies
    </span>
  )
}

export function InsiderComparison() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="relative">
      <div className="mb-8 flex flex-col gap-3 sm:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
          Comparison
        </p>
        <h2 className="font-hero text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Delta vs the patchwork stack
        </h2>
        <p className="max-w-3xl text-sm text-white/70 sm:text-base">
          Most bettors end up stitching together a stack like Action Network, Unabated,
          Props.Cash, spreadsheets, and Discord. Delta is built to replace the stack with a
          single insider workflow.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-[0_24px_90px_rgba(16,185,129,0.12)] backdrop-blur">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 insider-grid opacity-30" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 insider-scanlines opacity-25" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-24 bg-[radial-gradient(circle_at_25%_25%,rgba(52,211,153,0.16),transparent_45%),radial-gradient(circle_at_75%_35%,rgba(56,189,248,0.10),transparent_50%)]"
        />

        <div className="relative z-10">
          <div className="grid grid-cols-1 gap-3 border-b border-white/10 p-5 sm:grid-cols-12 sm:items-center sm:gap-4">
            <div className="sm:col-span-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
                Dimension
              </p>
            </div>
            <div className="sm:col-span-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
                Patchwork stack
              </p>
              <p className="mt-1 text-xs text-white/55">
                Multiple subscriptions plus manual stitching
              </p>
            </div>
            <div className="sm:col-span-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200/75">
                Delta
              </p>
              <p className="mt-1 text-xs text-emerald-200/70">
                One workflow across the 4 tools
              </p>
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {ROWS.map((row, idx) => (
              <motion.div
                key={row.label}
                initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45 }}
                className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-12 sm:items-start"
              >
                <div className="sm:col-span-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/75">
                    {row.label}
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white/85">
                      {row.patchwork.headline}
                    </p>
                    <StatusPill tone={row.patchwork.tone} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {row.patchwork.detail}
                  </p>
                </div>

                <div className="sm:col-span-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                      {row.delta.headline}
                    </p>
                    <StatusPill tone={row.delta.tone} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    {row.delta.detail}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-white/55">
              Note: feature coverage and pricing vary across third-party tools. This is a workflow comparison.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex w-full max-w-md items-center justify-center gap-3 rounded-full border border-emerald-400/35 bg-black/70 px-5 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200 shadow-[0_18px_50px_rgba(16,185,129,0.18)] backdrop-blur hover:border-emerald-300/70 hover:text-emerald-100 sm:w-auto sm:max-w-none sm:tracking-[0.35em]"
            >
              <span>Start your free trial</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
