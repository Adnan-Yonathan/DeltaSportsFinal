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

function AnimatedHero({
  staticText = "AI-powered betting",
  rotatingTerms = ["analytics", "models", "action", "edges", "lines", "tracking"],
  interval = 2000,
}: AnimatedHeroProps) {
  const [termIndex, setTermIndex] = useState(0)
  const { data } = useLiveScores({ refreshInterval: 30000 })

  // Generate phrases from upcoming and live games only
  const bettingPhrases = useMemo(() => {
    if (!data?.games) return rotatingTerms

    const phrases: string[] = []
    const upcomingGames = data.games.filter((game: LiveScoreGame) => game.bucket === "upcoming")
    const liveGames = data.games.filter((game: LiveScoreGame) => game.bucket === "live")

    // Add phrases based on live games
    liveGames.forEach((game: LiveScoreGame) => {
      const awayTeam = game.competitors.find(c => c.homeAway === "away")
      const homeTeam = game.competitors.find(c => c.homeAway === "home")

      if (awayTeam && homeTeam) {
        phrases.push(`${awayTeam.abbreviation} @ ${homeTeam.abbreviation} LIVE`)
      }
    })

    // Add phrases based on upcoming games
    upcomingGames.forEach((game: LiveScoreGame) => {
      const awayTeam = game.competitors.find(c => c.homeAway === "away")
      const homeTeam = game.competitors.find(c => c.homeAway === "home")

      if (awayTeam && homeTeam) {
        // Format like "Lakers vs Celtics"
        phrases.push(`${awayTeam.shortName} vs ${homeTeam.shortName}`)
      }
    })

    // If we have game phrases, return them; otherwise fall back to default terms
    return phrases.length > 0 ? phrases : rotatingTerms
  }, [data, rotatingTerms])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (termIndex === bettingPhrases.length - 1) {
        setTermIndex(0)
      } else {
        setTermIndex(termIndex + 1)
      }
    }, interval)
    return () => clearTimeout(timeoutId)
  }, [termIndex, bettingPhrases, interval])

  return (
    <h2 className="text-3xl font-bold text-white text-center font-mono">
      {staticText}
      <br />
      <span className="relative block min-h-[1.2em] w-full pt-8">
        {/* Invisible placeholder to maintain height and proper spacing */}
        <span className="invisible font-bold">analytics.</span>
        {bettingPhrases.map((term, index) => (
          <motion.span
            key={index}
            className="absolute left-0 right-0 inset-y-0 font-bold bg-gradient-to-r from-emerald-400 to-emerald-400 bg-clip-text text-transparent whitespace-nowrap flex items-center justify-center"
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
          >
            {term}.
          </motion.span>
        ))}
      </span>
    </h2>
  )
}

export { AnimatedHero }
