"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { StepUsername } from "./onboarding/StepUsername"
import { StepSports } from "./onboarding/StepSports"
import { StepExperience } from "./onboarding/StepExperience"
import { StepRiskTolerance } from "./onboarding/StepRiskTolerance"
import { StepBankroll } from "./onboarding/StepBankroll"
import { StepFeatures } from "./onboarding/StepFeatures"
import { StepPricing } from "./onboarding/StepPricing"

interface OnboardingData {
  username: string
  favorite_sports: string[]
  experience_level: string
  risk_tolerance: string
  starting_bankroll: number
  unit_size: number
  signup_reasons: string[]
  subscription_tier: string | null
}

export function OnboardingFlow() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isStepValid, setIsStepValid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [data, setData] = useState<OnboardingData>({
    username: "",
    favorite_sports: [],
    experience_level: "",
    risk_tolerance: "",
    starting_bankroll: 0,
    unit_size: 0,
    signup_reasons: [],
    subscription_tier: null,
  })

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("onboarding_data")
    if (saved) {
      try {
        const parsedData = JSON.parse(saved)
        setData(parsedData)
      } catch (e) {
        console.error("Failed to parse saved onboarding data")
      }
    }
  }, [])

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem("onboarding_data", JSON.stringify(data))
  }, [data])

  const totalSteps = 7
  const progress = ((currentStep + 1) / totalSteps) * 100

  const steps = [
    {
      component: (
        <StepUsername
          value={data.username}
          onChange={(value) => setData({ ...data, username: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepSports
          value={data.favorite_sports}
          onChange={(value) => setData({ ...data, favorite_sports: value })}
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
        <StepRiskTolerance
          value={data.risk_tolerance}
          onChange={(value) => setData({ ...data, risk_tolerance: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
    {
      component: (
        <StepBankroll
          bankroll={data.starting_bankroll}
          unitSize={data.unit_size}
          onChange={(bankroll, unitSize) =>
            setData({ ...data, starting_bankroll: bankroll, unit_size: unitSize })
          }
          onValidation={setIsStepValid}
        />
      ),
    },
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
        <StepPricing
          value={data.subscription_tier}
          onChange={(value) => setData({ ...data, subscription_tier: value })}
          onValidation={setIsStepValid}
        />
      ),
    },
  ]

  const handleNext = async () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
      setIsStepValid(false)
    } else {
      // Last step - save onboarding data
      await handleComplete()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = async () => {
    await handleComplete()
  }

  const handleComplete = async () => {
    setSaving(true)
    setError("")

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to save onboarding data")
      }

      // Clear localStorage
      localStorage.removeItem("onboarding_data")

      // Redirect based on subscription tier
      if (data.subscription_tier) {
        // TODO: Redirect to payment/checkout
        // For now, just go to chat
        router.push("/chat")
      } else {
        router.push("/chat")
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong")
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/10 z-50">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-4xl">
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

            {currentStep === totalSteps - 1 && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 rounded-lg text-white/60 hover:text-white transition-colors"
                disabled={saving}
              >
                Use free membership
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-white/60">
              Step {currentStep + 1} of {totalSteps}
            </div>

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
              ) : currentStep === totalSteps - 1 ? (
                "Complete"
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
    </div>
  )
}
