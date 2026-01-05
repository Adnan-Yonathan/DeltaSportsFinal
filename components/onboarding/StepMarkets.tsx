"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"

interface StepMarketsProps {
  value: string[]
  onChange: (value: string[]) => void
  onValidation: (isValid: boolean) => void
}

const MARKETS = [
  { id: "spreads", label: "Spreads", detail: "Point spreads and lines" },
  { id: "totals", label: "Totals", detail: "Game totals and alt lines" },
  { id: "moneyline", label: "Moneyline", detail: "Straight winners" },
  { id: "player-props", label: "Player props", detail: "Points, assists, and more" },
  { id: "sgp", label: "Parlays", detail: "Multi-leg combinations" },
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
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Markets</p>
        <h2 className="text-4xl font-bold text-white tracking-tight">
          Which markets do you care about most?
        </h2>
        <p className="text-white/60">Select all that apply.</p>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MARKETS.map((market) => {
            const isSelected = value.includes(market.id)
            return (
              <motion.button
                key={market.id}
                onClick={() => toggleMarket(market.id)}
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
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-white">{market.label}</div>
                  <div className="text-xs text-white/50">{market.detail}</div>
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
