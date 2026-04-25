'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  Shield,
  Waves,
} from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import {
  ROI_PLAN_COST,
  TOOL_DISPLAY_NAMES,
  TRIAL_ONBOARDING_STORAGE_KEY,
  createDefaultTrialOnboardingDraft,
  trackTrialFlowEvent,
  type TrialOnboardingDraft,
} from '@/lib/trial-flow'

type ScreenId = 'name' | 'whale-feed' | 'insider-feed' | 'sharp-props' | 'roi' | 'paywall'

const SCREENS: Array<{ id: ScreenId; label: string; progress: number; cta: string }> = [
  { id: 'name', label: 'Step 1 of 6', progress: 16.7, cta: 'Continue ->' },
  { id: 'whale-feed', label: 'Step 2 of 6', progress: 33.4, cta: 'Next tool ->' },
  { id: 'insider-feed', label: 'Step 3 of 6', progress: 50, cta: 'Next tool ->' },
  { id: 'sharp-props', label: 'Step 4 of 6', progress: 66.7, cta: 'See the math ->' },
  { id: 'roi', label: 'Step 5 of 6', progress: 83.4, cta: 'Continue to checkout ->' },
  { id: 'paywall', label: 'Step 6 of 6', progress: 100, cta: 'Start my free trial ->' },
]

const FEATURE_SCREENS: Array<{
  id: Extract<ScreenId, 'whale-feed' | 'insider-feed' | 'sharp-props'>
  icon: JSX.Element
  title: string
  eyebrow: string
  description: string
  detail: string
  videoSrc: string
  posterSrc: string
}> = [
  {
    id: 'whale-feed',
    icon: <Waves className="h-5 w-5" />,
    title: TOOL_DISPLAY_NAMES['whale-detector'],
    eyebrow: 'Tool one',
    description: 'See large-ticket flow and live market pressure in one feed.',
    detail:
      'Use Whale Feed to catch the print first, then decide whether the price is still actionable before the rest of the market adjusts.',
    videoSrc: '/whalefeedvid.mobile.mp4',
    posterSrc: '/updatedwhalefeed.png',
  },
  {
    id: 'insider-feed',
    icon: <Eye className="h-5 w-5" />,
    title: TOOL_DISPLAY_NAMES['insider-feed'],
    eyebrow: 'Tool two',
    description: 'Confirm where top ROI wallets are already positioned.',
    detail:
      'Use Insider Feed as your confirmation layer. If the highest quality wallets are already leaning the same way, conviction is higher.',
    videoSrc: '/insiderfeedvid.mobile.mp4',
    posterSrc: '/insiderfeed.png',
  },
  {
    id: 'sharp-props',
    icon: <Activity className="h-5 w-5" />,
    title: TOOL_DISPLAY_NAMES['sharp-props'],
    eyebrow: 'Tool three',
    description: 'Read prop pressure fast and catch sharp action before the market finishes moving.',
    detail:
      'Use Sharp Props when the edge is in the player market. It is the fastest way to see pressure, compare numbers, and move before books finish reacting.',
    videoSrc: '/sharppropsvid.mobile.mp4',
    posterSrc: '/sharpprojections.png',
  },
]

function syncDraft(draft: TrialOnboardingDraft) {
  try {
    sessionStorage.setItem(TRIAL_ONBOARDING_STORAGE_KEY, JSON.stringify(draft))
  } catch {}
}

function calcWinsNeeded(betSize: number, planCost = ROI_PLAN_COST) {
  const profitPerWin = betSize * (100 / 110)
  return Math.max(1, Math.ceil(planCost / profitPerWin))
}

