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
        const res = await fetch(`/api/news/latest?league=${league}&limit=3`)
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

  return (
    <div className="w-full max-w-3xl mx-auto bg-transparent px-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
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

      <div className="mt-2 space-y-2">
        {loading
          ? skeletons.map((_, idx) => (
              <div key={idx} className="rounded-lg border border-emerald-500/10 bg-transparent p-2.5 animate-pulse">
                <div className="h-3 w-2/3 rounded bg-emerald-900/40 mb-1.5" />
                <div className="h-3 w-1/3 rounded bg-gray-800/60" />
              </div>
            ))
          : articles.length > 0
          ? articles.map((article, idx) => (
              <motion.div
                key={article.url}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="group relative flex items-start gap-3 rounded-lg border border-transparent px-2.5 py-2 hover:border-emerald-500/30 hover:bg-emerald-900/10"
              >
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-emerald-200/70">{article.league}</div>
                  <Link href={article.url} target="_blank" className="block">
                    <div className="text-[13px] font-semibold text-white leading-tight line-clamp-2 group-hover:text-emerald-200">
                      {article.title}
                    </div>
                  </Link>
                </div>
                <div className="pointer-events-none absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-70" />
                <Link
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0"
                  aria-label={article.title}
                />
              </motion.div>
            ))
          : (
              <div className="rounded-lg border border-emerald-500/10 bg-transparent p-3 text-sm text-gray-300">
                {error || "No headlines available right now."}
              </div>
            )}
      </div>
    </div>
  )
}
