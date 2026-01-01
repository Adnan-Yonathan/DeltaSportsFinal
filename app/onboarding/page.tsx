import type { Metadata } from 'next'
import { OnboardingFlow } from '@/components/OnboardingFlow'

export const metadata: Metadata = {
  title: 'Onboarding | Delta Sports',
  description: 'Personalize Delta Sports AI before choosing a plan.',
}

export default function OnboardingPage() {
  return <OnboardingFlow />
}
