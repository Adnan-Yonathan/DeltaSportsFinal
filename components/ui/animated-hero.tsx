"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useLiveScores } from "@/hooks/use-live-scores"
import type { LiveScoreGame } from "@/lib/live-scores"

interface AnimatedHeroProps {
  staticText?: string
  rotatingTerms?: string[]
  interval?: number
}

const ALLOWED_LEAGUES = new Set<LiveScoreGame["league"]>([
  "nba",
  "nfl",
  "ncaab",
  "cfb",
  "nhl",
])

function AnimatedHero({
  staticText = "AI-powered betting",
  rotatingTerms = ["analytics", "models", "action", "edges", "lines", "tracking"],
  interval = 2000,
}: AnimatedHeroProps) {
  const [termIndex, setTermIndex] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideTerm, setGuideTerm] = useState<string | null>(null)
  const { data } = useLiveScores({ refreshInterval: 30000 })

  const bettingPhrases = useMemo(() => {
    if (!data?.games) return rotatingTerms

    const relevantGames = data.games.filter(
      (game: LiveScoreGame) => ALLOWED_LEAGUES.has(game.league) && game.bucket !== "completed"
    )

    const phrases: string[] = []

    const liveGames = relevantGames.filter((game) => game.bucket === "live")
    liveGames.forEach((game) => {
      const awayTeam = game.competitors.find((c) => c.homeAway === "away")
      const homeTeam = game.competitors.find((c) => c.homeAway === "home")
      if (awayTeam && homeTeam) {
        phrases.push(`${awayTeam.abbreviation} @ ${homeTeam.abbreviation} LIVE`)
      }
    })

    const upcomingGames = relevantGames.filter((game) => game.bucket === "upcoming")
    upcomingGames.forEach((game) => {
      const awayTeam = game.competitors.find((c) => c.homeAway === "away")
      const homeTeam = game.competitors.find((c) => c.homeAway === "home")
      if (awayTeam && homeTeam) {
        phrases.push(`${awayTeam.shortName} vs ${homeTeam.shortName}`)
      }
    })

    return phrases.length ? phrases : rotatingTerms
  }, [data, rotatingTerms])

  useEffect(() => {
    if (!bettingPhrases.length) return
    const timeoutId = setTimeout(() => {
      setTermIndex((prev) => (prev === bettingPhrases.length - 1 ? 0 : prev + 1))
    }, interval)
    return () => clearTimeout(timeoutId)
  }, [bettingPhrases, interval, termIndex])

  const openGuide = (term: string) => {
    setGuideTerm(term)
    setGuideOpen(true)
  }

  return (
    <div className="text-center">
      <h2 className="text-2xl sm:text-3xl font-bold text-white text-center font-mono leading-tight">
      {staticText}
      <br />
      <span className="relative block min-h-[2.2em] sm:min-h-[1.2em] w-full pt-4 sm:pt-8 px-2">
        <span className="invisible font-bold">analytics.</span>
        {bettingPhrases.map((term, index) => (
          <motion.button
            key={index}
            type="button"
            onClick={() => openGuide(term)}
            className="absolute left-0 right-0 inset-y-0 flex items-center justify-center"
            initial={{ opacity: 0, y: -50 }}
            transition={{ type: "spring", stiffness: 50 }}
            animate={
              termIndex === index
                ? {
                    y: 0,
                    opacity: 1,
                  }
                : {
                    y: termIndex > index ? -100 : 100,
                    opacity: 0,
                  }
            }
            style={{
              pointerEvents: termIndex === index ? "auto" : "none",
            }}
          >
            <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-1 text-[18px] sm:text-[20px] font-bold font-mono text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.25)]">
              {term}
            </span>
          </motion.button>
        ))}
      </span>
    </h2>
    {guideOpen && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl rounded-3xl border border-emerald-400/30 bg-black/95 p-6 text-left text-white shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">
                Whale Detector Guide
              </p>
              <h3 className="mt-2 text-lg font-semibold text-white">
                {guideTerm ?? "This matchup"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white hover:border-white/30"
            >
              Close
            </button>
          </div>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <p>
              Sharp Projections show the fair price for this market and the edge
              vs the listed book number. When the projection price is better than
              the market, you have a positive expected value spot.
            </p>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px]">
              <p className="font-semibold text-white">How to make money here:</p>
              <ol className="mt-2 list-decimal list-inside space-y-1 text-white/70">
                <li>Open Sharp Projections and find this matchup.</li>
                <li>Compare the fair line to the best available book price.</li>
                <li>Only bet when the edge stays positive across books.</li>
              </ol>
            </div>
            <p className="text-white/60">
              Use the best price highlighted in Line Shopping before the number
              moves.
            </p>
          </div>
        </motion.div>
      </div>
    )}
    </div>
  )
}

export { AnimatedHero }
