'use client'

import { forwardRef } from 'react'
import { ShareCaptureRoot, ShareCardFrame } from '@/components/share/ShareCardFrame'

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
  metricBars?: Array<{
    id: string
    label: string
    valueLabel: string
    normalizedHeight: number
  }>
}

const barHeight = (value: number) => Math.max(18, Math.min(100, Math.round(value)))

const ShareableSharpPropCard = forwardRef<
  HTMLDivElement,
  { prop: ShareableSharpProp }
>(({ prop }, ref) => {
  const bars =
    prop.metricBars && prop.metricBars.length > 0
      ? prop.metricBars.slice(0, 5)
      : [
          { id: 'pred', label: 'Pred', valueLabel: prop.predOddsLabel, normalizedHeight: 72 },
          { id: 'books', label: 'Books', valueLabel: prop.bookOddsLabel, normalizedHeight: 60 },
          { id: 'edge', label: 'Edge', valueLabel: prop.edgeLabel, normalizedHeight: 84 },
          { id: 'score', label: 'Score', valueLabel: prop.scoreLabel, normalizedHeight: 76 },
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
              padding: '24px 24px 22px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 20, letterSpacing: 2.1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                Sharp Props
              </div>
              <div
                style={{
                  borderRadius: 999,
                  border: '1px solid rgba(52, 211, 153, 0.45)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#86efac',
                  padding: '8px 12px',
                  fontSize: 19,
                  fontWeight: 700,
                }}
              >
                {prop.sportLabel}
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 46, fontWeight: 700, lineHeight: 1.06 }}>{prop.playerName}</div>
            <div style={{ marginTop: 7, fontSize: 28, color: 'rgba(255,255,255,0.68)' }}>{prop.propLabel}</div>

            <div
              style={{
                marginTop: 16,
                borderRadius: 22,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(0,0,0,0.44)',
                padding: '14px 14px 13px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(2,8,20,0.78)', padding: '10px 11px' }}>
                <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Pred Odds</div>
                <div style={{ marginTop: 5, fontSize: 36, fontWeight: 700, color: '#f8fafc' }}>{prop.predOddsLabel}</div>
              </div>
              <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(2,8,20,0.78)', padding: '10px 11px' }}>
                <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Book Odds</div>
                <div style={{ marginTop: 5, fontSize: 36, fontWeight: 700, color: '#f8fafc' }}>{prop.bookOddsLabel}</div>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                borderRadius: 22,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'linear-gradient(180deg, rgba(15,23,42,0.72) 0%, rgba(2,6,23,0.6) 100%)',
                padding: '14px 14px 12px',
              }}
            >
              <div style={{ fontSize: 17, letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)' }}>
                Signal Structure
              </div>
              <div
                style={{
                  marginTop: 12,
                  height: 250,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`,
                  gap: 10,
                  alignItems: 'end',
                }}
              >
                {bars.map((bar) => (
                  <div key={bar.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.84)', fontWeight: 700 }}>{bar.valueLabel}</div>
                    <div
                      style={{
                        width: '100%',
                        height: barHeight(bar.normalizedHeight) * 2,
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'linear-gradient(180deg, #34d399 0%, #10b981 100%)',
                      }}
                    />
                    <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase' }}>{bar.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div style={{ borderRadius: 14, border: '1px solid rgba(132,204,22,0.45)', background: 'rgba(132,204,22,0.14)', padding: '12px 11px' }}>
                <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.56)' }}>Edge</div>
                <div style={{ marginTop: 5, fontSize: 30, fontWeight: 700, color: '#bef264' }}>{prop.edgeLabel}</div>
              </div>
              <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 11px' }}>
                <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.56)' }}>Score</div>
                <div style={{ marginTop: 5, fontSize: 30, fontWeight: 700, color: '#f1f5f9' }}>{prop.scoreLabel}</div>
              </div>
              <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 11px' }}>
                <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.56)' }}>Volume</div>
                <div style={{ marginTop: 5, fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{prop.volumeLabel}</div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>
              Sources: {prop.sourcesLabel}
            </div>
          </div>
        </ShareCardFrame>
      </div>
    </ShareCaptureRoot>
  )
})

ShareableSharpPropCard.displayName = 'ShareableSharpPropCard'

export default ShareableSharpPropCard
