"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Sparkles, TrendingUp, Target } from "lucide-react"

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
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Experience</p>
        <h2 className="text-4xl font-bold text-white tracking-tight">
          How would you describe your betting experience?
        </h2>
        <p className="text-white/60">This helps us tune recommendations.</p>
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
                relative w-full p-6 rounded-2xl border transition-all text-left
                ${isSelected
                  ? "bg-gradient-to-b from-emerald-500/15 via-emerald-500/10 to-transparent border-emerald-400/70 shadow-[0_14px_40px_rgba(16,185,129,0.2)]"
                  : "bg-white/[0.03] border-white/10 hover:border-emerald-300/40"
                }
              `}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`
                    p-3 rounded-xl bg-gradient-to-br ${level.color}
                    ${isSelected ? "ring-2 ring-white/20" : ""}
                  `}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xl font-semibold text-white">{level.name}</h3>
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
