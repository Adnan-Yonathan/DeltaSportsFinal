'use client'

export type SeriesCoverData = {
  seriesName: string
  subtitle: string
}

export default function SeriesCover({ data }: { data: SeriesCoverData }) {
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Content at bottom */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          marginTop: 'auto',
          padding: '0 0 40px 0',
        }}
      >
        {/* Series name */}
        <div
          style={{
            fontSize: 86,
            fontWeight: 800,
            lineHeight: 0.95,
            textTransform: 'uppercase',
            letterSpacing: -1,
            color: '#ffffff',
            textShadow: '0 4px 30px rgba(0,0,0,0.5)',
          }}
        >
          {data.seriesName || 'Series Name'}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: 'rgba(255,255,255,0.7)',
            marginTop: 14,
            fontWeight: 500,
          }}
        >
          {data.subtitle || 'Subtitle goes here'}
        </div>
      </div>
    </div>
  )
}
