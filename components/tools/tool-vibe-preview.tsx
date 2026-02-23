'use client'

import React from 'react'
import type { CoreToolKey } from '@/lib/core-tools'

function Pill({
  children,
  tone = 'emerald',
}: {
  children: React.ReactNode
  tone?: 'emerald' | 'cyan' | 'amber' | 'white'
}) {
  const cls =
    tone === 'cyan'
      ? 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100/90'
      : tone === 'amber'
        ? 'border-amber-300/25 bg-amber-300/10 text-amber-100/90'
        : tone === 'white'
          ? 'border-white/15 bg-white/5 text-white/75'
          : 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100/90'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] ${cls}`}
    >
      {children}
    </span>
  )
}

function MonoLine({
  left,
  right,
  good,
}: {
  left: string
  right: string
  good?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 font-mono text-[11px] leading-5">
      <span className="truncate text-white/70">{left}</span>
      <span
        className={`shrink-0 ${
          good ? 'text-emerald-200/90' : 'text-white/55'
        }`}
      >
        {right}
      </span>
    </div>
  )
}

function Panel({
  title,
  children,
  tone = 'emerald',
}: {
  title: string
  children: React.ReactNode
  tone?: 'emerald' | 'cyan' | 'amber'
}) {
  const wash =
    tone === 'cyan'
      ? 'from-cyan-400/12'
      : tone === 'amber'
        ? 'from-amber-300/12'
        : 'from-emerald-400/12'
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/65 p-4">
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${wash} via-black/60 to-black`}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 insider-grid opacity-25" />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/55">
            {title}
          </p>
          <Pill tone={tone === 'amber' ? 'amber' : tone === 'cyan' ? 'cyan' : 'emerald'}>
            preview
          </Pill>
        </div>
        <div className="mt-3 space-y-2">{children}</div>
      </div>
    </div>
  )
}

function ProjectionsPreview() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
      <div className="sm:col-span-7">
        <Panel title="Market Projections" tone="emerald">
          <div className="rounded-xl border border-white/10 bg-black/70 p-3">
            <MonoLine left="DK LAL -2.5 (-110)" right="FAIR -3.5" good />
            <MonoLine left="FD DAL ML +128" right="FAIR +112" good />
            <MonoLine left="PIN BOS -4.0 (-108)" right="FAIR -3.0" />
            <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
            <MonoLine left="EDGE ROUTE" right="sort: EV desc" />
          </div>
          <div className="flex items-center gap-2">
            <Pill>gap detected</Pill>
            <Pill tone="white">confidence: high</Pill>
          </div>
        </Panel>
      </div>
      <div className="sm:col-span-5">
        <Panel title="Edge Tape" tone="cyan">
          <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/70 p-3">
            <MonoLine left="CLV target" right="+14bp" good />
            <MonoLine left="steam risk" right="medium" />
            <MonoLine left="timing window" right="08:12" />
            <MonoLine left="status" right="open" good />
          </div>
          <div className="relative mt-2 h-16 overflow-hidden rounded-xl border border-white/10 bg-black/70">
            <div className="absolute inset-0 opacity-90 [background:linear-gradient(90deg,rgba(52,211,153,0.0),rgba(52,211,153,0.35),rgba(52,211,153,0.0))] animate-[pulse_1.4s_ease-in-out_infinite]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.18),transparent_55%)]" />
          </div>
        </Panel>
      </div>
    </div>
  )
}

function PropsPreview() {
  return (
    <Panel title="Sharp Props Scanner" tone="cyan">
      <div className="rounded-xl border border-white/10 bg-black/70 p-3">
        <div className="flex items-center justify-between gap-3 font-mono text-[11px] text-white/55">
          <span>PLAYER</span>
          <span>PROP</span>
          <span>LEAN</span>
          <span className="text-cyan-200/80">WALL</span>
        </div>
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-12 items-center gap-2 font-mono text-[11px]">
            <span className="col-span-5 truncate text-white/70">Tatum</span>
            <span className="col-span-2 text-white/60">PTS 27.5</span>
            <span className="col-span-3 text-white/60">OVER -108</span>
            <span className="col-span-2 text-emerald-200/90">$2.8k</span>
          </div>
          <div className="grid grid-cols-12 items-center gap-2 font-mono text-[11px]">
            <span className="col-span-5 truncate text-white/70">Curry</span>
            <span className="col-span-2 text-white/60">3PM 4.5</span>
            <span className="col-span-3 text-white/60">UNDER +102</span>
            <span className="col-span-2 text-emerald-200/90">$1.9k</span>
          </div>
          <div className="grid grid-cols-12 items-center gap-2 font-mono text-[11px]">
            <span className="col-span-5 truncate text-white/70">Luka</span>
            <span className="col-span-2 text-white/60">AST 8.5</span>
            <span className="col-span-3 text-white/60">OVER -114</span>
            <span className="col-span-2 text-emerald-200/90">$1.2k</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="cyan">orderbook</Pill>
        <Pill>sharp lean</Pill>
        <Pill tone="white">filters: sport, odds</Pill>
      </div>
    </Panel>
  )
}

function WhalePreview() {
  return (
    <Panel title="Whale Feed" tone="emerald">
      <div className="rounded-xl border border-white/10 bg-black/70 p-3">
        <MonoLine left="[tape] $42,000  SF ML" right="cluster: 3" good />
        <MonoLine left="[tape] $18,500  KC -2.5" right="books lagging" good />
        <MonoLine left="[tape] $9,200   U 47.5" right="move: -0.5" />
        <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
        <MonoLine left="exchange vs books" right="divergence +" good />
      </div>
      <div className="relative mt-2 h-14 overflow-hidden rounded-xl border border-white/10 bg-black/70">
        <div className="absolute -left-12 top-0 h-full w-40 bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent blur-sm animate-[slide_1.2s_linear_infinite]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.14),transparent_60%)]" />
      </div>
      <style jsx>{`
        @keyframes slide {
          0% { transform: translateX(0); opacity: 0.0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(560px); opacity: 0.0; }
        }
      `}</style>
    </Panel>
  )
}

function ResearchPreview() {
  return (
    <Panel title="Research Mode" tone="amber">
      <div className="rounded-xl border border-white/10 bg-black/70 p-3">
        <div className="font-mono text-[11px] leading-5 text-white/65">
          <div>
            <span className="text-amber-200/80">delta</span>
            <span className="text-white/35">:</span>
            <span className="text-white/70"> explain movement</span>
          </div>
          <div className="mt-1 text-white/50">
            &gt; why did DAL move -1.5 to -3.0?
          </div>
          <div className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/10 p-2 text-white/65">
            Close review: money clustered early, books lagged, then snapped to exchange.
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-white/10 bg-black/60 p-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">closes</p>
            <p className="mt-1 font-mono text-[11px] text-emerald-200/85">+19bp</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/60 p-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">hit rate</p>
            <p className="mt-1 font-mono text-[11px] text-white/70">58%</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/60 p-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">sample</p>
            <p className="mt-1 font-mono text-[11px] text-white/70">n=212</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="amber">backtest</Pill>
        <Pill tone="white">notes</Pill>
        <Pill tone="white">close review</Pill>
      </div>
    </Panel>
  )
}

export function ToolVibePreview({
  toolKey,
  className = '',
  size = 'md',
}: {
  toolKey: CoreToolKey
  className?: string
  size?: 'sm' | 'md'
}) {
  const padding = size === 'sm' ? 'p-3' : 'p-4 sm:p-5'
  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-black/55 backdrop-blur ${padding} ${className}`}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 insider-grid opacity-25" />
      <div aria-hidden className="pointer-events-none absolute inset-0 insider-scanlines opacity-25" />
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-24 bg-[radial-gradient(circle_at_25%_25%,rgba(52,211,153,0.12),transparent_45%),radial-gradient(circle_at_75%_35%,rgba(56,189,248,0.10),transparent_50%)]"
      />

      <div className="relative z-10">
        {toolKey === 'sharp-projections' ? (
          <ProjectionsPreview />
        ) : toolKey === 'sharp-props' ? (
          <PropsPreview />
        ) : toolKey === 'whale-feed' ? (
          <WhalePreview />
        ) : (
          <ResearchPreview />
        )}
      </div>
    </div>
  )
}
