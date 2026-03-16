import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/supabase/types'
import {
  DEFAULT_RECOMMENDED_PLAN,
  PRECHECKOUT_ONBOARDING_COOKIE,
  PRECHECKOUT_ONBOARDING_COOKIE_COMPLETED,
  buildTrialOnboardingProfile,
  getEmptyTrialActivationState,
  isTrialExperience,
  isTrialGoalKey,
  resolveRecommendedTool,
} from '@/lib/trial-flow'

type TrialOnboardingRequest = {
  name?: string
  experienceLevel?: string
  goals?: string[]
  betSize?: number
  betsPerDay?: number
}

const isValidBetSize = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 25 && value <= 2000

const isValidBetsPerDay = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 10

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
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const goals = Array.isArray(body.goals) ? body.goals.filter(isTrialGoalKey) : []

  if (!name || !isTrialExperience(body.experienceLevel) || goals.length === 0) {
    return NextResponse.json({ error: 'Invalid onboarding payload' }, { status: 400 })
  }

  if (!isValidBetSize(body.betSize) || !isValidBetsPerDay(body.betsPerDay)) {
    return NextResponse.json({ error: 'Invalid ROI settings' }, { status: 400 })
  }

  const onboardingProfile = buildTrialOnboardingProfile({
    name,
    experienceLevel: body.experienceLevel,
    goals,
    betSize: body.betSize,
    betsPerDay: body.betsPerDay,
  })
  const recommendedTool = resolveRecommendedTool(onboardingProfile)
  const previousMetadata =
    user.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}
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
      onboarding_name: onboardingProfile.name,
      display_name:
        typeof previousMetadata.display_name === 'string' && previousMetadata.display_name.length > 0
          ? previousMetadata.display_name
          : onboardingProfile.name,
      onboarding_profile: onboardingProfile,
      precheckout_onboarding_pending: false,
      precheckout_onboarding_completed: true,
      recommended_tool: recommendedTool,
      recommended_plan: DEFAULT_RECOMMENDED_PLAN,
      prioritized_tools: onboardingProfile.prioritized_tools,
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
      prioritizedTools: onboardingProfile.prioritized_tools,
    },
  })
  response.cookies.set(PRECHECKOUT_ONBOARDING_COOKIE, PRECHECKOUT_ONBOARDING_COOKIE_COMPLETED, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
