"use client"

import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { TrendingUp, Target } from "lucide-react"

interface StepMonthlyProfitProps {
  unitSize: number
  betsPerDay: number
  onValidation: (isValid: boolean) => void
}

const EDGE = 0.03
const DAYS_PER_MONTH = 30

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function StepMonthlyProfit({
  unitSize,
  betsPerDay,
  onValidation,
}: StepMonthlyProfitProps) {
  useEffect(() => {
    onValidation(true)
  }, [onValidation])

  const safeBetSize = Number.isFinite(unitSize) ? unitSize : 0
  const safeBets = Number.isFinite(betsPerDay) ? betsPerDay : 0
  const monthlyProfit = safeBetSize * EDGE * safeBets * DAYS_PER_MONTH
  const monthlyBets = safeBets * DAYS_PER_MONTH

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">
          Delta Estimate
        </p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Here&apos;s how much you could make per month
        </h1>
        <p className="text-sm text-white/80 sm:text-base">
          Based on a 3% assumed edge per bet (illustrative, not guaranteed).
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-transparent p-5 sm:p-6">
          <div className="flex items-center gap-2 text-emerald-300 text-xs uppercase tracking-[0.25em]">
            <TrendingUp className="h-4 w-4" />
            Monthly profit
          </div>
          <div className="mt-4 text-4xl sm:text-5xl font-bold text-white">
            {formatCurrency(monthlyProfit)}
            <span className="text-base text-white/60 font-normal ml-2">/month</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                Unit size
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatCurrency(safeBetSize)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                Bets/day
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {safeBets || 0}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                Monthly bets
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {monthlyBets || 0}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 text-white/50 text-xs">
            <Target className="h-4 w-4 mt-0.5 text-emerald-300" />
            Assumes 3% profit per bet on average.
          </div>
        </div>
      </div>
    </motion.div>
  )
}
