'use client'

import { forwardRef } from 'react'
import { ShareCaptureRoot, ShareCardFrame } from '@/components/share/ShareCardFrame'
import { extractTeamLogos } from '@/lib/utils/team-logos'

export interface ShareableInsiderBet {
  id: string
  title: string
  outcome: string
  sportLabel: string | null
  avgEntryPrice: number
  americanOdds: number | null
  stakeUsd: number
  potentialPayoutUsd: number
  insiderScore: number
  sizeRatio: number
  walletRoiPct: number
  walletTradeCount: number
  displayName: string
  profileImageUrl: string | null
  lastTradeTime: string | null
}

const formatCurrency = (amount: number): string => {
  if (!Number.isFinite(amount)) return '$0'
  if (amount >= 1000)
    return `$${(amount / 1000).toFixed(1)}k`
  const rounded = Math.round(amount * 100) / 100
  const hasCents = Math.abs(rounded % 1) > 0
  return `$${rounded.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

const formatOdds = (price: number, americanOdds: number | null): string => {
  if (americanOdds != null && Number.isFinite(americanOdds)) {
    const sign = americanOdds >= 0 ? '+' : ''
    return `${sign}${Math.round(americanOdds)}`
  }
  if (price >= 0.5) return `-${Math.round((price / (1 - price)) * 100)}`
  return `+${Math.round(((1 - price) / price) * 100)}`
}

const formatPct = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}%`

const formatTimestamp = (value: string | null): string => {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const scoreTier = (score: number) => {
  if (score >= 90) return { label: 'Elite', bg: 'rgba(255,255,255,0.10)', border: 'rgba(255,255,255,0.40)', color: '#ffffff', glow: '0 0 12px rgba(255,255,255,0.18)' }
  if (score >= 80) return { label: 'Sharp', bg: 'rgba(16,185,129,0.15)', border: 'rgba(52,211,153,0.50)', color: '#86efac', glow: 'none' }
  return { label: 'Notable', bg: 'rgba(245,158,11,0.10)', border: 'rgba(251,191,36,0.40)', color: '#fcd34d', glow: 'none' }
}

const ShareableInsiderBetCard = forwardRef<HTMLDivElement, { bet: ShareableInsiderBet }>(
  ({ bet }, ref) => {
    const logos = extractTeamLogos(bet.title, bet.sportLabel)
    const tier = scoreTier(bet.insiderScore)
    const oddsLabel = formatOdds(bet.avgEntryPrice, bet.americanOdds)
    const roiLabel = formatPct(bet.walletRoiPct)
    const detectedLabel = formatTimestamp(bet.lastTradeTime)

    return (
      <ShareCaptureRoot>
        <div ref={ref}>
          <ShareCardFrame accent="emerald">
            <div
              style={{
                marginTop: 72,
                borderRadius: 38,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(2, 6, 23, 0.84)',
                padding: '28px 28px 24px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
              }}
            >
              {/* Header: label + sport pill */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 20, letterSpacing: 2.1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                  Insider Feed
                </div>
                {bet.sportLabel && (
                  <div
                    style={{
                      borderRadius: 999,
                      border: '1px solid rgba(52, 211, 153, 0.45)',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#86efac',
                      padding: '8px 14px',
                      fontSize: 19,
                      fontWeight: 700,
                      letterSpacing: 1.2,
                    }}
                  >
                    {bet.sportLabel}
                  </div>
                )}
              </div>

              {/* Team logos + Market title */}
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                {logos.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {logos.map((logo, i) => (
                      <img
                        key={logo.abbreviation}
                        src={logo.logoUrl}
                        alt={logo.name}
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 999,
                          objectFit: 'contain',
                          border: '2px solid rgba(255,255,255,0.15)',
                          background: 'rgba(0,0,0,0.5)',
                          marginLeft: i > 0 ? -12 : 0,
                        }}
                      />
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.06, color: '#f8fafc', minWidth: 0 }}>
                  {bet.title}
                </div>
              </div>

              {/* Score badge + outcome + odds */}
              <div
                style={{
                  marginTop: 18,
                  borderRadius: 22,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(0,0,0,0.44)',
                  padding: '18px 18px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                {/* Score badge */}
                <div
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: 20,
                    border: `2px solid ${tier.border}`,
                    background: tier.bg,
                    boxShadow: tier.glow,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: tier.color }}>{bet.insiderScore}</div>
                  <div style={{ marginTop: 2, fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: tier.color, opacity: 0.7 }}>
                    {tier.label}
                  </div>
                </div>

                {/* Outcome + odds */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 18, letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
                    The Position
                  </div>
                  <div style={{ marginTop: 6, fontSize: 42, fontWeight: 700, lineHeight: 1.08, color: '#f8fafc' }}>
                    {bet.outcome}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 22, color: 'rgba(255,255,255,0.6)' }}>
                    {(bet.avgEntryPrice * 100).toFixed(0)}c avg entry
                  </div>
                </div>

                {/* Odds pill */}
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

              {/* Wallet section */}
              <div
                style={{
                  marginTop: 16,
                  borderRadius: 22,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'linear-gradient(180deg, rgba(15,23,42,0.72) 0%, rgba(2,6,23,0.6) 100%)',
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {bet.profileImageUrl ? (
                    <img
                      src={bet.profileImageUrl}
                      alt={bet.displayName}
                      style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.10)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {bet.displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>{bet.displayName}</div>
                    <div style={{ marginTop: 2, fontSize: 18, color: 'rgba(255,255,255,0.45)' }}>
                      Last traded {detectedLabel}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                <div style={{ borderRadius: 14, border: '1px solid rgba(132,204,22,0.45)', background: 'rgba(132,204,22,0.14)', padding: '12px 12px' }}>
                  <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                    Stake
                  </div>
                  <div style={{ marginTop: 6, fontSize: 30, fontWeight: 700, color: '#bef264' }}>
                    {formatCurrency(bet.stakeUsd)}
                  </div>
                </div>
                <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 12px' }}>
                  <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                    To Win
                  </div>
                  <div style={{ marginTop: 6, fontSize: 30, fontWeight: 700, color: '#86efac' }}>
                    {formatCurrency(bet.potentialPayoutUsd)}
                  </div>
                </div>
                <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 12px' }}>
                  <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                    ROI
                  </div>
                  <div style={{ marginTop: 6, fontSize: 30, fontWeight: 700, color: '#86efac' }}>
                    {roiLabel}
                  </div>
                </div>
                <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 12px' }}>
                  <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                    Size
                  </div>
                  <div style={{ marginTop: 6, fontSize: 30, fontWeight: 700, color: '#f1f5f9' }}>
                    {bet.sizeRatio}x
                  </div>
                </div>
              </div>
            </div>
          </ShareCardFrame>
        </div>
      </ShareCaptureRoot>
    )
  }
)

ShareableInsiderBetCard.displayName = 'ShareableInsiderBetCard'

export default ShareableInsiderBetCard
