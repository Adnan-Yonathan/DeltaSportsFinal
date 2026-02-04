"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { GuestHero } from "@/components/ui/guest-hero"
import { GlareCard } from "@/components/ui/glare-card"

interface StepSportsProps {
  value: string[]
  onChange: (value: string[]) => void
  onValidation: (isValid: boolean) => void
}

type SportOption = {
  id: string
  label: string
  detail: string
}

const SPORTS: SportOption[] = [
  {
    id: "nba",
    label: "NBA",
    detail: "Pro basketball",
  },
  {
    id: "nfl",
    label: "NFL",
    detail: "Pro football",
  },
  {
    id: "mlb",
    label: "MLB",
    detail: "Baseball",
  },
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
      <GuestHero
        eyebrow="Sports"
        title="Which sports do you follow?"
        subtitle="Select all that apply."
        compact
        useCommitsGrid
      />

      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 place-items-center">
          {SPORTS.map((sport) => {
            const isSelected = value.includes(sport.id)
            return (
              <motion.button
                key={sport.id}
                onClick={() => toggleSport(sport.id)}
                className="relative w-full max-w-[520px] sm:max-w-[240px]"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative scale-[0.9] sm:scale-95">
                  <GlareCard className="flex h-full w-full flex-row items-center justify-between gap-4 p-4 sm:flex-col sm:items-start sm:gap-0 sm:p-5">
                    <div className="flex items-start gap-3 sm:w-full sm:items-start sm:justify-between">
                      <div className="text-base font-semibold text-white sm:text-lg">{sport.label}</div>
                      {isSelected && (
                        <div className="rounded-full bg-emerald-500 p-1 sm:ml-auto">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-left text-xs text-white/60 sm:mt-6 sm:text-sm">
                      {sport.detail}
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
