'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Eye,
  Radar,
  Waves,
} from 'lucide-react'
import { CardSpotlight } from '@/components/ui/card-spotlight'
import { Typewriter } from '@/components/ui/typewriter-text'

type ToolStep = {
  id: string
  label: string
  title: string
  description: string
  href: string
  Icon: React.ComponentType<{ className?: string }>
}

const STEPS: ToolStep[] = [
  {
    id: 'sharp-projections',
    label: 'TOOL 01',
    title: 'Sharp Movement',
    description:
      'Track line movement, limit expansion, and market pressure before prices settle.',
    href: '/tools/sharp-projections',
    Icon: Radar,
  },
  {
    id: 'sharp-props',
    label: 'TOOL 02',
    title: 'Sharp Props',
    description:
      'Read live prop orderbook walls and sharp lean direction before you bet.',
    href: '/tools/sharp-props',
    Icon: Activity,
  },
  {
    id: 'whale-feed',
    label: 'TOOL 03',
    title: 'Whale Feed',
    description:
      'Big money alerts with context. Compare exchange action to sportsbook pricing.',
    href: '/tools/whale-feed',
    Icon: Waves,
  },
  {
    id: 'insider-feed',
    label: 'TOOL 04',
    title: 'Insider Feed',
    description:
      'Track verified profitable wallets and their open sports positions on Polymarket.',
    href: '/tools/insider-feed',
    Icon: Eye,
  },
]

export function InsiderTransformation() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="relative">
      <div className="mb-8 flex flex-col gap-3 sm:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
          Transformation
        </p>
        <h2 className="font-hero text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Run the insider workflow
        </h2>
        <p className="max-w-3xl text-sm text-white/70 sm:text-base">
          Delta is not an LLM-first app. It is a toolchain. Each module does one
          job, fast, and the pipeline compounds your edge.
        </p>
        <div className="rounded-2xl border border-emerald-400/25 bg-black/50 p-4 sm:p-5 shadow-[0_18px_60px_rgba(16,185,129,0.12)] backdrop-blur">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/50">
            Playbook
          </p>
          <div className="mt-2 font-hero text-xs text-emerald-200 sm:text-sm">
            <span className="text-white/60">$</span>{' '}
            <Typewriter
              text={[
                'scan movement -> confirm with props -> watch whales -> track insiders',
                'find gaps -> price shop -> catch steam -> validate conviction',
              ]}
              speed={26}
              deleteSpeed={14}
              delay={1500}
              loop
              cursor="_"
            />
          </div>
        </div>
      </div>

      {/* Connector line */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 top-[164px] hidden h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent sm:block"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, idx) => (
          <motion.div
            key={step.id}
            initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            {/* Node */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-3 left-6 hidden sm:block"
            >
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.75)]" />
            </div>

            <Link href={step.href} className="block">
              <CardSpotlight
                className="h-full rounded-3xl border border-white/10 bg-black/60 p-5 sm:p-6 transition-colors hover:border-emerald-400/35"
                color="rgba(16,185,129,0.12)"
                radius={320}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-200">
                      {step.label}
                    </span>
                    <step.Icon className="h-5 w-5 text-emerald-200/90" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    {step.description}
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/90">
                    <span>Open</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </CardSpotlight>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
