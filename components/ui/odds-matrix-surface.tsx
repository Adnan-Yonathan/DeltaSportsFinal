'use client'

import React, { useEffect, useMemo, useRef } from 'react'

type OddsMatrixSurfaceProps = {
  className?: string
  intensity?: number
  tone?: 'emerald' | 'amber'
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
  tone = 'emerald',
}: OddsMatrixSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const blipsRef = useRef<Blip[]>([])
  const rafRef = useRef<number>(0)
  const lastTickRef = useRef<number>(0)
  const resizeRafRef = useRef<number>(0)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 0 })
  const lowPowerRef = useRef(false)

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

    const getLowPower = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      const cores = navigator.hardwareConcurrency
      return w < 768 || h < 520 || (memory != null && memory <= 4) || (cores != null && cores <= 4)
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const applyResize = () => {
      const nextLowPower = getLowPower()
      lowPowerRef.current = nextLowPower
      const maxDpr = nextLowPower ? 1.3 : 2
      const dpr = Math.max(1, Math.min(maxDpr, window.devicePixelRatio || 1))
      const width = window.innerWidth
      const height = window.innerHeight

      if (
        width === sizeRef.current.w &&
        height === sizeRef.current.h &&
        dpr === sizeRef.current.dpr
      ) {
        return
      }

      sizeRef.current = { w: width, h: height, dpr }
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const resize = () => {
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current)
      }
      resizeRafRef.current = requestAnimationFrame(applyResize)
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = (t: number) => {
      // Only advance the simulation when enough time has elapsed.
      // (Do not update the tick timestamp when skipping, otherwise it can "freeze" at 60fps.)
      if (!lastTickRef.current) lastTickRef.current = t
      const lowPower = lowPowerRef.current
      const step = reduceMotion ? 250 : lowPower ? 48 : 16
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
        const maxBlips = lowPower ? 140 : 280
        const baseSpawn = clamp(intensity, 0.1, 0.9) * (lowPower ? 9 : 18)
        const spawnCount = Math.max(2, Math.floor(baseSpawn))
        const w = window.innerWidth
        const h = window.innerHeight
        const isSmall = w < 640
        const cols = isSmall ? 2 : 4
        const maxNow = isSmall ? Math.floor(maxBlips * 0.62) : maxBlips
        const spawnNow = isSmall ? Math.max(2, Math.floor(spawnCount * 0.75)) : spawnCount
        const lineHNow = isSmall ? 20 : lowPower ? 19 : 18
        const leftPad = lowPower ? 18 : 24
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
      const fontSize = lowPower ? 12 : 13
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace`
      ctx.textBaseline = 'top'

      for (const b of blips) {
        const alpha = b.a * 0.95
        if (alpha <= 0) continue
        if (tone === 'amber') {
          if (b.color === 'g') ctx.fillStyle = `rgba(251,191,36,${alpha})`
          else if (b.color === 'c') ctx.fillStyle = `rgba(245,158,11,${alpha * 0.95})`
          else ctx.fillStyle = `rgba(255,255,255,${alpha * 0.72})`
        } else {
          if (b.color === 'g') ctx.fillStyle = `rgba(52,211,153,${alpha})`
          else if (b.color === 'c') ctx.fillStyle = `rgba(56,189,248,${alpha * 0.95})`
          else ctx.fillStyle = `rgba(255,255,255,${alpha * 0.72})`
        }
        ctx.fillText(b.text, b.x, b.y)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current)
      }
    }
  }, [intensity, strings, tone])

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
