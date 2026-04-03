'use client'

export type SharpPropData = {
  sportLabel: string
  playerName: string
  teamName: string
  playerImageUrl: string | null
  propLabel: string
  predOdds: string
  bookOdds: string
  edge: string
  score: string
  volume: string
  sources: string
  metricBars: Array<{ label: string; value: string; height: number }>
}

export default function SharpPropsCard({ data }: { data: SharpPropData }) {
  const bars = data.metricBars.length > 0
    ? data.metricBars
    : [
        { label: 'Pred', value: data.predOdds || '-110', height: 72 },
        { label: 'Books', value: data.bookOdds || '-105', height: 60 },
        { label: 'Edge', value: data.edge || '8.2%', height: 84 },
        { label: 'Score', value: data.score || '87', height: 76 },
      ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
          Sharp Props
        </div>
        <div
          style={{
            borderRadius: 999,
            border: '1px solid rgba(52, 211, 153, 0.45)',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#86efac',
            padding: '8px 18px',
            fontSize: 20,
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          {data.sportLabel || 'NBA'}
        </div>
      </div>

      {/* Main card */}
      <div
        style={{
          marginTop: 36,
          borderRadius: 32,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(2, 6, 23, 0.8)',
          padding: '32px 28px 28px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        }}
      >
        {/* Player info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              overflow: 'hidden',
              border: '3px solid rgba(52,211,153,0.4)',
              background: 'rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}
          >
            {data.playerImageUrl ? (
              <img src={data.playerImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: 'rgba(255,255,255,0.3)' }}>?</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.1 }}>{data.playerName || 'Player Name'}</div>
            <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{data.teamName || 'Team'}</div>
          </div>
        </div>

        {/* Prop label */}
        <div style={{ marginTop: 16, fontSize: 28, color: '#86efac', fontWeight: 600 }}>
          {data.propLabel || 'Over 24.5 Points'}
        </div>

        {/* Pred Odds / Book Odds grid */}
        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(2,8,20,0.78)', padding: '12px 14px' }}>
            <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Pred Odds</div>
            <div style={{ marginTop: 5, fontSize: 36, fontWeight: 700, color: '#f8fafc' }}>{data.predOdds || '-110'}</div>
          </div>
          <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(2,8,20,0.78)', padding: '12px 14px' }}>
            <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Book Odds</div>
            <div style={{ marginTop: 5, fontSize: 36, fontWeight: 700, color: '#f8fafc' }}>{data.bookOdds || '-105'}</div>
          </div>
        </div>

        {/* Signal bars */}
        <div
          style={{
            marginTop: 16,
            borderRadius: 20,
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
              height: 200,
              display: 'grid',
              gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`,
              gap: 10,
              alignItems: 'end',
            }}
          >
            {bars.map((bar, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.84)', fontWeight: 700 }}>{bar.value}</div>
                <div
                  style={{
                    width: '100%',
                    height: Math.max(18, Math.min(100, bar.height)) * 2,
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

        {/* Bottom stats: Edge, Score, Volume */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <div style={{ borderRadius: 14, border: '1px solid rgba(132,204,22,0.45)', background: 'rgba(132,204,22,0.14)', padding: '12px 11px' }}>
            <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.56)' }}>Edge</div>
            <div style={{ marginTop: 5, fontSize: 30, fontWeight: 700, color: '#bef264' }}>{data.edge || '8.2%'}</div>
          </div>
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 11px' }}>
            <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.56)' }}>Score</div>
            <div style={{ marginTop: 5, fontSize: 30, fontWeight: 700, color: '#f1f5f9' }}>{data.score || '87'}</div>
          </div>
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 11px' }}>
            <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.56)' }}>Volume</div>
            <div style={{ marginTop: 5, fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{data.volume || '12'}</div>
          </div>
        </div>

        {/* Sources */}
        <div style={{ marginTop: 10, fontSize: 18, color: 'rgba(255,255,255,0.45)' }}>
          Sources: {data.sources || 'Polymarket, Kalshi, Novig'}
        </div>
      </div>

      <div style={{ flex: 1 }} />
    </div>
  )
}
