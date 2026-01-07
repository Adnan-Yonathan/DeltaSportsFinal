"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { DottedSurface } from "@/components/ui/dotted-surface"

const PATCH_NOTES = [
  {
    title: "Whale Detector",
    points: [
      "New whale detection feed highlights large bets in real time.",
      "Tier labels now reflect whale types for quick scanning.",
    ],
  },
  {
    title: "New Dashboards",
    points: [
      "Market Projection dashboard is live.",
      "EV Bets dashboard now tracks expected value plays.",
    ],
  },
  {
    title: "Live Odds Enhancements",
    points: [
      "Arb and line shopping are unified on the Live Odds page.",
      "Arb cues surface directly on the matchup card.",
      "Line shopping opens a focused Compare Books modal.",
    ],
  },
  {
    title: "Mobile UI Fixes",
    points: [
      "Improved spacing and readability across live odds cards.",
      "Smoother panel transitions for the whale detector on mobile.",
    ],
  },
  {
    title: "Coming Soon",
    points: [
      "Player projections.",
      "Parlay predictor.",
      "Live projections.",
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
            <h1 className="text-3xl font-bold">Patch 0.2</h1>
            <p className="text-sm text-white/60">
              Whale detection, new dashboards, and a sharper live odds experience.
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
