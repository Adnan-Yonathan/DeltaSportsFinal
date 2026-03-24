import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { LAST_TOOL_COOKIE, sanitizeToolRoute } from '@/lib/navigation/tool-routes'
import TrialActivationHome from '@/components/trial-activation/trial-activation-home'
import {
  PRECHECKOUT_ONBOARDING_COOKIE,
  PRECHECKOUT_ONBOARDING_COOKIE_COMPLETED,
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
    'Follow sharp money in real time. Delta reads exchange orderbooks, tracks whale bets, and surfaces sharp money signals across NBA, NFL, NHL, and MLB. Start with a 7-day free trial.',
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
    const hasCompletedOnboardingCookie =
      cookieStore.get(PRECHECKOUT_ONBOARDING_COOKIE)?.value === PRECHECKOUT_ONBOARDING_COOKIE_COMPLETED
    const effectiveMetadata = hasCompletedOnboardingCookie
      ? {
          ...(user.user_metadata ?? {}),
          precheckout_onboarding_completed: true,
        }
      : user.user_metadata
    const membership = getMembershipStatusFromMetadata(effectiveMetadata)
    if (shouldStartPrecheckoutOnboarding(membership, effectiveMetadata)) {
      redirect('/trial-onboarding')
    }

    if (needsTrialActivationHome(membership, effectiveMetadata)) {
      const onboardingProfile =
        effectiveMetadata?.onboarding_profile &&
        typeof effectiveMetadata.onboarding_profile === 'object'
          ? (effectiveMetadata.onboarding_profile as TrialOnboardingProfile)
          : null
      const recommendedTool =
        typeof effectiveMetadata?.recommended_tool === 'string' &&
        effectiveMetadata.recommended_tool in RECOMMENDED_TOOL_DETAILS
          ? (effectiveMetadata.recommended_tool as keyof typeof RECOMMENDED_TOOL_DETAILS)
          : resolveRecommendedTool(onboardingProfile)
      const displayName =
        typeof effectiveMetadata?.full_name === 'string'
          ? effectiveMetadata.full_name
          : typeof effectiveMetadata?.name === 'string'
            ? effectiveMetadata.name
            : typeof effectiveMetadata?.display_name === 'string'
              ? effectiveMetadata.display_name
              : user.email ?? null

      return (
        <TrialActivationHome
          displayName={displayName}
          profile={onboardingProfile}
          recommendedTool={recommendedTool}
          initialState={getTrialActivationState(effectiveMetadata)}
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
