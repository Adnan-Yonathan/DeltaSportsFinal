import type { MembershipInfo } from '@/lib/utils/membership'

export const PRECHECKOUT_ONBOARDING_COOKIE = 'delta_precheckout_onboarding'
export const PRECHECKOUT_ONBOARDING_COOKIE_COMPLETED = 'completed'
export const DEFAULT_RECOMMENDED_PLAN = 'syndicate_annual'
export const TRIAL_ONBOARDING_STORAGE_KEY = 'delta_trial_onboarding_v2'
export const ROI_PLAN_COST = 79
export const ROI_BASELINE_EDGE = 0.0262

export type TrialGoalKey =
  | 'beat-the-book'
  | 'find-sharp-lines'
  | 'track-whale-activity'
  | 'validate-picks'

export type TrialExperience =
  | 'casual-fan'
  | 'recreational'
  | 'serious-bettor'
  | 'sharp-pro'

export type RecommendedToolKey =
  | 'sharp-projections'
  | 'sharp-props'
  | 'whale-detector'
  | 'insider-feed'
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
  | 'checkout_variant_loaded'
  | 'checkout_variant_fallback'
  | 'express_checkout_ready'
  | 'express_checkout_confirmed'
  | 'payment_element_submitted'
  | 'trial_started'
  | 'checklist_step_completed'

export interface RoiSnapshot {
  bet_size: number
  bets_per_day: number
  monthly_ev: number
  yearly_ev: number
  roi_vs_plan_cost: number
}

export interface TrialOnboardingDraft {
  name: string
  experienceLevel: TrialExperience | null
  goals: TrialGoalKey[]
  prioritizedTools: RecommendedToolKey[]
  betSize: number
  betsPerDay: number
  monthlyEv: number
  yearlyEv: number
  roiVsPlanCost: number
}

