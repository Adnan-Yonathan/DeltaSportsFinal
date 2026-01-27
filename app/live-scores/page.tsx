"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import clsx from "clsx"
import { ArrowLeft, Calendar, ChevronDown, ChevronLeft, ChevronRight, Lock, RefreshCw, X } from "lucide-react"
import { useLiveScores } from "@/hooks/use-live-scores"
import { useGameDetails } from "@/hooks/use-game-details"
import { ESPN_LEAGUES, type LeagueId, type LiveScoreGame, type LiveScoreGameDetails, type GamePlayerSummary } from "@/lib/live-scores"
import { normalizeTeamKey } from "@/lib/identity/sport"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatus, type MembershipInfo } from "@/lib/utils/membership"
import type { Bookmaker, OddsGame, OddsMarket } from "@/lib/types/odds"

const LEAGUE_TABS: Array<{ id: LeagueId; label: string }> =
  ESPN_LEAGUES.map((league) => ({ id: league.id, label: league.label }))

const CONFERENCE_FILTERS: Partial<Record<LeagueId, Array<{ value: string; label: string }>>> = {
  ncaab: [
    { value: "ACC", label: "ACC" },
    { value: "B12", label: "Big 12" },
    { value: "B10", label: "Big Ten" },
    { value: "SEC", label: "SEC" },
    { value: "PAC", label: "Pac-12" },
    { value: "BE", label: "Big East" },
    { value: "MW", label: "Mountain West" },
    { value: "WCC", label: "WCC" },
    { value: "A10", label: "A-10" },
  ],
  cfb: [
    { value: "ACC", label: "ACC" },
    { value: "SEC", label: "SEC" },
    { value: "B12", label: "Big 12" },
    { value: "B1G", label: "Big Ten" },
    { value: "PAC", label: "Pac-12" },
    { value: "AAC", label: "AAC" },
    { value: "MW", label: "MWC" },
    { value: "SBC", label: "Sun Belt" },
    { value: "MAC", label: "MAC" },
  ],
}

const BUCKET_ORDER: Array<{ key: LiveScoreGame["bucket"]; title: string }> = [  
  { key: "live", title: "Live Now" },
  { key: "upcoming", title: "Upcoming Games" },
  { key: "completed", title: "Recent Finals" },
]

const ODDS_SPORT_KEY_BY_LEAGUE: Record<LeagueId, string> = {
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  nhl: "icehockey_nhl",
  cfb: "americanfootball_ncaaf",
  ncaab: "basketball_ncaab",
}

const PROPS_SUPPORTED_SPORTS = new Set([
  "basketball_nba",
  "americanfootball_nfl",
  "icehockey_nhl",
])

const PROP_MARKETS_BY_SPORT: Record<string, string[]> = {
  basketball_nba: ["points", "rebounds", "assists", "threes", "pra"],
  americanfootball_nfl: [
    "passing_yards",
    "rushing_yards",
    "receiving_yards",
    "receptions",
  ],
  icehockey_nhl: ["points", "shots_on_goal"],
}

type PropOddsEntry = { book: string; odds: number; line?: number }
type PropMarket = {
  line: number
  over: { best: number; bestBook: string; allBooks: PropOddsEntry[] }
  under: { best: number; bestBook: string; allBooks: PropOddsEntry[] }
  lines?: Array<{ book: string; line: number; overOdds?: number; underOdds?: number }>
}

type PlayerProp = {
  player: string
  team?: string
  teamAbbr?: string
  position?: string
  game?: string
  markets: Record<string, PropMarket>
}

type PlayerPropsResponse = {
  sport: string
  count: number
  data: PlayerProp[]
}

type ArbitrageResult = {
  market: "moneyline" | "spreads" | "totals"
  profitPct: number
  line?: number
}

const todayYMD = () => new Date().toISOString().slice(0, 10)

function formatStartTime(dateString: string) {
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date)
  } catch {
    return ""
  }
}

function formatDisplayDate(dateString: string | undefined) {
  if (!dateString) return ""
  try {
    const date = new Date(`${dateString}T00:00:00Z`)
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date)
  } catch {
    return dateString
  }
}

const sanitizeText = (text?: string | null) =>
  text ? text.replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, "").trim() : ""

function adjustDate(date: string, delta: number) {
  const parsed = new Date(`${date}T00:00:00`)
  parsed.setDate(parsed.getDate() + delta)
  return parsed.toISOString().slice(0, 10)
}

function resolveHeadshot(src?: string | null) {
  if (!src) return null
  if (src.startsWith("http")) return src
  return `https:${src}`
}

const groupByLeague = (games: LiveScoreGame[]) => {
  const map = new Map<string, LiveScoreGame[]>()
  games.forEach((game) => {
    const key = game.leagueLabel ?? game.league
    const bucket = map.get(key) ?? []
    bucket.push(game)
    map.set(key, bucket)
  })
  return Array.from(map.entries())
}

const formatOdds = (value?: number) => {
  if (!Number.isFinite(value)) return "-"
  const rounded = Math.round(value as number)
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

const formatPoint = (value?: number, decimals = 1, showSign = true) => {
  if (!Number.isFinite(value)) return "-"
  const fixed = (value as number).toFixed(decimals)
  const trimmed = decimals > 0 ? fixed.replace(/\.0$/, "") : fixed
  if (!showSign) return trimmed
  return value && value > 0 ? `+${trimmed}` : trimmed
}

const formatMarketLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())

const formatLineOdds = (
  line?: number,
  odds?: number,
  showSign = true,
  book?: string,
  probability?: number
) => {
  const lineLabel = formatPoint(line, 1, showSign)
  const oddsLabel = formatOddsDisplay(odds, book, probability)
  if (lineLabel === "-" && oddsLabel === "-") return "-"
  if (lineLabel === "-") return oddsLabel
  if (oddsLabel === "-") return lineLabel
  return `${lineLabel} ${oddsLabel}`
}

const formatPeriodLabel = (league: LeagueId, index: number) => {
  if (league === "ncaab") {
    const base = ["H1", "H2"]
    if (index < base.length) return base[index]
    return `OT${index - base.length + 1}`
  }
  if (league === "nhl") {
    const base = ["1st", "2nd", "3rd"]
    if (index < base.length) return base[index]
    return `OT${index - base.length + 1}`
  }
  const base = ["Q1", "Q2", "Q3", "Q4"]
  if (index < base.length) return base[index]
  return `OT${index - base.length + 1}`
}

const toYmd = (value?: string) => {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toISOString().slice(0, 10)
}

const buildMatchKey = (away: string, home: string) =>
  `${normalizeTeamKey(away)}@${normalizeTeamKey(home)}`

