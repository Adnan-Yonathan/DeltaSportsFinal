"use client"

import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"

interface StepSportsProps {
  value: string[]
  onChange: (value: string[]) => void
  onValidation: (isValid: boolean) => void
}

const SPORTS = [
  { id: "nfl", name: "NFL", emoji: "🏈" },
  { id: "nba", name: "NBA", emoji: "🏀" },
  { id: "mlb", name: "MLB", emoji: "⚾" },
  { id: "nhl", name: "NHL", emoji: "🏒" },
  { id: "ncaaf", name: "NCAAF", emoji: "🏈" },
  { id: "ncaab", name: "NCAAB", emoji: "🏀" },
  { id: "soccer", name: "Soccer", emoji: "⚽" },
  { id: "mma", name: "MMA", emoji: "🥊" },
  { id: "tennis", name: "Tennis", emoji: "🎾" },
  { id: "golf", name: "Golf", emoji: "⛳" },
  { id: "boxing", name: "Boxing", emoji: "🥊" },
  { id: "esports", name: "Esports", emoji: "🎮" },
]

export function StepSports({ value, onChange, onValidation }: StepSportsProps) {
  useEffect(() => {
    onValidation(value.length > 0)
  }, [value, onValidation])

  const toggleSport = (sportId: string) => {
    if (value.includes(sportId)) {
      onChange(value.filter((id) => id !== sportId))
    } else {
      onChange([...value, sportId])
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
        <h2 className="text-4xl font-bold text-white">What Sports Do You Bet On?</h2>
        <p className="text-white/60">Select all that apply</p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {SPORTS.map((sport) => {
            const isSelected = value.includes(sport.id)
            return (
              <motion.button
                key={sport.id}
                onClick={() => toggleSport(sport.id)}
              className={`
                  relative p-6 rounded-xl border-2 transition-all
                  ${isSelected
                    ? "bg-gradient-to-br from-emerald-500/20 via-emerald-500/15 to-emerald-500/5 border-emerald-400/70 shadow-[0_10px_30px_rgba(16,185,129,0.25)]"
                    : "bg-neutral-850/80 border-emerald-300/15 hover:border-emerald-300/30"
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-emerald-500 rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="text-4xl mb-2">{sport.emoji}</div>
                <div className="text-white font-medium">{sport.name}</div>
              </motion.button>
            )
          })}
        </div>

        {value.length === 0 && (
          <p className="text-center text-red-400 text-sm mt-4">
            Please select at least one sport
          </p>
        )}

        {value.length > 0 && (
          <p className="text-center text-emerald-400 text-sm mt-4">
            {value.length} sport{value.length > 1 ? "s" : ""} selected
          </p>
        )}
      </div>
    </motion.div>
  )
}
