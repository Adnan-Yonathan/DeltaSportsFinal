'use client'

import { HeroSection } from '@/components/ui/hero-1'
import { ROICalculator } from '@/components/ui/roi-calculator'
import { PricingSection } from '@/components/ui/pricing-section'
import { PRICING_TIERS } from '@/components/pricing/pricing-tiers'
import { FeatureShowcaseHub } from '@/components/welcome/feature-showcase-hub'
import { WelcomeFaqAndFinalCta } from '@/components/welcome/faq-and-final-cta'
import { InsiderComparison } from '@/components/welcome/insider-comparison'
import { ScrollFadeIn } from '@/components/ui/scroll-fade-in'

export default function WelcomeLanding() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:pt-6">
        <HeroSection />

        {/* Features */}
        <ScrollFadeIn className="mt-14 sm:mt-24">
          <FeatureShowcaseHub />
        </ScrollFadeIn>

        {/* Comparison */}
        <ScrollFadeIn className="mt-14 sm:mt-24">
          <InsiderComparison />
        </ScrollFadeIn>

        {/* ROI */}
        <ScrollFadeIn className="mt-10 sm:mt-16">
          <ROICalculator variant="welcome" />
        </ScrollFadeIn>

        {/* Pricing */}
        <ScrollFadeIn className="mt-10 sm:mt-16">
          <div id="pricing" className="rounded-3xl border border-white/10 bg-black/50">
            <div className="border-b border-white/10 px-5 py-5 sm:px-7 sm:py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-200/75">
                Pricing
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Pick the plan that fits your workflow
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
