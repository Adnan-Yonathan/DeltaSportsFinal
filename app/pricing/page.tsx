import { PricingPageClient } from "@/components/pricing/PricingPageClient"
import { Suspense } from "react"

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingPageClient />
    </Suspense>
  )
}
