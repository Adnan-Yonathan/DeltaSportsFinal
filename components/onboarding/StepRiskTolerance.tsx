"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Shield, Scale, Zap } from "lucide-react"
import { GuestHero } from "@/components/ui/guest-hero"
import { GlareCard } from "@/components/ui/glare-card"

interface StepRiskToleranceProps {
  value: string
  onChange: (value: string) => void
  onValidation: (isValid: boolean) => void
}

const RISK_LEVELS = [
  {
    id: "conservative",
    name: "Conservative",
    description: "Lower variance with steadier outcomes.",
    details: "Focus on protection and long-term edges.",
    icon: Shield,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "moderate",
    name: "Balanced",
    description: "Mix safety with growth opportunities.",
    details: "Calculated risk with measured upside.",
    icon: Scale,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "aggressive",
    name: "Aggressive",
    description: "Higher volatility for bigger swings.",
    details: "Pursue larger edges with more variance.",
    icon: Zap,
    color: "from-emerald-500 to-emerald-500",
  },
]

export function StepRiskTolerance({
  value,
  onChange,
  onValidation,
}: StepRiskToleranceProps) {
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
        eyebrow="Risk"
        title="What's your risk preference?"
        subtitle="How do you like to play it?"
        compact
        useCommitsGrid
      />

      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 place-items-center">
        {RISK_LEVELS.map((level) => {
          const isSelected = value === level.id
          const Icon = level.icon
          return (
            <motion.button
              key={level.id}
              onClick={() => onChange(level.id)}
              className="relative w-full max-w-none sm:max-w-[240px]"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="relative scale-100 sm:scale-95">
                <GlareCard className="flex h-full w-full flex-row items-center justify-between gap-4 p-4 sm:flex-col sm:items-start sm:gap-0 sm:p-5">
                  <div className="flex items-start gap-3 sm:w-full sm:items-start sm:justify-between">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${level.color}`}>
                      <Icon className="w-5 h-5 text-white sm:w-6 sm:h-6" />
                    </div>
                    {isSelected && (
                      <div className="rounded-full bg-emerald-500 p-1 sm:ml-auto">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                  <div className="text-left sm:mt-6">
                    <h3 className="text-base font-semibold text-white sm:text-xl">{level.name}</h3>
                    <p className="mt-1 text-white/60 text-xs sm:mt-2 sm:text-sm">{level.description}</p>
                    <p className="mt-1 text-white/50 text-[11px] sm:mt-2 sm:text-xs">{level.details}</p>
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
          Please select your risk preference
        </p>
      )}
    </motion.div>
  )
}
