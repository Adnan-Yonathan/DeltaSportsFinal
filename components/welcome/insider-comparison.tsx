'use client'

import Link from 'next/link'
import { ArrowRight, X, Check } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

const WITHOUT = [
  'Public tweets - already priced in by the time you see them',
  'Podcast picks - recorded hours before air, lines have moved',
  'Gut feel with no edge calculation and no CLV tracking',
  'Manual line shopping - slow, incomplete, missed numbers',
  'You find out about the line move after it happened',
]

const WITH = [
  'Whale Feed - $50K+ tickets on your screen in real time',
  'Sharp Movement - line movement and limit expansion in one board',
  'Insider Feed - track verified profitable wallets in real time',
  'Multi-book comparison built in - best number, every time',
  'See the move before the line adjusts. Not after.',
]

export function InsiderComparison() {
  const rm = useReducedMotion()

  return (
    <section className="relative">
      <div className="mb-8 flex flex-col gap-3 text-center sm:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
          The gap
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          What you&apos;re working with vs. what Delta shows you
        </h2>
        <p className="mx-auto max-w-2xl text-sm text-white/60 sm:text-base">
          The information gap between sharp money and the public is where edge lives. Delta closes it.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-[0_24px_90px_rgba(16,185,129,0.08)] backdrop-blur">
        <div aria-hidden className="pointer-events-none absolute inset-0 insider-grid opacity-20" />
        <div aria-hidden className="pointer-events-none absolute inset-0 insider-scanlines opacity-20" />
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-24 bg-[radial-gradient(circle_at_70%_40%,rgba(52,211,153,0.10),transparent_50%)]"
        />

        <div className="relative z-10 grid grid-cols-1 divide-y divide-white/8 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {/* Without Delta */}
          <div className="p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10">
                <X className="h-3.5 w-3.5 text-red-400" />
              </div>
              <span className="text-sm font-bold text-white/50 uppercase tracking-[0.2em]">Without Delta</span>
            </div>
            <ul className="space-y-3.5">
              {WITHOUT.map((item, i) => (
                <motion.li
                  key={item}
                  initial={rm ? {} : { opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.35 }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-red-400/20 bg-red-500/8">
                    <X className="h-3 w-3 text-red-400/70" />
                  </div>
                  <span className="text-sm leading-6 text-white/45">{item}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* With Delta */}
          <div className="relative p-5 sm:p-7">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_50%,rgba(52,211,153,0.06),transparent_70%)]"
            />
            <div className="relative mb-5 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/15">
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              </div>
              <span className="text-sm font-bold text-emerald-300/80 uppercase tracking-[0.2em]">With Delta</span>
            </div>
            <ul className="relative space-y-3.5">
              {WITH.map((item, i) => (
                <motion.li
                  key={item}
                  initial={rm ? {} : { opacity: 0, x: 8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.35 }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-400/12">
                    <Check className="h-3 w-3 text-emerald-300" />
                  </div>
                  <span className="text-sm leading-6 text-white/80">{item}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider callout */}
        <div className="relative z-10 border-t border-white/8 px-5 py-4 text-center sm:px-7">
          <p className="text-xs text-white/38">
            The information gap compounds every day you wait to close it.
          </p>
        </div>

        <div className="relative z-10 flex justify-center border-t border-white/10 p-5 sm:p-6">
          <Link
            href="/auth/signup"
            className="inline-flex w-full max-w-md items-center justify-center gap-3 rounded-full border border-emerald-400/35 bg-black/70 px-5 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200 shadow-[0_18px_50px_rgba(16,185,129,0.18)] backdrop-blur transition hover:border-emerald-300/70 hover:text-emerald-100 sm:w-auto sm:max-w-none sm:tracking-[0.35em]"
          >
            <span>Close the gap - start free</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
