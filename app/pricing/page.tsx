import type { Metadata } from "next"
import { PricingSectionDemo } from "@/components/ui/pricing-section-demo"

export const metadata: Metadata = {
  title: "Pricing | Delta AI",
  description: "Choose the right Delta AI plan for your sports betting workflow.",
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-800 via-neutral-800 to-neutral-900 text-white animate-fade-in">
      <PricingSectionDemo />
    </main>
  )
}
