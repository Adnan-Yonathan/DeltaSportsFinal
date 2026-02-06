'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import StatsSection from '@/components/ui/call-to-action'
import { GuestHero } from '@/components/ui/guest-hero'
import { ROICalculator } from '@/components/ui/roi-calculator'
import { InsiderTransformation } from '@/components/welcome/insider-transformation'
import { InsiderToolArsenal } from '@/components/welcome/insider-tool-arsenal'
import { InsiderComparison } from '@/components/welcome/insider-comparison'
import { OddsMatrixSurface } from '@/components/ui/odds-matrix-surface'
import { ScrollFadeIn } from '@/components/ui/scroll-fade-in'

export default function WelcomeLanding() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <OddsMatrixSurface intensity={0.72} className="opacity-100" />

      {/* Ambient hacker wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.18),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.10),transparent_50%),radial-gradient(circle_at_50%_85%,rgba(34,197,94,0.12),transparent_55%)]" />
        <div className="insider-grid absolute inset-0 opacity-50" />
        <div className="insider-scanlines absolute inset-0 opacity-30" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-20 sm:pt-24">
        {/* Hero must remain unchanged */}
        <GuestHero />

        {/* CTA */}
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { duration: 0.5, delay: 0.7 }}
          className="mt-10 sm:mt-12"
        >
          <StatsSection showCards={false} />
        </motion.div>

        {/* Transformation */}
        <ScrollFadeIn className="mt-14 sm:mt-24">
          <InsiderTransformation />
        </ScrollFadeIn>

        {/* Features */}
        <ScrollFadeIn className="mt-14 sm:mt-24">
          <InsiderToolArsenal />
        </ScrollFadeIn>

        {/* Comparison */}
        <ScrollFadeIn className="mt-14 sm:mt-24">
          <InsiderComparison />
        </ScrollFadeIn>

        {/* ROI */}
        <ScrollFadeIn className="mt-10 sm:mt-16">
          <ROICalculator variant="welcome" />
        </ScrollFadeIn>

        {/* Bottom CTA (subtle, same as primary) */}
        <ScrollFadeIn className="mt-8 flex justify-center">
          <Link
            href="/auth/signup"
            className="inline-flex w-full max-w-md items-center justify-center gap-3 rounded-full border border-emerald-400/35 bg-black/70 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200 shadow-[0_18px_50px_rgba(16,185,129,0.18)] backdrop-blur hover:border-emerald-300/70 hover:text-emerald-100 sm:w-auto sm:max-w-none sm:tracking-[0.35em]"
          >
            <span className="text-white/60">Access:</span>
            <span>Try free for 7 days</span>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] text-emerald-200">
              free
            </span>
          </Link>
        </ScrollFadeIn>
      </div>
    </div>
  )
}
