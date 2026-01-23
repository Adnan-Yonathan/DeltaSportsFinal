'use client'

import { forwardRef } from 'react'
import { VerificationCard } from '@/components/ui/verification-card'

// Sharp tier labels and colors
const SHARP_TIER_LABELS: Record<string, string> = {
  dolphin: 'DOLPHIN',
  orca: 'ORCA',
  whale: 'WHALE',
  megalodon: 'MEGALODON',
}

const SHARP_TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  dolphin: { bg: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd', border: 'rgba(96, 165, 250, 0.5)' },
  orca: { bg: 'rgba(168, 85, 247, 0.2)', text: '#d8b4fe', border: 'rgba(192, 132, 252, 0.5)' },
  whale: { bg: 'rgba(245, 158, 11, 0.2)', text: '#fcd34d', border: 'rgba(251, 191, 36, 0.5)' },
  megalodon: { bg: 'rgba(16, 185, 129, 0.2)', text: '#6ee7b7', border: 'rgba(52, 211, 153, 0.5)' },
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

function formatMonthYear(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'N/A'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${month}/${year}`
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
 * Uses inline styles for html-to-image compatibility
 */
const ShareableTradeCard = forwardRef<HTMLDivElement, ShareableTradeCardProps>(
  ({ trade, matchupLabel }, ref) => {
    const tier = getSharpTier(trade.notional)
    const tierLabel = SHARP_TIER_LABELS[tier]
    const tierColors = SHARP_TIER_COLORS[tier]
    const displayMatchup = matchupLabel || trade.marketTitle
    const eventDate = trade.eventDate || formatDate(trade.timestamp)
    const cardValidThru = formatMonthYear(trade.eventDate || trade.timestamp)

    return (
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: -9999,
          pointerEvents: 'none',
          overflow: 'hidden',
          opacity: 0,
        }}
        aria-hidden="true"
      >
        <div
          ref={ref}
          style={{
            width: 1200,
            height: 628,
            background: '#000000',
            color: '#ffffff',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            opacity: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '28px 48px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: '#0a0a0a',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                Δ
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
                  deltasports.app
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                  Sharp money snapshot
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' as const }}>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                Market
              </div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{trade.marketTitle}</div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              padding: '12px 48px 32px',
              flex: 1,
              backgroundColor: '#000000',
            }}
          >
            <div style={{ transform: 'scale(2.2)', marginTop: 24 }}>
              <VerificationCard                label={`${trade.sport} SHARP`}
                idNumber={`BET ${formatCurrency(trade.notional)} • LINE ${formatOdds(
                  trade.priceCents,
                  trade.americanOdds
                )}`}
                name={displayMatchup}
                validThru={cardValidThru}
              />
            </div>
            <div style={{ textAlign: 'center' as const }}>
              <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.6)' }}>
                {eventDate} - {trade.outcome} - {formatCurrency(trade.notional)} - {tierLabel}
              </div>
              <div style={{ fontSize: 12, color: tierColors.text }}>
                via {trade.source === 'kalshi' ? 'Kalshi' : 'Polymarket'}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

ShareableTradeCard.displayName = 'ShareableTradeCard'

export default ShareableTradeCard

