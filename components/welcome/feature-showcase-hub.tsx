'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  ChartNoAxesCombined,
  Check,
  Eye,
  FlaskConical,
  Waves,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ─── Data ─────────────────────────────────────────────────────────────────────

type Stat = { label: string; value: string }

type Feature = {
  id: string
  title: string
  icon: ReactNode
  outcome: string
  description: string
  stats: Stat[]
}

const FEATURES: Feature[] = [
  {
    id: 'sharp-projections',
    title: 'Sharp Projections',
    icon: <ChartNoAxesCombined className="h-[1em] w-[1em]" />,
    outcome: 'See which games the model disagrees with the market on. Bet before the line corrects.',
    description:
      'Sharp Projections refreshes every 15 minutes, ranks the board by edge strength, and surfaces where model prices diverge from market prices — before the public closes the gap.',
    stats: [
      { label: 'Avg CLV', value: '+9.8%' },
      { label: 'Refresh cycle', value: '15 min' },
      { label: 'Tracked picks', value: '1,240' },
    ],
  },
  {
    id: 'sharp-props',
    title: 'Sharp Props',
    icon: <Activity className="h-[1em] w-[1em]" />,
    outcome: 'Read the orderbook before books adjust. Get the lean before it shows in the number.',
    description:
      'Sharp Props scans exchange depth, wall concentration, and side pressure to identify where informed prop money is positioning — so you move before books catch up.',
    stats: [
      { label: 'Long-term ROI', value: '+8.1%' },
      { label: 'Top over lean', value: '78%' },
      { label: 'Tracked props', value: '980' },
    ],
  },
  {
    id: 'whale-feed',
    title: 'Whale Feed',
    icon: <Waves className="h-[1em] w-[1em]" />,
    outcome: '$82,000 just hit the Lakers over. You saw it before the line moved.',
    description:
      'Whale Feed monitors outsized bets by market and timing, then maps that action to line movement and current book prices — so you can distinguish legitimate steam from noise.',
    stats: [
      { label: 'Ticket threshold', value: '$50K+' },
      { label: 'Move captured', value: '+0.9 pts' },
      { label: 'Tracked alerts', value: '3,420' },
    ],
  },
  {
    id: 'insider-feed',
    title: 'Insider Feed',
    icon: <Eye className="h-[1em] w-[1em]" />,
    outcome: 'The top Polymarket wallet just entered Lakers ML at +160. Their ROI is 51%.',
    description:
      'Insider Feed tracks verified profitable wallets on Polymarket, scores their open sports positions by authority and conviction, and shows you exactly where proven winners are allocating capital.',
    stats: [
      { label: 'Wallet ROI floor', value: '>0%' },
      { label: 'Score range', value: '60–99' },
      { label: 'Wallets tracked', value: '40+' },
    ],
  },
  {
    id: 'research-mode',
    title: 'Research Mode',
    icon: <FlaskConical className="h-[1em] w-[1em]" />,
    outcome: 'Your CLV went from +1.1% to +4.3%. This is what a disciplined process looks like.',
    description:
      'Research Mode aggregates closing outcomes, move patterns, and trend splits so every bet generates feedback you can study. It turns picks into a repeatable, improvable system.',
    stats: [
      { label: 'Long-term ROI', value: '+6.9%' },
      { label: 'False signals', value: '-22%' },
      { label: 'Backtests run', value: '640' },
    ],
  },
]

// ─── Mockup: Sharp Projections ────────────────────────────────────────────────

const PROJ_ROWS = [
  { game: 'Knicks vs Heat', market: 'Spread', edge: '+5.2', line: 'NYK -6.5', hot: true },
  { game: 'Lakers vs Celtics', market: 'Total', edge: '+3.8', line: 'Over 224.5', hot: false },
  { game: 'Bills vs Chiefs', market: 'Moneyline', edge: '+2.7', line: 'KC -148', hot: false },
]

