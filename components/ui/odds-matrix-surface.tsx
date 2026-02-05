'use client'

import React, { useEffect, useMemo, useRef } from 'react'

type OddsMatrixSurfaceProps = {
  className?: string
  intensity?: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function formatSigned(n: number) {
  const r = Math.round(n * 2) / 2
  if (r > 0) return `+${r.toFixed(1)}`
  return r.toFixed(1)
}

function formatTotal(n: number) {
  const r = Math.round(n * 2) / 2
  return r.toFixed(1)
}

function formatAmerican(n: number) {
  const v = Math.round(n / 5) * 5
  if (v > 0) return `+${v}`
  return `${v}`
}

type Blip = {
  x: number
  y: number
  a: number
  text: string
  color: 'g' | 'w' | 'c'
  ttl: number
}

export function OddsMatrixSurface({
  className = '',
  intensity = 0.62,
}: OddsMatrixSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const blipsRef = useRef<Blip[]>([])
  const rafRef = useRef<number>(0)
  const lastTickRef = useRef<number>(0)

  const strings = useMemo(() => {
    const TEAMS = [
      'LAL',
      'GSW',
      'BOS',
      'MIA',
      'NYK',
      'DAL',
      'DEN',
      'PHI',
      'OKC',
      'MIL',
      'BUF',
      'KC',
      'SF',
      'PHI (NFL)',
      'TOR',
      'NYR',
      'EDM',
      'VGK',
    ]
    const BOOKS = ['PIN', 'DK', 'FD', 'CZR', 'MGM', 'BOL', 'MRKT']
    const MARKETS = ['SPREAD', 'TOTAL', 'ML', 'PROP']

    const build = () => {
      const teamA = pick(TEAMS)
      let teamB = pick(TEAMS)
      if (teamB === teamA) teamB = pick(TEAMS)
      const book = pick(BOOKS)
      const market = pick(MARKETS)

      const baseTotal = rand(206, 241)
      const total = formatTotal(baseTotal)
      const spread = formatSigned(rand(-7.5, 7.5))
      const ml = formatAmerican(rand(-165, 165) || -110)
      const price = formatAmerican(rand(-145, 145) || -110)
      const edge = clamp(rand(-1.2, 3.8), -1.2, 3.8).toFixed(1)

      if (market === 'SPREAD') {
        return `${book} ${teamA} ${spread} (${price})  EDGE ${edge}%`
      }
      if (market === 'TOTAL') {
        const side = Math.random() > 0.5 ? 'O' : 'U'
        return `${book} ${side} ${total} (${price})  CLV +${clamp(rand(1, 18), 1, 18).toFixed(0)}bp`
      }
      if (market === 'ML') {
        return `${book} ${teamA} ML ${ml}  MOVE ${clamp(rand(-12, 22), -12, 22).toFixed(0)}`
      }
      const prop = pick(['PTS', 'REB', 'AST', '3PM', 'SOG'])
      const line = formatTotal(rand(0.5, 29.5))
      const side = Math.random() > 0.5 ? 'O' : 'U'
      return `${book} ${teamA} ${prop} ${side}${line} (${price})  EV ${edge}%`
    }

    return {
      next: build,
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    const maxBlips = 280
    const baseSpawn = clamp(intensity, 0.1, 0.9) * 18
    const fontSize = 13
    const lineH = 18
    const leftPad = 24

    const draw = (t: number) => {
      // Only advance the simulation when enough time has elapsed.
      // (Do not update the tick timestamp when skipping, otherwise it can "freeze" at 60fps.)
      if (!lastTickRef.current) lastTickRef.current = t
      const step = reduceMotion ? 250 : 16
      const rawDt = t - lastTickRef.current
      if (rawDt < step) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      // Clamp dt to avoid huge jumps after tab switches.
      const dt = Math.min(rawDt, reduceMotion ? 250 : 72)
      lastTickRef.current = t

      // Fade existing blips.
      const blips = blipsRef.current
      for (let i = blips.length - 1; i >= 0; i -= 1) {
        const b = blips[i]
        b.ttl -= dt
        b.a = Math.max(0, b.a - dt / 520)
        if (b.ttl <= 0 || b.a <= 0) blips.splice(i, 1)
      }

      // Spawn new blips.
      if (!reduceMotion) {
        const spawnCount = Math.max(2, Math.floor(baseSpawn))
        const w = window.innerWidth
        const h = window.innerHeight
        const isSmall = w < 640
        const cols = isSmall ? 2 : 4
        const maxNow = isSmall ? Math.floor(maxBlips * 0.62) : maxBlips
        const spawnNow = isSmall ? Math.max(2, Math.floor(spawnCount * 0.75)) : spawnCount
        const lineHNow = isSmall ? 20 : lineH
        for (let i = 0; i < spawnNow; i += 1) {
          if (blips.length >= maxNow) break
          const y = Math.floor(rand(0, h / lineHNow)) * lineHNow + 24
          const col = Math.floor(rand(0, cols))
          const x = leftPad + col * Math.floor(w / cols)
          const colorRoll = Math.random()
          const color = colorRoll > 0.88 ? 'c' : colorRoll > 0.22 ? 'g' : 'w'
          const baseAlpha = rand(0.14, 0.26) + clamp(intensity, 0.1, 0.9) * 0.11
          blips.push({
            x: x + rand(-12, 12),
            y: y + rand(-4, 4),
            a: clamp(baseAlpha, 0.12, 0.42),
            text: strings.next(),
            color,
            ttl: rand(420, 820),
          })
        }
      }

      // Clear with transparent, then redraw current blips.
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace`
      ctx.textBaseline = 'top'

      for (const b of blips) {
        const alpha = b.a * 0.95
        if (alpha <= 0) continue
        if (b.color === 'g') ctx.fillStyle = `rgba(52,211,153,${alpha})`
        else if (b.color === 'c') ctx.fillStyle = `rgba(56,189,248,${alpha * 0.95})`
        else ctx.fillStyle = `rgba(255,255,255,${alpha * 0.72})`
        ctx.fillText(b.text, b.x, b.y)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [intensity, strings])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 opacity-90 ${className}`}
      style={{
        filter: 'none',
        maskImage:
          'radial-gradient(circle at 50% 35%, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.60) 55%, rgba(0,0,0,0.18) 72%, transparent 80%)',
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
