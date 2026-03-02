"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { DottedSurface } from "@/components/ui/dotted-surface"

const PATCH_NOTES = [
  {
    title: "Free Membership + Access Gates",
    points: [
      "New Free tier with top-result previews and blurred full access.",
      "Sharp = full projections tools, Syndicate = full research tools.",
      "Sharp Money Feed remains Syndicate-only; Bet Feed is available to Free.",
    ],
  },
  {
    title: "The Odds API Everywhere",
    points: [
      "Odds API now powers EV Bets, Parlay Pro EV, Sharp Projections, and Line Shopping.",
      "Book selector expanded to 50+ books with Kalshi and Polymarket.",
      "EV Bets now supports all sports with refreshed book defaults.",
    ],
  },
  {
    title: "Parlay Pro + EV Bets Updates",
    points: [
      "EV filters removed from Parlay Pro in favor of the book dropdown.",
      "EV Bets now honors all selected books and fixes the no-bets bug.",
      "EV opportunities endpoints opened for Free previews.",
    ],
  },
  {
    title: "Research Suite Improvements",
    points: [
      "Sharp Action now includes deeper analysis and a point graph.",
      "Betting Trends rebuilt from 30-day line history with sport filtering.",
      "Backtesting and Research pages respect the new access gates.",
    ],
  },
  {
    title: "Sharp Money Feed Scoring",
    points: [
      "Sharp Money feed now triggers on 60%+ strength only.",
      "Bet Feed continues to show all qualifying market trades.",
    ],
  },
  {
    title: "Chat + Onboarding",
    points: [
      "Desktop chat box replaced with clickable Get Started guides.",
      "Pricing page updated to Free / Sharp / Syndicate structure.",
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
            <h1 className="text-3xl font-bold">Patch 0.5</h1>
            <p className="text-sm text-white/60">
              Free tier previews, Odds API expansion, and research upgrades.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#34d399] px-4 py-2 text-sm text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tools
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
