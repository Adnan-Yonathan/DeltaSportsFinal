 use client
import { useEffect, useMemo, useState } from \react\
import { motion } from \framer-motion\
import { useLiveScores } from \@/hooks/use-live-scores\
import type { LiveScoreGame } from \@/lib/live-scores\

interface AnimatedHeroProps {
  staticText?: string
  rotatingTerms?: string[]
  interval?: number
}

function AnimatedHero({
  staticText = \AI-powered betting\,
  rotatingTerms = [\analytics\, \models\, \action\, \edges\, \lines\, \tracking\],
  interval = 2000,
}: AnimatedHeroProps) {
  const [termIndex, setTermIndex] = useState(0)
  const { data } = useLiveScores({ refreshInterval: 30000 })

  const bettingPhrases = useMemo(() => {
    if (!data?.games) return rotatingTerms

    const allowedLeagues = new Set([\nba\, \nfl\, \ncaab\, \cfb\, \nhl\])
    const relevantGames = data.games.filter(
      (game: LiveScoreGame) => allowedLeagues.has(game.league) && game.bucket !== \completed\
    )

    const phrases: string[] = []
    const liveGames = relevantGames.filter((game: LiveScoreGame) => game.bucket === \live\)
    const upcomingGames = relevantGames.filter((game: LiveScoreGame) => game.bucket === \upcoming\)

    liveGames.forEach((game: LiveScoreGame) => {
      const awayTeam = game.competitors.find((c) => c.homeAway === \away\)
      const homeTeam = game.competitors.find((c) => c.homeAway === \home\)
      if (awayTeam && homeTeam) {
        phrases.push(${awayTeam.abbreviation} @  LIVE)
      }
    })

    upcomingGames.forEach((game: LiveScoreGame) => {
      const awayTeam = game.competitors.find((c) => c.homeAway === \away\)
      const homeTeam = game.competitors.find((c) => c.homeAway === \home\)
      if (awayTeam && homeTeam) {
        phrases.push(${awayTeam.shortName} vs )
      }
    })

    return phrases.length ? phrases : rotatingTerms
  }, [data, rotatingTerms])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTermIndex((prev) => (prev === bettingPhrases.length - 1 ? 0 : prev + 1))
    }, interval)
    return () => clearTimeout(timeoutId)
  }, [termIndex, bettingPhrases, interval])

  return (
    <h2 className=\text-3xl font-bold text-white text-center font-mono\>
      {staticText}
      <br />
      <span className=\relative block min-h-[1.2em] w-full pt-8\>
        <span className=\invisible font-bold\>analytics.</span>
        {bettingPhrases.map((term, index) => (
          <motion.span
            key={index}
            className=\absolute left-0 right-0 inset-y-0 font-bold bg-gradient-to-r from-emerald-400 to-emerald-400 bg-clip-text text-transparent whitespace-nowrap flex items-center justify-center\
            initial={{ opacity: 0, y: -50 }}
            transition={{ type: \spring\, stiffness: 50 }}
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
