'use client'

import type { ReactNode } from 'react'

const FRAME_WIDTH = 1080
const FRAME_HEIGHT = 1350

const FONT_STACK =
  'var(--font-sans, "Saira Condensed", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif)'

type ShareCardFrameProps = {
  children: ReactNode
  accent?: 'emerald' | 'cyan'
  height?: number
}

export function ShareCardFrame({ children, accent = 'emerald', height }: ShareCardFrameProps) {
  const frameHeight = height ?? FRAME_HEIGHT
  const accentGlow =
    accent === 'cyan'
      ? 'radial-gradient(circle at 12% 8%, rgba(16, 185, 129, 0.22), transparent 42%)'
      : 'radial-gradient(circle at 12% 8%, rgba(16, 185, 129, 0.28), transparent 42%)'

  return (
    <div
      style={{
        width: FRAME_WIDTH,
        height: frameHeight,
        position: 'relative',
        overflow: 'hidden',
        color: '#ffffff',
        fontFamily: FONT_STACK,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: `${accentGlow}, radial-gradient(circle at 84% 86%, rgba(16, 185, 129, 0.11), transparent 36%), #03060b`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(2, 6, 23, 0.05) 0%, rgba(2, 6, 23, 0.7) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: -120,
          right: -140,
          width: 360,
          height: 360,
          borderRadius: 220,
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.55), rgba(132, 204, 22, 0.3))',
          filter: 'blur(8px)',
          opacity: 0.62,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -160,
          left: -160,
          width: 420,
          height: 420,
          borderRadius: 260,
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.45), rgba(5, 150, 105, 0.24))',
          filter: 'blur(12px)',
          opacity: 0.58,
        }}
      />

      <div style={{ position: 'relative', zIndex: 2, height: '100%', padding: '44px 42px 36px' }}>
        {children}

        <div
          style={{
            position: 'absolute',
            left: 42,
            right: 42,
            bottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: 'rgba(255,255,255,0.62)',
            fontSize: 24,
            letterSpacing: 0.3,
          }}
        >
          <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)' }}>Find more at</span>
          <img src="/delta-logo.png" alt="Delta Sports" style={{ width: 30, height: 30, objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.86)' }}>deltasports.app</span>
        </div>
      </div>
    </div>
  )
}

export function ShareCaptureRoot({
  children,
}: {
  children: ReactNode
}) {
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
      {children}
    </div>
  )
}
