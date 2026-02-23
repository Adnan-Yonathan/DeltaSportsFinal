"use client"

import React, { useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

type OnboardingProfile = {
  primaryIntent?: string
  betFocus?: string
  goals?: string[]
}

type RecommendedFeature = {
  id: string
  title: string
  description: string
  href: string
  tags: string[]
}

interface StepRecommendationsProps {
  onValidation: (isValid: boolean) => void
  profile?: OnboardingProfile
  onContinue?: () => void
}

const uniq = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const buildRecommendations = (profile?: OnboardingProfile): RecommendedFeature[] => {
  const primaryIntent = profile?.primaryIntent ?? ""
  const betFocus = profile?.betFocus ?? ""
  const goals = uniq(profile?.goals ?? [])

  const base: RecommendedFeature[] = [
    {
      id: "sharp-projections",
      title: "Sharp Projections",
      description: "Scan today's board for mispriced spreads/totals/moneylines.",
      href: "/market-projections",
      tags: ["Projections", "CLV"],
    },
    {
      id: "sharp-props",
      title: "Sharp Props",
      description: "Read prop orderbook walls and sharp lean before the market moves.",
      href: "/sharp-props",
      tags: ["Props", "Orderbook"],
    },
    {
      id: "whale-feed",
      title: "Whale Feed",
      description: "See big-money activity and timing windows in real time.",
      href: "/sharp-detector",
      tags: ["Whales", "Alerts"],
    },
    {
      id: "research-mode",
      title: "Research Mode",
      description: "Explain movement, validate a thesis, and study closes.",
      href: "/research/sharp-action",
      tags: ["Research", "Movement"],
    },
    {
      id: "live-scores",
      title: "Live Scores + Line Shopping",
      description: "Compare odds fast and lock the best number.",
      href: "/live-scores",
      tags: ["Line shop"],
    },
    {
      id: "chat",
      title: "Delta Chat",
      description: "Ask for matchup notes, prop breakdowns, and bet checks.",
      href: "/chat",
      tags: ["Copilot"],
    },
  ]

  const boost: Record<string, string[]> = {
    "projection-models": ["sharp-projections", "research-mode", "live-scores"],
    "track-profitable-bettors": ["whale-feed", "research-mode", "live-scores"],
    "find-whales": ["whale-feed", "live-scores", "research-mode"],
    "historical-trends": ["research-mode", "sharp-projections", "live-scores"],
  }

  const boosts = boost[primaryIntent] ?? []

  const goalBoosts: string[] = []
  if (goals.includes("learn-research")) goalBoosts.push("research-mode", "chat")
  if (goals.includes("tail-sharp-action")) goalBoosts.push("whale-feed", "live-scores")
  if (goals.includes("become-profitable")) goalBoosts.push("sharp-projections", "research-mode")
  if (goals.includes("supercharge")) goalBoosts.push("live-scores", "whale-feed")

  if (betFocus === "player-props") goalBoosts.push("sharp-props")
  if (betFocus === "game-markets") goalBoosts.push("sharp-projections")

  const ranking = new Map<string, number>()
  const bump = (id: string, score: number) => ranking.set(id, (ranking.get(id) ?? 0) + score)
  boosts.forEach((id) => bump(id, 4))
  goalBoosts.forEach((id) => bump(id, 2))

  return base
    .slice()
    .sort((a, b) => (ranking.get(b.id) ?? 0) - (ranking.get(a.id) ?? 0))
    .slice(0, 4)
}

export function StepRecommendations({ onValidation, profile, onContinue }: StepRecommendationsProps) {
  useEffect(() => {
    onValidation(true)
  }, [onValidation])

  const recommendations = useMemo(
    () => buildRecommendations(profile),
    [profile]
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">Next steps</p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Recommended features to try first
        </h1>
        <p className="text-sm text-white/80 sm:text-base">
          Based on what you told us, here&apos;s where you&apos;ll see value fastest.
        </p>
      </div>

      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {recommendations.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group rounded-2xl border border-white/10 bg-black/40 p-5 transition-colors hover:border-emerald-400/40 hover:bg-black/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-white/65">{item.description}</div>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                  Open
                </span>
              </div>

              {item.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span
                      key={`${item.id}-${tag}`}
                      className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200/90"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              onContinue?.()
            }}
            className="inline-flex items-center gap-2 rounded-full bg-[#34d399] px-8 py-3 text-sm font-semibold text-[#0f1f15] transition-colors hover:bg-[#16a34a]"
          >
            Open Delta
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
