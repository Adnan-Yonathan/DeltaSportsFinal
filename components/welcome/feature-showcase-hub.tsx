'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Activity,
  ArrowRight,
  ChartNoAxesCombined,
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
  screenshotSrc: string
  outcome: string
  description: string
  stats: Stat[]
}

const FEATURES: Feature[] = [
  {
    id: 'sharp-projections',
    title: 'Sharp Projections',
    icon: <ChartNoAxesCombined className="h-[1em] w-[1em]" />,
    screenshotSrc: '/sharpprojections.png',
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
    screenshotSrc: '/Screenshot%202026-03-02%20015116.png',
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
    screenshotSrc: '/updatedwhalefeed.png',
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
    screenshotSrc: '/insiderfeed.png',
    outcome: 'The top Polymarket wallet just entered Lakers ML at +160. Their ROI is 13%.',
    description:
      'Insider Feed tracks thousands of profitable wallets on Polymarket, scores their open sports positions by authority and conviction, and shows you exactly where proven winners are allocating capital.',
    stats: [
      { label: 'Wallet ROI floor', value: '>0%' },
      { label: 'Score range', value: '60–99' },
      { label: 'Wallets tracked', value: '1,000+' },
    ],
  },
  {
    id: 'research-mode',
    title: 'Research Mode',
    icon: <FlaskConical className="h-[1em] w-[1em]" />,
    screenshotSrc: '/research.png',
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

// ─── Screenshot preview ──────────────────────────────────────────────────────

function FeatureScreenshot({ feature }: { feature: Feature }) {
  return (
    <div className="w-full overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#020810] shadow-[0_28px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <Image
        src={feature.screenshotSrc}
        alt={`${feature.title} interface`}
        width={1920}
        height={1080}
        className="h-auto w-full"
      />
    </div>
  )
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

function MobileFeatureCard({ feature }: { feature: Feature }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4 }}
      className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] overflow-hidden"
    >
      {/* Screenshot */}
      <div className="p-4 pb-0">
        <FeatureScreenshot feature={feature} />
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
                <FeatureScreenshot feature={activeFeature} />

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
          <MobileFeatureCard key={feature.id} feature={feature} />
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
