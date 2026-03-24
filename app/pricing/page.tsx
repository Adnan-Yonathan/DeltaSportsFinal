import type { Metadata } from 'next'
import { PricingPageClient } from "@/components/pricing/PricingPageClient"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: 'Pricing | Delta Sports – Sharp Money Tools from $24.99/wk',
  description:
    'Delta Sports plans start at $24.99/week. Get exchange orderbook reads, whale bet tracking, sharp money signals, and AI market projections. 7-day free trial on all plans.',
  alternates: {
    canonical: 'https://deltasports.app/pricing',
  },
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingPageClient />
    </Suspense>
  )
}
