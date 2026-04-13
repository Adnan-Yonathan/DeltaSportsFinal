'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  MoreVertical,
  LineChart,
  Loader2,
  SquareArrowUp,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import ChatHomeDashboard from '@/components/chat-home-dashboard'
import {
  RECOMMENDED_TOOL_DETAILS,
  TRIAL_ACTIVATION_STEPS,
  getCompletedTrialActivationSteps,
  isTrialActivationComplete,
  trackTrialFlowEvent,
} from '@/lib/trial-flow'
import type { TrialActivationState, TrialOnboardingProfile } from '@/lib/trial-flow'

type TrialActivationHomeProps = {
  displayName: string | null
  profile: TrialOnboardingProfile | null
  recommendedTool: keyof typeof RECOMMENDED_TOOL_DETAILS
  initialState: TrialActivationState
}

type PromptCard = {
  key: string
  eyebrow: string
  title: string
  body: string
  icon: typeof Sparkles
}

const PROMPTS: Array<{
  minDay: number
  key: string
  eyebrow: string
  title: string
  body: string
  icon: typeof Sparkles
}> = [
  {
    minDay: 0,
    key: 'day1',
    eyebrow: 'Day 1',
    title: 'Your setup is live',
    body: 'Start with your recommended tool, then move into the checklist so the trial immediately becomes part of your routine.',
    icon: Sparkles,
  },
  {
    minDay: 3,
    key: 'day3',
    eyebrow: 'Day 3',
    title: 'Tighten your workflow',
    body: 'Use Research Mode to validate one move you tailed this week and build a cleaner CLV habit.',
    icon: LineChart,
  },
  {
    minDay: 6,
    key: 'day6',
    eyebrow: 'Day 6',
    title: 'Your trial is almost over',
    body: 'Review what you tracked, what moved, and whether Delta earned a permanent place in your process.',
    icon: Clock3,
  },
]

