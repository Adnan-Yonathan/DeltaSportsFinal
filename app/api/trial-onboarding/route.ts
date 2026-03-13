import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/supabase/types'
import {
  DEFAULT_RECOMMENDED_PLAN,
  PRECHECKOUT_ONBOARDING_COOKIE,
  buildTrialOnboardingProfile,
  getEmptyTrialActivationState,
  isTrialBetFocus,
  isTrialExperience,
  isTrialPrimaryIntent,
  resolveRecommendedTool,
} from '@/lib/trial-flow'

type TrialOnboardingRequest = {
  primaryIntent?: string
  betFocus?: string
  experience?: string
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as TrialOnboardingRequest

  if (
    !isTrialPrimaryIntent(body.primaryIntent) ||
    !isTrialBetFocus(body.betFocus) ||
    !isTrialExperience(body.experience)
  ) {
    return NextResponse.json({ error: 'Invalid onboarding payload' }, { status: 400 })
  }

  const onboardingProfile = buildTrialOnboardingProfile({
    primaryIntent: body.primaryIntent,
    betFocus: body.betFocus,
    experience: body.experience,
  })
  const recommendedTool = resolveRecommendedTool(onboardingProfile)
  const previousMetadata =
    user.user_metadata && typeof user.user_metadata === 'object'
      ? user.user_metadata
      : {}
  const nextActivationState = {
    ...getEmptyTrialActivationState(recommendedTool),
    recommendedPlan: DEFAULT_RECOMMENDED_PLAN,
    events: {
      onboarding_completed: new Date().toISOString(),
    },
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      ...previousMetadata,
      onboarding_profile: onboardingProfile,
      precheckout_onboarding_pending: false,
      precheckout_onboarding_completed: true,
      recommended_tool: recommendedTool,
      recommended_plan: DEFAULT_RECOMMENDED_PLAN,
      trial_activation_v1: nextActivationState,
    },
  })

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const response = NextResponse.json({
    success: true,
    data: {
      recommendedTool,
      recommendedPlan: DEFAULT_RECOMMENDED_PLAN,
    },
  })
  response.cookies.set(PRECHECKOUT_ONBOARDING_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
