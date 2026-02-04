"use client"

import { PricingSection } from "@/components/ui/pricing-section"
import { PRICING_TIERS } from "@/components/pricing/pricing-tiers"

export function PricingSectionDemo() {
  return <PricingSection tiers={PRICING_TIERS} />
}
