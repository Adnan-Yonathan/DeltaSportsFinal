import type { Metadata } from "next"
import { PricingSectionDemo } from "@/components/ui/pricing-section-demo"

export const metadata: Metadata = {
  title: "Pricing | Delta AI",
  description: "Choose the right Delta AI plan for your sports betting workflow.",
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white animate-fade-in">
      <PricingSectionDemo />
    </main>
  )
}
