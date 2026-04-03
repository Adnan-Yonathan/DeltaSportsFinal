'use client'

import type { ReactNode } from 'react'

const FRAME_WIDTH = 1080

const FONT_STACK =
  'var(--font-sans, "Saira Condensed", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif)'

type Props = {
  children: ReactNode
  height: number
}

export default function InstagramFrame({ children, height }: Props) {
  return (
    <div
      style={{
        width: FRAME_WIDTH,
        height,
        position: 'relative',
        overflow: 'hidden',
        color: '#ffffff',
        fontFamily: FONT_STACK,
        background: 'radial-gradient(circle at 12% 8%, rgba(16, 185, 129, 0.28), transparent 42%), radial-gradient(circle at 84% 86%, rgba(16, 185, 129, 0.11), transparent 36%), #03060b',
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.05) 0%, rgba(2, 6, 23, 0.7) 100%)',
          zIndex: 0,
        }}
      />

      {/* Emerald glow orb top-right */}
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
          zIndex: 0,
        }}
      />
      {/* Emerald glow orb bottom-left */}
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
          zIndex: 0,
        }}
      />

      {/* Template content (background layer + template sit here) */}
      <div style={{ position: 'relative', zIndex: 1, height: '100%', padding: '44px 42px 36px' }}>
        {children}
      </div>

      {/* ── Logo watermark — always on top of everything ── */}
      <div
        style={{
          position: 'absolute',
          top: 44,
          left: 42,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <img
          src="/delta-logo.png"
          alt="Delta Sports"
          style={{ width: 40, height: 40, objectFit: 'contain' }}
        />
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.88)',
            letterSpacing: 0.5,
          }}
        >
          deltasports.app
        </span>
      </div>
    </div>
  )
}
