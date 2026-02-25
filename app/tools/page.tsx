import Link from 'next/link'
import { SimpleHeader } from '@/components/ui/simple-header'
import { OddsMatrixSurface } from '@/components/ui/odds-matrix-surface'
import { CORE_TOOLS } from '@/lib/core-tools'
import { CardSpotlight } from '@/components/ui/card-spotlight'
import { ArrowRight } from 'lucide-react'
import { ToolVibePreview } from '@/components/tools/tool-vibe-preview'
import { TutorialActionButton } from '@/components/tools/tutorial-action-button'
type ToolsPageProps = {
  searchParams?: {
    tutorial?: string
  }
}

export default function ToolsPage({ searchParams }: ToolsPageProps) {
  const tutorialActive = searchParams?.tutorial === '1'
  const firstToolKey = 'sharp-projections'

  return (
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.34} className="opacity-90" />

      <SimpleHeader widthClass="max-w-6xl" />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-20 sm:pt-24">
        {tutorialActive && (
          <section className="mb-6 rounded-3xl border border-emerald-400/35 bg-black/85 p-5 shadow-[0_18px_60px_rgba(16,185,129,0.18)] sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-200/85">
              Tutorial Step 1 of 4
            </p>
            <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">
              Click Sharp Projections to start
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-white/75">
              We will guide you through Sharp Projections, Sharp Props, Whale Feed, and Research
              Mode with quick spotlight instructions on each page.
            </p>
            <div className="mt-4">
              <TutorialActionButton
                label="Skip tutorial"
                redirectTo="/chat"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80 hover:border-white/35 hover:text-white"
              />
            </div>
          </section>
        )}

        <header className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            Tools
          </p>
          <h1 className="mt-3 font-hero text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Four tools. One insider workflow.
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-white/70 sm:text-base">
            Click a tool to see what it does and a visual example, then jump into the live
            product when you are ready.
          </p>
        </header>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CORE_TOOLS.map((tool, idx) => {
            const isTarget = tool.key === firstToolKey
            const isLocked = tutorialActive && !isTarget

            const card = (
              <CardSpotlight
                className={`relative h-full rounded-3xl border bg-black/55 p-6 backdrop-blur transition-colors ${
                  tutorialActive && isTarget
                    ? 'border-emerald-300/75 shadow-[0_0_0_2px_rgba(52,211,153,0.4)]'
                    : 'border-white/10 hover:border-emerald-400/35'
                } ${isLocked ? 'opacity-45' : ''}`}
                color={idx % 2 ? 'rgba(56,189,248,0.09)' : 'rgba(16,185,129,0.10)'}
                radius={360}
              >
                <div aria-hidden className="pointer-events-none absolute inset-0 insider-grid opacity-20" />
                {tutorialActive && isTarget && (
                  <span className="absolute right-4 top-4 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                    Start here
                  </span>
                )}
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
                  <span>{isLocked ? 'Complete step 1 first' : 'View guide'}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardSpotlight>
            )

            if (isLocked) {
              return (
                <div key={tool.key} className="block cursor-not-allowed">
                  {card}
                </div>
              )
            }

            return (
              <Link
                key={tool.key}
                href={`${tool.guideRoute}${tutorialActive ? '?tutorial=1' : ''}`}
                className="block"
              >
                {card}
              </Link>
            )
          })}
        </section>

        <div className="mt-10 flex justify-center">
          <Link
            href="/pricing"
            className="inline-flex w-full max-w-md items-center justify-center gap-3 rounded-full border border-emerald-400/35 bg-black/70 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200 shadow-[0_18px_50px_rgba(16,185,129,0.18)] backdrop-blur hover:border-emerald-300/70 hover:text-emerald-100 sm:w-auto sm:max-w-none sm:tracking-[0.35em]"
          >
            <span>Start your free trial</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}
