"use client"
import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronRight, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { StepMonthlyProfit } from "./onboarding/StepMonthlyProfit"
import { StepRecommendations } from "./onboarding/StepRecommendations"
import { StepIntroFeature } from "./onboarding/StepIntroFeature"
import { StepNarrative } from "./onboarding/StepNarrative"
import { StepSingleSelect } from "./onboarding/StepSingleSelect"
import { StepMultiSelect } from "./onboarding/StepMultiSelect"
import { StepUnitSize } from "./onboarding/StepUnitSize"
import { StepWelcome } from "./onboarding/StepWelcome"
import { MatrixTransition } from "./onboarding/MatrixTransition"

interface OnboardingData {
  primary_intent: string
  bet_frequency: string
  research_style: string
  bet_focus: "game-markets" | "player-props" | ""
  skill_level: string
  tailing_experience: string
  goals: string[]
  unit_size: number
  bets_per_day: number
}

export function OnboardingFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [currentStep, setCurrentStep] = useState(0)
  const [isStepValid, setIsStepValid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [hasSaved, setHasSaved] = useState(false)
  const [transitionPulse, setTransitionPulse] = useState(false)
  const [isScrambling, setIsScrambling] = useState(false)
  const [targetStep, setTargetStep] = useState<number | null>(null)
  const [welcomeUnlocking, setWelcomeUnlocking] = useState(false)

  const [data, setData] = useState<OnboardingData>({
    primary_intent: "",
    bet_frequency: "",
    research_style: "",
    bet_focus: "",
    skill_level: "",
    tailing_experience: "",
    goals: [],
    unit_size: 0,
    bets_per_day: 10,
  })

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("onboarding_data")
    if (saved) {
      try {
        const parsedData = JSON.parse(saved)
        setData((prev) => ({
          ...prev,
          ...parsedData,
          bets_per_day: parsedData?.bets_per_day ?? prev.bets_per_day,
        }))
      } catch (e) {
        console.error("Failed to parse saved onboarding data")
      }
    }
  }, [])

  useEffect(() => {
    const stepParam = searchParams.get('step')
    if (!stepParam) return

    const parsed = Number(stepParam)
    if (!Number.isFinite(parsed)) return

    const clamped = Math.max(0, Math.min(parsed, steps.length - 1))
    setCurrentStep(clamped)
    router.replace('/onboarding')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem("onboarding_data", JSON.stringify(data))
  }, [data])

  useEffect(() => {
    setTransitionPulse(true)
    const timer = setTimeout(() => setTransitionPulse(false), 240)
    return () => clearTimeout(timer)
  }, [currentStep])

  useEffect(() => {
    const AUTO_START = 1
    const AUTO_END = 6
    const AUTO_FEATURE_INTERVAL_MS = 5500
    const AUTO_NARRATIVE_INTERVAL_MS = 3500

    if (welcomeUnlocking) return
    if (isScrambling) return
    if (currentStep < AUTO_START || currentStep > AUTO_END) return

    const timer = window.setTimeout(() => {
      startStepTransition(currentStep + 1)
    }, currentStep <= 3 ? AUTO_FEATURE_INTERVAL_MS : AUTO_NARRATIVE_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [currentStep, isScrambling, welcomeUnlocking])

  const steps = [
    {
      component: <StepWelcome onValidation={setIsStepValid} unlocking={welcomeUnlocking} />,
      nextLabel: "Initialize",
    },
    {
      component: (
        <StepIntroFeature
          title="Research"
          description="Scan line movement across hundreds of games and surface sharp signals in real time."
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepIntroFeature
          title="Track"
          description="Follow the money: monitor big bets on exchanges and track profitable wallets on Polymarket."
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepIntroFeature
          title="Project"
          description="Combine signals with ML to generate confidence ranges and predict the closing line."
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepNarrative
          message="Delta is the all in one platform that turns you into a Sharp Bettor."
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepNarrative
          message="We pull thousands of signals and put them all in one place."
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepNarrative
          message="We find the Sharps so you can tail them."
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepNarrative
          message="Are you ready to change the way you bet forever?"
          prompt="Tap next to begin your operator profile."
          onValidation={setIsStepValid}
        />
      ),
      nextLabel: "I’m ready",
    },
    {
      component: (
        <StepSingleSelect
          eyebrow="Operator profile"
          question="What brings you to Delta Sports?"
          value={data.primary_intent}
          options={[
            {
              id: "projection-models",
              label: "Projection models based around sharp action",
            },
            {
              id: "track-profitable-bettors",
              label: "Tracking the most profitable bettors on exchanges",
            },
            {
              id: "find-whales",
              label: "Finding where the whales are betting",
            },
            {
              id: "historical-trends",
              label: "Researching historical betting trends and spotting early sharp moves",
            },
          ]}
          onChange={(value) => setData({ ...data, primary_intent: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepSingleSelect
          eyebrow="Bet frequency"
          question="How often do you bet on sports?"
          value={data.bet_frequency}
          options={[
            {
              id: "very-casually",
              label: "Very casually",
              description: "Once every few days–weeks",
            },
            {
              id: "pretty-often",
              label: "Pretty often",
              description: "Once every couple of days",
            },
            {
              id: "very-often",
              label: "Very often",
              description: "Every single day",
            },
            {
              id: "power-bettor",
              label: "Power bettor",
              description: "Multiple sports + multiple games/day",
            },
          ]}
          onChange={(value) => setData({ ...data, bet_frequency: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepSingleSelect
          eyebrow="Research style"
          question="Do you research your picks?"
          value={data.research_style}
          options={[
            { id: "wing-it", label: "Just wing it" },
            {
              id: "lineups-performances",
              label: "I look at lineups and recent performances",
            },
            {
              id: "articles-writeups",
              label: "I find articles and write-ups about games from cappers",
            },
            {
              id: "analyze-tools",
              label:
                "I analyze every game using different betting tools and find my own edge",
            },
          ]}
          onChange={(value) => setData({ ...data, research_style: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepSingleSelect
          eyebrow="Market focus"
          question="What do you bet on the most?"
          value={data.bet_focus}
          options={[
            {
              id: "game-markets",
              label: "Game markets (spreads, moneylines, totals)",
            },
            { id: "player-props", label: "Player props" },
          ]}
          onChange={(value) =>
            setData({
              ...data,
              bet_focus: value as OnboardingData["bet_focus"],
            })
          }
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepSingleSelect
          eyebrow="Skill level"
          question="What is your skill level?"
          value={data.skill_level}
          options={[
            { id: "newbie", label: "Newbie (just started betting)" },
            { id: "casual", label: "Casual (betting casually for a while now)" },
            {
              id: "amateur",
              label: "Amateur (betting consistently for over a year)",
            },
            {
              id: "pro",
              label: "Pro (betting with research and data for over a year)",
            },
            { id: "sharp", label: "Sharp (consistent winner over multiple years)" },
          ]}
          onChange={(value) => setData({ ...data, skill_level: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepSingleSelect
          eyebrow="Tailing"
          question="Have you ever tried tailing a sharp bettor?"
          value={data.tailing_experience}
          options={[
            { id: "no-guts", label: "No, I only bet with my guts" },
            { id: "tried-a-few", label: "I’ve tried tailing a capper a few times" },
            { id: "mostly-cappers", label: "I take most of my bets from cappers" },
            {
              id: "track-and-tail",
              label:
                "I track sharp action to find which side the sharps are on and tail them",
            },
          ]}
          onChange={(value) => setData({ ...data, tailing_experience: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepMultiSelect
          eyebrow="Goals"
          question="What are your goals?"
          hint="Select up to three."
          maxSelections={3}
          value={data.goals}
          options={[
            { id: "learn-research", label: "Learn how to research like a sharp" },
            {
              id: "tail-sharp-action",
              label: "Find where the sharp action is and tail them",
            },
            {
              id: "become-profitable",
              label: "Become a long term profitable bettor",
            },
            {
              id: "supercharge",
              label: "Supercharge my sports betting to take me to the next level",
            },
          ]}
          onChange={(value) => setData({ ...data, goals: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepUnitSize
          unitSize={data.unit_size}
          betsPerDay={data.bets_per_day}
          onChange={(unitSize, betsPerDay) =>
            setData({ ...data, unit_size: unitSize, bets_per_day: betsPerDay })
          }
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepMonthlyProfit
          unitSize={data.unit_size}
          betsPerDay={data.bets_per_day}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepRecommendations
          onValidation={setIsStepValid}
          profile={{
            primaryIntent: data.primary_intent,
            betFocus: data.bet_focus,
            goals: data.goals,
          }}
          onContinue={async () => {
            const saved = hasSaved ? true : await saveOnboarding()
            if (!saved) return
            router.push('/chat')
          }}
        />
      ),
    },
  ]

  const totalSteps = steps.length
  const progress = ((currentStep + 1) / totalSteps) * 100
  const isTimelineStep = currentStep === totalSteps - 1
  const isAutoLockedStep = currentStep >= 1 && currentStep <= 6
  const stepCode = String(currentStep + 1).padStart(2, "0")
  const nextLabel = steps[currentStep]?.nextLabel ?? "Next"
  const nextStepCode = String(Math.min(currentStep + 2, totalSteps)).padStart(2, "0")

  const paywallTriggerStep = 7

  const startStepTransition = (targetStep: number) => {
    if (targetStep === currentStep) return
    setTargetStep(targetStep)
    setIsScrambling(true)
  }

  useEffect(() => {
    if (!isScrambling || targetStep == null) return

    const swapTimer = window.setTimeout(() => {
      setCurrentStep(targetStep)
      setIsStepValid(false)
    }, 170)

    const doneTimer = window.setTimeout(() => {
      setIsScrambling(false)
      setTargetStep(null)
    }, 420)

    return () => {
      window.clearTimeout(swapTimer)
      window.clearTimeout(doneTimer)
    }
  }, [isScrambling, targetStep])

  useEffect(() => {
    if (currentStep !== 0 && welcomeUnlocking) {
      setWelcomeUnlocking(false)
    }
  }, [currentStep, welcomeUnlocking])

  const saveOnboarding = async () => {
    setSaving(true)
    setError("")

    try {
      const preferredMarkets =
        data.bet_focus === "player-props"
          ? ["player-props"]
          : data.bet_focus === "game-markets"
            ? ["spreads", "moneyline", "totals"]
            : []

      const experienceLevel =
        data.skill_level === "newbie" || data.skill_level === "casual"
          ? "beginner"
          : data.skill_level === "amateur"
            ? "intermediate"
            : data.skill_level
                ? "advanced"
                : ""

      const signupReasons = Array.from(
        new Set([data.primary_intent, ...data.goals].filter(Boolean))
      )

      const payload = {
        preferred_markets: preferredMarkets,
        experience_level: experienceLevel,
        risk_tolerance: "moderate",
        signup_reasons: signupReasons,
        unit_size: data.unit_size,
        bets_per_day: data.bets_per_day,
        primary_intent: data.primary_intent,
        bet_frequency: data.bet_frequency,
        research_style: data.research_style,
        bet_focus: data.bet_focus,
        skill_level: data.skill_level,
        tailing_experience: data.tailing_experience,
      }
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to save onboarding data")
      }

      localStorage.removeItem("onboarding_data")
      setHasSaved(true)
      return true
    } catch (err: any) {
      setError(err.message || "Something went wrong")
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleNext = async () => {
    if (currentStep < totalSteps - 1) {
      if (currentStep === 0 && !welcomeUnlocking) {
        setWelcomeUnlocking(true)
        window.setTimeout(() => {
          startStepTransition(1)
        }, 520)
        return
      }

      if (currentStep === paywallTriggerStep) {
        const resumeStep = Math.min(currentStep + 1, totalSteps - 1)
        router.push(
          `/pricing?next=/onboarding&resumeStep=${resumeStep}&cancelStep=${currentStep}`
        )
        return
      }
      startStepTransition(currentStep + 1)
    } else {
      await handleComplete()
    }
  }

  const handleComplete = async () => {
    if (hasSaved) {
      return
    }
    const saved = await saveOnboarding()
    if (saved) {
      return
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <MatrixTransition
        active={isScrambling}
        label={`DECRYPTING ${nextStepCode}`}
      />
      {/* Hacker Backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),rgba(0,0,0,0.0)_40%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.06),rgba(0,0,0,0.0)_45%)]" />
        <div className="absolute inset-0 opacity-[0.22] [background-image:repeating-linear-gradient(180deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_2px,transparent_6px)]" />
        <AnimatePresence mode="wait">
          <motion.div
            key={stepCode}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Image
              src="/delta-logo.png"
              alt=""
              aria-hidden
              width={360}
              height={360}
              priority
              className="h-[240px] w-[240px] select-none opacity-[0.07] sm:h-[320px] sm:w-[320px]"
            />
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {transitionPulse && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(16,185,129,0.12),transparent)] mix-blend-screen"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/10 z-50">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="fixed top-4 right-6 z-50">
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
        >
          Sign out
        </button>
      </div>

      {/* Main Content */}
      <div
        className="flex-1 flex items-center justify-center px-4 pt-16 pb-28"
      >
        <div className="relative z-10 w-full max-w-5xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 1 }}
              animate={{
                opacity: isScrambling ? 0 : 1,
                filter: isScrambling ? "blur(8px)" : "blur(0px)",
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {steps[currentStep].component}
            </motion.div>
          </AnimatePresence>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 p-4 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-center max-w-md mx-auto"
            >
              {error}
            </motion.div>
          )}
        </div>
      </div>

      {/* Navigation */}
      {!isTimelineStep && !isAutoLockedStep && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent backdrop-blur-sm" />
          <div className="relative mx-auto flex items-center justify-end px-6 pb-6">
            <button
              onClick={handleNext}
              disabled={!isStepValid || saving || isScrambling}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-7 py-3 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition-all hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isScrambling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  {nextLabel}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
