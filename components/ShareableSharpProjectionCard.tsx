'use client'

import { forwardRef } from 'react'
import { VerificationCard } from '@/components/ui/verification-card'

export type ShareableSharpProjection = {
  id: string
  sportLabel: string
  matchup: string
  filterLabel: string
  pickLabel: string
  edgeLabel: string
  oddsLabel: string
  sharpSummary?: string
  moveSummary?: string
}

const CARD_BACKGROUND = '/sportsbook.jpg'

const ShareableSharpProjectionCard = forwardRef<
  HTMLDivElement,
  { projection: ShareableSharpProjection }
>(({ projection }, ref) => {
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
                Projection snapshot
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
              Market
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{projection.filterLabel}</div>
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
            <VerificationCard
              backgroundImage={CARD_BACKGROUND}
              backgroundPosition="right top"
              label={`${projection.sportLabel} PROJECTION`}
              idNumber={`EDGE ${projection.edgeLabel}`}
              name={projection.matchup}
              validThru={projection.pickLabel}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

ShareableSharpProjectionCard.displayName = 'ShareableSharpProjectionCard'

export default ShareableSharpProjectionCard
