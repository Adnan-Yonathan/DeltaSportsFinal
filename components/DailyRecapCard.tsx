'use client'

import { X, TrendingUp, Target, DollarSign, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import type { DailyRecap } from '@/lib/services/daily-recap'
import { getClvTierLabel } from '@/lib/services/daily-recap'

interface DailyRecapCardProps {
  recap: DailyRecap
  onDismiss: () => void
}

const CLV_TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  godlike: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-300',
    border: 'border-purple-400/50',
  },
  elite: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-300',
    border: 'border-amber-400/50',
  },
  good: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    border: 'border-emerald-400/50',
  },
  negligible: {
    bg: 'bg-zinc-500/20',
    text: 'text-zinc-300',
    border: 'border-zinc-400/50',
  },
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatProfit(amount: number | null): string {
  if (amount == null) return '$0'
  const sign = amount >= 0 ? '+' : ''
  return `${sign}$${Math.abs(amount).toFixed(0)}`
}

export default function DailyRecapCard({ recap, onDismiss }: DailyRecapCardProps) {
  const record = `${recap.wins}-${recap.losses}${recap.pushes > 0 ? `-${recap.pushes}` : ''}`
  const tierColors = recap.clvTier
    ? CLV_TIER_COLORS[recap.clvTier] ?? CLV_TIER_COLORS.negligible
    : CLV_TIER_COLORS.negligible

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="relative w-full max-w-lg rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-black/90 to-black/80 p-6 shadow-2xl backdrop-blur-xl"
    >
      {/* Close button */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        aria-label="Close daily recap"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">
          Daily Recap
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {formatDate(recap.recapDate)}
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {recap.sports.map((sport) => (
            <span
              key={sport}
              className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-white/10 text-white/80 rounded"
            >
              {sport}
            </span>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Record */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/60">
              Record
            </span>
          </div>
          <p className="text-2xl font-bold text-white">{record}</p>
        </div>

        {/* ROI */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/60">
              ROI
            </span>
          </div>
          <p
            className={`text-2xl font-bold ${
              (recap.roiPercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {recap.roiPercent != null
              ? `${recap.roiPercent >= 0 ? '+' : ''}${recap.roiPercent.toFixed(1)}%`
              : 'N/A'}
          </p>
        </div>

        {/* CLV */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/60">
              Avg CLV
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-white">
              {recap.avgClvPoints != null
                ? `${recap.avgClvPoints >= 0 ? '+' : ''}${recap.avgClvPoints.toFixed(2)}`
                : 'N/A'}
            </p>
            {recap.clvTier && (
              <span
                className={`px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded ${tierColors.bg} ${tierColors.text} border ${tierColors.border}`}
              >
                {getClvTierLabel(recap.clvTier)}
              </span>
            )}
          </div>
        </div>

        {/* $100 Bettor */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/60">
              $100 Bettor
            </span>
          </div>
          <p
            className={`text-2xl font-bold ${
              (recap.hypothetical100Profit ?? 0) >= 0
                ? 'text-emerald-400'
                : 'text-red-400'
            }`}
          >
            {formatProfit(recap.hypothetical100Profit)}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center">
        <p className="text-[11px] text-white/50">
          Based on {recap.totalPicks} market projection{recap.totalPicks !== 1 ? 's' : ''}
        </p>
      </div>
    </motion.div>
  )
}
