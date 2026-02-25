"use client"

import React, { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { StepIntroFeature } from "./onboarding/StepIntroFeature"
import {
  TOOLS_TUTORIAL_LOCAL_KEY,
  TOOLS_TUTORIAL_METADATA_KEY,
} from "@/lib/tools-tutorial"

type FeatureStep = {
  id: string
  title: string
  description: string
  howToUse: string
  whyItValuable: string
  bullets: string[]
  metrics: Array<{ label: string; value: string }>
  previewSrc: string
  previewHref: string
}

const FEATURE_STEPS: FeatureStep[] = [
  {
    id: "sharp-projections",
    title: "Sharp Projections",
    description: "Find market gaps first, then move before books close edge.",
    howToUse:
      "Start every slate here. Sort by edge %, compare projected spread/moneyline/total versus market, and shortlist the top mismatches before placing a bet.",
    whyItValuable:
      "It removes guesswork and surfaces the highest-value opportunities quickly, so your first pass is edge-first instead of headline-driven.",
    bullets: [
      "Refreshes every 15 minutes and re-ranks the board automatically.",
      "Highlights spread, moneyline, and total in one unified table.",
      "Shows line movement context so you can see if edge is growing or closing.",
    ],
    metrics: [
      { label: "Refresh Cadence", value: "15 min" },
      { label: "Markets Covered", value: "Spread / ML / O-U" },
      { label: "Primary Goal", value: "Find best edge first" },
    ],
    previewSrc: "/Screenshot 2026-02-24 142211.png",
    previewHref: "/market-projections",
  },
  {
    id: "sharp-props",
    title: "Sharp Props",
    description: "Read orderbook pressure and spot sharp over/under lean.",
    howToUse:
      "Use Sharp Props after projections. Watch liquidity walls, compare best available price, and confirm whether sharp flow supports the side you plan to play.",
    whyItValuable:
      "Orderbook behavior reveals intent. You can avoid stale prop numbers and enter earlier when the market still underprices the move.",
    bullets: [
      "Tracks prop-level orderbook pressure and best market price.",
      "Flags meaningful wall size instead of thin, noisy prints.",
      "Works best when paired with Sharp Projections for signal confirmation.",
    ],
    metrics: [
      { label: "Signal Type", value: "Orderbook pressure" },
      { label: "Use Case", value: "Prop confirmation" },
      { label: "Best Pair", value: "Sharp Projections" },
    ],
    previewSrc: "/Screenshot 2026-02-24 170409.png",
    previewHref: "/sharp-props",
  },
  {
    id: "whale-feed",
    title: "Whale Feed",
    description: "Track large-ticket behavior and validate real conviction.",
    howToUse:
      "Scan recent whale activity, prioritize repeated action clusters, and compare timing to sportsbook line movement to confirm whether money is informed or reactive.",
    whyItValuable:
      "Big tickets alone are not enough. This feed helps you identify when size, timing, and market reaction align as a stronger confirmation signal.",
    bullets: [
      "Surfaces large notional trades with contextual detail.",
      "Lets you compare exchange flow versus sportsbook repricing.",
      "Useful as a secondary filter before execution.",
    ],
    metrics: [
      { label: "Focus", value: "Large money flow" },
      { label: "Edge Layer", value: "Signal validation" },
      { label: "Workflow Position", value: "After props/projections" },
    ],
    previewSrc: "/Screenshot 2026-02-24 142244.png",
    previewHref: "/sharp-detector",
  },
  {
    id: "research-mode",
    title: "Research Mode",
    description: "Review movement, closes, and trends to improve decisions.",
    howToUse:
      "Use Research Mode for post-bet analysis and pre-bet validation. Study 30-day movement patterns, CLV behavior, and repeatable edges before scaling exposure.",
    whyItValuable:
      "This is the long-term compounding layer. It turns one-off picks into a measurable process so you can refine strategy and protect ROI.",
    bullets: [
      "Breaks down spread, total, and moneyline trend behavior.",
      "Tracks biggest moves and closing-line dynamics over time.",
      "Supports more disciplined stake sizing through evidence.",
    ],
    metrics: [
      { label: "Window", value: "30-day trend lens" },
      { label: "Objective", value: "Improve CLV process" },
      { label: "Outcome", value: "Long-term refinement" },
    ],
    previewSrc: "/Screenshot 2026-02-24 142303.png",
    previewHref: "/research/betting-trends",
  },
]

export function OnboardingFlow() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [currentStep, setCurrentStep] = useState(0)
  const [isStepValid, setIsStepValid] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [targetStep, setTargetStep] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const totalSteps = FEATURE_STEPS.length
  const progress = ((currentStep + 1) / totalSteps) * 100
  const activeStep = FEATURE_STEPS[currentStep]
  const isLastStep = currentStep === totalSteps - 1

  useEffect(() => {
    const verifySession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/auth/login")
      }
    }

    void verifySession()
  }, [router, supabase])

  const startStepTransition = (stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= totalSteps || stepIndex === currentStep) return
    setTargetStep(stepIndex)
    setIsTransitioning(true)
  }

  useEffect(() => {
    if (!isTransitioning || targetStep == null) return

    const swapTimer = window.setTimeout(() => {
      setCurrentStep(targetStep)
      setIsStepValid(false)
    }, 150)

    const finishTimer = window.setTimeout(() => {
      setIsTransitioning(false)
      setTargetStep(null)
    }, 360)

    return () => {
      window.clearTimeout(swapTimer)
      window.clearTimeout(finishTimer)
    }
  }, [isTransitioning, targetStep])

  const completeTutorial = async (redirectTo: string) => {
    if (saving) return
    setSaving(true)
    setError("")

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TOOLS_TUTORIAL_LOCAL_KEY, "1")
      }

      await supabase.auth.updateUser({
        data: {
          [TOOLS_TUTORIAL_METADATA_KEY]: true,
          onboarding_completed: true,
        },
      })

      router.push(redirectTo)
    } catch {
      setError("Could not save onboarding progress. Please try again.")
      setSaving(false)
    }
  }

  const handleNext = async () => {
    if (isLastStep) {
      await completeTutorial("/chat")
      return
    }

    startStepTransition(currentStep + 1)
  }

  const handleBack = () => {
    if (currentStep === 0) return
    startStepTransition(currentStep - 1)
  }

  const handleSkip = async () => {
    await completeTutorial("/chat")
  }

  const backgroundNodes = useMemo(
    () => (
      <>
        <motion.div
          className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-emerald-500/12 blur-3xl"
          animate={{ x: [0, 40, 0], y: [0, -20, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-24 bottom-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, 18, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </>
    ),
    []
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-black via-[#04120d] to-black text-white">
      <div className="pointer-events-none absolute inset-0">{backgroundNodes}</div>
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:20px_20px]" />

      <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-white/10">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-cyan-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 pt-16 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.35em] text-emerald-200/75">
            Feature Onboarding
          </div>
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="rounded-full border border-white/15 bg-black/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Skip Tutorial"}
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur">
          <p className="text-xs text-white/65">
            Step {currentStep + 1} of {totalSteps} · {activeStep.title}
          </p>
        </div>

        <div className="relative flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.id}
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              animate={{
                opacity: isTransitioning ? 0.2 : 1,
                y: isTransitioning ? -4 : 0,
                filter: isTransitioning ? "blur(8px)" : "blur(0px)",
              }}
              exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <StepIntroFeature
                heading="Operator Playbook"
                title={activeStep.title}
                description={activeStep.description}
                howToUse={activeStep.howToUse}
                whyItValuable={activeStep.whyItValuable}
                bullets={activeStep.bullets}
                metrics={activeStep.metrics}
                previewSrc={activeStep.previewSrc}
                previewHref={activeStep.previewHref}
                previewAlt={`${activeStep.title} walkthrough screenshot`}
                onValidation={setIsStepValid}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/55 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0 || saving || isTransitioning}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.25em] text-white/75 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={!isStepValid || saving || isTransitioning}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.25em] text-black shadow-[0_16px_40px_rgba(16,185,129,0.35)] transition-all hover:from-emerald-300 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  {isLastStep ? "Finish Tutorial" : "Next"}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
