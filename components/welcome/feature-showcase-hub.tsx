'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Activity, ArrowRight, ChartNoAxesCombined, FlaskConical, Waves } from 'lucide-react'

type Stat = {
  label: string
  value: string
}

type Feature = {
  id: string
  title: string
  subtitle: string
  description: string
  imageSrc: string
  imageAlt: string
  howItWorks: string
  whyValuable: string
  stats: Stat[]
}

const FEATURES: Feature[] = [
  {
    id: 'sharp-projections',
    title: 'Sharp Projections',
    subtitle: 'Market edge detection',
    description: 'Compare projected spread, moneyline, and total versus current market numbers.',
    imageSrc: '/Screenshot 2026-02-24 142211.png',
    imageAlt: 'Sharp projections board',
    howItWorks:
      'Sharp Projections refreshes every 15 minutes, ranks games by edge strength, and surfaces where model prices differ from market prices.',
    whyValuable:
      'You can find mispriced lines early, validate movement context, and focus only on matchups with measurable edge.',
    stats: [
      { label: 'Long-term ROI', value: '+9.8%' },
      { label: 'Avg CLV', value: '+1.6%' },
      { label: 'Tracked Picks', value: '1,240' },
    ],
  },
  {
    id: 'sharp-props',
    title: 'Sharp Props',
    subtitle: 'Orderbook pressure',
    description: 'Read liquidity walls and sharp over/under lean before sportsbook numbers adjust.',
    imageSrc: '/Screenshot 2026-02-24 170409.png',
    imageAlt: 'Sharp props orderbook board',
    howItWorks:
      'Sharp Props scans exchange depth, wall concentration, and side pressure to identify where informed prop money is positioning.',
    whyValuable:
      'It helps you enter faster on props with real conviction and avoid betting into lines already corrected by sharp action.',
    stats: [
      { label: 'Long-term ROI', value: '+8.1%' },
      { label: 'Avg CLV', value: '+1.3%' },
      { label: 'Tracked Props', value: '980' },
    ],
  },
  {
    id: 'whale-feed',
    title: 'Whale Feed',
    subtitle: 'Big money alerts',
    description: 'Track large tickets with context and compare exchange action to sportsbook pricing.',
    imageSrc: '/Screenshot 2026-02-24 142244.png',
    imageAlt: 'Whale feed market board',
    howItWorks:
      'Whale Feed monitors outsized bets by market and timing, then maps that action directly to line movement and available book prices.',
    whyValuable:
      'You can spot legitimate steam faster, filter noisy moves, and prioritize bets where size and timing signal informed money.',
    stats: [
      { label: 'Long-term ROI', value: '+7.4%' },
      { label: 'Move Captured', value: '+0.9 pts' },
      { label: 'Tracked Alerts', value: '3,420' },
    ],
  },
  {
    id: 'research-mode',
    title: 'Research Mode',
    subtitle: 'Validate long-term',
    description: 'Break down closing line value, market movement, and trend behavior across time.',
    imageSrc: '/Screenshot 2026-02-24 142303.png',
    imageAlt: 'Research mode trends dashboard',
    howItWorks:
      'Research Mode aggregates closing outcomes, move patterns, and trend splits so every bet has post-game feedback you can study.',
    whyValuable:
      'It turns picks into a repeatable process by exposing what works, what fails, and where your model should be tightened.',
    stats: [
      { label: 'Long-term ROI', value: '+6.9%' },
      { label: 'False Signals', value: '-22%' },
      { label: 'Backtests Run', value: '640' },
    ],
  },
]

function FeatureIcon({ id }: { id: string }) {
  if (id === 'sharp-projections') return <ChartNoAxesCombined className="h-5 w-5" />
  if (id === 'sharp-props') return <Activity className="h-5 w-5" />
  if (id === 'whale-feed') return <Waves className="h-5 w-5" />
  return <FlaskConical className="h-5 w-5" />
}

export function FeatureShowcaseHub() {
  const [activeId, setActiveId] = useState(FEATURES[0].id)

  const activeFeature = useMemo(
    () => FEATURES.find((feature) => feature.id === activeId) ?? FEATURES[0],
    [activeId]
  )

  return (
    <section id="features" className="relative">
      <div className="mb-8 flex flex-col gap-3 sm:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
          Features
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Get ahead of the action
        </h2>
        <p className="max-w-3xl text-sm text-white/70 sm:text-base">
          Delta Sports provides proprietary tools to ensure you get access to where the sharps are
          betting in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-white/10 bg-black/60 p-4">
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 lg:block lg:space-y-3 lg:overflow-visible lg:pb-0">
            {FEATURES.map((feature) => {
              const active = feature.id === activeFeature.id
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => setActiveId(feature.id)}
                  className={`min-w-[265px] snap-start rounded-2xl border p-4 text-left transition lg:min-w-0 lg:w-full ${
                    active
                      ? 'border-emerald-300/55 bg-emerald-400/12'
                      : 'border-white/10 bg-black/60 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-xl border p-2 ${
                        active
                          ? 'border-emerald-300/35 bg-emerald-400/15 text-emerald-200'
                          : 'border-white/10 bg-white/5 text-white/70'
                      }`}
                    >
                      <FeatureIcon id={feature.id} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">{feature.title}</p>
                      <p className="text-sm text-white/65">{feature.subtitle}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-white/60">{feature.description}</p>
                </button>
              )
            })}
          </div>

          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-sm text-white/65">All tools are included in one workflow.</p>
            <a
              href="/auth/signup"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            >
              Start your free trial
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/70 shadow-[0_24px_90px_rgba(16,185,129,0.12)]">
          <div className="relative aspect-[16/9]">
            <Image
              src={activeFeature.imageSrc}
              alt={activeFeature.imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 70vw"
              priority
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
          </div>

          <div className="grid grid-cols-1 gap-6 border-t border-white/10 p-5 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-emerald-200/70">
                How it works
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/75">{activeFeature.howItWorks}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-emerald-200/70">
                Why it is valuable
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/75">{activeFeature.whyValuable}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-white/10 p-4 sm:gap-3 sm:p-5">
            {activeFeature.stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-black/65 p-3 sm:p-4">
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/55 sm:text-[10px] sm:tracking-[0.3em]">{stat.label}</p>
                <p className="mt-1 text-lg font-bold text-emerald-300 sm:text-2xl">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
