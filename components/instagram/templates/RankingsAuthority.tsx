'use client'

export type RankingEntry = { rank: number; label: string; value: string }

export type RankingsData = {
  headline: string
  entries: RankingEntry[]
  badgeText: string
}

export default function RankingsAuthority({ data }: { data: RankingsData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignSelf: 'flex-start',
            borderRadius: 999,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(52, 211, 153, 0.4)',
            padding: '8px 20px',
            fontSize: 20,
            fontWeight: 700,
            color: '#86efac',
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}
        >
          {data.badgeText || 'DELTA SPORTS'}
        </div>

        {/* Headline */}
        <div
          style={{
            marginTop: 36,
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1,
            textTransform: 'uppercase',
            color: '#ffffff',
            letterSpacing: -1,
          }}
        >
          {data.headline || 'TOP SHARP PLAYS'}
        </div>

        {/* Ranking entries */}
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(data.entries.length > 0 ? data.entries : [
            { rank: 1, label: 'Pick 1', value: 'W' },
            { rank: 2, label: 'Pick 2', value: 'W' },
            { rank: 3, label: 'Pick 3', value: 'L' },
          ]).map((entry, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.4)',
                padding: '20px 24px',
              }}
            >
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  color: '#34d399',
                  minWidth: 50,
                  textAlign: 'center',
                }}
              >
                {entry.rank}
              </div>
              <div style={{ flex: 1, fontSize: 28, fontWeight: 600, color: '#f1f5f9' }}>
                {entry.label}
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: entry.value.toUpperCase() === 'W' || entry.value.toUpperCase() === 'WIN'
                    ? '#34d399'
                    : entry.value.toUpperCase() === 'L' || entry.value.toUpperCase() === 'LOSS'
                      ? '#f87171'
                      : '#86efac',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  padding: '6px 16px',
                }}
              >
                {entry.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />
      </div>
    </div>
  )
}
