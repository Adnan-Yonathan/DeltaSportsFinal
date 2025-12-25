import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Onboarding | Delta AI',
  description: 'Onboarding has been replaced by membership checkout.',
}

export default function OnboardingPage() {
  redirect('/pricing')
}
