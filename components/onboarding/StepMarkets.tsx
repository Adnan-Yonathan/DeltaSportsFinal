"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
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
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">
          Markets
        </p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Which markets do you care about most?
        </h1>
        <p className="text-sm text-white/80 sm:text-base">
          Select all that apply.
        </p>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-4 place-items-center">
          {MARKETS.map((market) => {
            const isSelected = value.includes(market.id)
            return (
              <motion.button
                key={market.id}
                onClick={() => toggleMarket(market.id)}
                className="relative w-full max-w-none sm:max-w-[240px]"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative scale-100 sm:scale-95">
                  <GlareCard className="flex h-full w-full flex-row items-center justify-between gap-4 p-4 sm:flex-col sm:items-start sm:gap-0 sm:p-5">
                    <div className="flex items-start gap-3 sm:w-full sm:items-start sm:justify-between">
                      <div className="text-base font-semibold text-white sm:text-lg">{market.label}</div>
                      {isSelected && (
                        <div className="rounded-full bg-emerald-500 p-1 sm:ml-auto">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-left text-xs text-white/60 sm:mt-6 sm:text-sm">
                      {market.detail}
                    </div>
                  </GlareCard>
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
