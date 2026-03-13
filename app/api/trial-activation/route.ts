import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/supabase/types'
import {
  RECOMMENDED_TOOL_DETAILS,
  RecommendedToolKey,
  TrialActivationState,
  TrialActivationStepKey,
  TrialFlowEventName,
  getTrialActivationState,
  isTrialActivationComplete,
  isTrialActivationStepKey,
} from '@/lib/trial-flow'

type TrialActivationRequest =
  | {
      action: 'initialize'
      recommendedTool?: string
    }
  | {
      action: 'complete_step'
      step: TrialActivationStepKey
    }
  | {
      action: 'dismiss_prompt'
      prompt: string
    }
  | {
      action: 'track_event'
      event: TrialFlowEventName
    }

const withEvent = (
  state: TrialActivationState,
  eventName: TrialFlowEventName,
  timestamp: string
): TrialActivationState => ({
  ...state,
  events: {
    ...state.events,
    [eventName]: timestamp,
  },
})

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as TrialActivationRequest
  const previousMetadata =
    user.user_metadata && typeof user.user_metadata === 'object'
      ? user.user_metadata
      : {}
  let nextState = getTrialActivationState(previousMetadata)
  const now = new Date().toISOString()

  if (body.action === 'initialize') {
    nextState = {
      ...nextState,
      startedAt: nextState.startedAt ?? now,
        recommendedTool:
        typeof body.recommendedTool === 'string' && body.recommendedTool in RECOMMENDED_TOOL_DETAILS
          ? (body.recommendedTool as RecommendedToolKey)
          : nextState.recommendedTool,
    }
    nextState = withEvent(nextState, 'trial_started', now)
  } else if (body.action === 'complete_step') {
    if (!isTrialActivationStepKey(body.step)) {
      return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
    }
    nextState = {
      ...nextState,
      startedAt: nextState.startedAt ?? now,
      steps: {
        ...nextState.steps,
        [body.step]: nextState.steps[body.step] ?? now,
      },
    }
    nextState = withEvent(nextState, 'checklist_step_completed', now)
    if (!nextState.completedAt && isTrialActivationComplete(nextState)) {
      nextState = {
        ...nextState,
        completedAt: now,
      }
    }
  } else if (body.action === 'dismiss_prompt') {
    nextState = {
      ...nextState,
      dismissedPrompts: Array.from(new Set([...nextState.dismissedPrompts, body.prompt])),
    }
  } else if (body.action === 'track_event') {
    nextState = withEvent(nextState, body.event, now)
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      ...previousMetadata,
      trial_activation_v1: nextState,
    },
  })

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: nextState,
  })
}
