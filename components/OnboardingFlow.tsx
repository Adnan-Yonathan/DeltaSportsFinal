"use client"
import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { StepMarkets } from "./onboarding/StepMarkets"
import { StepExperience } from "./onboarding/StepExperience"
import { StepRiskTolerance } from "./onboarding/StepRiskTolerance"
import { StepFeatures } from "./onboarding/StepFeatures"
import { StepPricing } from "./onboarding/StepPricing"
import { StepBankrollProjection } from "./onboarding/StepBankrollProjection"
import { StepMonthlyProfit } from "./onboarding/StepMonthlyProfit"
import { StepSoftwareExperience } from "./onboarding/StepSoftwareExperience"
import { StepTailSharp } from "./onboarding/StepTailSharp"
import { StepTimeline } from "./onboarding/StepTimeline"

interface OnboardingData {
  preferred_markets: string[]
  experience_level: string
  software_experience: string
  tail_sharp_experience: string
  risk_tolerance: string
  signup_reasons: string[]
  bankroll: number
  bets_per_day: number
  pricing_intent: string | null
}

export function OnboardingFlow() {
  const router = useRouter()
  const supabase = createClient()
  const [currentStep, setCurrentStep] = useState(0)
  const [isStepValid, setIsStepValid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [hasSaved, setHasSaved] = useState(false)

  const [data, setData] = useState<OnboardingData>({
    preferred_markets: [],
    experience_level: "",
    software_experience: "",
    tail_sharp_experience: "",
    risk_tolerance: "",
    signup_reasons: [],
    bankroll: 0,
    bets_per_day: 10,
    pricing_intent: null,
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

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem("onboarding_data", JSON.stringify(data))
  }, [data])

  const totalSteps = 10
  const progress = ((currentStep + 1) / totalSteps) * 100
  const isPricingStep = currentStep === totalSteps - 1
  const isTimelineStep = currentStep === totalSteps - 2

  const steps = [
    {
      component: (
        <StepFeatures
          value={data.signup_reasons}
          onChange={(value) => setData({ ...data, signup_reasons: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepMarkets
          value={data.preferred_markets}
          onChange={(value) => setData({ ...data, preferred_markets: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepExperience
          value={data.experience_level}
          onChange={(value) => setData({ ...data, experience_level: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepSoftwareExperience
          value={data.software_experience}
          onChange={(value) => setData({ ...data, software_experience: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepTailSharp
          value={data.tail_sharp_experience}
          onChange={(value) => setData({ ...data, tail_sharp_experience: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepRiskTolerance
          value={data.risk_tolerance}
          onChange={(value) => setData({ ...data, risk_tolerance: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepBankrollProjection
          value={data.bankroll}
          betsPerDay={data.bets_per_day}
          onChange={(value, betsPerDay) =>
            setData({ ...data, bankroll: value, bets_per_day: betsPerDay })
          }
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepMonthlyProfit
          bankroll={data.bankroll}
          betsPerDay={data.bets_per_day}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepTimeline
          onValidation={setIsStepValid}
          onContinue={async () => {
            if (!hasSaved) {
              const saved = await saveOnboarding()
              if (!saved) return
            }
            router.push("/pricing")
          }}
          saving={saving}
        />
      ),
    },
    {
      component: (
        <StepPricing
          value={data.pricing_intent}
          onChange={(value) => setData({ ...data, pricing_intent: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
  ]

  const saveOnboarding = async () => {
    setSaving(true)
    setError("")

    try {
      const { pricing_intent, ...payload } = data
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
      if (currentStep === totalSteps - 2 && !hasSaved) {
        const saved = await saveOnboarding()
        if (!saved) return
      }
      setCurrentStep(currentStep + 1)
      setIsStepValid(false)
    } else {
      await handleComplete()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    if (hasSaved) {
      router.push("/pricing")
      return
    }
    const saved = await saveOnboarding()
    if (saved) {
      router.push("/pricing")
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Progress Bar */}
      {!isPricingStep && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-white/10 z-50">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

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
        className={`flex-1 flex ${isPricingStep ? "items-start" : "items-center"} justify-center ${
          isPricingStep ? "px-0 py-0" : "px-4 pt-16 pb-28"
        }`}
      >
        <div className={`w-full ${isPricingStep ? "max-w-none" : "max-w-5xl"}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
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
      {!isPricingStep && !isTimelineStep && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 p-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white"
                  disabled={saving}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleNext}
                disabled={!isStepValid || saving}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
