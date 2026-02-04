"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DollarSign, Info, AlertTriangle } from "lucide-react"
import DotCard from "@/components/ui/moving-dot-card"
import { GlareCard } from "@/components/ui/glare-card"

interface StepBankrollProjectionProps {
  value: number
  betsPerDay: number
  onChange: (value: number, betsPerDay: number) => void
  onValidation: (isValid: boolean) => void
}

// Constants for projection calculation
const DAYS_PER_MONTH = 30

// Bets per day options
const BETS_PER_DAY_OPTIONS = [
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: 20, label: "20+" },
]

// Profit calculation based purely on per-bet edge.
const EDGE = 0.0262
const calculateToolProfits = (betSize: number, betsPerDay: number) => {
  const totalProfit = betSize * EDGE * betsPerDay * DAYS_PER_MONTH

  return {
    total: totalProfit,
  }
}

export function StepBankrollProjection({
  value,
  betsPerDay,
  onChange,
  onValidation,
}: StepBankrollProjectionProps) {
  const [bankrollInput, setBankrollInput] = useState<string>(
    value > 0 ? String(value) : ""
  )
  const [betsPerDayValue, setBetsPerDayValue] = useState<number>(
    betsPerDay || 10
  )
  const [showProjection, setShowProjection] = useState(false)

  useEffect(() => {
    if (value > 0) {
      setBankrollInput(String(value))
    }
  }, [value])

  useEffect(() => {
    if (betsPerDay) {
      setBetsPerDayValue(betsPerDay)
    }
  }, [betsPerDay])

  const betSizeNum = parseFloat(bankrollInput) || 0
  const isValidBetSize = betSizeNum >= 1

  // Calculate projections for all tools
  const effectiveBetsPerDay = betsPerDayValue || 10
  const toolProfits = calculateToolProfits(betSizeNum, effectiveBetsPerDay)

  useEffect(() => {
    onValidation(isValidBetSize)
    if (isValidBetSize) {
      onChange(betSizeNum, effectiveBetsPerDay)
      // Show projection with a slight delay for effect
      const timer = setTimeout(() => setShowProjection(true), 300)
      return () => clearTimeout(timer)
    } else {
      setShowProjection(false)
    }
  }, [
    bankrollInput,
    isValidBetSize,
    betSizeNum,
    betsPerDayValue,
    onChange,
    onValidation,
  ])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatCurrencyDetailed = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
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
          Bet Size
        </p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          What&apos;s your average bet size?
        </h1>
        <p className="text-sm text-white/80 sm:text-base">
          We&apos;ll calculate expected profit based on your bet size and volume.
        </p>
      </div>

      <div className="max-w-5xl mx-auto space-y-5 text-center">
        {/* Bankroll Input */}
        <div className="space-y-2">
          <label className="text-white/80 text-sm font-medium">
            Average Bet Size
          </label>
          <div className="relative max-w-md mx-auto">
            <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-white/40" />
            <input
              type="number"
              value={bankrollInput}
              onChange={(e) => setBankrollInput(e.target.value)}
              placeholder="50"
              min="1"
              step="1"
              className="w-full bg-zinc-900/80 backdrop-blur-sm text-white placeholder:text-white/30 border border-white/10 rounded-2xl py-2 sm:py-2.5 pl-12 pr-5 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 text-base sm:text-lg font-semibold transition-all"
            />
          </div>
          <p className="text-white/40 text-sm">
            Enter the typical stake you place per bet.
          </p>
        </div>

        {/* Bets Per Day Selector */}
        <div className="space-y-1">
          <label className="text-white/80 text-sm font-medium">
            Bets per day
          </label>
          <div className="flex flex-wrap justify-center gap-3">
            {BETS_PER_DAY_OPTIONS.map((option) => {
              const isSelected = betsPerDayValue === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBetsPerDayValue(option.value)}
                  className="relative w-full max-w-none sm:max-w-[160px]"
                >
                  <div className="relative scale-100 sm:scale-[0.9]">
                    <GlareCard className="flex h-full w-full items-center justify-between gap-4 p-4 sm:justify-center">
                      <div className="text-base font-semibold text-white sm:text-xl">{option.label}</div>
                    </GlareCard>
                  </div>
                </button>
              )
            })}
          </div>
          {betsPerDayValue < 10 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 text-amber-400 text-sm"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                We recommend at least 10 bets/day to reduce variance and see consistent long-term results.
              </p>
            </motion.div>
          )}
        </div>

        {/* Projection Display */}
        <AnimatePresence>
          {showProjection && isValidBetSize && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-6"
            >
              {/* Live Counters */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center">
                  <DotCard target={Math.round(betSizeNum)} duration={1800} />
                  <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                    Bet Size
                  </div>
                </div>
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center">
                  <DotCard target={effectiveBetsPerDay} duration={1400} />
                  <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                    Bets/Day
                  </div>
                </div>
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-transparent px-4 py-5 text-center">
                  <DotCard target={Math.round(toolProfits.total)} duration={2200} />
                  <div className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">
                    Monthly Profit
                  </div>
                </div>
              </div>

              {/* Edge Explanation */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-sm text-white/70">
                Profit is calculated as bet size × 2.62% edge × bets per day × 30 days.
                <div className="mt-2 text-xs text-white/50">
                  Per-bet profit: {formatCurrencyDetailed(betSizeNum * EDGE)}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
                    Edge Assumed
                  </p>
                  <p className="text-xl font-semibold text-white">
                    2.62%
                  </p>
                  <p className="text-white/40 text-xs mt-1">per bet</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
                    Daily Profit
                  </p>
                  <p className="text-xl font-semibold text-emerald-400">
                    +{formatCurrency(toolProfits.total / 30)}
                  </p>
                  <p className="text-white/40 text-xs mt-1">based on volume</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
                    Monthly Bets
                  </p>
                  <p className="text-xl font-semibold text-white">
                    {effectiveBetsPerDay * DAYS_PER_MONTH}
                  </p>
                  <p className="text-white/40 text-xs mt-1">bets per month</p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-3 text-white/40 text-xs">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>
                  These projections are based on average CLV (closing line value) from our models.
                  This represents long-term expected value over 1000+ bets. Actual results will
                  vary—you may lose or make more money than projected. Always bet responsibly.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prompt to enter bankroll */}
        {!isValidBetSize && bankrollInput && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-amber-400 text-sm"
          >
            Please enter a bet size of at least $1
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}

