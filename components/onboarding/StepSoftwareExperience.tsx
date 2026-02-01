"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { GuestHero } from "@/components/ui/guest-hero"
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
      <GuestHero
        eyebrow="Software"
        title="Have you tried betting software before?"
        subtitle="This helps us tailor the onboarding flow."
        compact
        useCommitsGrid
      />

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap justify-center gap-4">
          {OPTIONS.map((option) => {
            const isSelected = value === option.id
            return (
              <motion.button
                key={option.id}
                onClick={() => onChange(option.id)}
                className="relative"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="relative scale-[0.9] sm:scale-95">
                  <GlareCard className="flex h-full w-full flex-col justify-between p-5">
                    <div className="flex items-start justify-between">
                      <div className="text-lg font-semibold text-white">
                        {option.title}
                      </div>
                      {isSelected && (
                        <div className="rounded-full bg-emerald-500 p-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="mt-6 text-sm text-white/60">
                      {option.description}
                    </div>
                  </GlareCard>
                  {isSelected && (
                    <span className="pointer-events-none absolute inset-0 rounded-[48px] ring-2 ring-emerald-400/60" />
                  )}
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