export interface TrialOnboardingProfile {
  name: string
  primary_intent: TrialGoalKey | null
  bet_focus: 'full-board'
  experience_level: TrialExperience
  preferred_markets: string[]
  signup_reasons: string[]
  goal_keys: TrialGoalKey[]
  prioritized_tools: RecommendedToolKey[]
  bet_size: number
  bets_per_day: number
  roi_snapshot: RoiSnapshot
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

type ToolDetail = {
  title: string
  href: string
  screenshotSrc: string
  summary: string
  statLabel: string
  statValue: string
}

export const TOOL_DISPLAY_NAMES: Record<RecommendedToolKey, string> = {
  'sharp-projections': 'Sharp Projections',
  'sharp-props': 'Sharp Props',
  'whale-detector': 'Whale Feed',
  'insider-feed': 'Insider Feed',
  'research-mode': 'Research Mode',
}

export const GOAL_DISPLAY_NAMES: Record<TrialGoalKey, string> = {
  'beat-the-book': 'Beat the book',
  'find-sharp-lines': 'Find sharp lines before they move',
  'track-whale-activity': 'Track big money / whale activity',
  'validate-picks': 'Validate picks with research and CLV',
}

export const EXPERIENCE_DISPLAY_NAMES: Record<TrialExperience, string> = {
  'casual-fan': 'Casual fan',
  recreational: 'Recreational',
  'serious-bettor': 'Serious bettor',
  'sharp-pro': 'Sharp/Pro',
}

const GOAL_TO_SIGNUP_REASON: Record<TrialGoalKey, string> = {
  'beat-the-book': 'beat-the-book',
  'find-sharp-lines': 'find-sharp-lines',
  'track-whale-activity': 'track-whale-activity',
  'validate-picks': 'validate-picks',
}

const GOAL_TO_MARKETS: Record<TrialGoalKey, string[]> = {
  'beat-the-book': ['spreads', 'totals', 'moneyline'],
  'find-sharp-lines': ['spreads', 'totals', 'moneyline'],
  'track-whale-activity': ['moneyline', 'totals', 'player-props'],
  'validate-picks': ['spreads', 'totals', 'moneyline', 'player-props'],
}

const GOAL_TOOL_WEIGHTS: Record<TrialGoalKey, Array<[RecommendedToolKey, number]>> = {
  'beat-the-book': [
    ['sharp-projections', 5],
    ['research-mode', 3],
    ['sharp-props', 2],
    ['whale-detector', 1],
  ],
  'find-sharp-lines': [
    ['sharp-projections', 5],
    ['whale-detector', 4],
    ['research-mode', 2],
    ['sharp-props', 1],
  ],
  'track-whale-activity': [
    ['whale-detector', 5],
    ['sharp-props', 3],
    ['sharp-projections', 2],
    ['research-mode', 1],
  ],
  'validate-picks': [
    ['research-mode', 6],
    ['sharp-projections', 4],
    ['whale-detector', 2],
    ['sharp-props', 1],
  ],
}

const EXPERIENCE_TOOL_WEIGHTS: Record<TrialExperience, Array<[RecommendedToolKey, number]>> = {
  'casual-fan': [
    ['sharp-projections', 1],
    ['research-mode', 0.5],
  ],
  recreational: [
    ['sharp-projections', 1],
    ['sharp-props', 0.5],
  ],
  'serious-bettor': [
    ['sharp-projections', 1],
    ['research-mode', 0.5],
  ],
  'sharp-pro': [
    ['research-mode', 1],
    ['sharp-projections', 0.5],
  ],
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
    description: 'Jump into Whale Feed and start following live sharp activity.',
    href: '/sharp-detector',
    cta: 'Open Whale Feed',
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

export const RECOMMENDED_TOOL_DETAILS: Record<RecommendedToolKey, ToolDetail> = {
  'sharp-projections': {
    title: 'Sharp Projections',
    href: '/market-projections',
    screenshotSrc: '/sharpprojections.png',
    summary:
      'Start with the board that ranks the cleanest gaps between Delta pricing and live markets.',
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
    title: 'Whale Feed',
    href: '/sharp-detector',
    screenshotSrc: '/whalefeed.png',
    summary:
      'Track large-ticket flow and compare exchange pricing against sportsbook movement in one stream.',
    statLabel: 'Alert cadence',
    statValue: 'Live',
  },
  'insider-feed': {
    title: 'Insider Feed',
    href: '/polymarket-insider',
    screenshotSrc: '/insiderfeed.png',
    summary: 'See where top-ROI Polymarket wallets are positioned on open sports markets.',
    statLabel: 'Score range',
    statValue: '60–99',
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

export const calculateRoiSnapshot = (
  betSize: number,
  betsPerDay: number,
  edge = ROI_BASELINE_EDGE,
  planCost = ROI_PLAN_COST
): RoiSnapshot => {
  const monthlyEvRaw = betSize * betsPerDay * 30 * edge
  const yearlyEvRaw = monthlyEvRaw * 12
  const roiVsPlanCostRaw = planCost > 0 ? monthlyEvRaw / planCost : 0

  return {
    bet_size: betSize,
    bets_per_day: betsPerDay,
    monthly_ev: Number(monthlyEvRaw.toFixed(2)),
    yearly_ev: Number(yearlyEvRaw.toFixed(2)),
    roi_vs_plan_cost: Number(roiVsPlanCostRaw.toFixed(2)),
  }
}

export const createDefaultTrialOnboardingDraft = (): TrialOnboardingDraft => {
  const roi = calculateRoiSnapshot(100, 1)
  return {
    name: '',
    experienceLevel: null,
    goals: [],
    prioritizedTools: ['sharp-projections', 'sharp-props', 'whale-detector', 'research-mode'],
    betSize: roi.bet_size,
    betsPerDay: roi.bets_per_day,
    monthlyEv: roi.monthly_ev,
    yearlyEv: roi.yearly_ev,
    roiVsPlanCost: roi.roi_vs_plan_cost,
  }
}

export const isTrialGoalKey = (value: unknown): value is TrialGoalKey =>
  value === 'beat-the-book' ||
  value === 'find-sharp-lines' ||
  value === 'track-whale-activity' ||
  value === 'validate-picks'

export const isTrialExperience = (value: unknown): value is TrialExperience =>
  value === 'casual-fan' ||
  value === 'recreational' ||
  value === 'serious-bettor' ||
  value === 'sharp-pro'

export const isTrialActivationStepKey = (value: unknown): value is TrialActivationStepKey =>
  value === 'view-edges' ||
  value === 'save-alert' ||
  value === 'compare-market' ||
  value === 'review-confirmation'

export const getExperienceResponse = (experience: TrialExperience) => {
  switch (experience) {
    case 'casual-fan':
      return 'Delta will lead with guided projections and plain-English signal context.'
    case 'recreational':
      return 'Delta will surface cleaner ranked signals first so you can move faster without overload.'
    case 'serious-bettor':
      return 'Delta will open on edge-ranked projections and sharper board context first.'
    case 'sharp-pro':
      return 'Delta will bias toward raw model data, CLV context, and faster validation workflows.'
  }
}

export const prioritizeTools = (
  goalKeys: TrialGoalKey[],
  experience: TrialExperience | null
): RecommendedToolKey[] => {
  const scores = new Map<RecommendedToolKey, number>([
    ['sharp-projections', 0],
    ['sharp-props', 0],
    ['whale-detector', 0],
    ['research-mode', 0],
  ])

  goalKeys.forEach((goal) => {
    GOAL_TOOL_WEIGHTS[goal].forEach(([tool, weight]) => {
      scores.set(tool, (scores.get(tool) ?? 0) + weight)
    })
  })

  if (experience) {
    EXPERIENCE_TOOL_WEIGHTS[experience].forEach(([tool, weight]) => {
      scores.set(tool, (scores.get(tool) ?? 0) + weight)
    })
  }

  return [...scores.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0])
    })
    .map(([tool]) => tool)
}

export const buildTrialOnboardingProfile = (input: {
  name: string
  experienceLevel: TrialExperience
  goals: TrialGoalKey[]
  betSize: number
  betsPerDay: number
}): TrialOnboardingProfile => {
  const prioritizedTools = prioritizeTools(input.goals, input.experienceLevel)
  const uniqueMarkets = Array.from(
    new Set(input.goals.flatMap((goal) => GOAL_TO_MARKETS[goal]))
  )
  const roi = calculateRoiSnapshot(input.betSize, input.betsPerDay)

  return {
    name: input.name.trim(),
    primary_intent: input.goals[0] ?? null,
    bet_focus: 'full-board',
    experience_level: input.experienceLevel,
    preferred_markets: uniqueMarkets,
    signup_reasons: input.goals.map((goal) => GOAL_TO_SIGNUP_REASON[goal]),
    goal_keys: input.goals,
    prioritized_tools: prioritizedTools,
    bet_size: roi.bet_size,
    bets_per_day: roi.bets_per_day,
    roi_snapshot: roi,
  }
}

export const resolveRecommendedTool = (
  profile: Partial<TrialOnboardingProfile> | null | undefined
): RecommendedToolKey => {
  if (Array.isArray(profile?.prioritized_tools)) {
    const tool = profile.prioritized_tools.find(
      (value): value is RecommendedToolKey =>
        typeof value === 'string' && value in RECOMMENDED_TOOL_DETAILS
    )
    if (tool) return tool
  }

  if (profile?.primary_intent === 'track-whale-activity') return 'whale-detector'
  if (profile?.primary_intent === 'validate-picks') return 'research-mode'
  if (profile?.primary_intent === 'find-sharp-lines') return 'sharp-projections'
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
    Object.entries(rawSteps).filter(
      ([key, value]) => isTrialActivationStepKey(key) && typeof value === 'string'
    )
  ) as Partial<Record<TrialActivationStepKey, string>>

  const events = Object.fromEntries(
    Object.entries(rawEvents).filter(([_, value]) => typeof value === 'string')
  ) as Partial<Record<TrialFlowEventName, string>>

  const dismissedPrompts = Array.isArray(typed.dismissedPrompts)
    ? typed.dismissedPrompts.filter((value): value is string => typeof value === 'string')
    : []

  const recommendedTool =
    typeof typed.recommendedTool === 'string' && typed.recommendedTool in RECOMMENDED_TOOL_DETAILS
      ? (typed.recommendedTool as RecommendedToolKey)
      : typeof metadata?.recommended_tool === 'string' &&
          metadata.recommended_tool in RECOMMENDED_TOOL_DETAILS
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
  if (membership.hasUsedTrial) return false
  return !Boolean(metadata?.precheckout_onboarding_completed)
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

  const gtag = (
    window as Window & {
      gtag?: (command: 'event', name: string, params?: Record<string, unknown>) => void
    }
  ).gtag

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
