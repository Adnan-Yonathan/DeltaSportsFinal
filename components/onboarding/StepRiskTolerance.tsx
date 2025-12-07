"use client"

import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Shield, Scale, Zap } from "lucide-react"

interface StepRiskToleranceProps {
  value: string
  onChange: (value: string) => void
  onValidation: (isValid: boolean) => void
}

const RISK_LEVELS = [
  {
    id: "conservative",
    name: "Conservative",
    description: "Focus on bankroll preservation with smaller, safer bets",
    details: "Typical bet size: 0.5-1% of bankroll ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Lower variance strategies",
    icon: Shield,
    color: "from-emerald-500 to-green-500",
  },
  {
    id: "moderate",
    name: "Moderate",
    description: "Balanced approach mixing safety with growth opportunities",
    details: "Typical bet size: 1-3% of bankroll ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Calculated risk taking",
    icon: Scale,
    color: "from-emerald-500 to-emerald-500",
  },
  {
    id: "aggressive",
    name: "Aggressive",
    description: "Maximize returns with larger bets and higher variance",
    details: "Typical bet size: 3-5% of bankroll ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Higher upside and downside",
    icon: Zap,
    color: "from-orange-500 to-red-500",
  },
]

export function StepRiskTolerance({ value, onChange, onValidation }: StepRiskToleranceProps) {
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
        <h2 className="text-4xl font-bold text-white">What&apos;s Your Risk Tolerance?</h2>
        <p className="text-white/60">How do you approach betting?</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {RISK_LEVELS.map((level) => {
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
                  <p className="text-white/60 mb-2">{level.description}</p>
                  <p className="text-white/40 text-sm">{level.details}</p>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      {!value && (
        <p className="text-center text-red-400 text-sm">
          Please select your risk tolerance
        </p>
      )}
    </motion.div>
  )
}
