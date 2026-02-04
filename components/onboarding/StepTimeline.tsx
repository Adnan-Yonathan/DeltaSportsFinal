"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"

interface StepTimelineProps {
  onValidation: (isValid: boolean) => void
  onContinue?: () => void
  saving?: boolean
  profile?: {
    primaryIntent?: string
    betFocus?: string
    goals?: string[]
  }
}

const uniq = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const buildTimeline = (profile?: StepTimelineProps["profile"]) => {
  const intent = profile?.primaryIntent ?? ""
  const betFocus = profile?.betFocus ?? ""
  const goals = uniq(profile?.goals ?? [])

  const day1ByIntent: Record<string, string> = {
    "projection-models":
      "Start with projections: scan today’s board, flag 3 edges, and learn what moves the close.",
    "track-profitable-bettors":
      "Start with tracking: follow top wallets, create a watchlist, and monitor their next moves.",
    "find-whales":
      "Start with whales: open the whale feed, set alerts, and learn how whales move lines.",
    "historical-trends":
      "Start with research: review historical movement, spot early sharp signals, and build your pattern library.",
  }

  const day3 = betFocus === "player-props"
    ? "Run props mode: compare lines, scan form, and only fire when price beats the market."
    : "Run markets mode: compare spreads/totals, line shop, and only fire when price beats the close."

  const addGoalDrills: string[] = []
  if (goals.includes("learn-research")) {
    addGoalDrills.push("Learn the workflow: signals → context → price → bet sizing → review.")
  }
  if (goals.includes("tail-sharp-action")) {
    addGoalDrills.push("Tail with discipline: track sharp side, confirm movement, and avoid late steam traps.")
  }
  if (goals.includes("become-profitable")) {
    addGoalDrills.push("Protect the bankroll: keep units consistent and track results like a pro.")
  }
  if (goals.includes("supercharge")) {
    addGoalDrills.push("Move faster: use alerts and watchlists so you never miss a sharp window.")
  }

  const drills = uniq(addGoalDrills).slice(0, 2)

  return [
    { day: "Day 1", title: day1ByIntent[intent] ?? "Start by focusing on signals that actually move markets." },
    { day: "Day 2", title: "Learn line movement: follow money flow and identify when the public is late." },
    { day: "Day 3", title: day3 },
    { day: "Day 4", title: drills[0] ?? "Track sharp action: confirm side, price, and timing before tailing." },
    { day: "Day 5", title: drills[1] ?? "Review profitable bettors: verify their positions and learn their patterns." },
    { day: "Day 6", title: "Research mode: study closes, CLV, and how sharps beat the number long-term." },
    { day: "Day 7", title: "Lock it in: build a repeatable process and keep compounding your edge." },
  ]
}

export function StepTimeline({ onValidation, onContinue, saving, profile }: StepTimelineProps) {
  useEffect(() => {
    onValidation(true)
  }, [onValidation])

  const timeline = buildTimeline(profile)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">
          First 7 Days
        </p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Here&apos;s how your betting changes in 7 days
        </h1>
        <p className="text-sm text-white/80 sm:text-base">
          Follow the plan. Stay disciplined. Become an insider.
        </p>
      </div>

      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="space-y-5">
          {timeline.map((item) => (
            <div
              key={item.day}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 sm:flex-row sm:items-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-sm font-semibold text-emerald-200">
                {item.day}
              </div>
              <div className="text-sm sm:text-base text-white/80">
                {item.title}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              onContinue?.()
            }}
            disabled={saving}
            className="rounded-full bg-[#34d399] px-8 py-3 text-sm font-semibold text-[#0f1f15] transition-colors hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Yes. Become an insider"
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
