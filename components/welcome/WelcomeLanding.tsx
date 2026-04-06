'use client'

import { CinematicLandingHero } from '@/components/ui/cinematic-landing-hero'
import { ROICalculator } from '@/components/ui/roi-calculator'
import { PricingSection } from '@/components/ui/pricing-section'
import { PRICING_TIERS } from '@/components/pricing/pricing-tiers'
import { FeatureShowcaseHub } from '@/components/welcome/feature-showcase-hub'
import { WelcomeFaqAndFinalCta } from '@/components/welcome/faq-and-final-cta'
import { InsiderComparison } from '@/components/welcome/insider-comparison'
import { LiveTicker } from '@/components/welcome/live-ticker'
import { ScrollFadeIn } from '@/components/ui/scroll-fade-in'
import { ImageAutoSlider } from '@/components/ui/image-auto-slider'

export default function WelcomeLanding() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-black text-white">
      <CinematicLandingHero />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:pt-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:gap-4">
          <a
            href="#features"
            className="flex-1 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:border-emerald-300/50 hover:bg-emerald-500/10 hover:text-emerald-100"
          >
            Features
          </a>
          <a
            href="/auth/signup"
            className="flex-1 rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.14em] text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-400/25"
          >
            Get Instant Access
          </a>
        </div>

        {/* Live ticker directly under hero */}
        <ScrollFadeIn className="mt-4 sm:mt-6">
          <LiveTicker />
        </ScrollFadeIn>

        <div id="betproof-showcase" className="scroll-mt-24">
          <ScrollFadeIn className="mt-10 sm:mt-14">
            <div className="mb-4 text-center sm:mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Public, Verified Results
              </h2>
            </div>
            <ImageAutoSlider />
          </ScrollFadeIn>
        </div>

        {/* Features */}
        <div id="features" className="scroll-mt-24 mt-14 sm:mt-24">
          <FeatureShowcaseHub />
        </div>

        {/* Before / After */}
        <ScrollFadeIn className="mt-14 sm:mt-24">
          <InsiderComparison />
        </ScrollFadeIn>

        {/* ROI */}
        <div id="calculate-your-edge" className="scroll-mt-24">
          <ScrollFadeIn className="mt-10 sm:mt-16">
            <ROICalculator variant="welcome" />
          </ScrollFadeIn>
        </div>

        {/* Pricing */}
        <ScrollFadeIn className="mt-10 sm:mt-16">
          <div id="pricing" className="rounded-3xl border border-white/10 bg-black/50">
            <div className="border-b border-white/10 px-5 py-5 sm:px-7 sm:py-6">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-200/75">
                Start free
              </p>
              <h2 className="mt-2 text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Less than a coffee a day. More edge than you&apos;re getting now.
              </h2>
            </div>
            <PricingSection
              tiers={PRICING_TIERS}
              className="bg-transparent"
              showTrialHeading={false}
              showTrialDisclaimer={false}
              showTrialTimeline={false}
            />
          </div>
        </ScrollFadeIn>

        {/* FAQ + Final CTA */}
        <ScrollFadeIn className="mt-14 sm:mt-20">
          <WelcomeFaqAndFinalCta />
        </ScrollFadeIn>
      </div>
    </div>
  )
}
