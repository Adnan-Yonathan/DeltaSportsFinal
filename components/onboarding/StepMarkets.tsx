"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { GuestHero } from "@/components/ui/guest-hero"
import { GlareCard } from "@/components/ui/glare-card"

interface StepMarketsProps {
  value: string[]
  onChange: (value: string[]) => void
  onValidation: (isValid: boolean) => void
}

const MARKETS = [
  { id: "spreads", label: "Spreads", detail: "Point spreads and lines" },
  { id: "moneyline", label: "Moneyline", detail: "Straight winners" },
  { id: "totals", label: "Totals", detail: "Game totals and alt lines" },
  { id: "player-props", label: "Player props", detail: "Points, assists, and more" },
]

export function StepMarkets({ value, onChange, onValidation }: StepMarketsProps) {
  useEffect(() => {
    onValidation(value.length > 0)
  }, [value, onValidation])

  const toggleMarket = (marketId: string) => {
    if (value.includes(marketId)) {
      onChange(value.filter((id) => id !== marketId))
    } else {
      onChange([...value, marketId])
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
        eyebrow="Markets"
        title="Which markets do you care about most?"
        subtitle="Select all that apply."
        compact
        useCommitsGrid
      />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 gap-4 place-items-center sm:grid-cols-4">
          {MARKETS.map((market) => {
            const isSelected = value.includes(market.id)
            return (
              <motion.button
                key={market.id}
                onClick={() => toggleMarket(market.id)}
                className="relative w-full max-w-[240px]"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative scale-[0.9] sm:scale-95">
                  <GlareCard className="flex h-full w-full flex-col justify-between p-5">
                    <div className="flex items-start justify-between">
                      <div className="text-lg font-semibold text-white">{market.label}</div>
                      {isSelected && (
                        <div className="rounded-full bg-emerald-500 p-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="mt-6 text-sm text-white/60">{market.detail}</div>
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
            Please select at least one market
          </p>
        )}

        {value.length > 0 && (
          <p className="text-center text-emerald-400 text-sm mt-4">
            {value.length} market{value.length > 1 ? "s" : ""} selected
          </p>
        )}
      </div>
    </motion.div>
  )
}