function ProjectionsMockup({ rm }: { rm: boolean }) {
  return (
    <MockupCard badge="LIVE" badgeColor="emerald" liveDot>
      <div className="space-y-2">
        {PROJ_ROWS.map((row, i) => (
          <motion.div
            key={row.game}
            initial={rm ? {} : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.1 }}
            className={cn(
              'flex items-center justify-between gap-3 rounded-[0.9rem] border px-3.5 py-3',
              row.hot ? 'border-emerald-300/22 bg-emerald-400/7' : 'border-white/7 bg-black/25'
            )}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{row.game}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/38">{row.market}</div>
            </div>
            <div className="shrink-0 text-right">
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                {row.edge}
              </span>
              <div className="mt-1 text-xs text-white/42">{row.line}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['Spread gap', 'Total misprice', 'Model consensus'].map((pill) => (
          <SignalPill key={pill}>{pill}</SignalPill>
        ))}
      </div>
    </MockupCard>
  )
}

// ─── Mockup: Sharp Props ──────────────────────────────────────────────────────

const PROP_ROWS = [
  { player: 'S. Curry', line: 'O 28.5 pts', pct: 78, edge: '+3.4', side: 'Over' },
  { player: 'P. Mahomes', line: 'U 285.5 yds', pct: 71, edge: '+2.9', side: 'Under' },
  { player: 'L. James', line: 'O 24.5 pts', pct: 62, edge: '+1.6', side: 'Over' },
]

function PropsMockup({ rm }: { rm: boolean }) {
  return (
    <MockupCard badge="SHARP" badgeColor="cyan">
      <div className="space-y-2.5">
        {PROP_ROWS.map((row, i) => (
          <motion.div
            key={row.player}
            initial={rm ? {} : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.12 }}
            className="rounded-[0.9rem] border border-white/7 bg-black/25 p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold">{row.player}</div>
                <div className="mt-0.5 text-xs text-white/48">{row.line}</div>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
                {row.edge}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/35">
              <span>{row.side} lean</span>
              <span className="font-semibold text-white/62">{row.pct}%</span>
            </div>
            <div className="mt-1.5 h-[4px] overflow-hidden rounded-full bg-white/8">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${row.pct}%` }}
                transition={rm ? {} : { duration: 0.85, ease: 'easeOut', delay: 0.22 + i * 0.12 }}
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300"
                style={{ boxShadow: '0 0 5px rgba(52,211,153,0.35)' }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </MockupCard>
  )
}

// ─── Mockup: Whale Feed ───────────────────────────────────────────────────────

const WHALE_ROWS = [
  { amount: '$82,000', game: 'Lakers vs Celtics Total', line: 'OVER 224.5', time: '2m' },
  { amount: '$54,500', game: 'Chiefs vs Bills Spread', line: 'KC -3', time: '11m' },
  { amount: '$120,000', game: 'Yankees ML', line: 'ML -145', time: '34m' },
  { amount: '$67,000', game: 'Heat vs Bucks Total', line: 'UNDER 218', time: '1h' },
]

function WhaleMockup({ rm }: { rm: boolean }) {
  return (
    <MockupCard badge="LIVE" badgeColor="emerald" liveDot>
      <div className="space-y-2">
        {WHALE_ROWS.map((row, i) => (
          <motion.div
            key={row.amount + row.time}
            initial={rm ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 + i * 0.1 }}
            className="flex items-center justify-between gap-3 rounded-[0.9rem] border border-white/7 bg-black/25 px-3.5 py-3"
            style={{ borderLeft: '2px solid rgba(52,211,153,0.2)' }}
          >
            <div className="min-w-0">
              <div className="text-sm font-bold text-emerald-300">{row.amount}</div>
              <div className="mt-0.5 truncate text-xs text-white/58">{row.game}</div>
            </div>
            <div className="shrink-0 text-right">
              <span className="rounded-full bg-cyan-400/12 px-2 py-0.5 text-xs font-bold text-cyan-200">
                {row.line}
              </span>
              <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-white/32">{row.time} ago</div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['Steam move', 'Line pressure', 'Exchange signal'].map((pill) => (
          <SignalPill key={pill}>{pill}</SignalPill>
        ))}
      </div>
    </MockupCard>
  )
}

// ─── Mockup: Insider Feed ────────────────────────────────────────────────────

const INSIDER_ROWS = [
  { wallet: 'WhaleAlpha', score: 94, market: 'Lakers ML', odds: '+160', roi: '51.3%', tier: 'Elite' },
  { wallet: 'SharpEdge', score: 86, market: 'Chiefs -3', odds: '-110', roi: '28.7%', tier: 'Sharp' },
  { wallet: 'ProfitLoop', score: 78, market: 'Celtics Over 224.5', odds: '+105', roi: '14.2%', tier: 'Notable' },
]

function InsiderMockup({ rm }: { rm: boolean }) {
  return (
    <MockupCard badge="INSIDER" badgeColor="emerald">
      <div className="space-y-2.5">
        {INSIDER_ROWS.map((row, i) => (
          <motion.div
            key={row.wallet}
            initial={rm ? {} : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.12 }}
            className="rounded-[0.9rem] border border-white/7 bg-black/25 p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold">{row.wallet}</div>
                  <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                    {row.tier}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-white/48">{row.market}</div>
              </div>
              <div className="shrink-0 text-right">
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
                  {row.score}
                </span>
                <div className="mt-1 text-[10px] text-white/42">{row.odds}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/35">
              <span>Wallet ROI</span>
              <span className="font-semibold text-emerald-300/70">{row.roi}</span>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['Verified ROI', 'Conviction score', 'Open positions'].map((pill) => (
          <SignalPill key={pill}>{pill}</SignalPill>
        ))}
      </div>
    </MockupCard>
  )
}

// ─── Mockup: Research Mode ────────────────────────────────────────────────────

const RESEARCH_BARS = [
  { label: 'Closing line value', value: '+3.2%', pct: 42, warn: false },
  { label: 'Market movement accuracy', value: '71%', pct: 71, warn: false },
  { label: 'Sharp-aligned bets', value: '68%', pct: 68, warn: false },
  { label: 'Win rate on sharp picks', value: '57%', pct: 57, warn: true },
]

function ResearchMockup({ rm }: { rm: boolean }) {
  return (
    <MockupCard badge="SYNDICATE" badgeColor="violet">
      <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-white/32">
        Your last 30 days — example
      </div>
      <div className="space-y-3.5">
        {RESEARCH_BARS.map((bar, i) => (
          <div key={bar.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/58">{bar.label}</span>
              <span className={cn('font-bold', bar.warn ? 'text-amber-300' : 'text-emerald-300')}>
                {bar.value}
              </span>
            </div>
            <div className="mt-1.5 h-[4px] overflow-hidden rounded-full bg-white/7">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${bar.pct}%` }}
                transition={rm ? {} : { duration: 1, ease: 'easeOut', delay: 0.1 + i * 0.15 }}
                className={cn(
                  'h-full rounded-full',
                  bar.warn
                    ? 'bg-gradient-to-r from-amber-300 to-orange-300'
                    : 'bg-gradient-to-r from-emerald-300 to-cyan-300'
                )}
                style={{
                  boxShadow: bar.warn
                    ? '0 0 5px rgba(251,191,36,0.35)'
                    : '0 0 5px rgba(52,211,153,0.3)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-[0.8rem] border border-violet-400/18 bg-violet-500/7 px-3 py-2.5">
        <span className="text-xs text-white/52">
          Full history unlocks with{' '}
          <span className="font-semibold text-violet-300">Syndicate</span>
        </span>
      </div>
    </MockupCard>
  )
}

// ─── Shared mockup card wrapper ────────────────────────────────────────────────

function MockupCard({
  badge,
  badgeColor,
  liveDot,
  children,
}: {
  badge: string
  badgeColor: 'emerald' | 'cyan' | 'violet'
  liveDot?: boolean
  children: ReactNode
}) {
  const cls = {
    emerald: 'border-emerald-300/22 bg-emerald-400/9 text-emerald-300',
    cyan: 'border-cyan-300/22 bg-cyan-400/9 text-cyan-300',
    violet: 'border-violet-300/22 bg-violet-400/9 text-violet-300',
  }
  return (
    <div className="w-full rounded-[1.8rem] border border-white/10 bg-[linear-gradient(155deg,rgba(5,17,15,0.98),rgba(2,7,6,0.99))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-hero text-[9px] uppercase tracking-[0.38em] text-white/28">
          Live tool preview
        </span>
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-hero text-[9px] font-bold uppercase tracking-[0.18em]',
            cls[badgeColor]
          )}
        >
          {liveDot && (
            <span className="ob-live-dot" style={{ width: 6, height: 6, minWidth: 6 }} />
          )}
          {badge}
        </div>
      </div>
      {children}
    </div>
  )
}

function SignalPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-emerald-300/15 bg-emerald-400/7 px-2.5 py-1 text-xs text-emerald-200/70">
      {children}
    </span>
  )
}

