"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { GuestHero } from "@/components/ui/guest-hero"

interface StepTimelineProps {
  onValidation: (isValid: boolean) => void
  onContinue?: () => void
  saving?: boolean
}

const TIMELINE = [
  {
    day: "Day 0",
    title: "Prepare to start betting with an edge.",
  },
  {
    day: "Day 1",
    title:
      "Access all the sharp tools and place your first bets using sharp projections.",
  },
  {
    day: "Day 2",
    title:
      "Learn how to find value by shopping for lines with the line shopper.",
  },
  {
    day: "Day 3",
    title:
      "Start betting props using the prop shopper and find high‑EV props.",
  },
  {
    day: "Day 4",
    title:
      "Look for unusual signals in the whale feed and watch for anything popping in the sharp feed.",
  },
  {
    day: "Day 5",
    title:
      "Review what the most profitable traders are betting on and verify if their positions show value.",
  },
  {
    day: "Day 6",
    title:
      "Use research mode to learn the infrastructure sharps use to predict line movement and beat the close.",
  },
  {
    day: "Day 7",
    title:
      "Continue using Delta to maintain a consistent edge.",
  },
]

export function StepTimeline({ onValidation, onContinue, saving }: StepTimelineProps) {
  useEffect(() => {
    onValidation(true)
  }, [onValidation])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <GuestHero
        eyebrow="First 7 Days"
        title="What to expect during your first week"
        subtitle="A quick timeline to keep your edge building every day."
        compact
        useCommitsGrid
      />

      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="space-y-5">
          {TIMELINE.map((item) => (
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
            onClick={onContinue}
            disabled={saving}
            className="rounded-full bg-[#34d399] px-8 py-3 text-sm font-semibold text-[#0f1f15] transition-colors hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Become an Insider Today"
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
