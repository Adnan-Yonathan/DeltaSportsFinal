'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  FlaskConical,
  Loader2,
  Radar,
  Sparkles,
  Target,
  Waves,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_RECOMMENDED_PLAN,
  type RecommendedToolKey,
  type TrialBetFocus,
  type TrialExperience,
  type TrialPrimaryIntent,
  resolveRecommendedTool,
  trackTrialFlowEvent,
} from '@/lib/trial-flow'

type StepId = 'welcome' | 'primary-intent' | 'bet-focus' | 'experience' | 'summary' | 'preview'

type QuestionOption<T extends string> = {
  value: T
  title: string
  description: string
  eyebrow?: string
}

type ToolSnapshot = {
  title: string
  eyebrow: string
  summary: string
  signalLabel: string
  signalValue: string
  authorityPoints: string[]
  Icon: LucideIcon
}

const STEP_ORDER: StepId[] = ['welcome', 'primary-intent', 'bet-focus', 'experience', 'summary', 'preview']

const PRIMARY_INTENT_OPTIONS: QuestionOption<TrialPrimaryIntent>[] = [
  {
    value: 'best-edges',
    title: 'Find the best edges faster',
    description: 'Start with the cleanest price gaps and highest-confidence opportunities on the board.',
    eyebrow: 'Fastest path to value',
  },
  {
    value: 'tail-sharp-action',
    title: 'Track where sharp money is landing',
    description: 'Follow size, timing, and market response when respected action hits.',
    eyebrow: 'Live market pressure',
  },
  {
    value: 'player-props',
    title: 'Attack player props earlier',
    description: 'See prop pressure and movement before books fully rebalance.',
    eyebrow: 'Props-first workflow',
  },
  {
    value: 'improve-clv',
    title: 'Improve my long-term CLV',
    description: 'Use research, validation, and repeatable routines instead of one-off guesses.',
    eyebrow: 'Process over impulse',
  },
]

const BET_FOCUS_OPTIONS: QuestionOption<TrialBetFocus>[] = [
  {
    value: 'game-lines',
    title: 'Game lines',
    description: 'Spreads, totals, and moneylines should lead my first Delta session.',
    eyebrow: 'Core board focus',
  },
  {
    value: 'player-props',
    title: 'Player props',
    description: 'Surface prop-specific pressure, movement, and outs first.',
    eyebrow: 'Player market focus',
  },
  {
    value: 'both',
    title: 'Both',
    description: 'Blend game lines and props so I can shop the best opportunity each day.',
    eyebrow: 'Full board coverage',
  },
]

const EXPERIENCE_OPTIONS: QuestionOption<TrialExperience>[] = [
  {
    value: 'new',
    title: 'New to this',
    description: 'Give me the cleanest starting workflow and reduce noise.',
    eyebrow: 'Guided setup',
  },
  {
    value: 'some',
    title: 'I have some experience',
    description: 'Show me the strongest tools quickly, but keep context visible.',
    eyebrow: 'Balanced depth',
  },
  {
    value: 'advanced',
    title: 'Advanced bettor',
    description: 'Prioritize speed, confirmation, and data depth over hand-holding.',
    eyebrow: 'High-speed workflow',
  },
]

const TOOL_SNAPSHOTS: Record<RecommendedToolKey, ToolSnapshot> = {
  'sharp-projections': {
    title: 'Sharp Projections',
    eyebrow: 'Model-ranked edge board',
    summary: 'Ranks the cleanest gaps between Delta pricing and live market numbers so you know where to start.',
    signalLabel: 'Board cadence',
    signalValue: '15 min refresh',
    authorityPoints: ['Ranks edges by confidence', 'Flags the board before books settle', 'Best starting point for most users'],
    Icon: BarChart3,
  },
  'sharp-props': {
    title: 'Sharp Props',
    eyebrow: 'Player prop pressure map',
    summary: 'Shows where prop markets are leaning so you can move before the last wave of price adjustment.',
    signalLabel: 'Signal type',
    signalValue: 'Orderflow pressure',
    authorityPoints: ['Early read on prop movement', 'Built for player market specialists', 'Pairs with live confirmation'],
    Icon: Target,
  },
  'whale-detector': {
    title: 'Whale Detector',
    eyebrow: 'Large-ticket activity feed',
    summary: 'Tracks size hitting the market and helps you separate real conviction from noise.',
    signalLabel: 'Feed status',
    signalValue: 'Live activity',
    authorityPoints: ['Monitors timing and size', 'Useful when sharp action clusters', 'Strong confirmation layer'],
    Icon: Radar,
  },
  'research-mode': {
    title: 'Research Mode',
    eyebrow: 'Validation and CLV lens',
    summary: 'Connects movement, close, and repeatability so you can build a process that compounds.',
    signalLabel: 'Research lens',
    signalValue: '30-day context',
    authorityPoints: ['Reinforces disciplined entries', 'Useful for CLV-focused workflows', 'Best for repeatable decision making'],
    Icon: FlaskConical,
  },
}

