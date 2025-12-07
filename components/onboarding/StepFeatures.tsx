"use client"

import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Brain, DollarSign, Search, BarChart3, LineChart, TrendingUp, Check } from "lucide-react"

interface StepFeaturesProps {
  value: string[]
  onChange: (value: string[]) => void
  onValidation: (isValid: boolean) => void
}

const FEATURES = [
  {
    id: "ai-insights",
    name: "AI Insights",
    description: "Chat with AI for game analysis and betting strategies",
    icon: Brain,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "odds-comparison",
    name: "Real-Time Odds",
    description: "Compare odds across 10+ sportsbooks instantly",
    icon: Search,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "statistics",
    name: "Advanced Statistics",
    description: "Access comprehensive stats for every team and player",
    icon: BarChart3,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "custom-models",
    name: "Custom Models",
    description: "Build personalized models with your own criteria",
    icon: LineChart,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "live-tracking",
    name: "Live Game Tracking",
    description: "Real-time scores, stats, and updates as games happen",
    icon: TrendingUp,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "line-shopping",
    name: "Smart Line Shopping",
    description: "Never miss the best line with automated comparison",
    icon: DollarSign,
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
    } else {
      onChange([...value, featureId])
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold text-white">What Brought You Here?</h2>
        <p className="text-white/60">Select the features you&apos;re most interested in</p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((feature) => {
            const isSelected = value.includes(feature.id)
            const Icon = feature.icon
            return (
              <motion.button
                key={feature.id}
                onClick={() => toggleFeature(feature.id)}
                className={`
                  relative p-5 rounded-xl border-2 transition-all text-left
                  ${isSelected
                    ? "bg-gradient-to-br from-emerald-500/20 via-emerald-500/15 to-emerald-500/5 border-emerald-400/70 shadow-[0_10px_30px_rgba(16,185,129,0.25)]"
                    : "bg-slate-900/70 border-emerald-400/15 hover:border-emerald-300/30"
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-emerald-500 rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className={`
                    p-2.5 rounded-lg bg-gradient-to-br ${feature.color} flex-shrink-0
                  `}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 pr-6">
                    <h3 className="text-lg font-bold text-white mb-1">{feature.name}</h3>
                    <p className="text-white/60 text-sm">{feature.description}</p>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>

        {value.length === 0 && (
          <p className="text-center text-red-400 text-sm mt-4">
            Please select at least one feature
          </p>
        )}

        {value.length > 0 && (
          <p className="text-center text-emerald-400 text-sm mt-4">
            {value.length} feature{value.length > 1 ? "s" : ""} selected
          </p>
        )}
      </div>
    </motion.div>
  )
}
