'use client'

import { forwardRef } from 'react'
import { ShareCaptureRoot, ShareCardFrame } from '@/components/share/ShareCardFrame'
import { SHARP_PROPS_SOURCE_ORDER } from '@/lib/config/odds-sources'

type SourceKey = 'kalshi' | 'polymarket' | 'novig' | 'prophetx'
type SharpBookKey = (typeof SHARP_PROPS_SOURCE_ORDER)[number]

const SOURCE_LOGOS: Record<SourceKey, { label: string; src: string }> = {
  kalshi: { label: 'Kalshi', src: '/kalshi.png' },
  polymarket: { label: 'Polymarket', src: '/polymarket.png' },
  novig: { label: 'NoVig', src: '/Novig.png' },
  prophetx: { label: 'ProphetX', src: '/ProphetX.png' },
}

const SHARP_BOOK_LOGOS: Record<SharpBookKey, { label: string; src?: string }> = {
  polymarket: { label: 'Polymarket', src: '/polymarket.png' },
  kalshi: { label: 'Kalshi', src: '/kalshi.png' },
  novig: { label: 'NoVig', src: '/Novig.png' },
  fanduel: { label: 'FanDuel', src: '/fanduel.png' },
  circa: { label: 'Circa', src: '/circasports.png' },
  prophetx: { label: 'ProphetX', src: '/ProphetX.png' },
  prizepicks: { label: 'PrizePicks', src: '/prizepicks.png' },
  underdog: { label: 'Underdog', src: '/underdogfantasy.png' },
  draftkings_pick6: { label: 'Pick6', src: '/pick6.png' },
  sleeper: { label: 'Sleeper', src: '/sleeper.png' },
}

export type ShareableSharpPropsToolPayload = {
  id: string
  sportLabel: string
  matchup: string
  sourceKeys: SourceKey[]
  whaleVolumeLabel: string
  playLabel: string
  playOddsLabel: string
  playSubtext: string
  playerImageUrl?: string | null
  playerInitials: string
  sharpBookOdds: Array<{
    key: SharpBookKey
    oddsLabel: string
  }>
  liquidityLevels: Array<{
    id: string
    priceLabel: string
    notionalLabel: string
    side: 'Over' | 'Under' | 'Neutral'
    normalizedHeight: number
  }>
  lineMarker?: string | null
}

const sideBarColor = (side: 'Over' | 'Under' | 'Neutral') => {
  if (side === 'Over') return 'linear-gradient(90deg, #34d399 0%, #10b981 100%)'
  if (side === 'Under') return 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
  return 'linear-gradient(90deg, #6ee7b7 0%, #10b981 100%)'
}

const levelHeight = (value: number) => Math.max(16, Math.min(100, Math.round(value)))

const ShareableSharpPropsToolCard = forwardRef<
  HTMLDivElement,
  { payload: ShareableSharpPropsToolPayload }
>(({ payload }, ref) => {
  const levels = payload.liquidityLevels.slice(0, 10)
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.08 }}>{payload.matchup}</div>
                <div style={{ marginTop: 6, fontSize: 22, color: 'rgba(255,255,255,0.64)' }}>{payload.sportLabel}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {payload.sourceKeys.map((source) => {
                  const logo = SOURCE_LOGOS[source]
                  return (
                    <div
                      key={`source-${payload.id}-${source}`}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        border: '1px solid rgba(255, 255, 255, 0.16)',
                        background: 'rgba(0,0,0,0.5)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img src={logo.src} alt={logo.label} style={{ width: 25, height: 25, objectFit: 'contain' }} />
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: '#86efac' }}>
                {payload.whaleVolumeLabel}
              </div>
              <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.62)' }}>Net liquidity on this market</div>
            </div>

            <div
              style={{
                marginTop: 14,
                borderRadius: 22,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(0,0,0,0.44)',
                padding: '14px 14px 13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.16)',
                    overflow: 'hidden',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {payload.playerImageUrl ? (
                    <img src={payload.playerImageUrl} alt="Player" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{payload.playerInitials}</span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.56)' }}>
                    The Play
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 34,
                      lineHeight: 1.08,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 690,
                    }}
                  >
                    {payload.playLabel}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 20, color: 'rgba(255,255,255,0.6)' }}>{payload.playSubtext}</div>
                </div>
              </div>
              <div
                style={{
                  borderRadius: 14,
                  background: '#84cc16',
                  color: '#132108',
                  fontSize: 42,
                  lineHeight: 1,
                  fontWeight: 700,
                  padding: '11px 14px',
                  flexShrink: 0,
                }}
              >
                {payload.playOddsLabel}
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                borderRadius: 22,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'linear-gradient(180deg, rgba(6, 18, 14, 0.78) 0%, rgba(2, 8, 7, 0.62) 100%)',
                padding: '14px 14px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 17, letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)' }}>
                  Liquidity by Price
                </div>
                {payload.lineMarker ? (
                  <div style={{ fontSize: 19, color: 'rgba(255,255,255,0.72)' }}>Line {payload.lineMarker}</div>
                ) : null}
              </div>

              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(levels.length
                  ? levels
                  : [{ id: 'empty', priceLabel: '--', notionalLabel: '--', side: 'Neutral' as const, normalizedHeight: 20 }]
                ).map((level) => (
                  <div
                    key={level.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px minmax(0,1fr) 120px',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.88)', fontWeight: 700 }}>
                      {level.priceLabel}
                    </div>
                    <div
                      style={{
                        height: 20,
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(15, 23, 42, 0.65)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(8, Math.min(100, levelHeight(level.normalizedHeight)))}%`,
                          height: '100%',
                          borderRadius: 8,
                          background: sideBarColor(level.side),
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        color: 'rgba(255,255,255,0.84)',
                        fontWeight: 700,
                        textAlign: 'right',
                      }}
                    >
                      {level.notionalLabel}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ShareCardFrame>
      </div>
    </ShareCaptureRoot>
  )
})

ShareableSharpPropsToolCard.displayName = 'ShareableSharpPropsToolCard'

export default ShareableSharpPropsToolCard
