import type { Metadata } from 'next'
import TrialOnboardingFlow from '@/components/trial-onboarding/trial-onboarding-flow'

export const metadata: Metadata = {
  title: 'Trial Onboarding | Delta Sports',
  description: 'Personalize your first week inside Delta before you start your 3-day annual trial.',
}

export default function TrialOnboardingPage() {
  return <TrialOnboardingFlow />
}
