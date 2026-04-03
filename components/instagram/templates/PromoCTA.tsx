'use client'

export type PromoCTAData = {
  headline: string
  ctaText: string
  subtitle: string
}

export default function PromoCTA({ data }: { data: PromoCTAData }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        textAlign: 'center',
        gap: 0,
      }}
    >
      {/* Headline */}
      <div
        style={{
          fontSize: 62,
          fontWeight: 800,
          lineHeight: 1.1,
          color: '#ffffff',
          maxWidth: 900,
          textTransform: 'uppercase',
        }}
      >
        {data.headline || 'Get Your Edge'}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 26,
          color: 'rgba(255,255,255,0.6)',
          marginTop: 20,
          maxWidth: 700,
        }}
      >
        {data.subtitle || 'Find profitable bets by tracking sharp money'}
      </div>

      {/* CTA button */}
      <div
        style={{
          marginTop: 48,
          borderRadius: 18,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          padding: '22px 56px',
          fontSize: 30,
          fontWeight: 700,
          color: '#000000',
          boxShadow: '0 8px 30px rgba(16,185,129,0.35)',
        }}
      >
        {data.ctaText || 'Try Free for 7 Days'}
      </div>
    </div>
  )
}
