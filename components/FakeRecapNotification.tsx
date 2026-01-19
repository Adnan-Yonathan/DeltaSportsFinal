'use client'

import { motion } from 'framer-motion'
import { TrendingUp, Target, BarChart3, DollarSign } from 'lucide-react'

// Believable mock data for marketing purposes
const MOCK_RECAP = {
  recapDate: 'Yesterday',
  record: '7-3',
  roiPercent: 18.4,
  avgClvPoints: 0.52,
  clvTier: 'good' as const,
  hypothetical100Profit: 184,
  sports: ['NBA', 'NCAAB'],
}

const CLV_TIER_COLORS = {
  good: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    border: 'border-emerald-400/50',
  },
}

export default function FakeRecapNotification() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: 0 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{
        type: 'spring',
        damping: 25,
        stiffness: 200,
        delay: 2, // Show after 2 seconds
      }}
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-80 z-50 pointer-events-none"
    >
      <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-black/95 to-black/90 p-4 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-emerald-300/70">
              Daily Recap
            </p>
            <p className="text-sm font-semibold text-white">
              {MOCK_RECAP.recapDate}
            </p>
          </div>
          <div className="flex gap-1">
            {MOCK_RECAP.sports.map((sport) => (
              <span
                key={sport}
                className="px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide bg-white/10 text-white/70 rounded"
              >
                {sport}
              </span>
            ))}
          </div>
        </div>

        {/* Compact Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          {/* Record */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Target className="w-3 h-3 text-emerald-400/70" />
            </div>
            <p className="text-sm font-bold text-white">{MOCK_RECAP.record}</p>
            <p className="text-[8px] uppercase tracking-wider text-white/40">
              Record
            </p>
          </div>

          {/* ROI */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <TrendingUp className="w-3 h-3 text-emerald-400/70" />
            </div>
            <p className="text-sm font-bold text-emerald-400">
              +{MOCK_RECAP.roiPercent}%
            </p>
            <p className="text-[8px] uppercase tracking-wider text-white/40">
              ROI
            </p>
          </div>

          {/* CLV */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <BarChart3 className="w-3 h-3 text-emerald-400/70" />
            </div>
            <p className="text-sm font-bold text-white">
              +{MOCK_RECAP.avgClvPoints}
            </p>
            <p className="text-[8px] uppercase tracking-wider text-white/40">
              Avg CLV
            </p>
          </div>

          {/* Profit */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <DollarSign className="w-3 h-3 text-emerald-400/70" />
            </div>
            <p className="text-sm font-bold text-emerald-400">
              +${MOCK_RECAP.hypothetical100Profit}
            </p>
            <p className="text-[8px] uppercase tracking-wider text-white/40">
              $100 Bet
            </p>
          </div>
        </div>

        {/* CLV Tier Badge */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <span
            className={`px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded ${CLV_TIER_COLORS.good.bg} ${CLV_TIER_COLORS.good.text} border ${CLV_TIER_COLORS.good.border}`}
          >
            Good CLV
          </span>
          <span className="text-[9px] text-white/40">
            Sign up for full recaps
          </span>
        </div>
      </div>
    </motion.div>
  )
}
