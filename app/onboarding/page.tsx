import type { Metadata } from 'next'
import { OnboardingFlow } from '@/components/OnboardingFlow'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Onboarding | Delta Sports',
  description: 'Feature walkthrough for Sharp Projections, Sharp Props, Sharp Money Feed, and Research Mode.',
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingFlow />
    </Suspense>
  )
}
