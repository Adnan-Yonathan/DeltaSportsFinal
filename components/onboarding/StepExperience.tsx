"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Sparkles, TrendingUp, Target } from "lucide-react"
import { GuestHero } from "@/components/ui/guest-hero"
import { GlareCard } from "@/components/ui/glare-card"

interface StepExperienceProps {
  value: string
  onChange: (value: string) => void
  onValidation: (isValid: boolean) => void
}

const EXPERIENCE_LEVELS = [
  {
    id: "beginner",
    name: "New",
    description: "Just getting started or betting casually.",
    icon: Sparkles,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "intermediate",
    name: "Intermediate",
    description: "Comfortable with lines and tracking results.",
    icon: TrendingUp,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "advanced",
    name: "Advanced",
    description: "Consistent strategies and deeper analysis.",
    icon: Target,
    color: "from-emerald-500 to-emerald-500",
  },
]

export function StepExperience({ value, onChange, onValidation }: StepExperienceProps) {
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
        eyebrow="Experience"
        title="What is your experience level?"
        subtitle="This helps us tune recommendations."
        compact
        useCommitsGrid
      />

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap justify-center gap-4">
        {EXPERIENCE_LEVELS.map((level) => {
          const isSelected = value === level.id
          const Icon = level.icon
          return (
            <motion.button
              key={level.id}
              onClick={() => onChange(level.id)}
              className="relative"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="relative scale-[0.9] sm:scale-95">
                <GlareCard className="flex h-full w-full flex-col justify-between p-5">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${level.color}`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    {isSelected && (
                      <div className="rounded-full bg-emerald-500 p-1">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                  <div className="mt-6">
                    <h3 className="text-xl font-semibold text-white">{level.name}</h3>
                    <p className="mt-2 text-white/60 text-sm">{level.description}</p>
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
          Please select your experience level
        </p>
      )}
    </motion.div>
  )
}
