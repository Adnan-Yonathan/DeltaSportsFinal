"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { DottedSurface } from "@/components/ui/dotted-surface"

const PATCH_NOTES = [
  {
    title: "Whale Feed + Sharp Money Signals",
    points: [
      "Sharp Detector renamed to Whale Feed across the app.",
      "New signal rules: EV, NCAAB clusters, and $100k+ nukes with filter-based ranking.",
    ],
  },
  {
    title: "Parlay Pro + EV Parlays",
    points: [
      "EV Parlays are now the primary tab with 3%+ EV threshold.",
      "Parlay builder remains as the secondary tab for custom tickets.",
    ],
  },
  {
    title: "Line Shopping",
    points: [
      "Renamed from Live Odds with pregame-only boards.",
      "Best odds now highlighted for prediction markets vs sportsbooks.",
    ],
  },
  {
    title: "Live Projections",
    points: [
      "ESPN win probability meter added for every game.",
      "Live spread interval derived from win probability.",
    ],
  },
  {
    title: "Shareable Assets + Hero",
    points: [
      "Share cards rebuilt with credit-card styling and sportsbook imagery.",
      "Rotating hero games are now clickable pills with a built-in guide.",
    ],
  },
  {
    title: "Calculators + News Feed",
    points: [
      "New calculators hub: Kelly, arb, parlay, EV, de-vig, promo, and more.",
      "News feed merged into one ticker (includes CBB) with hover slowdown.",
    ],
  },
  {
    title: "Quality-of-Life",
    points: [
      "Daily recap is now a main-page button and refreshes at 6am ET.",
      "NCAAB line move sensitivity reduced to NBA levels.",
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
            <h1 className="text-3xl font-bold">Patch 0.4</h1>
            <p className="text-sm text-white/60">
              Whale Feed signals, EV parlays, line shopping, and live projections.
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
