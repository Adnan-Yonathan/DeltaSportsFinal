"use client"

import { useEffect, useState, useMemo } from "react"
import { motion } from "framer-motion"
import Link from "next/link"

type Article = {
  title: string
  description?: string
  url: string
  image?: string
  published?: string
  byline?: string
  league: string
}

type LeagueKey = "nba" | "nfl" | "mlb" | "nhl"

const LEAGUE_TABS: { key: LeagueKey; label: string }[] = [
  { key: "nba", label: "NBA" },
  { key: "nfl", label: "NFL" },
  { key: "mlb", label: "MLB" },
  { key: "nhl", label: "NHL" },
]

export function LatestNewsStrip() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [league, setLeague] = useState<LeagueKey>("nba")

  const skeletons = useMemo(() => Array.from({ length: 4 }), [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/news/latest?league=${league}&limit=10`)
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data = await res.json()
        setArticles(Array.isArray(data?.articles) ? data.articles : [])
      } catch (err) {
        console.warn("[LatestNewsStrip] fetch failed", err)
        setError("News unavailable right now")
        setArticles([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [league])

  // Duplicate articles for seamless loop
  const duplicatedArticles = useMemo(() => {
    return articles.length > 0 ? [...articles, ...articles] : []
  }, [articles])

  return (
    <div className="w-full bg-transparent">
      {/* Mobile: Horizontal League Selector on Top */}
      <div className="flex md:hidden flex-wrap items-center justify-center gap-2 mb-3 px-1">
        {LEAGUE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setLeague(tab.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              league === tab.key
                ? "bg-emerald-500 text-white"
                : "border border-emerald-500/30 text-emerald-200 hover:bg-emerald-900/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop: Side by Side Layout with Selector Outside */}
      <div className="flex items-center justify-center gap-6">
        {/* Quadrant League Selector - Hidden on Mobile */}
        <div className="hidden md:grid grid-cols-2 gap-2">
          {LEAGUE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setLeague(tab.key)}
              className={`rounded-lg px-4 py-3 text-xs font-semibold transition ${
                league === tab.key
                  ? "bg-emerald-500 text-white"
                  : "border border-emerald-500/30 text-emerald-200 hover:bg-emerald-900/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Slideshow Container - Aligned with Chatbox */}
        <div className="w-full max-w-3xl relative min-h-[80px] px-1">
        {loading ? (
          <div className="rounded-lg border border-emerald-500/10 bg-transparent p-4 animate-pulse">
            <div className="h-3 w-2/3 rounded bg-emerald-900/40 mb-2" />
            <div className="h-3 w-1/2 rounded bg-gray-800/60" />
          </div>
        ) : articles.length > 0 ? (
          <div className="relative overflow-hidden rounded-lg border border-emerald-500/20 bg-emerald-900/5 py-4">
            {/* Gradient overlays for fade effect */}
            <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black via-black/50 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black via-black/50 to-transparent z-10 pointer-events-none" />

            {/* Scrolling ticker */}
            <motion.div
              className="flex gap-8 items-center"
              animate={{
                x: [0, -100 * articles.length],
              }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: articles.length * 2,
                  ease: "linear",
                },
              }}
            >
              {duplicatedArticles.map((article, index) => (
                <Link
                  key={`${article.url}-${index}`}
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-shrink-0 group hover:opacity-80 transition-opacity"
                >
                  <div className="min-w-[350px] max-w-[350px]">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-emerald-200/70 mb-1">
                      {article.league}
                    </div>
                    <div className="text-sm font-semibold text-white leading-tight line-clamp-2 group-hover:text-emerald-200">
                      {article.title}
                    </div>
                  </div>
                </Link>
              ))}
            </motion.div>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-500/10 bg-transparent p-4 text-sm text-gray-300">
            {error || "No headlines available right now."}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
