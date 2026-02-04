"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { GlareCard } from "@/components/ui/glare-card"

interface StepSoftwareExperienceProps {
  value: string
  onChange: (value: string) => void
  onValidation: (isValid: boolean) => void
}

const OPTIONS = [
  {
    id: "never",
    title: "Never used any",
    description: "I haven’t used betting software before.",
  },
  {
    id: "tried-briefly",
    title: "Tried briefly",
    description: "I’ve tested tools but only for a short time.",
  },
  {
    id: "experienced",
    title: "Experienced",
    description: "I regularly use betting software and dashboards.",
  },
]

export function StepSoftwareExperience({
  value,
  onChange,
  onValidation,
}: StepSoftwareExperienceProps) {
  useEffect(() => {
    onValidation(!!value)
  }, [value, onValidation])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">
          Software
        </p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Have you tried betting software before?
        </h1>
        <p className="text-sm text-white/80 sm:text-base">
          This helps us tailor the onboarding flow.
        </p>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 place-items-center">
          {OPTIONS.map((option) => {
            const isSelected = value === option.id
            return (
              <motion.button
                key={option.id}
                onClick={() => onChange(option.id)}
                className="relative w-full max-w-none sm:max-w-[240px]"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="relative scale-100 sm:scale-95">
                  <GlareCard className="flex h-full w-full flex-row items-center justify-between gap-4 p-4 sm:flex-col sm:items-start sm:gap-0 sm:p-5">
                    <div className="flex items-start gap-3 sm:w-full sm:items-start sm:justify-between">
                      <div className="text-base font-semibold text-white sm:text-lg">
                        {option.title}
                      </div>
                      {isSelected && (
                        <div className="rounded-full bg-emerald-500 p-1 sm:ml-auto">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-left text-xs text-white/60 sm:mt-6 sm:text-sm">
                      {option.description}
                    </div>
                  </GlareCard>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {!value && (
        <p className="text-center text-red-400 text-sm">
          Please select an option
        </p>
      )}
    </motion.div>
  )
}
