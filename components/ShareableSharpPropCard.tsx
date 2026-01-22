'use client'

import { forwardRef } from 'react'
import { VerificationCard } from '@/components/ui/verification-card'

export type ShareableSharpProp = {
  id: string
  sportLabel: string
  playerName: string
  propLabel: string
  edgeLabel: string
  scoreLabel: string
  predOddsLabel: string
  bookOddsLabel: string
  volumeLabel: string
  sourcesLabel: string
}

const CARD_BACKGROUND = '/sportsbook.jpg'

const ShareableSharpPropCard = forwardRef<
  HTMLDivElement,
  { prop: ShareableSharpProp }
>(({ prop }, ref) => {
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
                Sharp prop snapshot
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
              Market
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{prop.propLabel}</div>
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
              label={`${prop.sportLabel} SHARP PROP`}
              idNumber={`GRADE ${prop.scoreLabel}`}
              name={prop.playerName}
              validThru={prop.propLabel}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

ShareableSharpPropCard.displayName = 'ShareableSharpPropCard'

export default ShareableSharpPropCard
