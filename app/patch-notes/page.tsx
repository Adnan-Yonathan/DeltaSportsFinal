"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { DottedSurface } from "@/components/ui/dotted-surface"

const PATCH_NOTES = [
  {
    title: "Sharp Money Feed",
    points: [
      "New Sharp Money tab highlights top sharp signals in real time.",
      "Improved clustering, grading, and market signal tags.",
    ],
  },
  {
    title: "Sharp Props Tool",
    points: [
      "Player prop sharp tool now ranks the strongest prop edges.",
      "New filters help isolate the best props by sport and market.",
    ],
  },
  {
    title: "AI Chat Updates",
    points: [
      "Faster chat responses with tighter market context.",
      "Cleaner summaries for matchup and slate questions.",
    ],
  },
  {
    title: "Projection Model Upgrades",
    points: [
      "Fresh projection models across key sports markets.",
      "Improved calibration and stability for daily slates.",
    ],
  },
]

export default function PatchNotesPage() {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <DottedSurface className="z-10" />

      <div className="relative z-20 mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">Patch Notes</p>
            <h1 className="text-3xl font-bold">Patch 0.3</h1>
            <p className="text-sm text-white/60">
              Sharp money feed, sharp props, and new model upgrades.
            </p>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-full border border-[#34d399] px-4 py-2 text-sm text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </Link>
        </header>

        <div className="space-y-6">
          {PATCH_NOTES.map((section) => (
            <section
              key={section.title}
              className="rounded-3xl border border-[#2a2a2a] bg-black/70 p-6 space-y-3"
            >
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <ul className="space-y-2 text-sm text-white/70 list-disc list-inside">
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
