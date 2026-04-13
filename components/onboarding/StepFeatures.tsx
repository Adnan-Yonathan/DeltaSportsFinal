"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { LineChart, TrendingUp, Check } from "lucide-react"
import { GlareCard } from "@/components/ui/glare-card"

interface StepFeaturesProps {
  value: string[]
  onChange: (value: string[]) => void
  onValidation: (isValid: boolean) => void
}

const MAX_SELECTIONS = 3
const GOALS = [
  {
    id: "sharp-projections",
    name: "Sharp Movement",
    description: "Track opening-to-current line moves and spot market shifts early.",
    icon: TrendingUp,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "big-bets",
    name: "Track Big Bets",
    description: "See whale-sized bets and compare them to market lines.",
    icon: LineChart,
    color: "from-emerald-500 to-emerald-500",
  },
]

export function StepFeatures({ value, onChange, onValidation }: StepFeaturesProps) {
  useEffect(() => {
    onValidation(value.length > 0)
  }, [value, onValidation])

  const toggleFeature = (featureId: string) => {
    if (value.includes(featureId)) {
      onChange(value.filter((id) => id !== featureId))
      return
    }
    if (value.length >= MAX_SELECTIONS) {
      return
    }
    onChange([...value, featureId])
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">
          Your goals
        </p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          What do you want to get out of Delta?
        </h1>
        <p className="text-sm text-white/80 sm:text-base">
          Pick up to {MAX_SELECTIONS} so we can tailor your feed.
        </p>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 place-items-center">
          {GOALS.map((goal) => {
            const isSelected = value.includes(goal.id)
            const Icon = goal.icon
            const isDisabled = !isSelected && value.length >= MAX_SELECTIONS
            return (
              <motion.button
                key={goal.id}
                onClick={() => toggleFeature(goal.id)}
                className={`relative w-full max-w-none sm:max-w-[240px] ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                whileHover={isDisabled ? {} : { scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={isDisabled}
              >
                <div className="relative scale-100 sm:scale-95">
                  <GlareCard className="flex h-full w-full flex-row items-center justify-between gap-4 p-4 sm:flex-col sm:items-start sm:gap-0 sm:p-5">
                    <div className="flex items-start gap-3 sm:w-full sm:items-start sm:justify-between">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${goal.color}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      {isSelected && (
                        <div className="rounded-full bg-emerald-500 p-1 sm:ml-auto">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-left sm:mt-6">
                      <h3 className="text-base font-semibold text-white sm:text-lg sm:mb-2">{goal.name}</h3>
                      <p className="text-white/60 text-xs sm:text-sm">{goal.description}</p>
                    </div>
                  </GlareCard>
                </div>
              </motion.button>
            )
          })}
        </div>

        {value.length === 0 && (
          <p className="text-center text-red-400 text-sm mt-4">
            Please select at least one goal
          </p>
        )}

        {value.length > 0 && (
          <p className="text-center text-emerald-400 text-sm mt-4">
            {value.length} selected
          </p>
        )}

        {value.length >= MAX_SELECTIONS && (
          <p className="text-center text-white/50 text-xs mt-2">
            You can choose up to {MAX_SELECTIONS}. Deselect to change.
          </p>
        )}
      </div>
    </motion.div>
  )
}
