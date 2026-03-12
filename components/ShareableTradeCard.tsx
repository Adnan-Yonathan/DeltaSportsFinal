'use client'

import { forwardRef } from 'react'
import { ShareCaptureRoot, ShareCardFrame } from '@/components/share/ShareCardFrame'

type FlowDirection = 'up' | 'down' | 'neutral'

export type ShareableFlowBar = {
  timestampLabel: string
  notional: string
  oddsLabel: string
  direction: FlowDirection
  normalizedHeight: number
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
    roiLifetime?: number | null
    recentFlowBars?: ShareableFlowBar[]
  }
  matchupLabel?: string
}

const formatCurrency = (amount: number): string => {
  if (!Number.isFinite(amount)) return '$0'
  const rounded = Math.round(amount * 100) / 100
  const hasCents = Math.abs(rounded % 1) > 0
  return `$${rounded.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

const formatOdds = (priceCents: number, americanOdds: number | null): string => {
  if (!Number.isFinite(priceCents) && americanOdds == null) return 'n/a'
  if (americanOdds != null && Number.isFinite(americanOdds)) {
    const sign = americanOdds >= 0 ? '+' : ''
    return `${sign}${Math.round(americanOdds)}`
  }
  return `${Math.round(priceCents)}c`
}

const formatTimestamp = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatRoiPercent = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

const resolveGameLabel = (marketTitle: string) =>
  marketTitle.split(/\s*(spread|moneyline|total)/i)[0].trim() || marketTitle

const clampedHeight = (value: number) => Math.max(14, Math.min(100, Math.round(value)))

const directionColor = (direction: FlowDirection) => {
  if (direction === 'up') return 'linear-gradient(180deg, #34d399 0%, #10b981 100%)'
  if (direction === 'down') return 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
  return 'linear-gradient(180deg, #6ee7b7 0%, #10b981 100%)'
}

const ShareableTradeCard = forwardRef<HTMLDivElement, ShareableTradeCardProps>(
  ({ trade, matchupLabel }, ref) => {
    const displayMatchup = matchupLabel || resolveGameLabel(trade.marketTitle)
    const eventLabel = trade.eventDate || 'TBD'
    const detectedLabel = formatTimestamp(trade.timestamp)
    const oddsLabel = formatOdds(trade.priceCents, trade.americanOdds)
    const roiLabel = formatRoiPercent(trade.roiLifetime)
    const sourceLabel = trade.source === 'kalshi' ? 'KALSHI' : 'POLYMARKET'
    const flowBars =
      trade.recentFlowBars && trade.recentFlowBars.length > 0
        ? trade.recentFlowBars.slice(0, 9)
        : [
            {
              timestampLabel: detectedLabel,
              notional: formatCurrency(trade.notional),
              oddsLabel,
              direction: 'neutral' as const,
              normalizedHeight: 70,
            },
          ]

    return (
      <ShareCaptureRoot>
        <div ref={ref}>
          <ShareCardFrame accent="emerald">
            <div
              style={{
                marginTop: 92,
                borderRadius: 38,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(2, 6, 23, 0.84)',
                padding: '26px 26px 24px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.05, color: '#f8fafc' }}>
                  {displayMatchup}
                </div>
                <div
                  style={{
                    borderRadius: 999,
                    border: '1px solid rgba(52, 211, 153, 0.45)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#86efac',
                    padding: '10px 14px',
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: 1.2,
                  }}
                >
                  {sourceLabel}
                </div>
              </div>

              <div style={{ marginTop: 8, fontSize: 24, color: 'rgba(255,255,255,0.66)' }}>
                {eventLabel}
              </div>

              <div
                style={{
                  marginTop: 18,
                  borderRadius: 22,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(0,0,0,0.44)',
                  padding: '16px 16px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 18,
                      letterSpacing: 1.8,
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.55)',
                    }}
                  >
                    The Play
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 40,
                      fontWeight: 700,
                      lineHeight: 1.08,
                      color: '#f8fafc',
                    }}
                  >
                    {trade.outcome}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 22, color: 'rgba(255,255,255,0.62)' }}>
                    {trade.marketTitle}
                  </div>
                </div>
                <div
                  style={{
                    borderRadius: 14,
                    background: '#84cc16',
                    color: '#132108',
                    fontSize: 44,
                    lineHeight: 1,
                    fontWeight: 700,
                    padding: '12px 16px',
                    flexShrink: 0,
                  }}
                >
                  {oddsLabel}
                </div>
              </div>

              <div
                style={{
                  marginTop: 18,
                  borderRadius: 22,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'linear-gradient(180deg, rgba(15,23,42,0.72) 0%, rgba(2,6,23,0.6) 100%)',
                  padding: '14px 14px 12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: 'rgba(255,255,255,0.66)',
                    fontSize: 18,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }}
                >
                  <span>Order Flow</span>
                  <span>{flowBars.length} prints</span>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    height: 280,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${flowBars.length}, minmax(0, 1fr))`,
                    gap: 10,
                    alignItems: 'end',
                  }}
                >
                  {flowBars.map((bar, index) => (
                    <div key={`${bar.timestampLabel}-${index}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.84)', fontWeight: 700 }}>
                        {bar.notional}
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: clampedHeight(bar.normalizedHeight) * 2,
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: directionColor(bar.direction),
                        }}
                      />
                      <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.86)' }}>{bar.oddsLabel}</div>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>{bar.timestampLabel}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                <div style={{ borderRadius: 14, border: '1px solid rgba(132,204,22,0.45)', background: 'rgba(132,204,22,0.14)', padding: '12px 12px' }}>
                  <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                    Notional
                  </div>
                  <div style={{ marginTop: 6, fontSize: 32, fontWeight: 700, color: '#bef264' }}>
                    {formatCurrency(trade.notional)}
                  </div>
                </div>
                <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 12px' }}>
                  <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                    Sport
                  </div>
                  <div style={{ marginTop: 6, fontSize: 32, fontWeight: 700, color: '#f1f5f9' }}>{trade.sport}</div>
                </div>
                <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 12px' }}>
                  <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                    ROI %
                  </div>
                  <div style={{ marginTop: 6, fontSize: 30, fontWeight: 700, color: '#86efac' }}>{roiLabel}</div>
                </div>
                <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 12px' }}>
                  <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                    Detected
                  </div>
                  <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{detectedLabel}</div>
                </div>
              </div>
            </div>
          </ShareCardFrame>
        </div>
      </ShareCaptureRoot>
    )
  }
)

ShareableTradeCard.displayName = 'ShareableTradeCard'

export default ShareableTradeCard
