"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import {
  Brain,
  Search,
  BarChart3,
  LineChart,
  TrendingUp,
  Bell,
  Check,
} from "lucide-react"

interface StepFeaturesProps {
  value: string[]
  onChange: (value: string[]) => void
  onValidation: (isValid: boolean) => void
}

const MAX_SELECTIONS = 2
const GOALS = [
  {
    id: "live-lines",
    name: "Live lines",
    description: "Track live movement and spot fast shifts",
    icon: TrendingUp,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "prop-edges",
    name: "Prop edges",
    description: "Find mispriced player props quickly",
    icon: BarChart3,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "matchup-research",
    name: "Matchup research",
    description: "Build clean game notes and trend context",
    icon: Search,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "arbitrage-ev",
    name: "Arbitrage and EV scans",
    description: "Surface pricing gaps and value windows",
    icon: LineChart,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "education",
    name: "Betting education",
    description: "Learn terminology, risk, and modeling basics",
    icon: Brain,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "alerts",
    name: "Alerts and notifications",
    description: "Get notified when lines move in your favor",
    icon: Bell,
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
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Your goals</p>
        <h2 className="text-4xl font-bold text-white tracking-tight">
          What do you want to get out of Delta?
        </h2>
        <p className="text-white/60">
          Pick up to {MAX_SELECTIONS} so we can tailor your feed.
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GOALS.map((goal) => {
            const isSelected = value.includes(goal.id)
            const Icon = goal.icon
            const isDisabled = !isSelected && value.length >= MAX_SELECTIONS
            return (
              <motion.button
                key={goal.id}
                onClick={() => toggleFeature(goal.id)}
                className={`
                  relative p-5 rounded-2xl border transition-all text-left
                  ${isSelected
                    ? "bg-gradient-to-b from-emerald-500/15 via-emerald-500/10 to-transparent border-emerald-400/70 shadow-[0_14px_40px_rgba(16,185,129,0.2)]"
                    : "bg-white/[0.03] border-white/10 hover:border-emerald-300/40"
                  }
                  ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                `}
                whileHover={isDisabled ? {} : { scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={isDisabled}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-emerald-500 rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div
                    className={`
                      p-2.5 rounded-xl bg-gradient-to-br ${goal.color} flex-shrink-0
                      ${isSelected ? "ring-2 ring-white/20" : ""}
                    `}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 pr-6">
                    <h3 className="text-lg font-semibold text-white mb-1">{goal.name}</h3>
                    <p className="text-white/60 text-sm">{goal.description}</p>
                  </div>
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
