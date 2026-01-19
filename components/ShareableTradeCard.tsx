'use client'

import { forwardRef } from 'react'

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

    return (
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: -9999,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
        aria-hidden="true"
      >
        <div
          ref={ref}
          style={{
            width: 1200,
            height: 628,
            background: '#0a0a0a',
            color: '#ffffff',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '32px 48px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: '#0a0a0a',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Delta logo as styled box */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 700,
                  color: '#ffffff',
                }}
              >
                Δ
              </div>
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: '#ffffff' }}>
                DELTA SPORTS
              </span>
            </div>
            <span style={{ fontSize: 20, color: 'rgba(255, 255, 255, 0.6)' }}>{eventDate}</span>
          </div>

          {/* Content */}
          <div style={{ padding: '40px 48px', flex: 1, backgroundColor: '#0a0a0a' }}>
            {/* Sport and Source */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 32,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 600, color: '#34d399' }}>{trade.sport}</span>
              <span style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.6)' }}>
                via {trade.source === 'kalshi' ? 'Kalshi' : 'Polymarket'}
              </span>
            </div>

            {/* Main Card */}
            <div
              style={{
                borderRadius: 24,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                padding: 40,
              }}
            >
              {/* Matchup */}
              <div style={{ fontSize: 36, fontWeight: 700, color: '#ffffff', marginBottom: 24 }}>
                {displayMatchup}
              </div>

              {/* Bet Details */}
              <div style={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.8)', marginBottom: 32 }}>
                {trade.outcome}
              </div>

              {/* Odds and Size Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div
                    style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 4 }}
                  >
                    Odds
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 600, color: '#ffffff' }}>
                    {formatOdds(trade.priceCents, trade.americanOdds)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'right' as const }}>
                    <div
                      style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 4 }}
                    >
                      Size
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#ffffff' }}>
                      {formatCurrency(trade.notional)}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '8px 16px',
                      borderRadius: 9999,
                      fontSize: 16,
                      fontWeight: 700,
                      textTransform: 'uppercase' as const,
                      letterSpacing: 1,
                      backgroundColor: tierColors.bg,
                      color: tierColors.text,
                      border: `1px solid ${tierColors.border}`,
                    }}
                  >
                    {tierLabel}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '24px 48px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: '#0a0a0a',
              textAlign: 'center' as const,
            }}
          >
            <span style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.5)' }}>
              Track sharp money at{' '}
            </span>
            <span style={{ fontSize: 18, color: '#34d399', fontWeight: 500 }}>deltasports.app</span>
          </div>
        </div>
      </div>
    )
  }
)

ShareableTradeCard.displayName = 'ShareableTradeCard'

export default ShareableTradeCard