function NameScreen({
  draft,
  onName,
}: {
  draft: TrialOnboardingDraft
  onName: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
          Personalized setup
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">
          What should we call you?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          We will use your name throughout the trial and checkout flow.
        </p>
      </div>

      <div className="relative">
        <input
          autoFocus
          enterKeyHint="next"
          type="text"
          value={draft.name}
          onChange={(event) => onName(event.target.value)}
          placeholder="Your first name"
          className="w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3.5 text-base text-white placeholder:text-white/25 focus:border-emerald-400/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/20"
        />
        {draft.name.trim().length > 0 && (
          <div className="absolute right-4 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-400">
            <Check className="h-3 w-3 text-black" />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
        <div className="flex items-center gap-2 font-semibold text-white">
          <Shield className="h-4 w-4 text-emerald-300" />
          Private by default
        </div>
        <p className="mt-2 leading-relaxed text-white/50">
          Your onboarding answers stay attached to your account and are not shared or sold.
        </p>
      </div>
    </div>
  )
}

function ToolFeatureScreen({
  draft,
  feature,
}: {
  draft: TrialOnboardingDraft
  feature: (typeof FEATURE_SCREENS)[number]
}) {
  const firstName = draft.name.trim().split(' ')[0]
  const [videoFailed, setVideoFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0
    video.controls = true
  }, [feature.id])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
          {feature.eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">
          {firstName ? `${firstName}, start with ${feature.title}.` : `Start with ${feature.title}.`}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          {feature.description}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="aspect-[16/10] border-b border-white/10 bg-black">
          {videoFailed ? (
            <img
              src={feature.posterSrc}
              alt={`${feature.title} preview`}
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              key={feature.videoSrc}
              ref={videoRef}
              className="h-full w-full object-cover"
              controls
              playsInline
              poster={feature.posterSrc}
              preload="metadata"
              onError={() => setVideoFailed(true)}
            >
              <source src={feature.videoSrc} type="video/mp4" />
            </video>
          )}
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2 text-emerald-300">
              {feature.icon}
            </div>
            <div className="text-base font-bold text-white">{feature.title}</div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/55">{feature.detail}</p>
          <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/6 px-4 py-3">
            <p className="text-xs leading-relaxed text-emerald-100/85">
              Tap the video controls directly to play, pause, scrub, or turn sound on.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/6 p-4 text-sm leading-relaxed text-emerald-100/85">
        Delta keeps the workflow tight: spot the move, confirm the conviction, then act fast.
      </div>
    </div>
  )
}

function RoiScreen({
  draft,
  onBetSize,
  onBetsPerDay,
}: {
  draft: TrialOnboardingDraft
  onBetSize: (value: number) => void
  onBetsPerDay: (value: number) => void
}) {
  const winsNeeded = calcWinsNeeded(draft.betSize)
  const firstName = draft.name.trim().split(' ')[0]
  const monthlyBets = draft.betsPerDay * 30
  const breakEvenProfit = Math.round(winsNeeded * draft.betSize * (100 / 110))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
          Break-even math
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">
          {firstName ? `${firstName}, how much do you bet?` : 'How much do you bet?'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          We will show how many extra wins it takes for Delta to cover the monthly price.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-white/70">Average bet size</span>
            <span className="text-lg font-black text-white">${draft.betSize}</span>
          </div>
          <Slider
            min={25}
            max={500}
            step={25}
            value={[draft.betSize]}
            onValueChange={([value]) => onBetSize(value ?? draft.betSize)}
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/28">
            <span>$25</span>
            <span>$500</span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-white/70">Bets per day</span>
            <span className="text-lg font-black text-white">{draft.betsPerDay}</span>
          </div>
          <Slider
            min={1}
            max={10}
            step={1}
            value={[draft.betsPerDay]}
            onValueChange={([value]) => onBetsPerDay(value ?? draft.betsPerDay)}
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/28">
            <span>1/day</span>
            <span>10/day</span>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-emerald-400/25 bg-black p-6 text-center">
        <div className="text-6xl font-black text-emerald-300">{winsNeeded}</div>
        <div className="mt-2 text-lg font-bold text-white">
          extra {winsNeeded === 1 ? 'win' : 'wins'} per month
        </div>
        <p className="mt-2 text-sm text-white/50">
          That is all Delta needs to pay for itself at ${ROI_PLAN_COST}/month.
        </p>
        <p className="mt-3 text-xs text-white/35">
          At ${draft.betSize} a bet on -110 pricing, {winsNeeded} extra {winsNeeded === 1 ? 'win' : 'wins'} is about ${breakEvenProfit} in profit.
        </p>
      </div>

      <p className="text-center text-xs text-white/35">
        About {monthlyBets} bets per month at your pace. Delta only needs {winsNeeded} to matter.
      </p>
    </div>
  )
}

function PaywallScreen({
  draft,
  isSubmitting,
  onSubmit,
}: {
  draft: TrialOnboardingDraft
  isSubmitting: boolean
  onSubmit: () => void
}) {
  const firstName = draft.name.trim().split(' ')[0]
  const winsNeeded = calcWinsNeeded(draft.betSize)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
          Start your trial
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">
          {firstName ? `${firstName}, unlock Delta.` : 'Unlock Delta.'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          You are one step away from the full workflow and live data.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/6 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/70">
          Your setup
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white/45">Bet size</span>
            <span className="font-semibold text-white">${draft.betSize}/bet</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/45">Bets per day</span>
            <span className="font-semibold text-white">{draft.betsPerDay}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/45">Break-even target</span>
            <span className="font-semibold text-emerald-300">{winsNeeded} extra wins/month</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-sm font-bold text-white">7-day free trial</div>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            Get full access immediately, then decide if the signals are worth keeping.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-sm font-bold text-white">Cancel anytime</div>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            Stripe checkout, no calls, no friction.
          </p>
        </div>
      </div>

      <button
        onClick={onSubmit}
        disabled={isSubmitting}
        className="w-full rounded-full bg-[linear-gradient(90deg,#3CCB97,#22d3ee,#3CCB97)] py-4 text-sm font-bold text-black transition-opacity disabled:opacity-60"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Setting up checkout...
          </span>
        ) : (
          `Start ${firstName || 'my'} free trial ->`
        )}
      </button>

      <p className="text-center text-[11px] text-white/28">
        <Shield className="mr-1 inline h-3 w-3" />
        Stripe secure. Instant access. Cancel anytime.
      </p>
    </div>
  )
}

