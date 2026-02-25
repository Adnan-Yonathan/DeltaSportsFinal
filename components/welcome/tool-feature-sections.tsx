'use client'

import Image from 'next/image'

type Metric = {
  label: string
  value: string
  note: string
}

type FeatureShowcaseProps = {
  title: string
  imageSrc: string
  imageAlt: string
  howItWorks: string
  whyValuable: string
  metrics: Metric[]
}

function FeatureShowcase({
  title,
  imageSrc,
  imageAlt,
  howItWorks,
  whyValuable,
  metrics,
}: FeatureShowcaseProps) {
  return (
    <section className="relative">
      <div className="mb-8 flex flex-col gap-3 sm:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
          Feature
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          {title}
        </h2>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-[0_24px_90px_rgba(16,185,129,0.12)]">
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={1893}
          height={911}
          className="w-full object-cover"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <h3 className="text-xl font-semibold text-white">How it works</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/75 sm:text-base">
            {howItWorks}
          </p>
          <h3 className="mt-5 text-xl font-semibold text-white">Why it is valuable</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/75 sm:text-base">
            {whyValuable}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:col-span-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-200/85">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-300">{metric.value}</p>
              <p className="mt-1 text-xs text-emerald-100/70">{metric.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SharpPropsSection() {
  return (
    <FeatureShowcase
      title="Sharp Props"
      imageSrc="/Screenshot 2026-02-24 170409.png"
      imageAlt="Sharp props board"
      howItWorks="Sharp Props reads live orderbook walls, side liquidity, and synthetic sharp lines from exchange prices, then highlights where over/under pressure is strongest."
      whyValuable="You see real money conviction before books fully adjust, so you can price shop faster and avoid betting into already-corrected numbers."
      metrics={[
        { label: 'Long-term ROI', value: '+8.1%', note: 'wall + line filters' },
        { label: 'Average CLV', value: '+1.3%', note: 'vs close per prop' },
        { label: 'Hit Rate', value: '55.2%', note: 'tracked prop picks' },
        { label: 'Sample Size', value: '980', note: 'logged decisions' },
      ]}
    />
  )
}

export function WhaleFeedSection() {
  return (
    <FeatureShowcase
      title="Whale Feed"
      imageSrc="/Screenshot 2026-02-24 142244.png"
      imageAlt="Whale feed dashboard"
      howItWorks="Whale Feed monitors large tickets and clusters them by market and timing, then compares that action against sportsbook pricing and movement in one stream."
      whyValuable="It helps you catch meaningful steam earlier, filter noise, and focus on the bets where size and timing suggest informed action."
      metrics={[
        { label: 'Long-term ROI', value: '+7.4%', note: 'whale-confirmed plays' },
        { label: 'Move Captured', value: '+0.9 pts', note: 'avg pre-close edge' },
        { label: 'Signal Win Rate', value: '54.8%', note: 'tracked alerts' },
        { label: 'Tracked Alerts', value: '3,420', note: 'historical samples' },
      ]}
    />
  )
}

export function ResearchModeSection() {
  return (
    <FeatureShowcase
      title="Research Mode"
      imageSrc="/Screenshot 2026-02-24 142303.png"
      imageAlt="Research mode analytics"
      howItWorks="Research Mode breaks down movement, closes, and market behavior across time so you can inspect what actually happened before, during, and after entry."
      whyValuable="It turns every bet into feedback, improving decision quality over time and helping you build repeatable long-term process instead of one-off picks."
      metrics={[
        { label: 'Long-term ROI', value: '+6.9%', note: 'research-backed card' },
        { label: 'Average CLV', value: '+1.1%', note: 'market close delta' },
        { label: 'False Signals', value: '-22%', note: 'after filtering' },
        { label: 'Backtests Run', value: '640', note: 'strategy iterations' },
      ]}
    />
  )
}
