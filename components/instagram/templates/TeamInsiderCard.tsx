'use client'

export type TeamInsiderData = {
  sportLabel: string
  matchupTitle: string
  outcome: string
  teamImageUrl: string | null
  insiderScore: string
  stakeUsd: string
  toWinUsd: string
  walletRoi: string
  sizeRatio: string
  totalBets: string
  totalWagered: string
  odds: string
  feedType: 'insider' | 'whale'
}

export default function TeamInsiderCard({ data }: { data: TeamInsiderData }) {
  const score = parseInt(data.insiderScore) || 0
  const tier = score >= 90
    ? { label: 'Elite', border: 'rgba(255,255,255,0.40)', bg: 'rgba(255,255,255,0.10)', color: '#ffffff', glow: '0 0 12px rgba(255,255,255,0.18)' }
    : score >= 80
      ? { label: 'Sharp', border: 'rgba(52,211,153,0.50)', bg: 'rgba(16,185,129,0.15)', color: '#86efac', glow: 'none' }
      : { label: 'Notable', border: 'rgba(251,191,36,0.40)', bg: 'rgba(245,158,11,0.10)', color: '#fcd34d', glow: 'none' }

  const feedLabel = data.feedType === 'whale' ? 'Whale Feed' : 'Insider Feed'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
          {feedLabel}
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
        {/* Team image + matchup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {data.teamImageUrl && (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 16,
                overflow: 'hidden',
                border: '2px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.5)',
                flexShrink: 0,
              }}
            >
              <img src={data.teamImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>{data.matchupTitle || 'LAL vs BOS'}</div>
          </div>
        </div>

        {/* Score badge + outcome + odds */}
        <div
          style={{
            marginTop: 20,
            borderRadius: 22,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.44)',
            padding: '18px 18px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* Score badge */}
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: 20,
              border: `2px solid ${tier.border}`,
              background: tier.bg,
              boxShadow: tier.glow,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: tier.color }}>{data.insiderScore || '0'}</div>
            <div style={{ marginTop: 2, fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: tier.color, opacity: 0.7 }}>
              {tier.label}
            </div>
          </div>

          {/* Outcome */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 18, letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
              The Position
            </div>
            <div style={{ marginTop: 6, fontSize: 38, fontWeight: 700, lineHeight: 1.08, color: '#f8fafc' }}>
              {data.outcome || 'Lakers ML'}
            </div>
          </div>

          {/* Odds pill */}
          <div
            style={{
              borderRadius: 14,
              background: '#84cc16',
              color: '#132108',
              fontSize: 40,
              lineHeight: 1,
              fontWeight: 700,
              padding: '12px 16px',
              flexShrink: 0,
            }}
          >
            {data.odds || '-110'}
          </div>
        </div>

        {/* Stats grid - Row 1: Stake, To Win, ROI, Size */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          <div style={{ borderRadius: 14, border: '1px solid rgba(132,204,22,0.45)', background: 'rgba(132,204,22,0.14)', padding: '12px 12px' }}>
            <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Stake</div>
            <div style={{ marginTop: 5, fontSize: 28, fontWeight: 700, color: '#bef264' }}>{data.stakeUsd || '$5k'}</div>
          </div>
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 12px' }}>
            <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>To Win</div>
            <div style={{ marginTop: 5, fontSize: 28, fontWeight: 700, color: '#86efac' }}>{data.toWinUsd || '$4.5k'}</div>
          </div>
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 12px' }}>
            <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>ROI</div>
            <div style={{ marginTop: 5, fontSize: 28, fontWeight: 700, color: '#86efac' }}>{data.walletRoi || '+42%'}</div>
          </div>
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.35)', padding: '12px 12px' }}>
            <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Size</div>
            <div style={{ marginTop: 5, fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{data.sizeRatio || '3.2x'}</div>
          </div>
        </div>

        {/* Stats grid - Row 2: Total Bets, Total Wagered */}
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', padding: '14px 14px' }}>
            <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Total Bets</div>
            <div style={{ marginTop: 5, fontSize: 40, fontWeight: 700, color: '#f8fafc' }}>{data.totalBets || '12'}</div>
          </div>
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', padding: '14px 14px' }}>
            <div style={{ fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Total Wagered</div>
            <div style={{ marginTop: 5, fontSize: 40, fontWeight: 700, color: '#f8fafc' }}>{data.totalWagered || '$62k'}</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />
    </div>
  )
}
