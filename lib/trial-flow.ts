import type { MembershipInfo } from '@/lib/utils/membership'

export const PRECHECKOUT_ONBOARDING_COOKIE = 'delta_precheckout_onboarding'
export const DEFAULT_RECOMMENDED_PLAN = 'syndicate_monthly'

export type TrialPrimaryIntent =
  | 'best-edges'
  | 'tail-sharp-action'
  | 'player-props'
  | 'improve-clv'

export type TrialBetFocus = 'game-lines' | 'player-props' | 'both'
export type TrialExperience = 'new' | 'some' | 'advanced'

export type RecommendedToolKey =
  | 'sharp-projections'
  | 'sharp-props'
  | 'whale-detector'
  | 'research-mode'

export type TrialActivationStepKey =
  | 'view-edges'
  | 'save-alert'
  | 'compare-market'
  | 'review-confirmation'

export type TrialFlowEventName =
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'checkout_started_from_onboarding'
  | 'trial_started'
  | 'checklist_step_completed'

export interface TrialOnboardingProfile {
  primary_intent: TrialPrimaryIntent
  bet_focus: TrialBetFocus
  experience_level: TrialExperience
  preferred_markets: string[]
  signup_reasons: string[]
}

export interface TrialActivationState {
  startedAt: string | null
  completedAt: string | null
  recommendedTool: RecommendedToolKey | null
  recommendedPlan: string
  steps: Partial<Record<TrialActivationStepKey, string>>
  dismissedPrompts: string[]
  events: Partial<Record<TrialFlowEventName, string>>
}

export const TRIAL_ACTIVATION_STEPS: Array<{
  key: TrialActivationStepKey
  title: string
  description: string
  href: string
  cta: string
}> = [
  {
    key: 'view-edges',
    title: 'View your first 3 sharp edges',
    description: 'Open Sharp Projections and start with the highest-confidence board.',
    href: '/market-projections',
    cta: 'Open Sharp Projections',
  },
  {
    key: 'save-alert',
    title: 'Save one alert or watch item',
    description: 'Jump into Whale Detector and start following live sharp activity.',
    href: '/sharp-detector',
    cta: 'Open Whale Detector',
  },
  {
    key: 'compare-market',
    title: 'Compare one market across books',
    description: 'Use live boards to line shop the best number before you bet.',
    href: '/live-scores',
    cta: 'Open Live Boards',
  },
  {
    key: 'review-confirmation',
    title: 'Review one whale or line-move confirmation',
    description: 'Cross-check a move with Research Mode and build the habit of validation.',
    href: '/research/sharp-action',
    cta: 'Open Research Mode',
  },
]

export const RECOMMENDED_TOOL_DETAILS: Record<
  RecommendedToolKey,
  {
    title: string
    href: string
    screenshotSrc: string
    summary: string
    statLabel: string
    statValue: string
  }
> = {
  'sharp-projections': {
    title: 'Sharp Projections',
    href: '/market-projections',
    screenshotSrc: '/sharpprojections.png',
    summary: 'Start with the board that ranks the cleanest gaps between Delta prices and live markets.',
    statLabel: 'Board refresh',
    statValue: '15 min',
  },
  'sharp-props': {
    title: 'Sharp Props',
    href: '/sharp-props',
    screenshotSrc: '/Screenshot 2026-02-24 170409.png',
    summary: 'Read orderbook pressure and move early on props before books fully adjust.',
    statLabel: 'Signal type',
    statValue: 'Orderbook',
  },
  'whale-detector': {
    title: 'Whale Detector',
    href: '/sharp-detector',
    screenshotSrc: '/whalefeed.png',
    summary: 'Track large-ticket flow and confirm when size, timing, and market reaction align.',
    statLabel: 'Alert cadence',
    statValue: 'Live',
  },
  'research-mode': {
    title: 'Research Mode',
    href: '/research/sharp-action',
    screenshotSrc: '/research.png',
    summary: 'Validate line movement, closes, and long-term CLV patterns before you scale up.',
    statLabel: 'Lens',
    statValue: '30-day',
  },
}

const PRIMARY_INTENT_TO_REASONS: Record<TrialPrimaryIntent, string[]> = {
  'best-edges': ['live-lines'],
  'tail-sharp-action': ['alerts'],
  'player-props': ['prop-edges'],
  'improve-clv': ['matchup-research'],
}

const BET_FOCUS_TO_MARKETS: Record<TrialBetFocus, string[]> = {
  'game-lines': ['spreads', 'totals', 'moneyline'],
  'player-props': ['player-props'],
  both: ['spreads', 'totals', 'moneyline', 'player-props'],
}

export const isTrialPrimaryIntent = (value: unknown): value is TrialPrimaryIntent =>
  value === 'best-edges' ||
  value === 'tail-sharp-action' ||
  value === 'player-props' ||
  value === 'improve-clv'

export const isTrialBetFocus = (value: unknown): value is TrialBetFocus =>
  value === 'game-lines' || value === 'player-props' || value === 'both'

export const isTrialExperience = (value: unknown): value is TrialExperience =>
  value === 'new' || value === 'some' || value === 'advanced'

export const isTrialActivationStepKey = (value: unknown): value is TrialActivationStepKey =>
  value === 'view-edges' ||
  value === 'save-alert' ||
  value === 'compare-market' ||
  value === 'review-confirmation'

