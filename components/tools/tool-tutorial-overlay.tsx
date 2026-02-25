'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { CORE_TOOLS_BY_KEY, type CoreToolKey } from '@/lib/core-tools'
import { TOOLS_TUTORIAL_COPY, TOOLS_TUTORIAL_ORDER } from '@/lib/tools-tutorial'
import { TutorialActionButton } from '@/components/tools/tutorial-action-button'

type ToolTutorialOverlayProps = {
  toolKey: CoreToolKey
}

export function ToolTutorialOverlay({ toolKey }: ToolTutorialOverlayProps) {
  const searchParams = useSearchParams()
  const tutorialActive = searchParams.get('tutorial') === '1'

  if (!tutorialActive) return null

  const copy = TOOLS_TUTORIAL_COPY[toolKey]
  const currentIndex = TOOLS_TUTORIAL_ORDER.indexOf(toolKey)
  const nextToolKey = currentIndex >= 0 ? TOOLS_TUTORIAL_ORDER[currentIndex + 1] : undefined
  const nextTool = nextToolKey ? CORE_TOOLS_BY_KEY[nextToolKey] : undefined
  const currentTool = CORE_TOOLS_BY_KEY[toolKey]

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px]" />
      <div className="fixed inset-x-4 bottom-4 z-50 mx-auto w-full max-w-2xl rounded-3xl border border-emerald-400/35 bg-black/95 p-5 shadow-[0_24px_70px_rgba(16,185,129,0.22)] sm:inset-x-0 sm:bottom-6 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-200/85">
          Tutorial Step {copy.step} of {TOOLS_TUTORIAL_ORDER.length}
        </p>
        <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">{currentTool.label}</h3>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/65 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/75">How to use</p>
            <p className="mt-2 text-sm text-white/75">{copy.howToUse}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/65 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/75">Why it matters</p>
            <p className="mt-2 text-sm text-white/75">{copy.whyItValuable}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TutorialActionButton
            label="Skip tutorial"
            redirectTo="/chat"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80 hover:border-white/35 hover:text-white"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={currentTool.productRoute}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 hover:border-emerald-300/70 hover:text-emerald-100"
            >
              Open live tool
            </Link>

            {nextTool ? (
              <Link
                href={`${nextTool.guideRoute}?tutorial=1`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-black hover:bg-emerald-300"
              >
                Next: {nextTool.shortLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <TutorialActionButton
                label="Finish tutorial"
                redirectTo="/chat"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-black hover:bg-emerald-300"
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

