'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Beaker, Brain, Radar, Waves } from 'lucide-react'
import { CardSpotlight } from '@/components/ui/card-spotlight'

type Tool = {
  key: string
  title: string
  subtitle: string
  href: string
  meta: string
  cta: string
  Icon: React.ComponentType<{ className?: string }>
  accent: string
  priority?: 'primary' | 'secondary'
}

const TOOLS: Tool[] = [
  {
    key: 'sharp-projections',
    title: 'Sharp Projections',
    subtitle: 'Find the gap first',
    href: '/tools/sharp-projections',
    meta: 'Market-driven lines: spreads, totals, moneylines.',
    cta: 'View guide',
    Icon: Radar,
    priority: 'primary',
    accent: 'from-emerald-400/20 via-black/60 to-black',
  },
  {
    key: 'sharp-props',
    title: 'Sharp Props',
    subtitle: 'Price-shop EV',
    href: '/tools/sharp-props',
    meta: 'Prop EV scanner plus order-book liquidity for sharp lines.',
    cta: 'View guide',
    Icon: ArrowUpRight,
    priority: 'primary',
    accent: 'from-cyan-400/15 via-black/60 to-black',
  },
  {
    key: 'sharp-traders',
    title: 'Sharp Traders',
    subtitle: 'Follow conviction',
    href: '/tools/sharp-traders',
    meta: 'Track profitable wallets and their open positions.',
    cta: 'View guide',
    Icon: Brain,
    accent: 'from-sky-400/15 via-black/60 to-black',
  },
  {
    key: 'whale-feed',
    title: 'Whale Feed',
    subtitle: 'Spot big money',
    href: '/tools/whale-feed',
    meta: 'Live large-bet feed with sportsbook context.',
    cta: 'View guide',
    Icon: Waves,
    accent: 'from-emerald-300/15 via-black/60 to-black',
  },
  {
    key: 'research-mode',
    title: 'Research Mode',
    subtitle: 'Validate long-term',
    href: '/tools/research-mode',
    meta: 'Explain movement, study closes, and backtest edges.',
    cta: 'View guide',
    Icon: Beaker,
    accent: 'from-amber-300/15 via-black/60 to-black',
  },
]

export function InsiderToolArsenal() {
  const reduceMotion = useReducedMotion()

  const primary = TOOLS.filter((t) => t.priority === 'primary')
  const secondary = TOOLS.filter((t) => t.priority !== 'primary')

  return (
    <section className="relative">
      <div className="mb-8 flex flex-col gap-3 sm:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
          Features
        </p>
        <h2 className="font-hero text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Your tool arsenal
        </h2>
        <p className="max-w-3xl text-sm text-white/70 sm:text-base">
          Designed for conversion: lead with the two fastest paths to an edge, then
          confirm with wallets, whales, and research.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {primary.map((t, idx) => (
          <motion.div
            key={t.key}
            initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.55 }}
            className={idx === 0 ? 'lg:col-span-7' : 'lg:col-span-5'}
          >
            <ToolCard tool={t} size="large" />
          </motion.div>
        ))}

        {secondary.map((t, idx) => (
          <motion.div
            key={t.key}
            initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-4"
          >
            <ToolCard tool={t} size="small" />
          </motion.div>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <Link
          href="/auth/signup"
          className="inline-flex w-full max-w-md items-center justify-center gap-3 rounded-full border border-emerald-400/35 bg-black/70 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200 shadow-[0_18px_50px_rgba(16,185,129,0.18)] backdrop-blur hover:border-emerald-300/70 hover:text-emerald-100 sm:w-auto sm:max-w-none sm:tracking-[0.35em]"
        >
          <span className="text-white/60">Unlock:</span>
          <span>Start your free trial</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}

function ToolCard({ tool, size }: { tool: Tool; size: 'large' | 'small' }) {
  const isLarge = size === 'large'
  const Icon = tool.Icon

  return (
    <Link href={tool.href} className="block">
      <CardSpotlight
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-black/60 transition-colors hover:border-emerald-400/35 ${
          isLarge ? 'p-6 sm:p-8' : 'p-5 sm:p-6'
        }`}
        color="rgba(16,185,129,0.10)"
        radius={isLarge ? 420 : 320}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br ${tool.accent}`}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 insider-grid opacity-25"
        />

        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {tool.priority === 'primary' && (
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-200">
                  Start here
                </span>
              )}
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55 sm:tracking-[0.35em]">
                {tool.subtitle}
              </span>
            </div>
            <h3
              className={`mt-3 font-semibold tracking-tight text-white ${
                isLarge ? 'text-2xl sm:text-3xl' : 'text-xl'
              }`}
            >
              {tool.title}
            </h3>
            <p className={`mt-2 leading-relaxed text-white/70 ${isLarge ? 'text-sm sm:text-base' : 'text-sm'}`}>
              {tool.meta}
            </p>

            <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/90">
              <span>{tool.cta}</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/60 text-emerald-200 shadow-[0_10px_40px_rgba(16,185,129,0.12)] sm:h-11 sm:w-11">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardSpotlight>
    </Link>
  )
}
