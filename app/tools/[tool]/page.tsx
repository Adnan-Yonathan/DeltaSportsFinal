import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SimpleHeader } from '@/components/ui/simple-header'
import { OddsMatrixSurface } from '@/components/ui/odds-matrix-surface'
import { CORE_TOOLS, CORE_TOOLS_BY_KEY, type CoreToolKey } from '@/lib/core-tools'
import { ArrowRight } from 'lucide-react'
import { ToolVibePreview } from '@/components/tools/tool-vibe-preview'

export const dynamic = 'force-static'

type PageProps = {
  params: { tool: string }
}

function isCoreToolKey(value: string): value is CoreToolKey {
  return value in CORE_TOOLS_BY_KEY
}

export function generateStaticParams() {
  return CORE_TOOLS.map((tool) => ({ tool: tool.key }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const key = params.tool
  if (!isCoreToolKey(key)) return { title: 'Tool not found' }
  const tool = CORE_TOOLS_BY_KEY[key]
  return {
    title: `${tool.label} | Delta Tools`,
    description: tool.summary,
  }
}

export default function ToolDetailPage({ params }: PageProps) {
  const key = params.tool
  if (!isCoreToolKey(key)) notFound()
  const tool = CORE_TOOLS_BY_KEY[key]

  return (
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.38} className="opacity-90" />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 insider-grid opacity-50" />
        <div className="absolute inset-0 insider-scanlines opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.14),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.10),transparent_50%)]" />
      </div>

      <SimpleHeader widthClass="max-w-6xl" />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-20 sm:pt-24">
        <header className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            Tool Guide
          </p>
          <h1 className="mt-3 font-hero text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {tool.label}
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-white/70 sm:text-base">
            {tool.summary}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={tool.productRoute}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-emerald-400 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-black shadow-[0_16px_50px_rgba(16,185,129,0.25)] hover:bg-emerald-300 sm:w-auto"
            >
              <span>Open tool</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-white/75 hover:border-emerald-400/50 hover:text-emerald-200 sm:w-auto"
            >
              Start your free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur sm:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
                What you get
              </p>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                {tool.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-300/80 shadow-[0_0_16px_rgba(52,211,153,0.45)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
                  Insider move
                </p>
                <p className="mt-2 text-sm text-white/70">
                  Start here, then confirm with another tool before you commit.
                  Delta is built to compound signals.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/55 backdrop-blur">
              <div className="relative aspect-[16/9] w-full">
                <div className="absolute inset-0 p-4 sm:p-5">
                  <ToolVibePreview toolKey={tool.key} className="h-full w-full" />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              </div>
              <div className="p-5 text-xs text-white/55">
                Tip: click <span className="text-emerald-200">Open tool</span> above
                to see it live.
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10 flex justify-center">
          <Link
            href="/tools"
            className="inline-flex items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-white/70 hover:border-emerald-400/50 hover:text-emerald-200"
          >
            Back to tools
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}
