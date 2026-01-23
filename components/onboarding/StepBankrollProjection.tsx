"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DollarSign, TrendingUp, Calculator, Info, AlertTriangle, Target, Users, Zap, BarChart3, Radio } from "lucide-react"

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
  { value: 15, label: "15" },
  { value: 20, label: "20+" },
]

// Tool profit calculations (based on $10k bankroll baseline, scales linearly)
const calculateToolProfits = (bankroll: number, betsPerDay: number) => {
  const scaleFactor = bankroll / 10000
  const volumeMultiplier = betsPerDay / 10 // baseline is 10 bets/day

  // Sharp Projections: 2% unit, 2.62% edge, betsPerDay sides
  const sharpProjectionsProfit = bankroll * 0.02 * 0.0262 * betsPerDay * DAYS_PER_MONTH

  // Sharp Props: 0.5-1% unit (avg 0.75%), ~57% win rate, 5 props/day scaled
  const propsPerDay = Math.round(betsPerDay * 0.5) // half as many props as sides
  const propUnit = bankroll * 0.0075
  const propEdge = 0.04 // ~4% edge on props
  const sharpPropsProfit = propUnit * propEdge * propsPerDay * DAYS_PER_MONTH

  // EV Bets: 1-2% unit (avg 1.5%), ~4% EV, high volume
  const evBetsPerDay = betsPerDay // same volume as sides
  const evUnit = bankroll * 0.015
  const evEdge = 0.04
  const evBetsProfit = evUnit * evEdge * evBetsPerDay * DAYS_PER_MONTH

  // Parlays: 0.5% unit, ~5% EV, 2 parlays/day baseline
  const parlaysPerDay = Math.max(1, Math.round(betsPerDay * 0.2))
  const parlayUnit = bankroll * 0.005
  const parlayEdge = 0.05
  const parlayProfit = parlayUnit * parlayEdge * parlaysPerDay * DAYS_PER_MONTH

  // Live: 0.5-1% unit (avg 0.75%), ~6% edge, 2 live bets/day baseline
  const liveBetsPerDay = Math.max(1, Math.round(betsPerDay * 0.2))
  const liveUnit = bankroll * 0.0075
  const liveEdge = 0.06
  const liveProfit = liveUnit * liveEdge * liveBetsPerDay * DAYS_PER_MONTH

  const totalProfit = sharpProjectionsProfit + sharpPropsProfit + evBetsProfit + parlayProfit + liveProfit

  return {
    sharpProjections: sharpProjectionsProfit,
    sharpProps: sharpPropsProfit,
    evBets: evBetsProfit,
    parlays: parlayProfit,
    live: liveProfit,
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

  const bankrollNum = parseFloat(bankrollInput) || 0
  const isValidBankroll = bankrollNum >= 100

  // Calculate projections for all tools
  const toolProfits = calculateToolProfits(bankrollNum, betsPerDayValue)
  const unitSize = bankrollNum * 0.02

  useEffect(() => {
    onValidation(isValidBankroll)
    if (isValidBankroll) {
      onChange(bankrollNum, betsPerDayValue)
      // Show projection with a slight delay for effect
      const timer = setTimeout(() => setShowProjection(true), 300)
      return () => clearTimeout(timer)
    } else {
      setShowProjection(false)
    }
  }, [
    bankrollInput,
    isValidBankroll,
    bankrollNum,
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
      className="space-y-8"
    >
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          Bankroll
        </p>
        <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
          What's your betting bankroll?
        </h2>
        <p className="text-white/60">
          See your potential earnings with sharp projections
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-8">
        {/* Bankroll Input */}
        <div className="space-y-3">
          <label className="text-white/80 text-sm font-medium">
            Starting Bankroll
          </label>
          <div className="relative">
            <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-white/40" />
            <input
              type="number"
              value={bankrollInput}
              onChange={(e) => setBankrollInput(e.target.value)}
              placeholder="10000"
              min="100"
              step="100"
              className="w-full bg-zinc-900/80 backdrop-blur-sm text-white placeholder:text-white/30 border border-white/10 rounded-2xl py-4 sm:py-5 pl-14 pr-6 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 text-xl sm:text-2xl font-semibold transition-all"
            />
          </div>
          <p className="text-white/40 text-sm">
            Enter the total amount you have set aside for sports betting
          </p>
        </div>

        {/* Bets Per Day Selector */}
        <div className="space-y-3">
          <label className="text-white/80 text-sm font-medium">
            Bets per day
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BETS_PER_DAY_OPTIONS.map((option) => {
              const isSelected = betsPerDayValue === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBetsPerDayValue(option.value)}
                  className={`
                    relative flex-1 py-4 px-4 rounded-xl border transition-all font-semibold text-base sm:text-lg
                    ${isSelected
                      ? "bg-gradient-to-b from-emerald-500/20 to-emerald-600/10 border-emerald-500/50 text-white"
                      : "bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20 hover:text-white/80"
                    }
                  `}
                >
                  {option.label}
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
          {showProjection && isValidBankroll && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-6"
            >
              {/* Main Projection Card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-transparent border border-emerald-500/30 p-4 sm:p-6">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-3">
                    <TrendingUp className="w-4 h-4" />
                    Total Expected Monthly Profit
                  </div>
                  <div className="text-3xl sm:text-5xl font-bold text-white mb-2">
                    {formatCurrency(toolProfits.total)}
                    <span className="text-lg text-white/60 font-normal ml-2">
                      /month
                    </span>
                  </div>
                  <p className="text-white/50 text-sm">
                    Combined profit from all tools over the long run
                  </p>
                </div>
              </div>

              {/* Profit by Tool */}
              <div className="space-y-3">
                <h4 className="text-white/60 text-xs uppercase tracking-wider">
                  Profit breakdown by tool
                </h4>
                <div className="space-y-2">
                  {/* Sharp Projections */}
                  <div className="flex flex-col gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <Target className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">Sharp Projections</p>
                        <p className="text-white/40 text-xs">Sides & totals at 2.62% edge</p>
                      </div>
                    </div>
                    <p className="text-emerald-400 font-semibold sm:text-right">
                      +{formatCurrency(toolProfits.sharpProjections)}
                    </p>
                  </div>

                  {/* EV Bets */}
                  <div className="flex flex-col gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <Zap className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">EV Bets</p>
                        <p className="text-white/40 text-xs">Cross-market value at ~4% EV</p>
                      </div>
                    </div>
                    <p className="text-emerald-400 font-semibold sm:text-right">
                      +{formatCurrency(toolProfits.evBets)}
                    </p>
                  </div>

                  {/* Sharp Props */}
                  <div className="flex flex-col gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <Users className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">Sharp Props</p>
                        <p className="text-white/40 text-xs">Whale-backed player props</p>
                      </div>
                    </div>
                    <p className="text-emerald-400 font-semibold sm:text-right">
                      +{formatCurrency(toolProfits.sharpProps)}
                    </p>
                  </div>

                  {/* Live Projections */}
                  <div className="flex flex-col gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <Radio className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">Live Projections</p>
                        <p className="text-white/40 text-xs">In-game edges at ~6% EV</p>
                      </div>
                    </div>
                    <p className="text-emerald-400 font-semibold sm:text-right">
                      +{formatCurrency(toolProfits.live)}
                    </p>
                  </div>

                  {/* Parlay Pro */}
                  <div className="flex flex-col gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <BarChart3 className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">Parlay Pro</p>
                        <p className="text-white/40 text-xs">Correlated parlays at ~5% EV</p>
                      </div>
                    </div>
                    <p className="text-emerald-400 font-semibold sm:text-right">
                      +{formatCurrency(toolProfits.parlays)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
                    Base Unit
                  </p>
                  <p className="text-xl font-semibold text-white">
                    {formatCurrency(unitSize)}
                  </p>
                  <p className="text-white/40 text-xs mt-1">2% of bankroll</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
                    Daily Profit
                  </p>
                  <p className="text-xl font-semibold text-emerald-400">
                    +{formatCurrency(toolProfits.total / 30)}
                  </p>
                  <p className="text-white/40 text-xs mt-1">all tools combined</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
                    Monthly ROI
                  </p>
                  <p className="text-xl font-semibold text-white">
                    {((toolProfits.total / bankrollNum) * 100).toFixed(1)}%
                  </p>
                  <p className="text-white/40 text-xs mt-1">on your bankroll</p>
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
        {!isValidBankroll && bankrollInput && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-amber-400 text-sm"
          >
            Please enter a bankroll of at least $100
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}
