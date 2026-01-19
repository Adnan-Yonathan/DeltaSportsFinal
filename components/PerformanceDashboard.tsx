'use client'

import { useState, useEffect, useRef } from 'react'
import { X, TrendingUp, Target, DollarSign, Percent, BarChart3 } from 'lucide-react'
import { motion, useSpring, useTransform } from 'framer-motion'
import Link from 'next/link'

interface PerformanceDashboardProps {
  bankroll: number
  betsPerDay?: number
  onDismiss: () => void
}

// Constants for projection calculation
const WIN_RATE = 0.55 // 55% win rate
const EDGE = 0.0262 // 2.62% edge
const UNIT_SIZE = 0.02 // 2% of bankroll per bet
const DEFAULT_BETS_PER_DAY = 10

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const spring = useSpring(0, { stiffness: 50, damping: 20 })
  const display = useTransform(spring, (current) => {
    if (prefix === '$') {
      return `${prefix}${Math.round(current).toLocaleString()}${suffix}`
    }
    return `${prefix}${current.toFixed(1)}${suffix}`
  })

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  return <motion.span>{display}</motion.span>
}

export default function PerformanceDashboard({
  bankroll,
  betsPerDay = DEFAULT_BETS_PER_DAY,
  onDismiss,
}: PerformanceDashboardProps) {
  const [isVisible, setIsVisible] = useState(false)

  // Calculate projections
  const totalBets = betsPerDay * 7
  const wins = Math.round(totalBets * WIN_RATE)
  const losses = totalBets - wins
  const unitAmount = bankroll * UNIT_SIZE
  const weeklyProfit = unitAmount * totalBets * EDGE
  const winRatePercent = WIN_RATE * 100
  const edgePercent = EDGE * 100

  useEffect(() => {
    // Trigger animation after mount
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={isVisible ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="relative w-full max-w-lg rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-black/90 to-black/80 p-6 shadow-2xl backdrop-blur-xl"
    >
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        aria-label="Close dashboard"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">
          Your Profit Projection
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          7-Day Expected Returns
        </h2>
        <p className="mt-1 text-sm text-white/50">
          Based on your {formatCurrency(bankroll)} bankroll
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Win Rate */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/60">
              Win Rate
            </span>
          </div>
          <p className="text-2xl font-bold text-white">
            <AnimatedNumber value={winRatePercent} suffix="%" />
          </p>
          <p className="text-[10px] text-white/40 mt-1">expected</p>
        </div>

        {/* Edge */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/60">
              Edge
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            +<AnimatedNumber value={edgePercent} suffix="%" />
          </p>
          <p className="text-[10px] text-white/40 mt-1">our average</p>
        </div>

        {/* Bets/Day */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/60">
              Bets/Day
            </span>
          </div>
          <p className="text-2xl font-bold text-white">{betsPerDay}</p>
          <p className="text-[10px] text-white/40 mt-1">volume</p>
        </div>
      </div>

      {/* Profit Projection Card */}
      <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-5 mb-6">
        <p className="text-sm text-white/70 mb-1">
          With {formatCurrency(unitAmount)}/bet (2% of your bankroll)
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-white/60">Your expected weekly profit:</span>
        </div>
        <p className="text-4xl font-bold text-emerald-400 mt-2">
          +<AnimatedNumber value={weeklyProfit} prefix="$" />
        </p>
        <p className="text-xs text-white/50 mt-2">
          Over {totalBets} bets at {edgePercent.toFixed(2)}% edge each
        </p>
      </div>

      {/* Record Preview */}
      <div className="flex items-center justify-between text-sm text-white/60 mb-6">
        <span>Expected record: {wins}-{losses}</span>
        <span className="text-emerald-400/80">{(WIN_RATE * 100).toFixed(0)}% win rate</span>
      </div>

      {/* CTA */}
      <Link
        href="/market-projections"
        className="block w-full text-center py-3 px-4 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-medium hover:bg-emerald-500/30 hover:border-emerald-400/60 transition-all"
      >
        Explore Sharp Projections
      </Link>

      {/* Disclaimer */}
      <p className="mt-4 text-[10px] text-white/40 text-center">
        Projections based on historical CLV performance. Results vary based on volume and discipline.
      </p>
    </motion.div>
  )
}
