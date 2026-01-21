'use client'

import { forwardRef } from 'react'

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
              Sharp Projections
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
            {projection.sportLabel}
          </span>
        </div>

        <div style={{ padding: '32px 48px', flex: 1 }}>
          <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 18 }}>
            {projection.matchup}
          </div>
          <div
            style={{
              fontSize: 22,
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: 28,
            }}
          >
            {projection.filterLabel}
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
                Projection
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#ffffff' }}>
                {projection.pickLabel}
              </div>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 16,
                  color: 'rgba(255, 255, 255, 0.6)',
                }}
              >
                Best odds
              </div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {projection.oddsLabel}
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
              <div style={{ fontSize: 42, fontWeight: 700, color: '#34d399' }}>
                {projection.edgeLabel}
              </div>
              {projection.sharpSummary && (
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.55)',
                  }}
                >
                  {projection.sharpSummary}
                </div>
              )}
              {projection.moveSummary && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.45)',
                  }}
                >
                  {projection.moveSummary}
                </div>
              )}
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
            Track sharp projections and best book prices in real-time.
          </span>
        </div>
      </div>
    </div>
  )
})

ShareableSharpProjectionCard.displayName = 'ShareableSharpProjectionCard'

export default ShareableSharpProjectionCard