const TOOL_ORDER: RecommendedToolKey[] = ['sharp-projections', 'sharp-props', 'whale-detector', 'research-mode']

const getStepLabel = (step: StepId) => {
  switch (step) {
    case 'primary-intent':
      return 'What are you looking for?'
    case 'bet-focus':
      return 'What markets do you bet most?'
    case 'experience':
      return 'How experienced are you?'
    default:
      return 'Delta setup'
  }
}

const getSummaryHeadline = (recommendedTool: RecommendedToolKey, experience: TrialExperience | null) => {
  if (recommendedTool === 'whale-detector') return 'Start with live sharp confirmation'
  if (recommendedTool === 'research-mode') return 'Start with a tighter process'
  if (recommendedTool === 'sharp-props') return 'Start where props move fastest'
  if (experience === 'advanced') return 'Start with the strongest edge board'
  return 'Start with the clearest value on the board'
}

const buildToolOrder = (recommendedTool: RecommendedToolKey) => [
  recommendedTool,
  ...TOOL_ORDER.filter((tool) => tool !== recommendedTool),
]

export default function TrialOnboardingFlow() {
  const [stepIndex, setStepIndex] = useState(0)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [primaryIntent, setPrimaryIntent] = useState<TrialPrimaryIntent | null>(null)
  const [betFocus, setBetFocus] = useState<TrialBetFocus | null>(null)
  const [experience, setExperience] = useState<TrialExperience | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const currentStep = STEP_ORDER[stepIndex]
  const progress = ((stepIndex + 1) / STEP_ORDER.length) * 100

  const recommendedTool = useMemo<RecommendedToolKey>(() => {
    if (!primaryIntent || !betFocus) return 'sharp-projections'
    return resolveRecommendedTool({
      primary_intent: primaryIntent,
      bet_focus: betFocus,
      experience_level: experience ?? 'some',
      preferred_markets: [],
      signup_reasons: [],
    })
  }, [betFocus, experience, primaryIntent])

  const orderedTools = useMemo(() => buildToolOrder(recommendedTool), [recommendedTool])
  const activePreviewTool = orderedTools[previewIndex] ?? orderedTools[0]

  useEffect(() => {
    trackTrialFlowEvent('onboarding_started', { source: 'trial-onboarding' })
  }, [])

  const canContinue =
    currentStep === 'welcome' ||
    currentStep === 'summary' ||
    currentStep === 'preview' ||
    (currentStep === 'primary-intent' && Boolean(primaryIntent)) ||
    (currentStep === 'bet-focus' && Boolean(betFocus)) ||
    (currentStep === 'experience' && Boolean(experience))

  const goBack = () => {
    if (isSubmitting) return
    setSubmitError(null)
    setStepIndex((value) => Math.max(0, value - 1))
  }

  const goNext = async () => {
    if (!canContinue || isSubmitting) return
    setSubmitError(null)

    if (currentStep === 'preview') {
      if (!primaryIntent || !betFocus || !experience) return
      setIsSubmitting(true)
      trackTrialFlowEvent('onboarding_completed', { recommended_tool: recommendedTool })

      try {
        const response = await fetch('/api/trial-onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primaryIntent,
            betFocus,
            experience,
          }),
        })

        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to save onboarding')
        }

        trackTrialFlowEvent('checkout_started_from_onboarding', {
          recommended_tool: recommendedTool,
          recommended_plan: DEFAULT_RECOMMENDED_PLAN,
        })
        window.location.assign('/checkout?source=trial-onboarding')
        return
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Unable to continue')
      } finally {
        setIsSubmitting(false)
      }
    }

    if (currentStep !== 'welcome' && currentStep !== 'summary') {
      const value =
        currentStep === 'primary-intent'
          ? primaryIntent
          : currentStep === 'bet-focus'
            ? betFocus
            : currentStep === 'experience'
              ? experience
              : activePreviewTool
      trackTrialFlowEvent('onboarding_step_completed', {
        step: currentStep,
        value: value ?? 'unknown',
      })
    }

    setStepIndex((value) => Math.min(STEP_ORDER.length - 1, value + 1))
    if (currentStep === 'summary') setPreviewIndex(0)
  }

  return (
    <div className="relative h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#020706] text-white">
      <BackgroundChrome />
      <div className="relative z-10 mx-auto flex h-[100dvh] w-full max-w-5xl flex-col px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-5 lg:px-8 lg:pb-6">
        <TopBar
          currentStep={currentStep}
          stepIndex={stepIndex}
          totalSteps={STEP_ORDER.length}
          progress={progress}
          onBack={stepIndex > 0 ? goBack : undefined}
          disableBack={isSubmitting}
        />

        <div className="flex min-h-0 flex-1 items-stretch justify-center py-3 sm:py-5 lg:items-center lg:py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="h-full w-full"
            >
              {currentStep === 'welcome' && <WelcomeStep />}
              {currentStep === 'primary-intent' && (
                <QuestionStep
                  title="What are you looking for?"
                  description="We use this to decide which Delta workflow should lead your first week."
                  label="Your main goal"
                  options={PRIMARY_INTENT_OPTIONS}
                  value={primaryIntent}
                  onSelect={setPrimaryIntent}
                />
              )}
              {currentStep === 'bet-focus' && (
                <QuestionStep
                  title="What markets do you bet most?"
                  description="This changes whether Delta leans game lines, props, or both in your first session."
                  label="Your main market"
                  options={BET_FOCUS_OPTIONS}
                  value={betFocus}
                  onSelect={setBetFocus}
                />
              )}
              {currentStep === 'experience' && (
                <QuestionStep
                  title="How experienced are you?"
                  description="We tune the level of guidance so Delta feels decisive instead of noisy."
                  label="Your level"
                  options={EXPERIENCE_OPTIONS}
                  value={experience}
                  onSelect={setExperience}
                />
              )}
              {currentStep === 'summary' && (
                <SummaryStep
                  recommendedTool={recommendedTool}
                  primaryIntent={primaryIntent}
                  betFocus={betFocus}
                  experience={experience}
                  orderedTools={orderedTools}
                />
              )}
              {currentStep === 'preview' && (
                <PreviewStep
                  orderedTools={orderedTools}
                  activeTool={activePreviewTool}
                  previewIndex={previewIndex}
                  onSelectPreview={setPreviewIndex}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="z-20 pt-2 sm:pt-4">
          <BottomAction
            currentStep={currentStep}
            canContinue={canContinue}
            isSubmitting={isSubmitting}
            onNext={goNext}
            submitError={submitError}
          />
        </div>
      </div>
    </div>
  )
}

function BackgroundChrome() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(56,189,248,0.12),transparent_22%),linear-gradient(180deg,#04110d_0%,#020706_62%,#020706_100%)]" />
      <div className="insider-scanlines absolute inset-0 opacity-40" />
      <motion.div
        animate={{ x: [0, 24, 0], y: [0, -18, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-emerald-400/16 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -22, 0], y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,rgba(0,0,0,0.1)_45%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  )
}

function TopBar({
  currentStep,
  stepIndex,
  totalSteps,
  progress,
  onBack,
  disableBack,
}: {
  currentStep: StepId
  stepIndex: number
  totalSteps: number
  progress: number
  onBack?: () => void
  disableBack: boolean
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-hero text-[11px] uppercase tracking-[0.45em] text-emerald-300/80">Delta setup</div>
          <div className="mt-1 text-xs text-white/72 sm:text-sm">
            Step {stepIndex + 1} of {totalSteps}
            <span className="ml-2 text-white/40">{getStepLabel(currentStep)}</span>
          </div>
        </div>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={disableBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 py-2 text-xs text-white/90 transition hover:border-emerald-300/35 hover:bg-white/10 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <div className="h-10" />
        )}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function BottomAction({
  currentStep,
  canContinue,
  isSubmitting,
  onNext,
  submitError,
}: {
  currentStep: StepId
  canContinue: boolean
  isSubmitting: boolean
  onNext: () => void
  submitError: string | null
}) {
  const label =
    currentStep === 'welcome'
      ? 'Personalize Delta'
      : currentStep === 'summary'
        ? 'Preview your tools'
        : currentStep === 'preview'
          ? 'Start your 7-day trial'
          : 'Continue'

  return (
    <div className="space-y-2 rounded-[1.2rem] border border-white/10 bg-[rgba(3,11,9,0.88)] p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.34)] backdrop-blur sm:space-y-3 sm:rounded-[1.5rem] sm:p-4">
      <button
        type="button"
        onClick={onNext}
        disabled={!canContinue || isSubmitting}
        className="inline-flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-[1rem] bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-500 px-4 py-3 text-sm font-semibold text-[#04120d] shadow-[0_18px_50px_rgba(16,185,129,0.22)] transition hover:brightness-105 sm:min-h-[56px] sm:gap-3 sm:rounded-[1.35rem] sm:px-5 sm:py-3.5 sm:text-lg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : label}
        {!isSubmitting && <ArrowRight className="h-5 w-5" />}
      </button>
      <div className="min-h-[1.25rem] text-center text-xs text-white/58 sm:text-sm">
        {submitError ?? 'We only use this to personalize your first week inside Delta.'}
      </div>
    </div>
  )
}

function WelcomeStep() {
  return (
    <div className="grid h-full items-center gap-4 lg:grid-cols-[1fr_0.96fr] lg:gap-7">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-emerald-200/85">
          <Sparkles className="h-3.5 w-3.5" />
          Built to create fast conviction
        </div>
        <div className="space-y-3">
          <h1 className="max-w-3xl text-[2.2rem] font-semibold leading-[0.96] text-white sm:text-5xl lg:text-[3.65rem]">
            Build a Delta setup that gets you to value faster.
          </h1>
          <p className="max-w-2xl text-[0.95rem] leading-relaxed text-white/72 sm:text-[1.1rem]">
            Answer a few short questions, then Delta will route your first week toward the signals most likely to make you stay.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <AuthorityChip label="First-week focus" value="Edges, props, flow" />
          <AuthorityChip label="Setup time" value="Under 60 seconds" />
          <AuthorityChip label="Trial path" value="Direct to checkout" />
        </div>

        <div className="lg:hidden">
          <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.05] p-3">
            <div className="font-hero text-[10px] uppercase tracking-[0.32em] text-white/42">What Delta will lead with</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {TOOL_ORDER.slice(0, 4).map((tool) => (
                <div
                  key={tool}
                  className="rounded-[1rem] border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-semibold text-white/88"
                >
                  {TOOL_SNAPSHOTS[tool].title}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <ToolAuthorityBoard recommendedTool="sharp-projections" />
      </div>
    </div>
  )
}

function QuestionStep<T extends string>({
  title,
  description,
  label,
  options,
  value,
  onSelect,
}: {
  title: string
  description: string
  label: string
  options: QuestionOption<T>[]
  value: T | null
  onSelect: (value: T) => void
}) {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col justify-between">
      <div className="mb-5 text-center sm:mb-8">
        <h2 className="text-[2rem] font-semibold leading-tight text-white sm:text-4xl lg:text-[3.1rem]">{title}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-white/68 sm:mt-4 sm:text-lg">{description}</p>
      </div>

      <div className="space-y-3">
        <div className="font-hero text-[10px] uppercase tracking-[0.38em] text-white/45 sm:text-[11px]">{label}</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
          {options.map((option, index) => (
            <OptionCard
              key={option.value}
              title={option.title}
              description={option.description}
              eyebrow={option.eyebrow}
              selected={value === option.value}
              onClick={() => onSelect(option.value)}
              index={index}
              spanFull={options.length % 2 === 1 && index === options.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function AuthorityChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.95rem] border border-white/10 bg-white/6 px-2.5 py-2.5 backdrop-blur sm:rounded-[1.15rem] sm:px-4 sm:py-4">
      <div className="font-hero text-[10px] uppercase tracking-[0.32em] text-white/40">{label}</div>
      <div className="mt-1.5 text-[12px] font-semibold leading-snug text-white sm:mt-2 sm:text-lg">{value}</div>
    </div>
  )
}

function OptionCard({
  title,
  description,
  eyebrow,
  selected,
  onClick,
  index,
  spanFull,
}: {
  title: string
  description: string
  eyebrow?: string
  selected: boolean
  onClick: () => void
  index: number
  spanFull: boolean
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.24 }}
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-start justify-between gap-3 rounded-[1.15rem] border px-3.5 py-3.5 text-left transition sm:rounded-[1.45rem] sm:px-5 sm:py-5',
        spanFull && 'col-span-2 md:col-span-1',
        selected
          ? 'border-emerald-300/45 bg-gradient-to-r from-emerald-300/18 via-emerald-300/8 to-white/[0.05] shadow-[0_18px_40px_rgba(16,185,129,0.16)]'
          : 'border-white/10 bg-white/[0.04] hover:border-white/18 hover:bg-white/[0.07]'
      )}
    >
      <div className="space-y-2">
        {eyebrow ? <div className="font-hero text-[10px] uppercase tracking-[0.34em] text-emerald-200/75">{eyebrow}</div> : null}
        <div className="text-[1.08rem] font-semibold leading-tight text-white sm:text-[1.8rem]">{title}</div>
        <div className="max-w-2xl text-[12px] leading-relaxed text-white/66 sm:text-base">{description}</div>
      </div>
      <div
        className={cn(
          'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition',
          selected ? 'border-emerald-200 bg-emerald-300 text-[#03110b]' : 'border-white/16 text-white/35'
        )}
      >
        <Check className={cn('h-4 w-4 transition', selected ? 'opacity-100' : 'opacity-0')} />
      </div>
    </motion.button>
  )
}

function SummaryStep({
  recommendedTool,
  primaryIntent,
  betFocus,
  experience,
  orderedTools,
}: {
  recommendedTool: RecommendedToolKey
  primaryIntent: TrialPrimaryIntent | null
  betFocus: TrialBetFocus | null
  experience: TrialExperience | null
  orderedTools: RecommendedToolKey[]
}) {
  const recommendedSnapshot = TOOL_SNAPSHOTS[recommendedTool]

  return (
    <div className="grid h-full items-start gap-4 lg:grid-cols-[1fr_0.98fr] lg:gap-5">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-emerald-200/85">
          <Activity className="h-3.5 w-3.5" />
          Your first-week setup
        </div>
        <div>
          <h2 className="text-[1.95rem] font-semibold leading-tight text-white sm:text-4xl lg:text-[3.1rem]">
            {getSummaryHeadline(recommendedTool, experience)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/68 sm:mt-4 sm:text-lg">
            Delta will lead with <span className="font-semibold text-white">{recommendedSnapshot.title}</span> based on how you bet and what you want out of the trial.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <AuthorityChip
            label="Lead signal"
            value={primaryIntent === 'tail-sharp-action' ? 'Sharp action' : primaryIntent === 'improve-clv' ? 'Validation' : primaryIntent === 'player-props' ? 'Prop pressure' : 'Board value'}
          />
          <AuthorityChip
            label="Market bias"
            value={betFocus === 'player-props' ? 'Props first' : betFocus === 'both' ? 'Hybrid board' : 'Game lines'}
          />
          <AuthorityChip
            label="Guidance level"
            value={experience === 'advanced' ? 'Fast + data-heavy' : experience === 'new' ? 'More guided' : 'Balanced'}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 lg:hidden">
          {orderedTools.map((tool) => (
            <div
              key={tool}
              className={cn(
                'rounded-[1rem] border px-3 py-2 text-sm font-semibold',
                tool === recommendedTool
                  ? 'border-emerald-300/35 bg-emerald-300/12 text-white'
                  : 'border-white/10 bg-black/20 text-white/72'
              )}
            >
              {TOOL_SNAPSHOTS[tool].title}
            </div>
          ))}
        </div>

        <div className="hidden rounded-[2rem] border border-white/10 bg-white/[0.05] p-4 sm:p-5 lg:block">
          <div className="font-hero text-[10px] uppercase tracking-[0.34em] text-white/42">Included in your Delta stack</div>
          <div className="mt-4 space-y-3">
            {orderedTools.map((tool, index) => (
              <ToolMiniPanel key={tool} tool={tool} highlighted={tool === recommendedTool} index={index} />
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 space-y-3">
        <ToolSnapshotCard tool={recommendedTool} featured />
      </div>
    </div>
  )
}

function PreviewStep({
  orderedTools,
  activeTool,
  previewIndex,
  onSelectPreview,
}: {
  orderedTools: RecommendedToolKey[]
  activeTool: RecommendedToolKey
  previewIndex: number
  onSelectPreview: (index: number) => void
}) {
  return (
    <div className="grid h-full items-start gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:gap-5">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-cyan-100/85">
          <Waves className="h-3.5 w-3.5" />
          Tool snapshots
        </div>
        <div>
          <h2 className="text-[1.95rem] font-semibold leading-tight text-white sm:text-4xl lg:text-[3.1rem]">See how Delta will feel on day one.</h2>
          <p className="mt-2 max-w-xl text-sm text-white/68 sm:mt-4 sm:text-lg">
            These are visual depictions of the workflows you unlock during the trial. Pick through them before you head into checkout.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:hidden">
          {orderedTools.map((tool, index) => {
            const snapshot = TOOL_SNAPSHOTS[tool]
            const active = previewIndex === index

            return (
              <button
                key={tool}
                type="button"
                onClick={() => onSelectPreview(index)}
                className={cn(
                  'rounded-[1rem] border px-3 py-2 text-left transition',
                  active
                    ? 'border-emerald-300/45 bg-emerald-300/12'
                    : 'border-white/10 bg-white/[0.04]'
                )}
              >
                <div className="text-sm font-semibold text-white">{snapshot.title}</div>
                <div className="mt-1 text-[11px] text-white/48">{snapshot.eyebrow}</div>
              </button>
            )
          })}
        </div>

        <div className="hidden space-y-3 lg:block">
          {orderedTools.map((tool, index) => {
            const snapshot = TOOL_SNAPSHOTS[tool]
            const active = previewIndex === index

            return (
              <button
                key={tool}
                type="button"
                onClick={() => onSelectPreview(index)}
                className={cn(
                  'flex w-full items-center justify-between gap-4 rounded-[1.4rem] border px-4 py-4 text-left transition',
                  active
                    ? 'border-emerald-300/45 bg-emerald-300/12'
                    : 'border-white/10 bg-white/[0.04] hover:border-white/18 hover:bg-white/[0.07]'
                )}
              >
                <div>
                  <div className="font-hero text-[10px] uppercase tracking-[0.32em] text-white/42">{snapshot.eyebrow}</div>
                  <div className="mt-1 text-xl font-semibold text-white">{snapshot.title}</div>
                </div>
                <ArrowRight className={cn('h-5 w-5 transition', active ? 'text-emerald-200' : 'text-white/35')} />
              </button>
            )
          })}
        </div>
      </div>

      <ToolSnapshotCard tool={activeTool} featured />
    </div>
  )
}

function ToolMiniPanel({
  tool,
  highlighted,
  index,
}: {
  tool: RecommendedToolKey
  highlighted: boolean
  index: number
}) {
  const snapshot = TOOL_SNAPSHOTS[tool]
  const Icon = snapshot.Icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.24 }}
      className={cn(
        'rounded-[1.4rem] border px-4 py-4',
        highlighted ? 'border-emerald-300/35 bg-emerald-300/10' : 'border-white/8 bg-black/20'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 text-emerald-200">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold text-white">{snapshot.title}</div>
            {highlighted ? (
              <span className="rounded-full bg-emerald-300/18 px-2 py-0.5 text-[11px] uppercase tracking-[0.25em] text-emerald-100">
                Recommended first
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-white/60">{snapshot.summary}</p>
        </div>
      </div>
    </motion.div>
  )
}

function ToolSnapshotCard({ tool, featured = false }: { tool: RecommendedToolKey; featured?: boolean }) {
  const snapshot = TOOL_SNAPSHOTS[tool]
  const Icon = snapshot.Icon

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur sm:rounded-[2rem] sm:p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-hero text-[10px] uppercase tracking-[0.34em] text-emerald-200/75">{snapshot.eyebrow}</div>
          <div className="mt-1.5 text-xl font-semibold text-white sm:mt-2 sm:text-3xl">{snapshot.title}</div>
          <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-white/64 sm:mt-3 sm:text-base">{snapshot.summary}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-emerald-200 sm:h-12 sm:w-12">
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-3 sm:mt-5">
        <ToolVisual tool={tool} />
      </div>

      <div className={cn('mt-3 grid gap-2 sm:mt-5 sm:gap-3', featured ? 'sm:grid-cols-[0.9fr_1.1fr]' : 'sm:grid-cols-2')}>
        <div className="rounded-[1.4rem] border border-white/8 bg-black/20 p-4">
          <div className="font-hero text-[10px] uppercase tracking-[0.32em] text-white/42">{snapshot.signalLabel}</div>
          <div className="mt-2 text-xl font-semibold text-white">{snapshot.signalValue}</div>
        </div>
        <div className="hidden rounded-[1.4rem] border border-white/8 bg-black/20 p-4 sm:block">
          <div className="font-hero text-[10px] uppercase tracking-[0.32em] text-white/42">Why this converts</div>
          <div className="mt-2 space-y-2">
            {snapshot.authorityPoints.map((point) => (
              <div key={point} className="flex items-start gap-2 text-sm text-white/68">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolAuthorityBoard({ recommendedTool }: { recommendedTool: RecommendedToolKey }) {
  return (
    <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-black/25 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur sm:p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_36%)]" />
      <div className="relative space-y-4">
        <ToolSnapshotCard tool={recommendedTool} featured />
      </div>
    </div>
  )
}

function ToolVisual({ tool }: { tool: RecommendedToolKey }) {
  if (tool === 'sharp-props') {
    return (
      <div className="relative overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#051310] p-2.5 sm:rounded-[1.6rem] sm:p-4">
        <OverlayChrome />
        <div className="relative space-y-3">
          {[
            ['J. Brunson PTS', 'Over 27.5', 86],
            ['S. Curry 3PM', 'Over 4.5', 74],
            ['A. Davis REB', 'Under 11.5', 68],
          ].map(([label, leaning, value], index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 + 0.1, duration: 0.28 }}
              className="rounded-[1rem] border border-white/10 bg-black/25 p-2.5 sm:rounded-[1.2rem] sm:p-3"
            >
              <div className="flex items-center justify-between gap-3 text-[12px] sm:text-sm">
                <div className="font-medium text-white">{label}</div>
                <div className="text-emerald-200">{leaning}</div>
              </div>
              <PressureRow value={Number(value)} accent="from-cyan-300 to-emerald-300" />
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  if (tool === 'whale-detector') {
    return (
      <div className="relative overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#07100f] p-2.5 sm:rounded-[1.6rem] sm:p-4">
        <OverlayChrome />
        <div className="relative space-y-3">
          {[
            ['BOS -4.5', '$78.2k', 91],
            ['LAL/GSW Over 238.5', '$51.1k', 74],
            ['SGP Cluster', '$33.8k', 58],
          ].map(([market, size, confidence], index) => (
            <motion.div
              key={market}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07 + 0.08, duration: 0.26 }}
              className="rounded-[1rem] border border-white/10 bg-black/25 p-2.5 sm:rounded-[1.2rem] sm:p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] font-medium text-white sm:text-sm">{market}</div>
                <div className="rounded-full bg-emerald-300/14 px-2 py-1 text-xs uppercase tracking-[0.24em] text-emerald-100">
                  {size}
                </div>
              </div>
              <PressureRow value={Number(confidence)} accent="from-emerald-300 to-lime-200" />
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  if (tool === 'research-mode') {
    return (
      <div className="relative overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#061110] p-2.5 sm:rounded-[1.6rem] sm:p-4">
        <OverlayChrome />
        <div className="relative grid gap-2 sm:grid-cols-[1.15fr_0.85fr] sm:gap-4">
          <div className="rounded-[1rem] border border-white/10 bg-black/25 p-2 sm:rounded-[1.2rem] sm:p-3">
            <svg viewBox="0 0 280 150" className="h-28 w-full sm:h-40">
              <defs>
                <linearGradient id="delta-clv" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="rgba(125,211,252,0.95)" />
                  <stop offset="100%" stopColor="rgba(52,211,153,0.95)" />
                </linearGradient>
              </defs>
              <path d="M20 124 L80 108 L125 92 L180 74 L230 52 L260 38" fill="none" stroke="url(#delta-clv)" strokeWidth="4" strokeLinecap="round" />
              <path d="M20 124 L80 108 L125 92 L180 74 L230 52 L260 38" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="12" strokeLinecap="round" opacity="0.2" />
              {[
                [20, 124],
                [80, 108],
                [125, 92],
                [180, 74],
                [230, 52],
                [260, 38],
              ].map(([x, y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" fill="rgba(52,211,153,1)" />
              ))}
            </svg>
          </div>
          <div className="space-y-2 sm:space-y-3">
            <MetricChip label="CLV trend" value="+4.8%" />
            <MetricChip label="Validation score" value="87 / 100" />
            <MetricChip label="Closing reads" value="14 tracked" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#051310] p-2.5 sm:rounded-[1.6rem] sm:p-4">
      <OverlayChrome />
      <div className="relative space-y-3">
        {[
          ['NYK -4.5', 'Edge +3.2%', 84],
          ['MIL/CHI Over 229.5', 'Edge +2.7%', 71],
          ['DEN ML', 'Edge +2.1%', 63],
        ].map(([market, edge, score], index) => (
          <motion.div
            key={market}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.07 + 0.08, duration: 0.26 }}
            className="rounded-[1rem] border border-white/10 bg-black/25 p-2.5 sm:rounded-[1.2rem] sm:p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-medium text-white sm:text-sm">{market}</div>
              <div className="rounded-full bg-cyan-300/14 px-2 py-1 text-xs uppercase tracking-[0.24em] text-cyan-100">
                {edge}
              </div>
            </div>
            <PressureRow value={Number(score)} accent="from-emerald-300 to-cyan-300" />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function OverlayChrome() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_35%)]" />
      <div className="absolute left-3 top-3 h-7 w-16 rounded-full border border-white/10 bg-white/6 sm:left-4 sm:top-4 sm:h-9 sm:w-20" />
      <div className="absolute right-3 top-3 flex items-center gap-1 sm:right-4 sm:top-4">
        <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
        <span className="h-2 w-2 rounded-full bg-white/35" />
        <span className="h-2 w-2 rounded-full bg-white/18" />
      </div>
      <div className="absolute bottom-3 left-3 right-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </>
  )
}

function PressureRow({ value, accent }: { value: number; accent: string }) {
  return (
    <div className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-white/42 sm:text-[11px] sm:tracking-[0.28em]">
        <span>Pressure</span>
        <span>{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full bg-gradient-to-r', accent)}
        />
      </div>
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-white/10 bg-black/25 p-2.5 sm:rounded-[1.2rem] sm:p-3">
      <div className="font-hero text-[10px] uppercase tracking-[0.32em] text-white/42">{label}</div>
      <div className="mt-1.5 text-sm font-semibold text-white sm:mt-2 sm:text-lg">{value}</div>
    </div>
  )
}
