"use client"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
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
  const [bettingPhrases, setBettingPhrases] = useState<string[]>(rotatingTerms)

  useEffect(() => {
    let isCancelled = false
    const DAY_MS = 24 * 60 * 60 * 1000

    const fetchPhrases = async () => {
      try {
        const today = new Date()
        const dates = Array.from({ length: 4 }, (_, index) => {
          const future = new Date(today.getTime() + index * DAY_MS)
          return future.toISOString().slice(0, 10)
        })

        const responses = await Promise.all(
          dates.map((date) =>
            fetch(`/api/live-scores?date=${encodeURIComponent(date)}`, { cache: "no-store" })
          )
        )

        const payloads = await Promise.all(
          responses.map(async (res) => {
            if (!res.ok) return null
            return res.json().catch(() => null)
          })
        )

        const nbaGames = payloads
          .flatMap((payload) => (payload?.games ?? []))
          .filter(
            (game: LiveScoreGame) =>
              game.league === "nba" && (game.bucket === "live" || game.bucket === "upcoming")
          )

        const phrases: string[] = []

        nbaGames
          .filter((game) => game.bucket === "live")
          .forEach((game) => {
            const awayTeam = game.competitors.find((c) => c.homeAway === "away")
            const homeTeam = game.competitors.find((c) => c.homeAway === "home")
            if (awayTeam && homeTeam) {
              phrases.push(`${awayTeam.abbreviation} @ ${homeTeam.abbreviation} LIVE`)
            }
          })

        nbaGames
          .filter((game) => game.bucket === "upcoming")
          .forEach((game) => {
            const awayTeam = game.competitors.find((c) => c.homeAway === "away")
            const homeTeam = game.competitors.find((c) => c.homeAway === "home")
            if (awayTeam && homeTeam) {
              phrases.push(`${awayTeam.shortName} vs ${homeTeam.shortName}`)
            }
          })

        if (!isCancelled) {
          setBettingPhrases(phrases.length ? phrases : rotatingTerms)
        }
      } catch (error) {
        console.error("[AnimatedHero] failed to fetch NBA games", error)
        if (!isCancelled) {
          setBettingPhrases(rotatingTerms)
        }
      }
    }

    fetchPhrases()
    const intervalId = setInterval(fetchPhrases, 60_000)

    return () => {
      isCancelled = true
      clearInterval(intervalId)
    }
  }, [rotatingTerms])

  const phrasesToShow = bettingPhrases.length ? bettingPhrases : rotatingTerms

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTermIndex((prev) => (prev === phrasesToShow.length - 1 ? 0 : prev + 1))
    }, interval)
    return () => clearTimeout(timeoutId)
  }, [termIndex, phrasesToShow, interval])

  return (
    <h2 className="text-3xl font-bold text-white text-center font-mono">
      {staticText}
      <br />
      <span className="relative block min-h-[1.2em] w-full pt-8">
        <span className="invisible font-bold">analytics.</span>
        {phrasesToShow.map((term, index) => (
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
