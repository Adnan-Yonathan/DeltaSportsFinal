import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Onboarding | Delta Sports',
  description: 'Legacy onboarding route for Delta Sports.',
}

export default function OnboardingPage() {
  redirect('/')
}
