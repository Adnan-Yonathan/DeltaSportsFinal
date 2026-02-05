import Link from 'next/link'
import { SimpleHeader } from '@/components/ui/simple-header'
import { OddsMatrixSurface } from '@/components/ui/odds-matrix-surface'
import { CORE_TOOLS } from '@/lib/core-tools'
import { CardSpotlight } from '@/components/ui/card-spotlight'
import { ArrowRight } from 'lucide-react'
import { ToolVibePreview } from '@/components/tools/tool-vibe-preview'

export const dynamic = 'force-static'

export default function ToolsPage() {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.34} className="opacity-90" />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 insider-grid opacity-50" />
        <div className="absolute inset-0 insider-scanlines opacity-25" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.12),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.10),transparent_50%)]" />
      </div>

      <SimpleHeader widthClass="max-w-6xl" />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-20 sm:pt-24">
        <header className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            Tools
          </p>
          <h1 className="mt-3 font-hero text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Five tools. One insider workflow.
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-white/70 sm:text-base">
            Click a tool to see what it does and a visual example, then jump into the live
            product when you are ready.
          </p>
        </header>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CORE_TOOLS.map((tool, idx) => (
            <Link key={tool.key} href={tool.guideRoute} className="block">
              <CardSpotlight
                className="relative h-full rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur transition-colors hover:border-emerald-400/35"
                color={idx % 2 ? 'rgba(56,189,248,0.09)' : 'rgba(16,185,129,0.10)'}
                radius={360}
              >
                <div aria-hidden className="pointer-events-none absolute inset-0 insider-grid opacity-20" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/55">
                  {tool.shortLabel}
                </p>
                <h2 className="mt-3 text-xl font-semibold text-white">{tool.label}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{tool.summary}</p>

                <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/50">
                  <div className="aspect-[16/9] w-full p-3">
                    <ToolVibePreview toolKey={tool.key} size="sm" className="h-full w-full" />
                  </div>
                </div>

                <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/90">
                  <span>View guide</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardSpotlight>
            </Link>
          ))}
        </section>

        <div className="mt-10 flex justify-center">
          <Link
            href="/pricing"
            className="inline-flex w-full max-w-md items-center justify-center gap-3 rounded-full border border-emerald-400/35 bg-black/70 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200 shadow-[0_18px_50px_rgba(16,185,129,0.18)] backdrop-blur hover:border-emerald-300/70 hover:text-emerald-100 sm:w-auto sm:max-w-none sm:tracking-[0.35em]"
          >
            <span className="text-white/60">Unlock:</span>
            <span>Become an insider</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}
