'use client'

import { forwardRef } from 'react'

const FONT_STACK =
  'ui-monospace, "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace'

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
  if (!Number.isFinite(amount)) return '$0'
  const rounded = Math.round(amount * 100) / 100
  const hasCents = Math.abs(rounded % 1) > 0
  return `$${rounded.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
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

const MARKET_SUFFIX_PATTERN =
  /\b(half|quarter|period|inning|set|map|moneyline|ml|spread|total|over|under|winner|to win|points|yards|touchdowns|runs|goals|shots|team|props?)\b/i

const cleanTeamLabel = (value: string) => {
  const trimmed = value.split(':')[0]?.trim() ?? ''
  if (!trimmed) return ''
  const withoutParens = trimmed.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  const normalizedDashes = withoutParens.replace(/[\u2013\u2014]/g, '-')
  const parts = normalizedDashes.split(/\s*-\s*/g)
  if (parts.length > 1) {
    const tail = parts.slice(1).join(' ').toLowerCase()
    if (MARKET_SUFFIX_PATTERN.test(tail)) {
      return parts[0].trim()
    }
  }
  return normalizedDashes
}

const parseTeamsFromTitle = (marketTitle: string) => {
  const match = marketTitle.split(/\s+(?:vs\.?|v\.?|@|at)\s+/i)
  if (match.length !== 2) return null
  const away = cleanTeamLabel(match[0] ?? '')
  const home = cleanTeamLabel(match[1] ?? '')
  if (!away || !home) return null
  return { away, home }
}

const resolveMarketType = (trade: ShareableTradeCardProps['trade']) => {
  const combined = `${trade.outcome} ${trade.marketTitle}`.toLowerCase()
  if (combined.includes('over') || combined.includes('under') || combined.includes('total')) {
    return 'total'
  }
  if (combined.includes('spread') || /[+-]\s?\d/.test(combined)) {
    return 'spread'
  }
  return 'moneyline'
}

const extractSpreadLine = (value: string) => {
  const match = value.match(/([+-]\s?\d+(?:\.\d+)?)/)
  if (!match?.[1]) return null
  return match[1].replace(/\s+/g, '')
}

const findBetTeam = (outcome: string, teams: { away: string; home: string }) => {
  const lower = outcome.toLowerCase()
  const awayLower = teams.away.toLowerCase()
  const homeLower = teams.home.toLowerCase()
  if (lower.includes(awayLower)) return teams.away
  if (lower.includes(homeLower)) return teams.home
  return null
}

const renderHighlightedOutcome = (outcome: string, teamName: string) => {
  const lowerOutcome = outcome.toLowerCase()
  const lowerTeam = teamName.toLowerCase()
  const index = lowerOutcome.indexOf(lowerTeam)
  if (index === -1) return outcome
  const before = outcome.slice(0, index)
  const team = outcome.slice(index, index + teamName.length)
  const after = outcome.slice(index + teamName.length)
  return (
    <>
      {before}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 12px',
          margin: '0 4px',
          borderRadius: 9999,
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#6ee7b7',
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {team}
      </span>
      {after}
    </>
  )
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
    const teams = parseTeamsFromTitle(displayMatchup || trade.marketTitle)
    const betTeam = teams ? findBetTeam(trade.outcome, teams) : null
    const marketType = resolveMarketType(trade)
    const spreadLine =
      marketType === 'spread'
        ? extractSpreadLine(`${trade.outcome} ${trade.marketTitle}`)
        : null
    const outcomeHasLine = /[+-]\s?\d+(?:\.\d+)?/.test(trade.outcome)
    const betLabel =
      betTeam && spreadLine && !outcomeHasLine
        ? (
          <>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 9999,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#6ee7b7',
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {betTeam}
            </span>
            <span style={{ marginLeft: 10, color: '#ffffff', fontWeight: 700 }}>
              {spreadLine}
            </span>
          </>
        )
        : betTeam
          ? renderHighlightedOutcome(trade.outcome, betTeam)
          : trade.outcome

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
            background: '#0a0a0a',
            color: '#ffffff',
            fontFamily: FONT_STACK,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            opacity: 1,
          }}
        >
          {/* Header - deltasports.app prominently centered */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 48px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: '#0a0a0a',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Delta logo - white on black */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  backgroundColor: '#000000',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  fontWeight: 700,
                  color: '#ffffff',
                }}
              >
                Δ
              </div>
              <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: 1, color: '#ffffff' }}>
                deltasports.app
              </span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#34d399', letterSpacing: 0.5 }}>
              Make money betting like a sharp.
            </span>
          </div>

          {/* Content */}
          <div style={{ padding: '32px 48px', flex: 1, backgroundColor: '#0a0a0a' }}>
            {/* Pills Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 28,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    padding: '6px 14px',
                    borderRadius: 9999,
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#6ee7b7',
                  }}
                >
                  {trade.sport}
                </span>
                <span
                  style={{
                    padding: '6px 14px',
                    borderRadius: 9999,
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(96, 165, 250, 0.5)',
                    color: '#bfdbfe',
                  }}
                >
                  {trade.source === 'kalshi' ? 'Kalshi' : 'Polymarket'}
                </span>
              </div>
              <span
                style={{
                  padding: '6px 14px',
                  borderRadius: 9999,
                  fontSize: 14,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                  backgroundColor: tierColors.bg,
                  color: tierColors.text,
                  border: `1px solid ${tierColors.border}`,
                }}
              >
                {tierLabel}
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
              <div style={{ fontSize: 36, fontWeight: 700, color: '#ffffff', marginBottom: 20 }}>
                {displayMatchup}
              </div>

              {/* Bet Details */}
              <div style={{ fontSize: 26, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 30 }}>
                {betLabel}
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
                      Bet Size
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#ffffff' }}>
                      {formatCurrency(trade.notional)}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.6)' }}>
                    {eventDate}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - simple tagline */}
          <div
            style={{
              padding: '20px 48px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: '#0a0a0a',
              textAlign: 'center' as const,
            }}
          >
            <span style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.4)' }}>
              Track sharp money in real-time
            </span>
          </div>
        </div>
      </div>
    )
  }
)

ShareableTradeCard.displayName = 'ShareableTradeCard'

export default ShareableTradeCard