const isTeamMatch = (a: string, b: string) => {
  const left = normalizeTeamKey(a)
  const right = normalizeTeamKey(b)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

const resolveMarketLine = (market: OddsMarket) => {
  const rawPoint = market.outcomes.find((outcome) =>
    Number.isFinite(outcome.point)
  )?.point
  if (!Number.isFinite(rawPoint)) return null
  const line = Number(rawPoint)
  if (market.key.startsWith("spreads")) return Math.abs(line)
  return line
}

const buildMarketSignature = (market: OddsMarket) => {
  const line = resolveMarketLine(market)
  const lineLabel = Number.isFinite(line) ? `:${line}` : ""
  return `${market.key}${lineLabel}`
}

const mergeMarkets = (base: OddsMarket[], additions: OddsMarket[]) => {
  const merged = [...base]
  additions.forEach((market) => {
    const signature = buildMarketSignature(market)
    const index = merged.findIndex(
      (current) => buildMarketSignature(current) === signature
    )
    if (index === -1) {
      merged.push(market)
      return
    }
    if (market.outcomes.length > merged[index].outcomes.length) {
      merged[index] = market
    }
  })
  return merged
}

const mergeBookmakers = (base: Bookmaker[], additions: Bookmaker[]) => {
  const merged = [...base]
  additions.forEach((book) => {
    const index = merged.findIndex((current) => current.key === book.key)
    if (index === -1) {
      merged.push(book)
      return
    }
    merged[index] = {
      ...merged[index],
      markets: mergeMarkets(merged[index].markets, book.markets),
    }
  })
  return merged
}

const mergeOddsGames = (base: OddsGame, addition: OddsGame): OddsGame => ({
  ...base,
  bookmakers: mergeBookmakers(base.bookmakers, addition.bookmakers),
})

const getTeamsFromGame = (game: LiveScoreGame) => {
  const home = game.competitors.find((team) => team.homeAway === "home")
  const away = game.competitors.find((team) => team.homeAway === "away")
  const fallback = game.competitors[0]
  return {
    home,
    away,
    homeName: home?.name || fallback?.name || "",
    awayName: away?.name || game.competitors[1]?.name || fallback?.name || "",
    homeAbbr: home?.abbreviation || home?.shortName || "",
    awayAbbr: away?.abbreviation || away?.shortName || "",
  }
}

const getLineScoreColumns = (game: LiveScoreGame) => {
  const lineOwner = game.competitors.reduce(
    (current, team) =>
      team.linescore && team.linescore.length > current.length ? team.linescore : current,
    [] as NonNullable<LiveScoreGame["competitors"][number]["linescore"]>
  )
  return lineOwner.map((entry, index) => entry.label || formatPeriodLabel(game.league, index))
}

type MarketEntry = {
  book: string
  odds: number
  point?: number
  probability?: number
}

const averageOf = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

const impliedProbability = (odds: number) => {
  if (!Number.isFinite(odds)) return null
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
}

const isPredictionMarketBook = (book?: string) => {
  const normalized = (book || "").toLowerCase()
  return normalized === "polymarket" || normalized === "kalshi"
}

const formatProbability = (value?: number | null, decimals = 1) => {
  if (!Number.isFinite(value)) return "-"
  return `${((value as number) * 100).toFixed(decimals)}%`
}

const resolveEntryProbability = (probability?: number, odds?: number) => {
  if (Number.isFinite(probability)) return probability as number
  if (!Number.isFinite(odds)) return null
  return impliedProbability(odds as number)
}

const formatOddsDisplay = (
  odds?: number,
  book?: string,
  probability?: number
) => {
  const oddsLabel = formatOdds(odds)
  if (!isPredictionMarketBook(book)) return oddsLabel
  const prob = resolveEntryProbability(probability, odds)
  if (prob == null) return oddsLabel
  return `${formatProbability(prob)} (${oddsLabel})`
}

const filterOddsGameForLive = (
  oddsGame: OddsGame | null,
  bucket?: LiveScoreGame["bucket"]
) => {
  if (!oddsGame) return null
  if (bucket === "live") return null
  return oddsGame
}

const calculateArbProfit = (oddsA?: number, oddsB?: number) => {
  if (!Number.isFinite(oddsA) || !Number.isFinite(oddsB)) return null
  const probA = impliedProbability(oddsA as number)
  const probB = impliedProbability(oddsB as number)
  if (probA == null || probB == null) return null
  const total = probA + probB
  if (total >= 1) return null
  return (1 / total - 1) * 100
}

const bestOddsByLine = (entries: MarketEntry[]) => {
  const map = new Map<number, MarketEntry>()
  entries.forEach((entry) => {
    if (!Number.isFinite(entry.point)) return
    const line = entry.point as number
    const existing = map.get(line)
    if (!existing || entry.odds > existing.odds) {
      map.set(line, entry)
    }
  })
  return map
}

const findArbitrage = (
  oddsGame: OddsGame | null,
  homeName: string,
  awayName: string
): ArbitrageResult | null => {
  if (!oddsGame) return null
  const results: ArbitrageResult[] = []

  const homeMl = pickBestEntry(
    collectOutcomeEntries(oddsGame, "h2h", homeName),
    "h2h"
  )
  const awayMl = pickBestEntry(
    collectOutcomeEntries(oddsGame, "h2h", awayName),
    "h2h"
  )
  const mlProfit = calculateArbProfit(homeMl?.odds, awayMl?.odds)
  if (mlProfit != null && mlProfit > 0) {
    results.push({ market: "moneyline", profitPct: mlProfit })
  }

  const homeSpreads = collectOutcomeEntries(oddsGame, "spreads", homeName)
  const awaySpreads = collectOutcomeEntries(oddsGame, "spreads", awayName)
  const bestHomeByLine = bestOddsByLine(homeSpreads)
  const bestAwayByLine = bestOddsByLine(awaySpreads)
  bestHomeByLine.forEach((homeEntry, line) => {
    const awayEntry = bestAwayByLine.get(-line)
    if (!awayEntry) return
    const profit = calculateArbProfit(homeEntry.odds, awayEntry.odds)
    if (profit != null && profit > 0) {
      results.push({ market: "spreads", profitPct: profit, line })
    }
  })

  const overTotals = collectOutcomeEntries(oddsGame, "totals", "over")
  const underTotals = collectOutcomeEntries(oddsGame, "totals", "under")
  const bestOverByLine = bestOddsByLine(overTotals)
  const bestUnderByLine = bestOddsByLine(underTotals)
  bestOverByLine.forEach((overEntry, line) => {
    const underEntry = bestUnderByLine.get(line)
    if (!underEntry) return
    const profit = calculateArbProfit(overEntry.odds, underEntry.odds)
    if (profit != null && profit > 0) {
      results.push({ market: "totals", profitPct: profit, line })
    }
  })

  if (!results.length) return null
  return results.reduce((best, current) =>
    current.profitPct > best.profitPct ? current : best
  )
}

const pickBestEntry = (entries: MarketEntry[], marketKey: string) => {
  if (!entries.length) return null
  return entries.reduce((best, current) => {
    if (!best) return current
    if (marketKey === "spreads") {
      const bestPoint = best.point ?? Number.NEGATIVE_INFINITY
      const currentPoint = current.point ?? Number.NEGATIVE_INFINITY
      if (currentPoint > bestPoint) return current
      if (currentPoint === bestPoint && current.odds > best.odds) return current
      return best
    }
    if (current.odds > best.odds) return current
    return best
  }, entries[0])
}

const collectOutcomeEntries = (
  oddsGame: OddsGame | null,
  marketKey: string,
  outcomeName: string
) => {
  const entries: MarketEntry[] = []
  if (!oddsGame) return entries
  oddsGame.bookmakers.forEach((book) => {
    const markets = book.markets.filter((market) => market.key === marketKey)
    markets.forEach((market) => {
      const outcome = market.outcomes.find((item) =>
        marketKey === "totals"
          ? item.name.toLowerCase() === outcomeName.toLowerCase()
          : isTeamMatch(item.name, outcomeName)
      )
      if (outcome) {
        const rawPoint = outcome.point
        const parsedPoint =
          typeof rawPoint === "number" ? rawPoint : Number(rawPoint)
        entries.push({
          book: book.title,
          odds: outcome.price,
          point: Number.isFinite(parsedPoint) ? parsedPoint : undefined,
          probability: outcome.probability,
        })
      }
    })
  })
  return entries
}

const buildMarketRows = (
  oddsGame: OddsGame | null,
  marketKey: string,
  homeName: string,
  awayName: string
) => {
  if (!oddsGame) return [] as Array<Record<string, any>>
  const rows: Array<Record<string, any>> = []
  oddsGame.bookmakers.forEach((book) => {
    const markets = book.markets.filter((market) => market.key === marketKey)
    markets.forEach((market) => {
      if (marketKey === "h2h") {
        const home = market.outcomes.find((o) => isTeamMatch(o.name, homeName))
        const away = market.outcomes.find((o) => isTeamMatch(o.name, awayName))
        if (home || away) {
          rows.push({
            book: book.title,
            homeOdds: home?.price,
            homeProbability: home?.probability,
            awayOdds: away?.price,
            awayProbability: away?.probability,
          })
        }
        return
      }
      if (marketKey === "spreads") {
        const home = market.outcomes.find((o) => isTeamMatch(o.name, homeName))
        const away = market.outcomes.find((o) => isTeamMatch(o.name, awayName))
        if (home || away) {
          const homePoint =
            typeof home?.point === "number" ? home.point : Number(home?.point)
          const awayPoint =
            typeof away?.point === "number" ? away.point : Number(away?.point)
          rows.push({
            book: book.title,
            homeLine: Number.isFinite(homePoint) ? homePoint : undefined,
            homeOdds: home?.price,
            homeProbability: home?.probability,
            awayLine: Number.isFinite(awayPoint) ? awayPoint : undefined,
            awayOdds: away?.price,
            awayProbability: away?.probability,
          })
        }
        return
      }
      if (marketKey === "totals") {
        const over = market.outcomes.find((o) => o.name.toLowerCase() === "over")
        const under = market.outcomes.find((o) => o.name.toLowerCase() === "under")
        if (over || under) {
          const overPoint =
            typeof over?.point === "number" ? over.point : Number(over?.point)
          const underPoint =
            typeof under?.point === "number" ? under.point : Number(under?.point)
          const resolvedLine = Number.isFinite(overPoint)
            ? overPoint
            : Number.isFinite(underPoint)
              ? underPoint
              : undefined
          rows.push({
            book: book.title,
            line: resolvedLine,
            overOdds: over?.price,
            overProbability: over?.probability,
            underOdds: under?.price,
            underProbability: under?.probability,
          })
        }
      }
    })
  })
  return rows
}

const EMPTY_ODDS_BY_LEAGUE: Record<LeagueId, OddsGame[]> = {
  nba: [],
  nfl: [],
  ncaab: [],
  nhl: [],
  cfb: [],
}

export default function LiveScoresPage() {
  const [activeLeague, setActiveLeague] = useState<(typeof LEAGUE_TABS)[number]["id"]>(LEAGUE_TABS[0]?.id)
  const [selectedDate, setSelectedDate] = useState<string>(todayYMD())
  const [selectedGame, setSelectedGame] = useState<LiveScoreGame | null>(null)
  const [conference, setConference] = useState<string>("")
    const [lineShoppingGame, setLineShoppingGame] = useState<LiveScoreGame | null>(null)
  const [oddsByLeague, setOddsByLeague] = useState<Record<LeagueId, OddsGame[]>>(
    EMPTY_ODDS_BY_LEAGUE
  )
  const [oddsLoading, setOddsLoading] = useState(false)
  const [oddsError, setOddsError] = useState<string | null>(null)
  const [propsByGame, setPropsByGame] = useState<Record<string, PlayerProp[]>>(
    {}
  )
  const [propsLoadingByGame, setPropsLoadingByGame] = useState<Record<string, boolean>>({})
  const [propsErrorByGame, setPropsErrorByGame] = useState<Record<string, string | null>>({})
  const [oddsRefreshToken, setOddsRefreshToken] = useState(0)
  const [arbDropdownOpen, setArbDropdownOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const { data, loading, error, lastUpdated, refetch, isRefreshing } = useLiveScores({
    refreshInterval: 1000,
    date: selectedDate,
  })
  const detailsState = useGameDetails({
    league: selectedGame?.league,
    eventId: selectedGame?.eventId,
    enabled: Boolean(selectedGame),
  })
  const filteredGames = useMemo(() => {
    if (!data?.games) return []
    const leagueFiltered = data.games.filter((game) => game.league === activeLeague)

    if (!conference || !(activeLeague in CONFERENCE_FILTERS)) {
      return leagueFiltered
    }

    const target = conference.toLowerCase()
    return leagueFiltered.filter((game) =>
      game.competitors?.some((team) => {
        const conf = String(team.conferenceAbbr || team.conferenceName || "").toLowerCase()
        return conf === target || conf.includes(target)
      })
    )
  }, [data, activeLeague, conference])

  // Reset conference filter when league changes
  useEffect(() => {
    setConference("")
    setLineShoppingGame(null)
  }, [activeLeague])

  useEffect(() => {
    let isMounted = true
    const loadUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!isMounted) return
        if (!user) {
          setMembership(null)
          setAuthLoading(false)
          return
        }
        const membershipInfo = getMembershipStatus(user.user_metadata)
        setMembership(membershipInfo)
        setAuthLoading(false)
      } catch (err) {
        if (!isMounted) return
        console.error("[live-scores] auth check failed", err)
        setMembership(null)
        setAuthLoading(false)
      }
    }
    loadUser()
    return () => {
      isMounted = false
    }
  }, [supabase])

  const oddsSportKey = ODDS_SPORT_KEY_BY_LEAGUE[activeLeague]
  const isDevAccess = process.env.NODE_ENV !== "production"
  const canLoadOdds = Boolean(oddsSportKey && (membership?.hasFullAccess || isDevAccess))
  const canLoadProps = Boolean(
    canLoadOdds && oddsSportKey && PROPS_SUPPORTED_SPORTS.has(oddsSportKey)
  )
  const wantsAllProps = true
  const propMarkets = useMemo(() => {
    if (!oddsSportKey) return []
    return PROP_MARKETS_BY_SPORT[oddsSportKey] ?? []
  }, [oddsSportKey])

  const oddsGames = useMemo(
    () => oddsByLeague[activeLeague] ?? [],
    [oddsByLeague, activeLeague]
  )
  const oddsMatchIndex = useMemo(() => {
    const map = new Map<string, OddsGame>()
    oddsGames.forEach((game) => {
      const key = buildMatchKey(game.away_team, game.home_team)
      const existing = map.get(key)
      if (existing) {
        map.set(key, mergeOddsGames(existing, game))
      } else {
        map.set(key, game)
      }
    })
    return map
  }, [oddsGames])
  const findOddsGame = useCallback(
    (homeName: string, awayName: string) => {
      const key = buildMatchKey(awayName, homeName)
      const directMatch = oddsMatchIndex.get(key)
      if (directMatch) return directMatch
      const matches = oddsGames.filter(
        (game) =>
          isTeamMatch(game.home_team, homeName) &&
          isTeamMatch(game.away_team, awayName)
      )
      if (!matches.length) return undefined
      return matches.reduce((merged, game) => mergeOddsGames(merged, game))
    },
    [oddsGames, oddsMatchIndex]
  )

  type ArbEntry = {
    game: LiveScoreGame
    teams: ReturnType<typeof getTeamsFromGame>
    arbitrage: ArbitrageResult
    label: string
  }

  const allArbs = useMemo<ArbEntry[]>(() => {
    if (!canLoadOdds) return []
    const arbs: ArbEntry[] = []
    filteredGames.forEach((game) => {
      const teams = getTeamsFromGame(game)
      const rawOddsGame = findOddsGame(teams.homeName, teams.awayName) ?? null
      const oddsGame = filterOddsGameForLive(rawOddsGame, game.bucket)
      if (!oddsGame) return
      const arb = findArbitrage(oddsGame, teams.homeName, teams.awayName)
      if (arb) {
        const marketLabel =
          arb.market === "moneyline"
            ? "ML"
            : arb.market === "spreads"
            ? "Spread"
            : "Total"
        arbs.push({
          game,
          teams,
          arbitrage: arb,
          label: `${teams.awayAbbr || teams.awayName} @ ${teams.homeAbbr || teams.homeName} - ${marketLabel} +${arb.profitPct.toFixed(1)}%`,
        })
      }
    })
    return arbs.sort((a, b) => b.arbitrage.profitPct - a.arbitrage.profitPct)
  }, [filteredGames, canLoadOdds, findOddsGame])

  const fetchOddsForLeague = useCallback(async () => {
    if (!canLoadOdds) return
    setOddsLoading(true)
    setOddsError(null)
    try {
      const buildRequest = async (url: URL): Promise<OddsGame[]> => {
        const response = await fetch(url.toString(), { cache: "no-store" })
        if (!response.ok) {
          const body = await response.text().catch(() => "")
          throw new Error(body || "Failed to load odds.")
        }
        const payload = await response.json()
        return Array.isArray(payload?.games) ? (payload.games as OddsGame[]) : []
      }
      const url = new URL("/api/odds/games", window.location.origin)
      url.searchParams.set("sport", oddsSportKey)

      const results = await Promise.allSettled([buildRequest(url)])
      const errors = results.filter((result) => result.status === "rejected")
      if (errors.length === results.length) {
        throw errors[0]?.reason || new Error("Failed to load odds.")
      }
      const merged = new Map<string, OddsGame>()
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          result.value.forEach((game) => {
            merged.set(game.id, game)
          })
        }
      })
      setOddsByLeague((prev) => ({
        ...prev,
        [activeLeague]: Array.from(merged.values()),
      }))
    } catch (err: any) {
      setOddsError(err?.message ?? "Unable to load odds.")
    } finally {
      setOddsLoading(false)
    }
  }, [activeLeague, canLoadOdds, oddsSportKey])

  useEffect(() => {
    if (!canLoadOdds) return
    fetchOddsForLeague()
  }, [canLoadOdds, fetchOddsForLeague, oddsRefreshToken])

  // Close arb dropdown on click outside
  useEffect(() => {
    if (!arbDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-arb-dropdown]")) {
        setArbDropdownOpen(false)
      }
    }
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [arbDropdownOpen])

  const handleRefresh = useCallback(() => {
    refetch()
    setOddsRefreshToken((prev) => prev + 1)
  }, [refetch])

  const fetchPropsForGame = useCallback(
    async (gameId: string, homeName: string, awayName: string) => {
      if (!canLoadProps || !oddsSportKey) return
      if (propsLoadingByGame[gameId]) return
      setPropsLoadingByGame((prev) => ({ ...prev, [gameId]: true }))
      setPropsErrorByGame((prev) => ({ ...prev, [gameId]: null }))
      try {
        const url = new URL("/api/player-props", window.location.origin)
        url.searchParams.set("sport", oddsSportKey)
        url.searchParams.set("team", `${awayName},${homeName}`)
        if (wantsAllProps) {
          url.searchParams.set("market", "all")
        } else if (propMarkets.length) {
          url.searchParams.set("market", propMarkets.join(","))
        }
        const response = await fetch(url.toString(), { cache: "no-store" })
        if (!response.ok) {
          const body = await response.text().catch(() => "")
          throw new Error(body || "Failed to load player props.")
        }
        const payload: PlayerPropsResponse = await response.json()
        const props = Array.isArray(payload?.data) ? payload.data : []
        setPropsByGame((prev) => ({ ...prev, [gameId]: props }))
      } catch (err: any) {
        setPropsErrorByGame((prev) => ({
          ...prev,
          [gameId]: err?.message ?? "Unable to load props.",
        }))
      } finally {
        setPropsLoadingByGame((prev) => ({ ...prev, [gameId]: false }))
      }
    },
    [canLoadProps, oddsSportKey, propMarkets, propsLoadingByGame, wantsAllProps]
  )

  const lineShoppingTeams = useMemo(
    () => (lineShoppingGame ? getTeamsFromGame(lineShoppingGame) : null),
    [lineShoppingGame]
  )
  const lineShoppingOddsGame = useMemo(() => {
    if (!lineShoppingGame || !lineShoppingTeams) return null
    const oddsGame =
      findOddsGame(lineShoppingTeams.homeName, lineShoppingTeams.awayName) ??
      null
    return filterOddsGameForLive(oddsGame, lineShoppingGame.bucket)
  }, [findOddsGame, lineShoppingGame, lineShoppingTeams])
  const lineShoppingProps = lineShoppingGame
    ? propsByGame[lineShoppingGame.id]
    : undefined
  const lineShoppingPropsLoading = lineShoppingGame
    ? propsLoadingByGame[lineShoppingGame.id]
    : false
  const lineShoppingPropsError = lineShoppingGame
    ? propsErrorByGame[lineShoppingGame.id]
    : null

  useEffect(() => {
    if (!lineShoppingGame || !lineShoppingTeams) return
    if (
      canLoadProps &&
      !lineShoppingProps &&
      !lineShoppingPropsLoading
    ) {
      fetchPropsForGame(
        lineShoppingGame.id,
        lineShoppingTeams.homeName,
        lineShoppingTeams.awayName
      )
    }
  }, [
    canLoadProps,
    fetchPropsForGame,
    lineShoppingGame,
    lineShoppingProps,
    lineShoppingPropsLoading,
    lineShoppingTeams,
  ])

  const bucketed = useMemo(() => {
    return filteredGames.reduce(
      (acc, game) => {
        acc[game.bucket].push(game)
        return acc
      },
      {
        upcoming: [] as LiveScoreGame[],
        live: [] as LiveScoreGame[],
        completed: [] as LiveScoreGame[],
      }
    )
  }, [filteredGames])

  const selectedDateLabel = formatDisplayDate(data?.requestedDate ?? selectedDate)
  const completedDateLabel = formatDisplayDate(data?.previousDate)

  return (
    <div className="relative min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-12 py-8 space-y-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[#34d399] px-4 py-2 text-sm text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">Live Center</p>
              <h1 className="text-3xl font-bold">Real-time Scores</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-[#6b6b6b] px-3 py-1.5 bg-black">
              <button
                onClick={() => setSelectedDate((prev) => adjustDate(prev, -1))}
                className="p-1 rounded-full hover:bg-white/10"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-white/60" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value || todayYMD())}
                  className="bg-transparent outline-none text-white text-sm"
                />
              </div>
              <button
                onClick={() => setSelectedDate((prev) => adjustDate(prev, 1))}
                className="p-1 rounded-full hover:bg-white/10"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="relative" data-arb-dropdown>
              <button
                onClick={() => setArbDropdownOpen((prev) => !prev)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                  allArbs.length > 0
                    ? "border-[#34d399] text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15]"
                    : "border-[#6b6b6b] text-white/60"
                )}
              >
                {allArbs.length > 0 ? (
                  <>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#34d399] text-[10px] font-bold text-[#0f1f15]">
                      {allArbs.length}
                    </span>
                    Arbs Found
                  </>
                ) : (
                  "No Arbs"
                )}
                <ChevronDown className={clsx("h-4 w-4 transition-transform", arbDropdownOpen && "rotate-180")} />
              </button>
              {arbDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[#6b6b6b] bg-black shadow-lg shadow-black/50">
                  <div className="flex items-center justify-between border-b border-[#6b6b6b] px-4 py-3">
                    <span className="text-sm font-medium text-white">Arbitrage Opportunities</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRefresh()
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#34d399] px-2.5 py-1 text-xs text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors"
                    >
                      <RefreshCw className={clsx("h-3 w-3", { "animate-spin": isRefreshing })} />
                      Refresh
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {allArbs.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-white/50">
                        No arbitrage opportunities found for {LEAGUE_TABS.find((t) => t.id === activeLeague)?.label || activeLeague}
                      </div>
                    ) : (
                      allArbs.map((arb, idx) => (
                        <button
                          key={`${arb.game.eventId}-${idx}`}
                          onClick={() => {
                            setLineShoppingGame(arb.game)
                            setArbDropdownOpen(false)
                          }}
                          className="flex w-full items-center justify-between gap-2 border-b border-[#6b6b6b]/50 px-4 py-3 text-left text-sm text-white/80 hover:bg-white/5 transition-colors last:border-b-0"
                        >
                          <span className="truncate">
                            {arb.teams.awayAbbr || arb.teams.awayName} @ {arb.teams.homeAbbr || arb.teams.homeName}
                          </span>
                          <span className="shrink-0 rounded-full bg-[#34d399]/20 px-2 py-0.5 text-xs font-medium text-[#34d399]">
                            {arb.arbitrage.market === "moneyline" ? "ML" : arb.arbitrage.market === "spreads" ? "Spread" : "Total"} +{arb.arbitrage.profitPct.toFixed(1)}%
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-white/50">Updated</p>
              <p className="text-sm font-medium text-white">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "-"}</p>
            </div>
          </div>
        </header>

        {!authLoading && !canLoadOdds && (
          <div className="rounded-2xl border border-[#6b6b6b] bg-black p-4 text-xs text-white/70 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-white/60 uppercase tracking-[0.3em] text-[10px]">
              <Lock className="h-3.5 w-3.5" />
              Line Shopping Locked
            </span>
            <span>
              Sign in or upgrade to unlock live odds comparisons and player props.
            </span>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-[#34d399] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors"
              onClick={(event) => event.stopPropagation()}
            >
              View Plans
            </Link>
          </div>
        )}
        {canLoadOdds && oddsError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
            {oddsError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 sm:mt-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {LEAGUE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveLeague(tab.id)}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors border",
                  activeLeague === tab.id
                    ? "bg-[#34d399] text-[#0f1f15] border-[#34d399]"
                    : "border-[#6b6b6b] text-white/80 hover:border-white/60 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
            {CONFERENCE_FILTERS[activeLeague] && (
              <select
                value={conference}
                onChange={(event) => setConference(event.target.value)}
                className="rounded-full border border-[#6b6b6b] bg-black px-3 py-2 text-sm text-white hover:border-white/60 focus:outline-none focus:ring-2 focus:ring-[#34d399]/60"
              >
                <option value="">All Conferences</option>
                {CONFERENCE_FILTERS[activeLeague]?.map((conf) => (
                  <option key={`${activeLeague}-${conf.value}`} value={conf.value}>
                    {conf.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-[#6b6b6b] bg-black p-10 text-center text-white/70">Loading live scores...</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-200">{error}</div>
        ) : filteredGames.length === 0 ? (
          <div className="rounded-3xl border border-[#6b6b6b] bg-black p-10 text-center text-white/70">No games found for this selection.</div>
        ) : (
          BUCKET_ORDER.map((section) => {
            const games = bucketed[section.key]
            const description =
              section.key === "completed"
                ? `Yesterday - ${completedDateLabel || "No finals"}`
                : `For ${selectedDateLabel || "selected date"}`

            if (games.length === 0) {
              return (
                <section key={section.key} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                      <p className="text-xs text-white/50">{description}</p>
                    </div>
                    <span className="text-xs text-white/40 uppercase tracking-[0.3em]">0 games</span>
                  </div>
                  <div className="rounded-3xl border border-[#6b6b6b] bg-black p-8 text-center text-white/70 text-sm">
                    No {section.key === "completed" ? "final results" : section.key} for this selection.
                  </div>
                </section>
              )
            }

            const grouped = groupByLeague(games)

            return (
              <section key={section.key} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                    <p className="text-xs text-white/50">{description}</p>
                  </div>
                  <span className="text-xs text-white/40 uppercase tracking-[0.3em]">{games.length} games</span>
                </div>
                {grouped.map(([leagueName, leagueGames]) => (
                  <div key={`${section.key}-${leagueName}`} className="space-y-4 pt-2">
                    <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">{leagueName}</div>
                    <div className="grid grid-cols-2 gap-2 [@media(min-width:480px)]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 sm:gap-4 lg:gap-5">
                      {leagueGames.map((game) => (
                        <article
                          key={`${section.key}-${game.id}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedGame(game)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              setSelectedGame(game)
                            }
                          }}
                      className="rounded-2xl border border-[#6b6b6b] bg-black p-2 sm:p-4 lg:p-5 shadow-md shadow-black/30 transition ring-offset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#34d399]/60 cursor-pointer"
                    >
                      {(() => {
                        const detail = sanitizeText(game.status?.detail)
                        const shortDetail = sanitizeText(game.status?.shortDetail)
                        const broadcast = sanitizeText(game.broadcast)
                        const odds =
                          game.bucket === "live" ? "" : sanitizeText(game.odds)
                        const teams = getTeamsFromGame(game)
                        const rawOddsGame =
                          findOddsGame(teams.homeName, teams.awayName) ?? null
                        const oddsGame = filterOddsGameForLive(
                          rawOddsGame,
                          game.bucket
                        )
                        const arbitrage = findArbitrage(
                          oddsGame ?? null,
                          teams.homeName,
                          teams.awayName
                        )
                        const arbitrageLabel = arbitrage
                          ? `${arbitrage.market === "moneyline"
                              ? "ML"
                              : arbitrage.market === "spreads"
                                ? "Spread"
                                : "Total"
                            } Arb +${arbitrage.profitPct.toFixed(1)}%`
                          : null
                        const moneylineAwayEntries = collectOutcomeEntries(
                          oddsGame,
                          "h2h",
                          teams.awayName
                        )
                        const moneylineHomeEntries = collectOutcomeEntries(
                          oddsGame,
                          "h2h",
                          teams.homeName
                        )
                        const moneylineAway = pickBestEntry(
                          moneylineAwayEntries,
                          "h2h"
                        )
                        const moneylineHome = pickBestEntry(
                          moneylineHomeEntries,
                          "h2h"
                        )
                        const awayWinProb = averageOf(
                          moneylineAwayEntries
                            .map((entry) =>
                              resolveEntryProbability(
                                entry.probability,
                                entry.odds
                              )
                            )
                            .filter((value): value is number => value != null)
                        )
                        const homeWinProb = averageOf(
                          moneylineHomeEntries
                            .map((entry) =>
                              resolveEntryProbability(
                                entry.probability,
                                entry.odds
                              )
                            )
                            .filter((value): value is number => value != null)
                        )
                        const spreadAway = pickBestEntry(
                          collectOutcomeEntries(oddsGame, "spreads", teams.awayName),
                          "spreads"
                        )
                        const spreadHome = pickBestEntry(
                          collectOutcomeEntries(oddsGame, "spreads", teams.homeName),
                          "spreads"
                        )
                        const totalOver = pickBestEntry(
                          collectOutcomeEntries(oddsGame, "totals", "over"),
                          "totals"
                        )
                        const totalUnder = pickBestEntry(
                          collectOutcomeEntries(oddsGame, "totals", "under"),
                          "totals"
                        )
                        const statusLabel =
                          game.bucket === "upcoming"
                            ? formatStartTime(game.startTime)
                            : shortDetail || detail || (game.bucket === "completed" ? "Final" : "Live")
                        const summaryRows = [
                          {
                            key: "moneyline",
                            label: "Moneyline",
                            leftLabel: teams.awayAbbr || teams.awayName,
                            rightLabel: teams.homeAbbr || teams.homeName,
                            left: moneylineAway,
                            right: moneylineHome,
                            showSign: true,
                          },
                          {
                            key: "spread",
                            label: "Spread",
                            leftLabel: teams.awayAbbr || teams.awayName,
                            rightLabel: teams.homeAbbr || teams.homeName,
                            left: spreadAway,
                            right: spreadHome,
                            showSign: true,
                          },
                          {
                            key: "total",
                            label: "Total",
                            leftLabel: "Over",
                            rightLabel: "Under",
                            left: totalOver,
                            right: totalUnder,
                            showSign: false,
                          },
                        ]
                        const renderSummaryCell = (
                          entry: MarketEntry | null,
                          label: string,
                          showSign = true
                        ) => {
                          if (!entry) {
                            return <span className="text-white/40">-</span>
                          }
                          const lineLabel =
                            entry.point != null
                              ? ` ${formatPoint(entry.point, 1, showSign)}`
                              : ""
                          return (
                            <div className="text-[11px] text-white/80">
                              <div className="truncate">
                                <span className="font-semibold">{label}</span>
                                {lineLabel}
                              </div>
                              <div className="text-white/70">
                                {formatOddsDisplay(
                                  entry.odds,
                                  entry.book,
                                  entry.probability
                                )}{" "}
                                <span className="text-white/40">({entry.book})</span>
                              </div>
                            </div>
                          )
                        }
                        return (
                          <>
                          <div className="flex items-center justify-between text-[11px] text-white/60 gap-2">
                            <span className="uppercase tracking-[0.3em]">{game.leagueLabel}</span>
                            <div className="flex items-center gap-2">
                              {game.bucket === "live" && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/60 bg-red-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-red-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                  Live
                                </span>
                              )}
                              {arbitrageLabel && (
                                <span className="inline-flex items-center rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200">
                                  {arbitrageLabel}
                                </span>
                              )}
                              <span>{statusLabel}</span>
                            </div>
                          </div>

                          <div className="mt-3 space-y-3">
                            {[...game.competitors].sort((a, b) => (a.homeAway === "home" ? 1 : -1)).map((team) => (
                              <div key={team.id} className="flex items-center gap-2">
                                <div className="relative h-7 w-7 sm:h-9 sm:w-9 overflow-hidden rounded-lg border border-[#6b6b6b] bg-black">
                                  {team.logo ? (
                                    <Image src={team.logo} alt={team.shortName} fill sizes="36px" className="object-contain p-1" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
                                      {team.abbreviation}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-1 items-center justify-between">
                                  <div>
                                    <p className="text-xs sm:text-sm font-semibold leading-tight">{team.name}</p>
                                    <p className="text-[10px] sm:text-[11px] text-white/50">
                                      {(() => {
                                        const recordLabel =
                                          team.record ??
                                          (team.homeAway === "home" ? "Home" : "Away")
                                        const winProb =
                                          team.homeAway === "home"
                                            ? homeWinProb
                                            : awayWinProb
                                        const winProbLabel = Number.isFinite(winProb)
                                          ? `Win ${formatProbability(winProb)}`
                                          : null
                                        return winProbLabel
                                          ? `${recordLabel} | ${winProbLabel}`
                                          : recordLabel
                                      })()}
                                    </p>
                                  </div>
                                  <p className="text-lg sm:text-xl font-bold tabular-nums">{team.score}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {game.situation?.description && (
                            <p className="mt-2 sm:mt-3 text-[11px] text-white/60">{sanitizeText(game.situation.description)}</p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                            {detail && <span>{detail}</span>}
                            {broadcast && <span>- {broadcast}</span>}
                            {odds && <span>- {odds}</span>}
                          </div>

                          <div
                            className="mt-4 rounded-2xl border border-[#2a2a2a] bg-black/80 p-3 space-y-3"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex items-center justify-end sm:justify-between text-[10px] uppercase tracking-[0.3em] text-white/50">
                              <span className="hidden sm:inline">Line Shopping</span>
                              <div className="flex items-center gap-2">
                                {oddsGame?.bookmakers?.length ? (
                                  <span className="hidden sm:inline text-[10px] text-white/40">
                                    {oddsGame.bookmakers.length} books
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    if (!canLoadOdds) return
                                    setLineShoppingGame(game)
                                  }}
                                  disabled={!canLoadOdds}
                                  className={clsx(
                                    "inline-flex items-center gap-2 rounded-full border border-[#34d399] px-2 py-1 text-[10px] text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors",
                                    !canLoadOdds && "cursor-not-allowed opacity-60"
                                  )}
                                >
                                  Compare Books
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {authLoading ? (
                              <div className="text-xs text-white/60">
                                Checking line shopping access...
                              </div>
                            ) : !canLoadOdds ? (
                              <div className="flex items-center gap-2 text-xs text-white/60">
                                <Lock className="h-3.5 w-3.5" />
                                <span>Upgrade to unlock odds comparisons.</span>
                              </div>
                            ) : oddsLoading ? (
                              <div className="text-xs text-white/60">Loading odds...</div>
                            ) : oddsError ? (
                              <div className="text-xs text-red-200">{oddsError}</div>
                            ) : !oddsGame ? (
                              <div className="text-xs text-white/60">
                                No odds found for this matchup yet.
                              </div>
                            ) : (
                              <div className="hidden sm:grid gap-2 text-xs">
                                {summaryRows.map((row) => (
                                  <div
                                    key={row.key}
                                    className="grid grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-xl border border-[#303030] bg-black/60 px-2.5 py-2"
                                  >
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                                      {row.label}
                                    </span>
                                    <div className="min-w-0">
                                      {renderSummaryCell(
                                        row.left,
                                        row.leftLabel,
                                        row.showSign
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      {renderSummaryCell(
                                        row.right,
                                        row.rightLabel,
                                        row.showSign
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                          </div>

                          </>
                        )
                      })()}

                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )
          })
        )}
      </div>
      {selectedGame && (
        <GameDetailsModal game={selectedGame} onClose={() => setSelectedGame(null)} detailsState={detailsState} />
      )}
      {lineShoppingGame && lineShoppingTeams && (
        <LineShoppingModal
          game={lineShoppingGame}
          teams={lineShoppingTeams}
          oddsGame={lineShoppingOddsGame}
          authLoading={authLoading}
          canLoadOdds={canLoadOdds}
          oddsLoading={oddsLoading}
          oddsError={oddsError}
          canLoadProps={canLoadProps}
          propMarkets={propMarkets}
          propsData={lineShoppingProps}
          propsLoading={lineShoppingPropsLoading}
          propsError={lineShoppingPropsError}
          onLoadProps={() => {
            if (!lineShoppingGame || !lineShoppingTeams) return
            fetchPropsForGame(
              lineShoppingGame.id,
              lineShoppingTeams.homeName,
              lineShoppingTeams.awayName
            )
          }}
          onClose={() => setLineShoppingGame(null)}
        />
      )}

    </div>
  )
}

interface LineShoppingModalProps {
  game: LiveScoreGame
  teams: ReturnType<typeof getTeamsFromGame>
  oddsGame: OddsGame | null
  authLoading: boolean
  canLoadOdds: boolean
  oddsLoading: boolean
  oddsError: string | null
  canLoadProps: boolean
  propMarkets: string[]
  propsData?: PlayerProp[]
  propsLoading?: boolean
  propsError?: string | null
  onLoadProps: () => void
  onClose: () => void
}

function LineShoppingModal({
  game,
  teams,
  oddsGame,
  authLoading,
  canLoadOdds,
  oddsLoading,
  oddsError,
  canLoadProps,
  propMarkets,
  propsData,
  propsLoading,
  propsError,
  onLoadProps,
  onClose,
}: LineShoppingModalProps) {
  const lineColumns = useMemo(() => getLineScoreColumns(game), [game])
  const lineScoreTeams = useMemo(
    () => [...game.competitors].sort((a, b) => (a.homeAway === "home" ? 1 : -1)),
    [game.competitors]
  )

  const moneylineAway = pickBestEntry(
    collectOutcomeEntries(oddsGame, "h2h", teams.awayName),
    "h2h"
  )
  const moneylineHome = pickBestEntry(
    collectOutcomeEntries(oddsGame, "h2h", teams.homeName),
    "h2h"
  )
  const spreadAway = pickBestEntry(
    collectOutcomeEntries(oddsGame, "spreads", teams.awayName),
    "spreads"
  )
  const spreadHome = pickBestEntry(
    collectOutcomeEntries(oddsGame, "spreads", teams.homeName),
    "spreads"
  )
  const totalOver = pickBestEntry(
    collectOutcomeEntries(oddsGame, "totals", "over"),
    "totals"
  )
  const totalUnder = pickBestEntry(
    collectOutcomeEntries(oddsGame, "totals", "under"),
    "totals"
  )

  const moneylineRows = buildMarketRows(
    oddsGame,
    "h2h",
    teams.homeName,
    teams.awayName
  )
  const spreadRows = buildMarketRows(
    oddsGame,
    "spreads",
    teams.homeName,
    teams.awayName
  )
  const totalRows = buildMarketRows(
    oddsGame,
    "totals",
    teams.homeName,
    teams.awayName
  )

  const statusLabel =
    sanitizeText(game.status?.shortDetail) ||
    sanitizeText(game.status?.detail) ||
    formatStartTime(game.startTime) ||
    "Line Shopping"

  const isBestMatch = (
    entry: MarketEntry | null,
    book: string,
    oddsValue?: number,
    point?: number
  ) =>
    Boolean(
      entry &&
        entry.book === book &&
        entry.odds === oddsValue &&
        (entry.point == null || entry.point === point)
    )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-[#6b6b6b] bg-black p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Line Shopping
            </p>
            <h3 className="text-2xl font-bold text-white">
              {teams.awayName} @ {teams.homeName}
            </h3>
            <p className="text-sm text-white/60">{statusLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-[#6b6b6b] p-2 text-white/70 hover:text-white hover:border-white/50 transition"
            aria-label="Close line shopping"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {authLoading ? (
            <div className="rounded-2xl border border-[#6b6b6b] bg-black p-4 text-sm text-white/70">
              Checking line shopping access...
            </div>
          ) : !canLoadOdds ? (
            <div className="rounded-2xl border border-[#6b6b6b] bg-black p-4 text-sm text-white/70 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Upgrade to unlock odds comparisons.
            </div>
          ) : oddsLoading ? (
            <div className="rounded-2xl border border-[#6b6b6b] bg-black p-4 text-sm text-white/70">
              Loading odds...
            </div>
          ) : oddsError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {oddsError}
            </div>
          ) : !oddsGame ? (
            <div className="rounded-2xl border border-[#6b6b6b] bg-black p-4 text-sm text-white/70">
              No odds found for this matchup yet.
            </div>
          ) : (
            <>
              {lineColumns.length > 0 && (
                <div className="rounded-2xl border border-[#262626] bg-black/70 p-4">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-white/50">
                    <span>Line Score</span>
                    <span className="text-white/40">{lineColumns.length} periods</span>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-[12px]">
                      <thead className="text-white/50">
                        <tr>
                          <th className="text-left font-medium">Team</th>
                          {lineColumns.map((label) => (
                            <th key={label} className="px-2 text-center font-medium">
                              {label}
                            </th>
                          ))}
                          <th className="px-2 text-center font-medium">T</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineScoreTeams.map((team) => (
                          <tr key={`line-${game.id}-${team.id}`} className="border-t border-[#262626]">
                            <td className="py-2 pr-2 text-left font-semibold text-white">
                              {team.abbreviation ?? team.name}
                            </td>
                            {lineColumns.map((label, index) => (
                              <td key={`${team.id}-${label}`} className="px-2 py-2 text-center text-white/80">
                                {team.linescore?.[index]?.value ?? "-"}
                              </td>
                            ))}
                            <td className="px-2 py-2 text-center font-semibold text-white">
                              {team.score}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#262626] bg-black/70 p-4">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-white/50">
                    <span>Moneyline</span>
                    <span className="text-white/40">{moneylineRows.length} books</span>
                  </div>
                  {moneylineRows.length ? (
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="grid grid-cols-[1fr_1fr_1fr] text-white/50">
                        <span>Book</span>
                        <span className="text-right">{teams.awayAbbr || teams.awayName}</span>
                        <span className="text-right">{teams.homeAbbr || teams.homeName}</span>
                      </div>
                      {moneylineRows.map((row) => (
                        <div key={`ml-${game.id}-${row.book}`} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
                          <span className="truncate text-white/70">{row.book}</span>
                          <span
                            className={clsx(
                              "text-right",
                              isBestMatch(moneylineAway, row.book, row.awayOdds)
                                ? "text-emerald-300 font-semibold"
                                : "text-white/80"
                            )}
                          >
                            {formatOddsDisplay(
                              row.awayOdds,
                              row.book,
                              row.awayProbability
                            )}
                          </span>
                          <span
                            className={clsx(
                              "text-right",
                              isBestMatch(moneylineHome, row.book, row.homeOdds)
                                ? "text-emerald-300 font-semibold"
                                : "text-white/80"
                            )}
                          >
                            {formatOddsDisplay(
                              row.homeOdds,
                              row.book,
                              row.homeProbability
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-white/50">Moneyline odds unavailable.</div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#262626] bg-black/70 p-4">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-white/50">
                    <span>Spread</span>
                    <span className="text-white/40">{spreadRows.length} books</span>
                  </div>
                  {spreadRows.length ? (
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="grid grid-cols-[1fr_1fr_1fr] text-white/50">
                        <span>Book</span>
                        <span className="text-right">{teams.awayAbbr || teams.awayName}</span>
                        <span className="text-right">{teams.homeAbbr || teams.homeName}</span>
                      </div>
                      {spreadRows.map((row) => (
                        <div key={`spread-${game.id}-${row.book}`} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
                          <span className="truncate text-white/70">{row.book}</span>
                          <span
                            className={clsx(
                              "text-right",
                              isBestMatch(spreadAway, row.book, row.awayOdds, row.awayLine)
                                ? "text-emerald-300 font-semibold"
                                : "text-white/80"
                            )}
                          >
                            {formatLineOdds(
                              row.awayLine,
                              row.awayOdds,
                              true,
                              row.book,
                              row.awayProbability
                            )}
                          </span>
                          <span
                            className={clsx(
                              "text-right",
                              isBestMatch(spreadHome, row.book, row.homeOdds, row.homeLine)
                                ? "text-emerald-300 font-semibold"
                                : "text-white/80"
                            )}
                          >
                            {formatLineOdds(
                              row.homeLine,
                              row.homeOdds,
                              true,
                              row.book,
                              row.homeProbability
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-white/50">Spread odds unavailable.</div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#262626] bg-black/70 p-4">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-white/50">
                    <span>Total</span>
                    <span className="text-white/40">{totalRows.length} books</span>
                  </div>
                  {totalRows.length ? (
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="grid grid-cols-[1fr_1fr_1fr] text-white/50">
                        <span>Book</span>
                        <span className="text-right">Over</span>
                        <span className="text-right">Under</span>
                      </div>
                      {totalRows.map((row) => (
                        <div key={`total-${game.id}-${row.book}`} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
                          <span className="truncate text-white/70">{row.book}</span>
                          <span
                            className={clsx(
                              "text-right",
                              isBestMatch(totalOver, row.book, row.overOdds, row.line)
                                ? "text-emerald-300 font-semibold"
                                : "text-white/80"
                            )}
                          >
                            {formatLineOdds(
                              row.line,
                              row.overOdds,
                              false,
                              row.book,
                              row.overProbability
                            )}
                          </span>
                          <span
                            className={clsx(
                              "text-right",
                              isBestMatch(totalUnder, row.book, row.underOdds, row.line)
                                ? "text-emerald-300 font-semibold"
                                : "text-white/80"
                            )}
                          >
                            {formatLineOdds(
                              row.line,
                              row.underOdds,
                              false,
                              row.book,
                              row.underProbability
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-white/50">Totals odds unavailable.</div>
                  )}
                </div>
              </div>

              {canLoadProps && (
                <div className="rounded-2xl border border-[#262626] bg-black/70 p-4 space-y-3">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-white/50">
                    <span>Player Props</span>
                    <button
                      type="button"
                      onClick={onLoadProps}
                      disabled={propsLoading}
                      className={clsx(
                        "inline-flex items-center gap-2 rounded-full border border-[#34d399] px-3 py-1 text-[10px] text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors",
                        propsLoading && "cursor-not-allowed opacity-60"
                      )}
                    >
                      {propsLoading ? "Loading..." : propsData?.length ? "Refresh Props" : "Load Props"}
                    </button>
                  </div>
                  {propsError ? (
                    <div className="text-xs text-red-200">{propsError}</div>
                  ) : propsLoading ? (
                    <div className="text-xs text-white/60">Loading player props...</div>
                  ) : propsData?.length ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {propsData.map((prop) => {
                        const marketKeys = Object.keys(prop.markets)
                        const orderedMarkets = propMarkets.length
                          ? [
                              ...propMarkets.filter((key) => prop.markets[key]),
                              ...marketKeys.filter((key) => !propMarkets.includes(key)),
                            ]
                          : marketKeys
                        const marketEntries = orderedMarkets
                          .map((key) => [key, prop.markets[key]] as const)
                          .filter((entry) => entry[1])
                        return (
                          <div
                            key={`${game.id}-${prop.player}`}
                            className="rounded-lg border border-[#303030] bg-black/70 p-3"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-white">{prop.player}</span>
                              <span className="text-white/50">{prop.teamAbbr || prop.team || ""}</span>
                            </div>
                            <div className="mt-2 grid gap-1 text-[11px] text-white/70">
                              {marketEntries.map(([key, market]) => {
                                const lineLabel = formatPoint(market.line, 1, false)
                                const overLabel = Number.isFinite(market.over.best)
                                  ? `${formatOdds(market.over.best)}${
                                      market.over.bestBook ? ` (${market.over.bestBook})` : ""
                                    }`
                                  : "-"
                                const underLabel = Number.isFinite(market.under.best)
                                  ? `${formatOdds(market.under.best)}${
                                      market.under.bestBook ? ` (${market.under.bestBook})` : ""
                                    }`
                                  : "-"
                                return (
                                  <div
                                    key={`${prop.player}-${key}`}
                                    className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
                                  >
                                    <span className="text-white/60 truncate">
                                      {formatMarketLabel(key)} {lineLabel}
                                    </span>
                                    <span className="text-emerald-200">O {overLabel}</span>
                                    <span className="text-rose-200">U {underLabel}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-white/60">No props available for this matchup.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface GameDetailsModalProps {
  game: LiveScoreGame
  onClose: () => void
  detailsState: {
    data: LiveScoreGameDetails | null
    loading: boolean
    error: string | null
    refetch: () => void
  }
}

function GameDetailsModal({ game, onClose, detailsState }: GameDetailsModalProps) {
  const { data, loading, error, refetch } = detailsState
  const [playerDetail, setPlayerDetail] = useState<{ team: string; playerId: string } | null>(null)
  const lineColumns = useMemo(() => {
    if (!data?.teams?.length) return [] as string[]
    return data.teams.reduce((labels: string[], team) => {
      if (team.linescore.length > labels.length) {
        return team.linescore.map((entry, index) => entry.label || `P${index + 1}`)
      }
      return labels
    }, [])
  }, [data])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl rounded-3xl border border-[#6b6b6b] bg-black p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">{game.leagueLabel}</p>
            <h3 className="text-2xl font-bold text-white">{game.shortName}</h3>
            <p className="text-sm text-white/60">{sanitizeText(data?.statusText) || "Details"}</p>
          </div>
          {data?.winProbability && (
            <div className="flex flex-col items-end text-sm text-white/80">
              <span className="text-xs uppercase tracking-[0.25em] text-white/50">Win Probability</span>
              <div className="mt-1 flex items-center gap-2 text-base font-semibold">
                <span>{Math.round(data.winProbability.home * 100)}% Home</span>
                <div className="h-2 w-28 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400"
                    style={{ width: `${Math.round(data.winProbability.home * 100)}%` }}
                  />
                </div>
                <span>{Math.round(data.winProbability.away * 100)}% Away</span>
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            className="rounded-full border border-[#6b6b6b] p-2 text-white/70 hover:text-white hover:border-white/50 transition"
            aria-label="Close box score"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {loading ? (
            <div className="rounded-2xl border border-[#6b6b6b] bg-black p-6 text-center text-white/70">Loading box score...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-200 space-y-3">
              <p>{error}</p>
              <button
                onClick={refetch}
                className="inline-flex items-center justify-center rounded-full border border-[#6b6b6b] px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/85 hover:border-white/60"
              >
                Retry
              </button>
            </div>
          ) : data?.teams?.length ? (
            <>
              <section className="rounded-2xl border border-[#6b6b6b] bg-black p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Line Score</h4>
                  <span className="text-xs text-white/50">{data.venue || ""}</span>
                </div>
                {lineColumns.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-white/60">
                        <tr>
                          <th className="text-left font-medium">Team</th>
                          {lineColumns.map((label) => (
                            <th key={label} className="px-2 text-center font-medium">
                              {label}
                            </th>
                          ))}
                          <th className="px-2 text-center font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.teams.map((team) => (
                          <tr key={`line-${team.id}`} className="border-t border-[#6b6b6b]">
                            <td className="py-2 pr-2 text-left font-semibold text-white">
                              {team.abbreviation ?? team.name}
                            </td>
                            {lineColumns.map((label, index) => (
                              <td key={`${team.id}-${label}`} className="px-2 py-2 text-center text-white/80">
                                {team.linescore[index]?.value ?? "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}
                              </td>
                            ))}
                            <td className="px-2 py-2 text-center text-lg font-bold text-white">{team.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-white/60">Line score data is not available yet.</p>
                )}
              </section>

              {data?.plays && data.plays.length > 0 && (
                <section className="rounded-2xl border border-[#6b6b6b] bg-black p-4 space-y-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Play by Play</h4>
                    <span className="text-xs text-white/50">Latest {Math.min(data.plays.length, 30)} plays</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {Object.entries(
                      data.plays
                        .slice(-30)
                        .reduce((acc: Record<string, typeof data.plays>, play) => {
                          const key = play.period != null ? `P${play.period}` : "Plays"
                          acc[key] = acc[key] || []
                          acc[key].push(play)
                          return acc
                        }, {})
                    ).map(([periodKey, plays]) => (
                      <div key={periodKey} className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-white/50">{periodKey}</p>
                        <div className="space-y-1.5">
                          {plays
                            .slice()
                            .reverse()
                            .map((play) => (
                              <div key={play.id} className="rounded-xl border border-[#6b6b6b] bg-black px-3 py-2 text-sm text-white/80">
                                <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
                                  <span>{play.clock || "-"}</span>
                                  {(play.homeScore != null || play.awayScore != null) && (
                                    <span className="font-semibold text-white/70">
                                      {play.awayScore ?? "-"} - {play.homeScore ?? "-"}
                                    </span>
                                  )}
                                </div>
                                <p className="leading-snug">{sanitizeText(play.text)}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="grid gap-4 md:grid-cols-2">
                {data.teams.map((team) => (
                  <div key={`stats-${team.id}`} className="rounded-2xl border border-[#6b6b6b] bg-black p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-[#6b6b6b] bg-black">
                        {team.logo ? (
                          <Image src={team.logo} alt={team.name} fill sizes="40px" className="object-contain p-2" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-white/60">{team.abbreviation}</div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{team.name}</p>
                        <p className="text-xs text-white/50 capitalize">{team.homeAway}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {team.statistics.slice(0, 10).map((stat) => (
                        <div key={`${team.id}-${stat.label}`} className="rounded-xl border border-[#6b6b6b] bg-black px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{stat.label}</p>
                          <p className="text-base font-semibold text-white">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>

              <section className="rounded-2xl border border-[#6b6b6b] bg-black p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Lineups</h4>
                  <span className="text-xs text-white/50">From latest box score</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.teams.map((team) => (
                    <div key={`lineups-${team.id}`} className="space-y-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">{team.name}</p>
                      {data.league === "nfl" || data.league === "cfb" ? (
                        <div className="space-y-3">
                          <LineupGroup
                            title="Offense"
                            players={team.offense || []}
                            onSelect={(playerId) => setPlayerDetail({ team: team.id, playerId })}
                          />
                          <LineupGroup
                            title="Defense"
                            players={team.defense || []}
                            onSelect={(playerId) => setPlayerDetail({ team: team.id, playerId })}
                          />
                          <LineupGroup
                            title="Special Teams"
                            players={team.specialTeams || []}
                            onSelect={(playerId) => setPlayerDetail({ team: team.id, playerId })}
                          />
                        </div>
                      ) : data.league === "nhl" ? (
                        <div className="space-y-3">
                          <LineupGroup
                            title="Forwards"
                            players={team.forwards || []}
                            onSelect={(playerId) => setPlayerDetail({ team: team.id, playerId })}
                          />
                          <LineupGroup
                            title="Defensemen"
                            players={team.defensemen || []}
                            onSelect={(playerId) => setPlayerDetail({ team: team.id, playerId })}
                          />
                          <LineupGroup
                            title="Goalies"
                            players={team.goalies || []}
                            onSelect={(playerId) => setPlayerDetail({ team: team.id, playerId })}
                          />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <LineupGroup
                            title="Starters"
                            players={team.starters}
                            emptyMessage="Starting lineups populate closer to game time."
                            onSelect={(playerId) => setPlayerDetail({ team: team.id, playerId })}
                          />
                          <LineupGroup
                            title="Bench"
                            players={team.bench}
                            emptyMessage="Bench stats unavailable."
                            onSelect={(playerId) => setPlayerDetail({ team: team.id, playerId })}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-2xl border border-[#6b6b6b] bg-black p-6 text-center text-white/70">No box score data available yet.</div>
          )}
          {playerDetail && data?.teams && (
            <PlayerDetailDrawer
              team={data.teams.find((team) => team.id === playerDetail.team)}
              playerId={playerDetail.playerId}
              onClose={() => setPlayerDetail(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface PlayerDetailDrawerProps {
  team?: LiveScoreGameDetails["teams"][number]
  playerId: string
  onClose: () => void
}

function PlayerDetailDrawer({ team, playerId, onClose }: PlayerDetailDrawerProps) {
  if (!team) return null
  const playerPool = [
    ...team.starters,
    ...team.bench,
    ...(team.offense || []),
    ...(team.defense || []),
    ...(team.specialTeams || []),
    ...(team.forwards || []),
    ...(team.defensemen || []),
    ...(team.goalies || []),
  ]
  const player = playerPool.find((athlete) => athlete.id === playerId)
  if (!player) return null

  const statsEntries = player.statMap ? Object.entries(player.statMap) : []
  const headshotSrc = resolveHeadshot(player.headshot)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-[#6b6b6b] bg-black p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-full bg-black">
              {headshotSrc ? (
                <Image src={headshotSrc} alt={player.name} fill sizes="48px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                  {player.position || player.name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{player.name}</p>
              <p className="text-xs text-white/60">
                {team.name} - {player.position || "Player"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-[#6b6b6b] p-2 text-white/70 hover:text-white hover:border-white/60"
            aria-label="Close player stats"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {statsEntries.length ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {statsEntries.map(([label, value]) => (
              <div key={`${playerId}-${label}`} className="rounded-xl border border-[#6b6b6b] bg-black px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{label}</p>
                <p className="text-base font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/60">No detailed stats recorded for this player.</p>
        )}
      </div>
    </div>
  )
}

interface LineupGroupProps {
  title: string
  players: GamePlayerSummary[]
  emptyMessage?: string
  compact?: boolean
  onSelect: (playerId: string) => void
}

function LineupGroup({ title, players, emptyMessage, compact, onSelect }: LineupGroupProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">{title}</p>
      {players.length ? (
        <div className="space-y-2">
          {players.map((player) => {
            const headshotSrc = resolveHeadshot(player.headshot)
            return (
              <button
                key={`${title}-${player.id}`}
                onClick={() => onSelect(player.id)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-2xl border bg-black px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#34d399]/60",
                  compact ? "border-[#6b6b6b]" : "border-[#6b6b6b]"
                )}
              >
                <div
                  className={clsx(
                    "relative overflow-hidden bg-black",
                    compact ? "h-8 w-8 rounded-full" : "h-10 w-10 rounded-full"
                  )}
                >
                  {headshotSrc ? (
                    <Image src={headshotSrc} alt={player.name} fill sizes={compact ? "32px" : "40px"} className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-white/70">
                      {player.position || player.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className={clsx("font-semibold text-white", compact ? "text-xs" : "text-sm")}>
                    {player.name}{" "}
                    {player.position && (
                      <span className={clsx("text-white/50", compact ? "text-[11px]" : "text-xs")}>{player.position}</span>
                    )}
                  </p>
                  <p className={clsx("text-white/60", compact ? "text-[11px]" : "text-xs")}>
                    {player.summaryLine || player.lineLabel || (title === "Bench" ? "Bench" : title)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      ) : emptyMessage ? (
        <p className="text-xs text-white/50">{emptyMessage}</p>
      ) : null}
    </div>
  )
}