export default function TrialOnboardingFlow() {
  const [screenIndex, setScreenIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [draft, setDraft] = useState<TrialOnboardingDraft>(createDefaultTrialOnboardingDraft)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const screen = SCREENS[screenIndex]
  const feature = FEATURE_SCREENS.find((entry) => entry.id === screen?.id)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TRIAL_ONBOARDING_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TrialOnboardingDraft>
        setDraft((previous) => ({ ...previous, ...parsed }))
      }
    } catch {}

    trackTrialFlowEvent('onboarding_started', { screen: 'name' })
  }, [])

  function updateDraft(patch: Partial<TrialOnboardingDraft>) {
    setDraft((previous) => {
      const next = { ...previous, ...patch }
      syncDraft(next)
      return next
    })
  }

  function goNext() {
    if (!screen || screenIndex >= SCREENS.length - 1) return
    trackTrialFlowEvent('onboarding_step_completed', {
      step: screen.id,
      step_index: screenIndex,
    })
    setDirection(1)
    setScreenIndex((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    if (screenIndex === 0) return
    setDirection(-1)
    setScreenIndex((current) => current - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBetSize(value: number) {
    updateDraft({ betSize: value })
  }

  function handleBetsPerDay(value: number) {
    updateDraft({ betsPerDay: value })
  }

  async function handleSubmit() {
    if (isSubmitting) return

    setIsSubmitting(true)
    trackTrialFlowEvent('onboarding_completed', {
      bet_size: draft.betSize,
      bets_per_day: draft.betsPerDay,
    })

    try {
      await fetch('/api/trial-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          betSize: draft.betSize,
          betsPerDay: draft.betsPerDay,
        }),
      })

      trackTrialFlowEvent('checkout_started_from_onboarding', { source: 'short_onboarding' })
      window.location.href = '/checkout?source=trial-onboarding-v2'
    } catch {
      setIsSubmitting(false)
    }
  }

  const ctaDisabled =
    screen?.id === 'name'
      ? draft.name.trim().length === 0
      : false
  const isFinal = screen?.id === 'paywall'
  const ctaLabel = screen.cta

  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir * -40 }),
  }

  if (!screen) return null

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <div className="fixed left-0 right-0 top-0 z-30 bg-black/95 backdrop-blur">
        <div className="h-0.5 bg-white/8">
          <motion.div
            className="h-full bg-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${screen.progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          {screenIndex > 0 ? (
            <button
              onClick={goBack}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-white/25 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="h-8 w-8 shrink-0" />
          )}

          <div className="flex-1 text-center text-xs font-medium text-white/40">{screen.label}</div>
          <div className="h-8 w-8 shrink-0" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-20">
        <div className="mx-auto w-full max-w-lg">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={screen.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.24, ease: 'easeInOut' }}
            >
              {screen.id === 'name' && (
                <NameScreen draft={draft} onName={(value) => updateDraft({ name: value })} />
              )}
              {feature && <ToolFeatureScreen draft={draft} feature={feature} />}
              {screen.id === 'roi' && (
                <RoiScreen
                  draft={draft}
                  onBetSize={handleBetSize}
                  onBetsPerDay={handleBetsPerDay}
                />
              )}
              {screen.id === 'paywall' && (
                <PaywallScreen
                  draft={draft}
                  isSubmitting={isSubmitting}
                  onSubmit={handleSubmit}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {!isFinal && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/8 bg-black/95 px-5 py-4 backdrop-blur"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto w-full max-w-lg">
            <button
              onClick={goNext}
              disabled={ctaDisabled}
              className={cn(
                'w-full rounded-full py-3.5 text-sm font-bold transition-all',
                ctaDisabled
                  ? 'cursor-not-allowed bg-white/8 text-white/25'
                  : 'bg-[linear-gradient(90deg,#3CCB97,#22d3ee,#3CCB97)] text-black'
              )}
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
