import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { LAST_TOOL_COOKIE, sanitizeToolRoute } from '@/lib/navigation/tool-routes'
import TrialActivationHome from '@/components/trial-activation/trial-activation-home'
import {
  RECOMMENDED_TOOL_DETAILS,
  getTrialActivationState,
  needsTrialActivationHome,
  resolveRecommendedTool,
  shouldStartPrecheckoutOnboarding,
} from '@/lib/trial-flow'
import type { TrialOnboardingProfile } from '@/lib/trial-flow'
import { getMembershipStatusFromMetadata } from '@/lib/utils/membership'
import WelcomeClient from './welcome/welcome-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Delta Sports | Sharp Money Tracking & Betting Analytics',
  description:
    'Follow sharp money in real time. Delta reads exchange orderbooks, tracks whale bets, and surfaces sharp money signals across NBA, NFL, NHL, and MLB. Start free for 7 days.',
  alternates: {
    canonical: 'https://deltasports.app',
  },
}

export default async function Home() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const cookieStore = cookies()
    const membership = getMembershipStatusFromMetadata(user.user_metadata)
    if (shouldStartPrecheckoutOnboarding(membership, user.user_metadata)) {
      redirect('/trial-onboarding')
    }

    if (needsTrialActivationHome(membership, user.user_metadata)) {
      const onboardingProfile =
        user.user_metadata?.onboarding_profile &&
        typeof user.user_metadata.onboarding_profile === 'object'
          ? (user.user_metadata.onboarding_profile as TrialOnboardingProfile)
          : null
      const recommendedTool =
        typeof user.user_metadata?.recommended_tool === 'string' &&
        user.user_metadata.recommended_tool in RECOMMENDED_TOOL_DETAILS
          ? (user.user_metadata.recommended_tool as keyof typeof RECOMMENDED_TOOL_DETAILS)
          : resolveRecommendedTool(onboardingProfile)
      const displayName =
        typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === 'string'
            ? user.user_metadata.name
            : typeof user.user_metadata?.display_name === 'string'
              ? user.user_metadata.display_name
              : user.email ?? null

      return (
        <TrialActivationHome
          displayName={displayName}
          profile={onboardingProfile}
          recommendedTool={recommendedTool}
          initialState={getTrialActivationState(user.user_metadata)}
        />
      )
    }

    const rawLastTool = cookieStore.get(LAST_TOOL_COOKIE)?.value
    let decodedLastTool: string | null = null
    if (rawLastTool) {
      try {
        decodedLastTool = decodeURIComponent(rawLastTool)
      } catch {
        decodedLastTool = rawLastTool
      }
    }
    redirect(sanitizeToolRoute(decodedLastTool))
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <WelcomeClient />
    </Suspense>
  )
}
