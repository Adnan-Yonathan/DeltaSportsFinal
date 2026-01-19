'use client'

import { forwardRef } from 'react'
import Image from 'next/image'

// Sharp tier labels and colors
const SHARP_TIER_LABELS: Record<string, string> = {
  dolphin: 'DOLPHIN',
  orca: 'ORCA',
  whale: 'WHALE',
  megalodon: 'MEGALODON',
}

const SHARP_TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  dolphin: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-400/50' },
  orca: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-400/50' },
  whale: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-400/50' },
  megalodon: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-400/50' },
}

function getSharpTier(notional: number): string {
  if (notional >= 25000) return 'megalodon'
  if (notional >= 15000) return 'whale'
  if (notional >= 7500) return 'orca'
  return 'dolphin'
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}K`
  }
  return `$${amount.toLocaleString()}`
}

function formatOdds(priceCents: number, americanOdds: number | null): string {
  const cents = `${priceCents}c`
  if (americanOdds != null) {
    const sign = americanOdds >= 0 ? '+' : ''
    return `${cents} (${sign}${americanOdds})`
  }
  return cents
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export interface ShareableTradeCardProps {
  trade: {
    id: string
    marketTitle: string
    outcome: string
    notional: number
    source: 'kalshi' | 'polymarket'
    sport: string
    eventDate?: string
    timestamp: string
    priceCents: number
    americanOdds: number | null
  }
  matchupLabel?: string
}

/**
 * Shareable trade card designed for Twitter/Reddit (1200x628)
 * This component is rendered off-screen and captured as an image
 */
const ShareableTradeCard = forwardRef<HTMLDivElement, ShareableTradeCardProps>(
  ({ trade, matchupLabel }, ref) => {
    const tier = getSharpTier(trade.notional)
    const tierLabel = SHARP_TIER_LABELS[tier]
    const tierColors = SHARP_TIER_COLORS[tier]
    const displayMatchup = matchupLabel || trade.marketTitle
    const eventDate = trade.eventDate || formatDate(trade.timestamp)

    return (
      <div
        ref={ref}
        style={{
          width: 1200,
          height: 628,
          position: 'absolute',
          left: -9999,
          top: -9999,
        }}
        className="bg-gradient-to-br from-zinc-900 via-black to-zinc-900 text-white font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-12 py-8 border-b border-white/10">
          <div className="flex items-center gap-4">
            <Image
              src="/delta-logo.png"
              alt="Delta Sports"
              width={48}
              height={48}
              className="rounded-lg"
            />
            <span className="text-2xl font-bold tracking-tight">DELTA SPORTS</span>
          </div>
          <span className="text-xl text-white/60">{eventDate}</span>
        </div>

        {/* Content */}
        <div className="px-12 py-10">
          {/* Sport and Source */}
          <div className="flex items-center justify-between mb-8">
            <span className="text-xl font-semibold text-emerald-400">{trade.sport}</span>
            <span className="text-lg text-white/60">
              via {trade.source === 'kalshi' ? 'Kalshi' : 'Polymarket'}
            </span>
          </div>

          {/* Main Card */}
          <div className="rounded-3xl border border-white/20 bg-white/5 p-10">
            {/* Matchup */}
            <h2 className="text-4xl font-bold text-white mb-6">{displayMatchup}</h2>

            {/* Bet Details */}
            <p className="text-2xl text-white/80 mb-8">{trade.outcome}</p>

            {/* Odds and Size Row */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xl text-white/60 block mb-1">Odds</span>
                <span className="text-3xl font-semibold text-white">
                  {formatOdds(trade.priceCents, trade.americanOdds)}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xl text-white/60 block mb-1">Size</span>
                  <span className="text-3xl font-bold text-white">
                    {formatCurrency(trade.notional)}
                  </span>
                </div>
                <span
                  className={`px-4 py-2 rounded-full text-lg font-bold uppercase tracking-wider ${tierColors.bg} ${tierColors.text} border ${tierColors.border}`}
                >
                  {tierLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-12 py-6 border-t border-white/10">
          <p className="text-center text-lg text-white/50">
            Track sharp money at <span className="text-emerald-400 font-medium">deltasports.app</span>
          </p>
        </div>
      </div>
    )
  }
)

ShareableTradeCard.displayName = 'ShareableTradeCard'

export default ShareableTradeCard
