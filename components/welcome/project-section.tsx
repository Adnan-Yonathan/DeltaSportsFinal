'use client'

import Image from 'next/image'

const METRICS = [
  { label: 'Long-term ROI', value: '+9.8%', note: 'edge-filtered plays' },
  { label: 'Average CLV', value: '+1.6%', note: 'vs close per ticket' },
  { label: 'Hit Rate', value: '56.4%', note: 'tracked projection picks' },
  { label: 'Sample Size', value: '1,240', note: 'logged decisions' },
]

export function ProjectSection() {
  return (
    <section className="relative">
      <div className="mb-8 flex flex-col gap-3 sm:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
          Project
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Sharp Projections
        </h2>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-[0_24px_90px_rgba(16,185,129,0.12)]">
        <Image
          src="/Screenshot 2026-02-24 142211.png"
          alt="Sharp projections table"
          width={1893}
          height={911}
          className="w-full object-cover"
          priority
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <h3 className="text-xl font-semibold text-white">How it works</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/75 sm:text-base">
            Sharp Projections compares our modeled spread, total, and moneyline prices to live market numbers,
            then ranks matchups by edge strength. You get one board that shows where pricing is off, where line
            movement confirms conviction, and where whale flow agrees with the projection.
          </p>
          <h3 className="mt-5 text-xl font-semibold text-white">Why it is valuable</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/75 sm:text-base">
            It compresses discovery, validation, and execution into one workflow. Instead of hunting across tools,
            you can identify the best value first, verify with sharp context, and act before the market closes the gap.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:col-span-4">
          {METRICS.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-200/85">{metric.label}</p>
              <p className="mt-2 text-2xl font-bold text-emerald-300">{metric.value}</p>
              <p className="mt-1 text-xs text-emerald-100/70">{metric.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
