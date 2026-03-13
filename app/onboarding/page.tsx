import type { Metadata } from 'next'
import { OnboardingFlow } from '@/components/OnboardingFlow'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Onboarding | Delta Sports',
  description: 'Welcome to Delta. Follow the socials, grab the Kalshi bonus, and head into the app.',
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingFlow />
    </Suspense>
  )
}