// ─── Mockup dispatcher ────────────────────────────────────────────────────────

function FeatureMockup({ id, rm }: { id: string; rm: boolean }) {
  if (id === 'sharp-projections') return <ProjectionsMockup rm={rm} />
  if (id === 'sharp-props') return <PropsMockup rm={rm} />
  if (id === 'whale-feed') return <WhaleMockup rm={rm} />
  if (id === 'insider-feed') return <InsiderMockup rm={rm} />
  return <ResearchMockup rm={rm} />
}

// ─── Desktop: left copy panel ─────────────────────────────────────────────────

function FeatureCopy({
  feature,
  index,
  isActive,
}: {
  feature: Feature
  index: number
  isActive: boolean
}) {
  return (
    <div className="max-w-md py-24">
      {/* Step + label */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border font-hero text-xs font-bold transition-all duration-300',
            isActive
              ? 'border-emerald-300/35 bg-emerald-400/15 text-emerald-300'
              : 'border-white/10 bg-white/4 text-white/28'
          )}
        >
          {String(index + 1).padStart(2, '0')}
        </div>
        <div
          className={cn(
            'flex items-center gap-2 font-hero text-[10px] uppercase tracking-[0.3em] transition-colors duration-300',
            isActive ? 'text-emerald-300/75' : 'text-white/28'
          )}
        >
          <span className="text-[14px]">{feature.icon}</span>
          {feature.title}
        </div>
      </div>

      {/* Outcome headline */}
      <h3
        className={cn(
          'mt-5 text-[1.85rem] font-black leading-[1.1] tracking-[-0.04em] transition-colors duration-300 sm:text-[2.1rem]',
          isActive ? 'text-white' : 'text-white/45'
        )}
      >
        {feature.outcome}
      </h3>

      {/* Description */}
      <p
        className={cn(
          'mt-4 text-base leading-[1.75] transition-colors duration-300',
          isActive ? 'text-white/62' : 'text-white/28'
        )}
      >
        {feature.description}
      </p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        {feature.stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              'rounded-[1rem] border px-3 py-3 transition-all duration-300',
              isActive
                ? 'border-white/10 bg-white/[0.04]'
                : 'border-white/6 bg-white/[0.02]'
            )}
          >
            <div
              className={cn(
                'text-base font-black transition-colors duration-300',
                isActive ? 'text-emerald-300' : 'text-white/28'
              )}
            >
              {stat.value}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-white/32">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mobile: stacked feature cards ────────────────────────────────────────────

