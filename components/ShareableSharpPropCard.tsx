'use client'

import { forwardRef } from 'react'

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
          background: '#0a0a0a',
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
            padding: '24px 48px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: '#0a0a0a',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: 0.5 }}>
              deltasports.app
            </span>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#34d399' }}>
              Sharp Props
            </span>
          </div>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#34d399',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              borderRadius: 9999,
              padding: '6px 14px',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {prop.sportLabel}
          </span>
        </div>

        <div style={{ padding: '32px 48px', flex: 1 }}>
          <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 10 }}>
            {prop.playerName}
          </div>
          <div
            style={{
              fontSize: 22,
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: 24,
            }}
          >
            {prop.propLabel}
          </div>

          <div
            style={{
              borderRadius: 24,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: 32,
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: 24,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 18,
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: 6,
                }}
              >
                Odds
              </div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>
                Pred {prop.predOddsLabel}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, marginTop: 10 }}>
                Books {prop.bookOddsLabel}
              </div>
              <div
                style={{
                  marginTop: 18,
                  fontSize: 14,
                  color: 'rgba(255, 255, 255, 0.55)',
                }}
              >
                Sources: {prop.sourcesLabel}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 18,
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: 6,
                }}
              >
                Edge
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#34d399' }}>
                {prop.edgeLabel}
              </div>
              <div style={{ marginTop: 12, fontSize: 18, color: '#ffffff' }}>
                Score {prop.scoreLabel}
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 14,
                  color: 'rgba(255, 255, 255, 0.55)',
                }}
              >
                Volume {prop.volumeLabel}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '20px 48px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: '#0a0a0a',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.4)' }}>
            Follow sharp prop bettors with verified market signals.
          </span>
        </div>
      </div>
    </div>
  )
})

ShareableSharpPropCard.displayName = 'ShareableSharpPropCard'

export default ShareableSharpPropCard
