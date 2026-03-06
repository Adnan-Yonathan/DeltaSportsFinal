'use client'

import { forwardRef } from 'react'

const FONT_STACK =
  'ui-monospace, "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace'

type SourceKey = 'kalshi' | 'polymarket' | 'novig' | 'prophetx'
type SharpBookKey = SourceKey | 'pinnacle'

const SOURCE_LOGOS: Record<SourceKey, { label: string; src: string }> = {
  kalshi: { label: 'Kalshi', src: '/kalshi.png' },
  polymarket: { label: 'Polymarket', src: '/polymarket.png' },
  novig: { label: 'NoVig', src: '/Novig.png' },
  prophetx: { label: 'ProphetX', src: '/ProphetX.png' },
}

const SHARP_BOOK_LOGOS: Record<SharpBookKey, { label: string; src: string }> = {
  prophetx: { label: 'ProphetX', src: '/ProphetX.png' },
  novig: { label: 'NoVig', src: '/Novig.png' },
  polymarket: { label: 'Polymarket', src: '/polymarket.png' },
  kalshi: { label: 'Kalshi', src: '/kalshi.png' },
  pinnacle: { label: 'Pinnacle', src: '/pinnacle.jpg' },
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
  ladderSummaryLabel: string
  ladderRows: Array<{
    id: string
    sideLabel: string
    oddsLabel: string
    volumeLabel: string
    widthPct: number
    sourceKeys: SourceKey[]
  }>
}

const ShareableSharpPropsToolCard = forwardRef<
  HTMLDivElement,
  { payload: ShareableSharpPropsToolPayload }
>(({ payload }, ref) => {
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
          color: '#ffffff',
          fontFamily: FONT_STACK,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: 1,
          position: 'relative',
          background:
            'radial-gradient(circle at 20% 0%, rgba(22, 163, 74, 0.2), transparent 45%), #02050c',
          border: '1px solid rgba(255, 255, 255, 0.07)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '22px 26px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                borderRadius: 999,
                border: '1px solid rgba(255, 255, 255, 0.18)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                padding: '6px 12px',
                fontSize: 12,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.75)',
              }}
            >
              {payload.sportLabel}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {payload.sourceKeys.map((source) => {
                const logo = SOURCE_LOGOS[source]
                return (
                  <div
                    key={`source-${payload.id}-${source}`}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      backgroundColor: '#03070f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                    title={logo.label}
                  >
                    <img
                      src={logo.src}
                      alt={logo.label}
                      style={{ width: 24, height: 24, objectFit: 'contain' }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ fontSize: 13, letterSpacing: 2, color: 'rgba(255, 255, 255, 0.48)' }}>
            SHARP PROPS
          </div>
        </div>

        <div style={{ padding: '0 26px', fontSize: 46, fontWeight: 700, lineHeight: 1.1 }}>
          {payload.matchup}
        </div>

        <div style={{ padding: '12px 26px 0', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1, color: '#a3e635' }}>
            {payload.whaleVolumeLabel}
          </div>
          <div style={{ fontSize: 25, color: 'rgba(255, 255, 255, 0.58)' }}>Whale Volume</div>
        </div>

        <div
          style={{
            margin: '18px 26px 0',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backgroundColor: 'rgba(0, 0, 0, 0.46)',
            padding: '12px 14px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.55)',
              marginBottom: 8,
            }}
          >
            Sharp Books Live Odds
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {payload.sharpBookOdds.map((book) => {
              const logo = SHARP_BOOK_LOGOS[book.key]
              return (
                <div
                  key={`book-${payload.id}-${book.key}`}
                  style={{
                    borderRadius: 12,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(2, 8, 20, 0.9)',
                    padding: '7px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 6,
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={logo.src}
                      alt={logo.label}
                      style={{ width: 23, height: 23, objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#a3e635', lineHeight: 1 }}>
                    {book.oddsLabel}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div
          style={{
            margin: '12px 26px 0',
            borderRadius: 14,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backgroundColor: 'rgba(0, 0, 0, 0.52)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: '#a3e635',
                marginBottom: 7,
              }}
            >
              The Play
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {payload.playerImageUrl ? (
                  <img
                    src={payload.playerImageUrl}
                    alt="Player"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255, 255, 255, 0.78)' }}>
                    {payload.playerInitials}
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    lineHeight: 1.15,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 700,
                  }}
                >
                  {payload.playLabel}
                </div>
                <div style={{ marginTop: 4, fontSize: 18, color: 'rgba(255, 255, 255, 0.52)' }}>
                  {payload.playSubtext}
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              borderRadius: 10,
              backgroundColor: '#84cc16',
              color: '#0b1100',
              fontSize: 34,
              fontWeight: 700,
              padding: '10px 14px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {payload.playOddsLabel}
          </div>
        </div>

        <div style={{ margin: '12px 26px 0', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.52)',
              }}
            >
              Recommended Side Liquidity
            </div>
            <div style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.64)' }}>{payload.ladderSummaryLabel}</div>
          </div>

          <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {payload.ladderRows.map((row) => (
              <div
                key={`ladder-${payload.id}-${row.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '200px minmax(0, 1fr) 84px',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {row.sourceKeys.slice(0, 3).map((source) => {
                      const logo = SOURCE_LOGOS[source]
                      return (
                        <div
                          key={`ladder-logo-${row.id}-${source}`}
                          style={{
                            width: 23,
                            height: 23,
                            borderRadius: 5,
                            border: '1px solid rgba(255, 255, 255, 0.14)',
                            backgroundColor: 'rgba(0, 0, 0, 0.55)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          <img
                            src={logo.src}
                            alt={logo.label}
                            style={{ width: 17, height: 17, objectFit: 'contain' }}
                          />
                        </div>
                      )
                    })}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: 1.2,
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.46)',
                      }}
                    >
                      {row.sideLabel}
                    </div>
                    <div style={{ fontSize: 21, fontWeight: 700, color: '#a3e635', lineHeight: 1 }}>
                      {row.oddsLabel}
                    </div>
                  </div>
                <div
                  style={{
                    height: 17,
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(4, 11, 24, 0.76)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${row.widthPct}%`,
                      height: '100%',
                      borderRadius: 8,
                      background:
                        'linear-gradient(90deg, rgba(120, 173, 19, 0.75) 0%, rgba(166, 237, 59, 0.95) 100%)',
                    }}
                  />
                </div>
                <div style={{ fontSize: 20, textAlign: 'right', color: 'rgba(255, 255, 255, 0.72)' }}>
                  {row.volumeLabel}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            right: 22,
            bottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderRadius: 999,
            border: '1px solid rgba(255, 255, 255, 0.17)',
            backgroundColor: 'rgba(0, 0, 0, 0.56)',
            padding: '7px 12px',
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 5,
              border: '1px solid rgba(255, 255, 255, 0.25)',
              overflow: 'hidden',
              backgroundColor: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img src="/delta-logo.png" alt="Delta Sports" style={{ width: 15, height: 15, objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.95)' }}>deltasports.app</span>
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.62)' }}>follow the money</span>
          </div>
        </div>
      </div>
    </div>
  )
})

ShareableSharpPropsToolCard.displayName = 'ShareableSharpPropsToolCard'

export default ShareableSharpPropsToolCard