export default function TrialActivationHome({
  displayName,
  profile,
  recommendedTool,
  initialState,
}: TrialActivationHomeProps) {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [busyStep, setBusyStep] = useState<string | null>(null)
  const [dismissingPrompt, setDismissingPrompt] = useState(false)
  const recommended = RECOMMENDED_TOOL_DETAILS[recommendedTool]
  const completedSteps = useMemo(() => getCompletedTrialActivationSteps(state), [state])
  const progressPercent = Math.round((completedSteps / TRIAL_ACTIVATION_STEPS.length) * 100)

  useEffect(() => {
    let active = true

    const initialize = async () => {
      if (state.startedAt) return

      try {
        const response = await fetch('/api/trial-activation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'initialize' }),
        })

        if (!response.ok) return
        const payload = await response.json()
        if (!active) return
        setState(payload.data as TrialActivationState)
      } catch {
        // Ignore init failures and keep the local state.
      }
    }

    void initialize()
    return () => {
      active = false
    }
  }, [recommendedTool, state.startedAt])

  const daysSinceStart = useMemo(() => {
    if (!state.startedAt) return 0
    const startedAtMs = Date.parse(state.startedAt)
    if (!Number.isFinite(startedAtMs)) return 0
    const diffMs = Date.now() - startedAtMs
    return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)))
  }, [state.startedAt])

  const activePrompt = useMemo<PromptCard | null>(() => {
    const prompt = [...PROMPTS]
      .reverse()
      .find((candidate) => daysSinceStart >= candidate.minDay && !state.dismissedPrompts.includes(candidate.key))
    return prompt ?? null
  }, [daysSinceStart, state.dismissedPrompts])

  const handleCompleteStep = async (stepKey: string, href: string) => {
    setBusyStep(stepKey)
    try {
      const response = await fetch('/api/trial-activation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'complete_step',
          step: stepKey,
        }),
      })

      if (response.ok) {
        const payload = await response.json()
        setState(payload.data as TrialActivationState)
      }

      trackTrialFlowEvent('checklist_step_completed', {
        step: stepKey,
      })
      router.push(href)
    } finally {
      setBusyStep(null)
    }
  }

  const handleDismissPrompt = async () => {
    if (!activePrompt) return
    setDismissingPrompt(true)
    try {
      const response = await fetch('/api/trial-activation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'dismiss_prompt',
          prompt: activePrompt.key,
        }),
      })

      if (!response.ok) return
      const payload = await response.json()
      setState(payload.data as TrialActivationState)
    } finally {
      setDismissingPrompt(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.24),_transparent_35%),linear-gradient(135deg,_rgba(3,11,7,0.96),_rgba(0,0,0,0.98))]">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 sm:p-8">
              <div className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200">
                Trial activation
              </div>
              <h1 className="mt-4 text-4xl font-black leading-none tracking-tight text-white sm:text-5xl">
                Delta is ready{displayName ? `, ${displayName.split(' ')[0]}` : ''}.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/72 sm:text-base">
                Start in {recommended.title}, then complete your first four actions so this trial turns into a real workflow.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <StatCard label="Recommended first tool" value={recommended.title} />
                <StatCard label="Checklist progress" value={`${completedSteps}/${TRIAL_ACTIVATION_STEPS.length}`} />
                <StatCard label="Trial momentum" value={`${progressPercent}%`} />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => router.push(recommended.href)}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#04120c] transition-colors hover:bg-emerald-300"
                >
                  Open {recommended.title}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href="/live-scores"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white"
                >
                  Open live boards
                </Link>
              </div>
            </div>

            <div className="relative min-h-[340px] border-t border-white/10 lg:border-l lg:border-t-0">
              <Image
                src={recommended.screenshotSrc}
                alt={recommended.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-[1.75rem] border border-white/10 bg-black/70 p-4 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/70">
                    Start here
                  </div>
                  <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                    {recommended.statLabel}: {recommended.statValue}
                  </div>
                </div>
                <div className="mt-2 text-xl font-semibold text-white">{recommended.title}</div>
                <div className="mt-2 text-sm text-white/70">{recommended.summary}</div>
              </div>
            </div>
          </div>
        </section>

        {activePrompt ? (
          <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-emerald-200">
                  <activePrompt.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/70">
                    {activePrompt.eyebrow}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">{activePrompt.title}</div>
                  <div className="mt-2 text-sm text-white/70">{activePrompt.body}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismissPrompt}
                disabled={dismissingPrompt}
                className="rounded-full border border-white/10 p-2 text-white/55 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50"
                aria-label="Dismiss trial prompt"
              >
                {dismissingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </button>
            </div>
          </section>
        ) : null}

        <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/50">First 4 wins</div>
              <h2 className="mt-2 text-2xl font-bold text-white">Complete the activation checklist</h2>
              <p className="mt-2 text-sm text-white/65">
                This persists across sessions and keeps trial users focused on the actions that make Delta sticky.
              </p>
            </div>
            <div className="text-sm text-emerald-200">{progressPercent}% complete</div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {TRIAL_ACTIVATION_STEPS.map((step) => {
              const completed = Boolean(state.steps[step.key])
              return (
                <div
                  key={step.key}
                  className={`rounded-[1.5rem] border p-4 transition-colors ${
                    completed
                      ? 'border-emerald-300/25 bg-emerald-400/10'
                      : 'border-white/10 bg-black/35'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">{step.title}</div>
                      <div className="mt-1 text-sm text-white/65">{step.description}</div>
                    </div>
                    {completed ? (
                      <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-300" />
                    ) : (
                      <Target className="mt-1 h-5 w-5 text-white/35" />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCompleteStep(step.key, step.href)}
                    disabled={busyStep === step.key}
                    className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      completed
                        ? 'bg-white/10 text-white/70 hover:bg-white/15'
                        : 'bg-emerald-400 text-[#04120c] hover:bg-emerald-300'
                    }`}
                  >
                    {busyStep === step.key ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <span>{completed ? 'Open again' : step.cta}</span>
                    {busyStep === step.key ? null : <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              )
            })}
          </div>

          {isTrialActivationComplete(state) ? (
            <div className="mt-4 rounded-[1.5rem] border border-emerald-300/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              Checklist complete. Your next visit to `/` will send you back to your last active tool.
            </div>
          ) : null}
        </section>

        <section className="mt-5 rounded-[1.75rem] border border-cyan-300/20 bg-cyan-400/5 p-4 sm:p-6">
          <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/75">Post-trial step</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Add Delta to your home screen</h2>
          <p className="mt-2 text-sm text-white/70">
            Make Delta open like an app for faster access during your betting workflow.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.25rem] border border-white/10 bg-black/35 p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/55">iPhone (Safari)</div>
              <div className="mt-2 text-sm text-white/80">
                Tap{' '}
                <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/85">
                  <SquareArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  Share
                </span>{' '}
                then tap <span className="font-semibold text-white">Add to Home Screen</span>.
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-white/10 bg-black/35 p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/55">Android (Chrome)</div>
              <div className="mt-2 text-sm text-white/80">
                Tap the{' '}
                <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/85">
                  <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                  3-dot menu
                </span>{' '}
                at the top right, then tap <span className="font-semibold text-white">Add to Home screen</span>.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/50">Why users stay</div>
              <h2 className="mt-2 text-2xl font-bold text-white">Your first week has a plan</h2>
            </div>
            <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              {profile?.primary_intent?.replace(/-/g, ' ') ?? 'personalized'}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MiniTimelineCard
              title="Find the gap"
              body="Open your recommended board and use Delta to narrow the slate to real edge candidates."
              icon={Target}
            />
            <MiniTimelineCard
              title="Confirm the move"
              body="Use whale flow, line movement, and orderbook pressure to filter noise out of the decision."
              icon={BellRing}
            />
            <MiniTimelineCard
              title="Turn it into process"
              body="Review a close, compare books, and build CLV discipline that survives beyond one bet."
              icon={LineChart}
            />
          </div>
        </section>

        <div className="mt-5">
          <ChatHomeDashboard welcomeName={displayName} />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  )
}

function MiniTimelineCard({
  title,
  body,
  icon: Icon,
}: {
  title: string
  body: string
  icon: typeof Sparkles
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
      <div className="inline-flex rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-2 text-emerald-200">
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 text-lg font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm text-white/65">{body}</div>
    </div>
  )
}