export const buildTrialOnboardingProfile = (input: {
  primaryIntent: TrialPrimaryIntent
  betFocus: TrialBetFocus
  experience: TrialExperience
}): TrialOnboardingProfile => ({
  primary_intent: input.primaryIntent,
  bet_focus: input.betFocus,
  experience_level: input.experience,
  preferred_markets: BET_FOCUS_TO_MARKETS[input.betFocus],
  signup_reasons: PRIMARY_INTENT_TO_REASONS[input.primaryIntent],
})

export const resolveRecommendedTool = (profile: Partial<TrialOnboardingProfile> | null | undefined): RecommendedToolKey => {
  const primaryIntent = profile?.primary_intent
  const betFocus = profile?.bet_focus

  if (primaryIntent === 'tail-sharp-action') return 'whale-detector'
  if (primaryIntent === 'improve-clv') return 'research-mode'
  if (primaryIntent === 'player-props' || betFocus === 'player-props') return 'sharp-props'
  return 'sharp-projections'
}

export const getEmptyTrialActivationState = (
  recommendedTool: RecommendedToolKey | null = null
): TrialActivationState => ({
  startedAt: null,
  completedAt: null,
  recommendedTool,
  recommendedPlan: DEFAULT_RECOMMENDED_PLAN,
  steps: {},
  dismissedPrompts: [],
  events: {},
})

export const getTrialActivationState = (
  metadata: Record<string, unknown> | null | undefined
): TrialActivationState => {
  const raw = metadata?.trial_activation_v1
  if (!raw || typeof raw !== 'object') {
    const recommendedTool =
      typeof metadata?.recommended_tool === 'string' &&
      metadata.recommended_tool in RECOMMENDED_TOOL_DETAILS
        ? (metadata.recommended_tool as RecommendedToolKey)
        : null
    return getEmptyTrialActivationState(recommendedTool)
  }

  const typed = raw as Record<string, unknown>
  const rawSteps =
    typed.steps && typeof typed.steps === 'object'
      ? (typed.steps as Record<string, unknown>)
      : {}
  const rawEvents =
    typed.events && typeof typed.events === 'object'
      ? (typed.events as Record<string, unknown>)
      : {}

  const steps = Object.fromEntries(
    Object.entries(rawSteps).filter(([key, value]) => isTrialActivationStepKey(key) && typeof value === 'string')
  ) as Partial<Record<TrialActivationStepKey, string>>

  const events = Object.fromEntries(
    Object.entries(rawEvents).filter(([key, value]) => typeof value === 'string')
  ) as Partial<Record<TrialFlowEventName, string>>

  const dismissedPrompts = Array.isArray(typed.dismissedPrompts)
    ? typed.dismissedPrompts.filter((value): value is string => typeof value === 'string')
    : []

  const recommendedTool =
    typeof typed.recommendedTool === 'string' && typed.recommendedTool in RECOMMENDED_TOOL_DETAILS
      ? (typed.recommendedTool as RecommendedToolKey)
      : typeof metadata?.recommended_tool === 'string' && metadata.recommended_tool in RECOMMENDED_TOOL_DETAILS
        ? (metadata.recommended_tool as RecommendedToolKey)
        : null

  return {
    startedAt: typeof typed.startedAt === 'string' ? typed.startedAt : null,
    completedAt: typeof typed.completedAt === 'string' ? typed.completedAt : null,
    recommendedTool,
    recommendedPlan:
      typeof typed.recommendedPlan === 'string' && typed.recommendedPlan.length > 0
        ? typed.recommendedPlan
        : DEFAULT_RECOMMENDED_PLAN,
    steps,
    dismissedPrompts,
    events,
  }
}

export const getCompletedTrialActivationSteps = (state: TrialActivationState) =>
  TRIAL_ACTIVATION_STEPS.filter((step) => Boolean(state.steps[step.key])).length

export const isTrialActivationComplete = (state: TrialActivationState) =>
  getCompletedTrialActivationSteps(state) >= TRIAL_ACTIVATION_STEPS.length

export const needsTrialActivationHome = (
  membership: MembershipInfo,
  metadata: Record<string, unknown> | null | undefined
) => {
  if (membership.status !== 'trialing') return false
  return !isTrialActivationComplete(getTrialActivationState(metadata))
}

export const shouldStartPrecheckoutOnboarding = (
  membership: MembershipInfo,
  metadata: Record<string, unknown> | null | undefined
) => {
  if (membership.hasPaidAccess) return false
  if (membership.hasUsedTrial) return false
  return !Boolean(metadata?.precheckout_onboarding_completed)
}

export const canAccessPrecheckoutOnboarding = (
  membership: MembershipInfo,
  metadata: Record<string, unknown> | null | undefined
) => {
  if (membership.hasPaidAccess) return false
  return !membership.hasUsedTrial || !Boolean(metadata?.precheckout_onboarding_completed)
}

export const trackTrialFlowEvent = (
  eventName: TrialFlowEventName,
  properties: Record<string, string | number | boolean | null | undefined> = {}
) => {
  if (typeof window === 'undefined') return

  const payload = {
    event_category: 'trial_flow',
    ...properties,
  }

  const gtag = (window as Window & {
    gtag?: (command: 'event', name: string, params?: Record<string, unknown>) => void
  }).gtag

  if (typeof gtag === 'function') {
    gtag('event', eventName, payload)
  }

  const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer
  if (Array.isArray(dataLayer)) {
    dataLayer.push({
      event: eventName,
      ...payload,
    })
  }
}