function MobileFeatureCard({ feature, rm }: { feature: Feature; rm: boolean }) {
  return (
    <motion.div
      initial={rm ? {} : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4 }}
      className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] overflow-hidden"
    >
      {/* Mockup */}
      <div className="p-4 pb-0">
        <FeatureMockup id={feature.id} rm={rm} />
      </div>

      {/* Copy */}
      <div className="p-5">
        <div className="flex items-center gap-2 font-hero text-[10px] uppercase tracking-[0.3em] text-emerald-300/70">
          <span className="text-[13px]">{feature.icon}</span>
          {feature.title}
        </div>
        <h3 className="mt-3 text-xl font-black leading-tight tracking-[-0.03em]">
          {feature.outcome}
        </h3>
        <p className="mt-3 text-sm leading-[1.7] text-white/58">{feature.description}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {feature.stats.map((stat) => (
            <div key={stat.label} className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2.5 py-2.5">
              <div className="text-sm font-black text-emerald-300">{stat.value}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-white/32">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FeatureShowcaseHub() {
  const rm = useReducedMotion() ?? false
  const [activeId, setActiveId] = useState(FEATURES[0].id)
  const triggerRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null, null])

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    triggerRefs.current.forEach((el, i) => {
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) setActiveId(FEATURES[i]!.id)
        },
        { rootMargin: '-42% 0px -42% 0px', threshold: 0 }
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach((obs) => obs.disconnect())
  }, [])

  const activeFeature = FEATURES.find((f) => f.id === activeId) ?? FEATURES[0]

  return (
    <section id="features" className="relative">
      {/* Section header */}
      <div className="mb-12 sm:mb-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
          Tools
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Five tools. One workflow. Zero guessing.
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-white/62 sm:text-base">
          Every tool in Delta is built around the same principle: get the signal before the market
          prices it in. Here&apos;s what that looks like in practice.
        </p>
      </div>

      {/* ── Desktop: sticky scroll ── */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_420px] lg:gap-16">
        {/* Left: scroll triggers */}
        <div>
          {FEATURES.map((feature, i) => (
            <div
              key={feature.id}
              ref={(el) => {
                triggerRefs.current[i] = el
              }}
            >
              <FeatureCopy
                feature={feature}
                index={i}
                isActive={activeId === feature.id}
              />
            </div>
          ))}

          {/* CTA at bottom of scroll area */}
          <div className="pb-24 pt-4">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
            >
              All five tools included — start free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Right: sticky mockup */}
        <div>
          <div className="sticky top-8 flex items-start pt-24">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={rm ? {} : { opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={rm ? {} : { opacity: 0, y: -10, scale: 0.98 }}
                transition={
                  rm ? {} : { type: 'spring', stiffness: 300, damping: 30 }
                }
                className="w-full"
              >
                <FeatureMockup id={activeId} rm={rm} />

                {/* Active feature label below mockup */}
                <motion.div
                  key={`label-${activeId}`}
                  initial={rm ? {} : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 flex items-center gap-2.5 px-1"
                >
                  <div className="flex items-center gap-2 font-hero text-[9px] uppercase tracking-[0.3em] text-emerald-300/60">
                    {activeFeature?.icon}
                    {activeFeature?.title}
                  </div>
                  {/* Progress dots */}
                  <div className="ml-auto flex gap-1.5">
                    {FEATURES.map((f) => (
                      <div
                        key={f.id}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-300',
                          f.id === activeId
                            ? 'w-5 bg-emerald-300'
                            : 'w-1.5 bg-white/18'
                        )}
                      />
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Mobile: stacked cards ── */}
      <div className="space-y-5 lg:hidden">
        {FEATURES.map((feature) => (
          <MobileFeatureCard key={feature.id} feature={feature} rm={rm} />
        ))}
        <div className="pt-2 text-center">
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300"
          >
            All five tools included — start free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
