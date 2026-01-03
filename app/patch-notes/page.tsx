"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { DottedSurface } from "@/components/ui/dotted-surface"

const PATCH_NOTES = [
  {
    title: "Live Odds + Line Shopping Merge",
    points: [
      "Line shopping summary added to every live score card.",
      "Compare Books opens a dedicated modal instead of expanding the page.",
      "Moneyline, spread, and total best lines highlighted per matchup.",
    ],
  },
  {
    title: "Player Props Expansion",
    points: [
      "All available props for each game are pulled (no slicing).",
      "Props load on-demand inside the line shopping modal.",
    ],
  },
  {
    title: "Arbitrage Scanner",
    points: [
      "Arb badge appears directly on the game card when detected.",
      "Checks moneyline, spreads by line, and totals by line.",
    ],
  },
  {
    title: "Odds Reliability Fixes",
    points: [
      "Odds provider routing restored via ODDS_PROVIDER config.",
      "SBD fallback to odds-api-io when markets are missing.",
      "NCAAB odds now use the proper league filter again.",
    ],
  },
  {
    title: "Performance + Caching",
    points: [
      "Disabled oversized fetch caching for large props payloads.",
      "Live + upcoming odds are merged for broader coverage.",
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
            <h1 className="text-3xl font-bold">Patch 0.1</h1>
            <p className="text-sm text-white/60">
              Line shopping and live scores are now one flow, with deeper props and arb cues.
            </p>
          </div>
          <Link
            href="/live-scores"
            className="inline-flex items-center gap-2 rounded-full border border-[#34d399] px-4 py-2 text-sm text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Live Odds
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
