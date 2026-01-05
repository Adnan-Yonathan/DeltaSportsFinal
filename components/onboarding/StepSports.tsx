"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import Image from "next/image"

interface StepSportsProps {
  value: string[]
  onChange: (value: string[]) => void
  onValidation: (isValid: boolean) => void
}

type SportOption = {
  id: string
  label: string
  detail: string
  logoSrc?: string
  logoAlt?: string
}

const SPORTS: SportOption[] = [
  {
    id: "nba",
    label: "NBA",
    detail: "Pro basketball",
    logoSrc: "/R.png",
    logoAlt: "NBA logo",
  },
  {
    id: "ncaab",
    label: "NCAAB",
    detail: "College basketball",
    logoSrc: "/227-2274470_ncaa-logo-png.png",
    logoAlt: "NCAA logo",
  },
  {
    id: "nfl",
    label: "NFL",
    detail: "Pro football",
    logoSrc: "/nfl-logo-nfl-icon-transparent-free-png.webp",
    logoAlt: "NFL logo",
  },
  {
    id: "ncaaf",
    label: "NCAAF",
    detail: "College football",
    logoSrc: "/227-2274470_ncaa-logo-png.png",
    logoAlt: "NCAA logo",
  },
  {
    id: "mlb",
    label: "MLB",
    detail: "Baseball",
    logoSrc: "/mlb-logo-png.png",
    logoAlt: "MLB logo",
  },
  {
    id: "nhl",
    label: "NHL",
    detail: "Hockey",
    logoSrc: "/1526525415nhl-logo-png.png",
    logoAlt: "NHL logo",
  },
  { id: "other", label: "Other", detail: "Everything else" },
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
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Sports</p>
        <h2 className="text-4xl font-bold text-white tracking-tight">
          Which sports do you follow?
        </h2>
        <p className="text-white/60">Select all that apply.</p>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SPORTS.map((sport) => {
            const isSelected = value.includes(sport.id)
            return (
              <motion.button
                key={sport.id}
                onClick={() => toggleSport(sport.id)}
                className={`
                  relative p-5 rounded-2xl border transition-all text-left
                  ${isSelected
                    ? "bg-gradient-to-b from-emerald-500/15 via-emerald-500/10 to-transparent border-emerald-400/70 shadow-[0_14px_40px_rgba(16,185,129,0.2)]"
                    : "bg-white/[0.03] border-white/10 hover:border-emerald-300/40"
                  }
                `}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-emerald-500 rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="space-y-2">
                  {sport.logoSrc ? (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                        <Image
                          src={sport.logoSrc}
                          alt={sport.logoAlt ?? sport.label}
                          width={32}
                          height={32}
                          className="h-8 w-8 object-contain"
                        />
                      </div>
                      <div className="text-lg font-semibold text-white">{sport.label}</div>
                    </div>
                  ) : (
                    <div className="text-lg font-semibold text-white">{sport.label}</div>
                  )}
                  <div className="text-xs text-white/50">{sport.detail}</div>
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
