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
    color: "from-purple-500 to-indigo-500",
  },
  {
    id: "arbitrage",
    name: "Arbitrage Detection",
    description: "Find guaranteed profit opportunities across sportsbooks",
    icon: DollarSign,
    color: "from-emerald-500 to-green-500",
  },
  {
    id: "line-shopping",
    name: "Line Shopping",
    description: "Compare odds across 10+ sportsbooks instantly",
    icon: Search,
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "bankroll-tracking",
    name: "Bankroll Tracking",
    description: "Monitor performance with advanced analytics",
    icon: BarChart3,
    color: "from-amber-500 to-orange-500",
  },
  {
    id: "clv-tracking",
    name: "CLV Tracking",
    description: "Measure your edge with closing line value analysis",
    icon: LineChart,
    color: "from-pink-500 to-rose-500",
  },
  {
    id: "sharp-money",
    name: "Sharp Money Tracking",
    description: "Follow professional betting patterns and line movements",
    icon: TrendingUp,
    color: "from-violet-500 to-purple-500",
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
        <p className="text-white/60">Select the features you're most interested in</p>
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
                    ? "bg-indigo-500/20 border-indigo-500"
                    : "bg-zinc-900/50 border-white/10 hover:border-white/30"
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-indigo-500 rounded-full p-1">
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
