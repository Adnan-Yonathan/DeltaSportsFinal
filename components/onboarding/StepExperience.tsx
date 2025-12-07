"use client"

import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Sparkles, TrendingUp, Target, Trophy } from "lucide-react"

interface StepExperienceProps {
  value: string
  onChange: (value: string) => void
  onValidation: (isValid: boolean) => void
}

const EXPERIENCE_LEVELS = [
  {
    id: "beginner",
    name: "Beginner",
    description: "Just starting out or betting casually for fun",
    icon: Sparkles,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "intermediate",
    name: "Intermediate",
    description: "Have some experience, tracking bets and learning strategies",
    icon: TrendingUp,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "advanced",
    name: "Advanced",
    description: "Experienced bettor with proven strategies and consistent tracking",
    icon: Target,
    color: "from-orange-500 to-red-500",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Serious about betting as an investment with statistical models",
    icon: Trophy,
    color: "from-amber-500 to-yellow-500",
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
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold text-white">What&apos;s Your Experience Level?</h2>
        <p className="text-white/60">This helps us personalize your experience</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {EXPERIENCE_LEVELS.map((level) => {
          const isSelected = value === level.id
          const Icon = level.icon
          return (
            <motion.button
              key={level.id}
              onClick={() => onChange(level.id)}
              className={`
                relative w-full p-6 rounded-xl border-2 transition-all text-left
                ${isSelected
                  ? "bg-gradient-to-br from-emerald-500/20 via-emerald-500/15 to-cyan-500/10 border-emerald-400/70 shadow-[0_10px_30px_rgba(16,185,129,0.25)]"
                  : "bg-slate-900/70 border-emerald-400/15 hover:border-emerald-300/30"
                }
              `}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-start gap-4">
                <div className={`
                  p-3 rounded-lg bg-gradient-to-br ${level.color}
                  ${isSelected ? "ring-2 ring-white/20" : ""}
                `}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xl font-bold text-white">{level.name}</h3>
                    {isSelected && (
                      <div className="flex items-center gap-2 text-emerald-400 text-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        Selected
                      </div>
                    )}
                  </div>
                  <p className="text-white/60">{level.description}</p>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      {!value && (
        <p className="text-center text-red-400 text-sm">
          Please select your experience level
        </p>
      )}
    </motion.div>
  )
}
