import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingFlow } from '@/components/OnboardingFlow'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Welcome to Delta AI | Complete Your Profile",
  description: "Complete your profile to get the most out of Delta AI",
}

export default async function OnboardingPage() {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Check if onboarding is already completed
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (userError) {
    console.error('Error fetching user data:', userError)
  }

  // If onboarding is completed, redirect to chat
  if (userData?.onboarding_completed) {
    redirect('/')
  }

  return <OnboardingFlow />
}
