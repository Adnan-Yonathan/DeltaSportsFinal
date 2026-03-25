'use client'

import { forwardRef } from 'react'
import { ShareCaptureRoot, ShareCardFrame } from '@/components/share/ShareCardFrame'
import { extractTeamLogos } from '@/lib/utils/team-logos'

export type ShareableSharpProjection = {
  id: string
  sportLabel: string
  matchup: string
  marketLabel: string
  betLabel: string
  edgeLabel: string
  sharpFairLabel: string
  bookPriceLabel: string
  selectedBookLabel: string
  limitPressureLabel: string
}

const ShareableSharpProjectionCard = forwardRef<
  HTMLDivElement,
  { projection: ShareableSharpProjection }
>(({ projection }, ref) => {
  const logos = extractTeamLogos(projection.matchup, projection.sportLabel)

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
                Sharp Projections
              </div>
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
                {projection.sportLabel}
              </div>
            </div>

            {/* Team logos + Matchup */}
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
                {projection.matchup}
              </div>
            </div>

            {/* Bet + Edge row */}
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
              {/* Edge badge */}
              <div
                style={{
                  width: 110,
                  height: 90,
                  borderRadius: 20,
                  border: '2px solid rgba(52,211,153,0.50)',
                  background: 'rgba(16,185,129,0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: '#86efac' }}>
                  {projection.edgeLabel}
                </div>
                <div style={{ marginTop: 2, fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#86efac', opacity: 0.7 }}>
                  Edge
                </div>
              </div>

              {/* Pick label */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 18, letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
                    {projection.marketLabel}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 42, fontWeight: 700, lineHeight: 1.08, color: '#f8fafc' }}>
                    {projection.betLabel}
                  </div>
                </div>
              </div>

            {/* Stats grid */}
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ borderRadius: 14, border: '1px solid rgba(134,239,172,0.45)', background: 'rgba(16,185,129,0.16)', padding: '12px 14px' }}>
                <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                  Sharp Fair %
                </div>
                <div style={{ marginTop: 6, fontSize: 30, fontWeight: 700, color: '#bef264' }}>
                  {projection.sharpFairLabel || 'n/a'}
                </div>
              </div>
              <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 14px' }}>
                <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                  Book Price
                </div>
                <div style={{ marginTop: 6, fontSize: 30, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.1 }}>
                  {projection.bookPriceLabel || 'n/a'}
                </div>
                <div style={{ marginTop: 4, fontSize: 15, color: 'rgba(255,255,255,0.65)' }}>
                  {projection.selectedBookLabel}
                </div>
              </div>
              <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 14px' }}>
                <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                  Limit Pressure
                </div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>
                  {projection.limitPressureLabel || 'Balanced limits'}
                </div>
              </div>
              <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 14px' }}>
                <div style={{ fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                  Edge vs Book
                </div>
                <div style={{ marginTop: 6, fontSize: 30, fontWeight: 700, color: '#86efac', lineHeight: 1.1 }}>
                  {projection.edgeLabel}
                </div>
              </div>
            </div>
          </div>
        </ShareCardFrame>
      </div>
    </ShareCaptureRoot>
  )
})

ShareableSharpProjectionCard.displayName = 'ShareableSharpProjectionCard'

export default ShareableSharpProjectionCard
