"use client"

import { useMemo } from "react"
import type { OddsGame } from "@/lib/types/odds"
import { formatAmericanOdds } from "@/lib/utils/odds"
import { normalizeTeamKey } from "@/lib/identity/sport"

type MarketEntry = {
  book: string
  bookKey?: string
  odds: number
  point?: number
}

const isTeamMatch = (a: string, b: string) => {
  const left = normalizeTeamKey(a)
  const right = normalizeTeamKey(b)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

const formatPoint = (value?: number) => {
  if (!Number.isFinite(value)) return ""
  const point = Number(value)
  return point > 0 ? `+${point}` : `${point}`
}

const formatTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "TBD"
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type BookMarketRow = {
  bookTitle: string
  bookKey?: string
  away?: MarketEntry | null
  home?: MarketEntry | null
  over?: MarketEntry | null
  under?: MarketEntry | null
  bestOdds: number | null
}

const resolveBestOdds = (entry?: MarketEntry | null, fallback?: number | null) => {
  if (!entry) return fallback ?? null
  return Math.max(entry.odds, fallback ?? Number.NEGATIVE_INFINITY)
}

const renderEntry = (
  entry?: MarketEntry | null,
  prefix?: string,
  isBest?: boolean
) => {
  if (!entry) return "-"
  const oddsLabel = formatAmericanOdds(entry.odds)
  const pointLabel = entry.point != null ? formatPoint(entry.point) : ""
  const label = [prefix, pointLabel, oddsLabel].filter(Boolean).join(" ")
  return (
    <span className={isBest ? "font-semibold text-emerald-200" : undefined}>
      {label}
    </span>
  )
}

const isPredictionMarket = (bookKey?: string) =>
  bookKey === "kalshi" || bookKey === "polymarket"

const resolveBestByCategory = (
  rows: BookMarketRow[],
  marketKey: MarketKey
) => {
  const best = {
    prediction: {
      away: Number.NEGATIVE_INFINITY,
      home: Number.NEGATIVE_INFINITY,
      over: Number.NEGATIVE_INFINITY,
      under: Number.NEGATIVE_INFINITY,
    },
    sportsbook: {
      away: Number.NEGATIVE_INFINITY,
      home: Number.NEGATIVE_INFINITY,
      over: Number.NEGATIVE_INFINITY,
      under: Number.NEGATIVE_INFINITY,
    },
  }

  rows.forEach((row) => {
    const category = isPredictionMarket(row.bookKey) ? "prediction" : "sportsbook"
    if (marketKey === "totals") {
      if (row.over?.odds != null) {
        best[category].over = Math.max(best[category].over, row.over.odds)
      }
      if (row.under?.odds != null) {
        best[category].under = Math.max(best[category].under, row.under.odds)
      }
      return
    }
    if (row.away?.odds != null) {
      best[category].away = Math.max(best[category].away, row.away.odds)
    }
    if (row.home?.odds != null) {
      best[category].home = Math.max(best[category].home, row.home.odds)
    }
  })

  return best
}

const buildBookRows = (game: OddsGame, marketKey: MarketKey) => {
  const rows: BookMarketRow[] = []
  const bookmakers = game.bookmakers ?? []
  bookmakers.forEach((book) => {
    const market = book.markets.find((item) => item.key === marketKey)
    if (!market) return
    const awayOutcome = market.outcomes.find((item) =>
      marketKey === "totals"
        ? item.name.toLowerCase() === "over"
        : isTeamMatch(item.name, game.away_team)
    )
    const homeOutcome = market.outcomes.find((item) =>
      marketKey === "totals"
        ? item.name.toLowerCase() === "under"
        : isTeamMatch(item.name, game.home_team)
    )
    const normalizeOutcome = (outcome?: typeof market.outcomes[number]) => {
      if (!outcome) return null
      const rawPoint = outcome.point
      const parsedPoint = typeof rawPoint === "number" ? rawPoint : Number(rawPoint)
      return {
        book: book.title,
        bookKey: book.key,
        odds: outcome.price,
        point: Number.isFinite(parsedPoint) ? parsedPoint : undefined,
      }
    }
    const away = normalizeOutcome(awayOutcome)
    const home = normalizeOutcome(homeOutcome)
    const bestOdds = resolveBestOdds(away, resolveBestOdds(home, null))
    rows.push({
      bookTitle: book.title,
      bookKey: book.key,
      away: marketKey === "totals" ? null : away,
      home: marketKey === "totals" ? null : home,
      over: marketKey === "totals" ? away : null,
      under: marketKey === "totals" ? home : null,
      bestOdds,
    })
  })

  return rows
}

type MarketKey = "h2h" | "spreads" | "totals"

export default function LiveOddsTable({
  games,
  loading,
  errorMessage,
  marketKey,
  sportKey,
}: {
  games: OddsGame[]
  loading: boolean
  errorMessage: string | null
  marketKey: MarketKey
  sportKey: string
}) {
  const sortedGames = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    ).getTime()
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    ).getTime()
    const upcoming = [...games].filter((game) => {
      const time = Date.parse(game.commence_time)
      return Number.isFinite(time) && time >= startOfToday
    })

    const needsNextDate =
      sportKey === "americanfootball_nfl" || sportKey === "basketball_ncaab"
    if (!needsNextDate) {
      return upcoming
        .filter((game) => {
          const time = Date.parse(game.commence_time)
          return Number.isFinite(time) && time <= endOfToday
        })
        .sort((a, b) => {
          const booksA = a.bookmakers?.length ?? 0
          const booksB = b.bookmakers?.length ?? 0
          if (booksA !== booksB) return booksB - booksA
          const timeA = Date.parse(a.commence_time)
          const timeB = Date.parse(b.commence_time)
          if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) return 0
          return timeA - timeB
        })
    }

    const dates = upcoming
      .map((game) => {
        const time = Date.parse(game.commence_time)
        if (!Number.isFinite(time)) return null
        const date = new Date(time)
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
      })
      .filter((value): value is number => Number.isFinite(value))
    const nextDate = dates.length ? Math.min(...dates) : null
    const filtered =
      nextDate == null
        ? []
        : upcoming.filter((game) => {
            const time = Date.parse(game.commence_time)
            if (!Number.isFinite(time)) return false
            const date = new Date(time)
            const dayKey = new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate()
            ).getTime()
            return dayKey === nextDate
          })
    return filtered
      .sort((a, b) => {
        const booksA = a.bookmakers?.length ?? 0
        const booksB = b.bookmakers?.length ?? 0
        if (booksA !== booksB) return booksB - booksA
        const timeA = Date.parse(a.commence_time)
        const timeB = Date.parse(b.commence_time)
        if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) return 0
        return timeA - timeB
      })
  }, [games, sportKey])

  if (errorMessage && !games.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-6 text-sm text-red-200">
        {errorMessage}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/60">
      {loading && !games.length ? (
        <div className="px-4 py-6 text-sm text-white/60">Loading odds...</div>
      ) : sortedGames.length === 0 ? (
        <div className="px-4 py-6 text-sm text-white/60">
          No odds available for this slate yet.
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {sortedGames.map((game) => {
            const away = game.away_team
            const home = game.home_team
            const bookRows = buildBookRows(game, marketKey).sort((a, b) => {
              const left = a.bestOdds ?? Number.NEGATIVE_INFINITY
              const right = b.bestOdds ?? Number.NEGATIVE_INFINITY
              return right - left
            })
            const bestByCategory = resolveBestByCategory(bookRows, marketKey)

            return (
              <div key={game.id} className="px-3 py-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/60">
                  <span>{formatTime(game.commence_time)}</span>
                  <span className="uppercase tracking-[0.2em] text-white/40">
                    {(game.bookmakers?.length ?? 0)} books
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {away} @ {home}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {bookRows.length === 0 ? (
                    <div className="text-xs text-white/50">No books listed.</div>
                  ) : (
                    bookRows.map((book) => {
                      const isPM = isPredictionMarket(book.bookKey)
                      const category = isPM ? "prediction" : "sportsbook"
                      const bestAway = book.away?.odds != null &&
                        book.away.odds === bestByCategory[category].away
                      const bestHome = book.home?.odds != null &&
                        book.home.odds === bestByCategory[category].home
                      const bestOver = book.over?.odds != null &&
                        book.over.odds === bestByCategory[category].over
                      const bestUnder = book.under?.odds != null &&
                        book.under.odds === bestByCategory[category].under
                      const hasBest =
                        bestAway || bestHome || bestOver || bestUnder

                      return (
                        <div
                          key={`${game.id}-${book.bookKey ?? book.bookTitle}`}
                          className={`min-w-[140px] rounded-2xl border px-3 py-2 text-[11px] ${
                            hasBest
                              ? "border-emerald-400/50 bg-emerald-500/10 text-white"
                              : "border-white/10 bg-black/70 text-white/70"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                              {book.bookTitle}
                            </div>
                            {hasBest && (
                              <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-emerald-200">
                                {isPM ? "Best PM" : "Best Book"}
                              </span>
                            )}
                          </div>
                        {marketKey === "totals" ? (
                          <div className="mt-2 space-y-1">
                            <div>{renderEntry(book.over, "O", bestOver)}</div>
                            <div>{renderEntry(book.under, "U", bestUnder)}</div>
                          </div>
                        ) : (
                          <div className="mt-2 space-y-1">
                            <div>{renderEntry(book.away, "A", bestAway)}</div>
                            <div>{renderEntry(book.home, "H", bestHome)}</div>
                          </div>
                        )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
