'use client'

import { forwardRef } from 'react'

const FONT_STACK =
  'ui-monospace, "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace'

const SHARP_TIER_LABELS: Record<string, string> = {
  dolphin: 'SWORDFISH',
  orca: 'ORCA',
  whale: 'BLUE WHALE',
  megalodon: 'NUKE',
}

const SHARP_TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  dolphin: { bg: 'rgba(59, 130, 246, 0.15)', text: '#93c5fd', border: 'rgba(96, 165, 250, 0.4)' },
  orca: { bg: 'rgba(14, 165, 233, 0.15)', text: '#7dd3fc', border: 'rgba(56, 189, 248, 0.45)' },
  whale: { bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', border: 'rgba(52, 211, 153, 0.45)' },
  megalodon: { bg: 'rgba(132, 204, 22, 0.18)', text: '#bef264', border: 'rgba(163, 230, 53, 0.55)' },
}

const SOURCE_STYLES: Record<'kalshi' | 'polymarket', { label: string; bg: string; border: string; text: string }> =
  {
    kalshi: {
      label: 'KALSHI',
      bg: 'rgba(8, 145, 178, 0.16)',
      border: 'rgba(34, 211, 238, 0.45)',
      text: '#67e8f9',
    },
    polymarket: {
      label: 'POLYMARKET',
      bg: 'rgba(30, 64, 175, 0.22)',
      border: 'rgba(96, 165, 250, 0.4)',
      text: '#bfdbfe',
    },
  }

function getSharpTier(notional: number): string {
  if (notional >= 25000) return 'megalodon'
  if (notional >= 15000) return 'whale'
  if (notional >= 7500) return 'orca'
  return 'dolphin'
}

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '$0'
  const rounded = Math.round(amount * 100) / 100
  const hasCents = Math.abs(rounded % 1) > 0
  return `$${rounded.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

function formatOdds(priceCents: number, americanOdds: number | null): string {
  if (!Number.isFinite(priceCents) && americanOdds == null) return 'n/a'
  if (americanOdds != null && Number.isFinite(americanOdds)) {
    const sign = americanOdds >= 0 ? '+' : ''
    return `${sign}${Math.round(americanOdds)}`
  }
  return `${Math.round(priceCents)}c`
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const resolveGameLabel = (marketTitle: string) =>
  marketTitle.split(/\s*(spread|moneyline|total)/i)[0].trim() || marketTitle

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

const ShareableTradeCard = forwardRef<HTMLDivElement, ShareableTradeCardProps>(
  ({ trade, matchupLabel }, ref) => {
    const tier = getSharpTier(trade.notional)
    const tierLabel = SHARP_TIER_LABELS[tier]
    const tierColors = SHARP_TIER_COLORS[tier]
    const sourceStyle = SOURCE_STYLES[trade.source]
    const displayMatchup = matchupLabel || resolveGameLabel(trade.marketTitle)
    const eventLabel = trade.eventDate || 'TBD'
    const detectedLabel = formatTimestamp(trade.timestamp)
    const oddsLabel = formatOdds(trade.priceCents, trade.americanOdds)

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
            color: '#ffffff',
            fontFamily: FONT_STACK,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            opacity: 1,
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background:
              'radial-gradient(circle at 15% 8%, rgba(16, 185, 129, 0.2), transparent 42%), radial-gradient(circle at 95% 95%, rgba(34, 211, 238, 0.13), transparent 48%), #02050c',
          }}
        >
          <div style={{ padding: '20px 28px 0', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  borderRadius: 999,
                  border: `1px solid ${sourceStyle.border}`,
                  backgroundColor: sourceStyle.bg,
                  color: sourceStyle.text,
                  fontSize: 12,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  padding: '6px 12px',
                  fontWeight: 700,
                }}
              >
                {sourceStyle.label}
              </span>
              <span
                style={{
                  borderRadius: 999,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: 'rgba(255, 255, 255, 0.78)',
                  fontSize: 12,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  padding: '6px 12px',
                }}
              >
                {trade.sport}
              </span>
            </div>
            <span
              style={{
                borderRadius: 999,
                border: `1px solid ${tierColors.border}`,
                backgroundColor: tierColors.bg,
                color: tierColors.text,
                fontSize: 12,
                letterSpacing: 2,
                textTransform: 'uppercase',
                padding: '6px 12px',
                fontWeight: 700,
              }}
            >
              {tierLabel}
            </span>
          </div>

          <div style={{ padding: '20px 28px 0' }}>
            <div style={{ fontSize: 14, letterSpacing: 3, color: 'rgba(255, 255, 255, 0.48)', textTransform: 'uppercase' }}>
              Whale Detector
            </div>
            <div style={{ marginTop: 8, fontSize: 52, lineHeight: 1.08, fontWeight: 700 }}>{displayMatchup}</div>
          </div>

          <div
            style={{
              margin: '16px 28px 0',
              borderRadius: 18,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(0, 0, 0, 0.48)',
              padding: '18px 20px',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginBottom: 7,
                }}
              >
                The Bet
              </div>
              <div style={{ fontSize: 37, lineHeight: 1.12, fontWeight: 700, color: '#f8fafc' }}>{trade.outcome}</div>
              <div style={{ marginTop: 10, fontSize: 18, color: 'rgba(255, 255, 255, 0.58)' }}>{trade.marketTitle}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div
                style={{
                  borderRadius: 12,
                  backgroundColor: '#84cc16',
                  color: '#0b1100',
                  padding: '10px 14px',
                  fontSize: 36,
                  lineHeight: 1,
                  fontWeight: 700,
                }}
              >
                {oddsLabel}
              </div>
              <div style={{ marginTop: 10, fontSize: 14, color: 'rgba(255, 255, 255, 0.58)' }}>Entry Odds</div>
            </div>
          </div>

          <div
            style={{
              margin: '12px 28px 0',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            <div
              style={{
                borderRadius: 14,
                border: '1px solid rgba(132, 204, 22, 0.45)',
                background: 'linear-gradient(135deg, rgba(132, 204, 22, 0.22), rgba(16, 185, 129, 0.08))',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.5)' }}>
                Notional
              </div>
              <div style={{ marginTop: 8, fontSize: 36, fontWeight: 700, lineHeight: 1, color: '#bef264' }}>
                {formatCurrency(trade.notional)}
              </div>
            </div>
            <div
              style={{
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.5)' }}>
                Event Date
              </div>
              <div style={{ marginTop: 9, fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{eventLabel}</div>
            </div>
            <div
              style={{
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.5)' }}>
                Detected
              </div>
              <div style={{ marginTop: 9, fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{detectedLabel}</div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              right: 22,
              bottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: 999,
              border: '1px solid rgba(255, 255, 255, 0.17)',
              backgroundColor: 'rgba(0, 0, 0, 0.56)',
              padding: '7px 12px',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                border: '1px solid rgba(255, 255, 255, 0.25)',
                overflow: 'hidden',
                backgroundColor: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img src="/delta-logo.png" alt="Delta Sports" style={{ width: 15, height: 15, objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.95)' }}>deltasports.app</span>
              <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.62)' }}>follow the money</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

ShareableTradeCard.displayName = 'ShareableTradeCard'

export default ShareableTradeCard
