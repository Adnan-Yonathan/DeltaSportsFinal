import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import MobileToolsNav from "@/components/mobile-tools-nav"
import {
  INSIDER_ODDS_SOURCE_ORDER,
  getOddsSource,
} from "@/lib/config/odds-sources"
import { createServiceClient } from "@/lib/supabase/service"

export const metadata: Metadata = {
  title: "Odds Screen | Compare Live Pregame Odds Across Sportsbooks | Delta Sports",
  description:
    "Compare live pregame odds across FanDuel, DraftKings, BetMGM, Caesars, BetRivers, Hard Rock Bet, Fanatics, ESPN BET, Fliff, Circa, Pinnacle, NoVig, ProphetX, Polymarket, and Kalshi in one complete odds screen.",
  alternates: {
    canonical: "https://deltasports.app/odds-screen",
  },
}

export const dynamic = "force-dynamic"
export const revalidate = 0

const SPORT_OPTIONS = [
  { key: "all", label: "All Sports" },
  { key: "basketball_nba", label: "NBA" },
  { key: "basketball_ncaab", label: "NCAAB" },
  { key: "americanfootball_nfl", label: "NFL" },
  { key: "americanfootball_ncaaf", label: "NCAAF" },
  { key: "icehockey_nhl", label: "NHL" },
  { key: "baseball_mlb", label: "MLB" },
] as const

type SportKey = (typeof SPORT_OPTIONS)[number]["key"]
type BookKey = (typeof INSIDER_ODDS_SOURCE_ORDER)[number]

type MarketEdge = {
  homeOdds: number | null
  awayOdds: number | null
  overOdds: number | null
  underOdds: number | null
  totalLine: number | null
  homeSpreadLine: number | null
  awaySpreadLine: number | null
  homeSpreadOdds: number | null
  awaySpreadOdds: number | null
}

type EventView = {
  id: string
  sport: string
  sportLabel: string
  matchup: string
  awayTeam: string
  homeTeam: string
  commenceTime: string
  topTeam: string
  bottomTeam: string
  moneylineTopQuotes: Array<{ book: BookKey; odds: number }>
  moneylineBottomQuotes: Array<{ book: BookKey; odds: number }>
  spreadTopQuotes: Array<{ book: BookKey; odds: number; line: number | null }>
  spreadBottomQuotes: Array<{ book: BookKey; odds: number; line: number | null }>
  overQuotes: Array<{ book: BookKey; odds: number; line: number | null }>
  underQuotes: Array<{ book: BookKey; odds: number; line: number | null }>
  totalConsensusLine: number | null
  columnOrder: BookKey[]
}

const SPORT_LABELS: Record<string, string> = {
  basketball_nba: "NBA",
  basketball_ncaab: "NCAAB",
  americanfootball_nfl: "NFL",
  americanfootball_ncaaf: "NCAAF",
  icehockey_nhl: "NHL",
  baseball_mlb: "MLB",
}

const BOOK_LOGOS: Partial<Record<BookKey, string>> = {
  fanduel: "/fanduel.jpeg",
  draftkings: "/draftkings.png",
  betmgm: "/BETMGM-Logo-Color-Scheme-PNG-thumb.png",
  caesars: "/CZR_BIG.D-96274f93.png",
  betrivers: "/betrivers.png",
  hardrockbet: "/hardrock.png",
  fanatics: "/newfanaticslogo.png",
  espnbet: "/ESPN-BET-Logo.png",
  fliff: "/fliff.png",
  circa: "/circasports.png",
  pinnacle: "/pinnacle.jpg",
  novig: "/Novig.png",
  prophetx: "/ProphetX.png",
  polymarket: "/polymarket.png",
  kalshi: "/kalshi.png",
}

const ALL_ICON_BOOKS: BookKey[] = [
  ...INSIDER_ODDS_SOURCE_ORDER,
].filter((book, index, array) => array.indexOf(book) === index) as BookKey[]

const ACTIVE_SPORT_KEYS = SPORT_OPTIONS.filter(
  (option) => option.key !== "all"
).map((option) => option.key)

const normalizeToken = (value?: string | null) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

const BOOK_TOKEN_ALIASES: Record<BookKey, string[]> = {
  fanduel: ["fanduel", "fd"],
  draftkings: ["draftkings", "dk"],
  betmgm: ["betmgm", "mgm"],
  caesars: ["caesars", "czr", "williamhillus"],
  betrivers: ["betrivers", "rivers"],
  hardrockbet: ["hardrockbet", "hardrock"],
  fanatics: ["fanatics", "fanaticssportsbook", "betfanatics"],
  espnbet: ["espnbet", "thescorebet"],
  fliff: ["fliff"],
  circa: ["circa", "circasports"],
  pinnacle: ["pinnacle", "pinnaclesports"],
  novig: ["novig", "novigus", "novigus"],
  prophetx: ["prophetx", "prophet", "prophetexchange"],
  polymarket: ["polymarket", "poly"],
  kalshi: ["kalshi"],
}

const matchesBookToken = (book: BookKey, candidateKey: string) => {
  const aliases = BOOK_TOKEN_ALIASES[book]
  const normalizedCandidate = normalizeToken(candidateKey)
  if (!normalizedCandidate) return false
  return aliases.some((alias) => {
    const normalizedAlias = normalizeToken(alias)
    return (
      normalizedAlias === normalizedCandidate ||
      normalizedCandidate.includes(normalizedAlias) ||
      normalizedAlias.includes(normalizedCandidate)
    )
  })
}

const resolveBookQuoteByAlias = (
  quotes: Record<string, unknown> | null | undefined,
  book: BookKey
) => {
  if (!quotes || typeof quotes !== "object") return null
  const direct = quotes[book]
  if (direct) return direct as Record<string, unknown>

  for (const [key, value] of Object.entries(quotes)) {
    if (matchesBookToken(book, key)) {
      return value as Record<string, unknown>
    }
  }
  return null
}

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const formatAmericanOdds = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return "\u2014"
  const rounded = Math.round(value)
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

const formatLine = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return "\u2014"
  const rounded = Number(value.toFixed(1))
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded.toFixed(1)}`
}

const formatCommenceTime = (value?: string | null) => {
  if (!value) return "TBD"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "TBD"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date)
}

const impliedProbability = (odds: number | null) => {
  if (odds == null || !Number.isFinite(odds) || odds === 0) return null
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100)
}

const average = (values: number[]) => {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const toBookOrderScore = (
  rowSets: Array<Array<{ book: BookKey; odds: number }>>
) => {
  const scores = new Map<BookKey, number>()
  for (const row of rowSets) {
    const sorted = [...row].sort((a, b) => b.odds - a.odds)
    const n = sorted.length
    sorted.forEach((quote, index) => {
      const points = n - index
      scores.set(quote.book, (scores.get(quote.book) ?? 0) + points)
    })
  }
  return scores
}

const resolveEventColumnOrder = (
  rowSets: Array<Array<{ book: BookKey; odds: number }>>
) => {
  const scores = toBookOrderScore(rowSets)
  return [...ALL_ICON_BOOKS].sort((a, b) => {
    const scoreDiff = (scores.get(b) ?? 0) - (scores.get(a) ?? 0)
    if (scoreDiff !== 0) return scoreDiff
    return ALL_ICON_BOOKS.indexOf(a) - ALL_ICON_BOOKS.indexOf(b)
  })
}

const isFutureEvent = (commenceTime?: string | null) => {
  if (!commenceTime) return true
  const ms = Date.parse(commenceTime)
  if (!Number.isFinite(ms)) return true
  return ms >= Date.now()
}

const extractBookQuote = (edge: any, book: BookKey): MarketEdge => {
  const moneylineQuote = resolveBookQuoteByAlias(edge?.moneyline?.bookQuotes, book)
  const totalQuote = resolveBookQuoteByAlias(edge?.total?.bookQuotes, book)
  const spreadQuote = resolveBookQuoteByAlias(edge?.spread?.bookQuotes, book)
  return {
    homeOdds: coerceNumber(moneylineQuote?.homeOdds),
    awayOdds: coerceNumber(moneylineQuote?.awayOdds),
    overOdds: coerceNumber(totalQuote?.overOdds),
    underOdds: coerceNumber(totalQuote?.underOdds),
    totalLine: coerceNumber(totalQuote?.line),
    homeSpreadLine: coerceNumber(spreadQuote?.homeLine),
    awaySpreadLine: coerceNumber(spreadQuote?.awayLine),
    homeSpreadOdds: coerceNumber(spreadQuote?.homeOdds),
    awaySpreadOdds: coerceNumber(spreadQuote?.awayOdds),
  }
}

const resolveFavoriteSide = (
  homeOdds: number[],
  awayOdds: number[],
  homeSpreadLines: number[],
  awaySpreadLines: number[]
): "home" | "away" | null => {
  const homeProbability = average(
    homeOdds.map((odds) => impliedProbability(odds)).filter((v): v is number => v != null)
  )
  const awayProbability = average(
    awayOdds.map((odds) => impliedProbability(odds)).filter((v): v is number => v != null)
  )

  if (homeProbability == null && awayProbability == null) return null
  if (homeProbability == null) return "away"
  if (awayProbability == null) return "home"
  if (homeProbability !== awayProbability) {
    return homeProbability >= awayProbability ? "home" : "away"
  }

  const homeSpreadAverage = average(homeSpreadLines)
  const awaySpreadAverage = average(awaySpreadLines)
  if (homeSpreadAverage == null || awaySpreadAverage == null) return null
  if (homeSpreadAverage === awaySpreadAverage) return null
  return homeSpreadAverage < awaySpreadAverage ? "home" : "away"
}

const resolveConsensusTotalLine = (lines: number[]) => {
  if (!lines.length) return null
  const sorted = [...lines].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(1))
  }
  return Number(sorted[middle].toFixed(1))
}

const buildEventViews = (edges: any[]): EventView[] => {
  const rows: EventView[] = []

  for (const edge of edges) {
    const awayTeam = String(edge?.awayTeam ?? "").trim()
    const homeTeam = String(edge?.homeTeam ?? "").trim()
    if (!awayTeam || !homeTeam) continue

    const bookQuotes = INSIDER_ODDS_SOURCE_ORDER.map((book) => ({
      book,
      quote: extractBookQuote(edge, book),
    }))

    const homeOdds = bookQuotes
      .map((entry) => entry.quote.homeOdds)
      .filter((value): value is number => value != null)
    const awayOdds = bookQuotes
      .map((entry) => entry.quote.awayOdds)
      .filter((value): value is number => value != null)
    const homeSpreadLines = bookQuotes
      .map((entry) => entry.quote.homeSpreadLine)
      .filter((value): value is number => value != null)
    const awaySpreadLines = bookQuotes
      .map((entry) => entry.quote.awaySpreadLine)
      .filter((value): value is number => value != null)

    const favoriteSide = resolveFavoriteSide(
      homeOdds,
      awayOdds,
      homeSpreadLines,
      awaySpreadLines
    )
    const topSide = favoriteSide ?? "home"
    const bottomSide = topSide === "home" ? "away" : "home"

    const moneylineTopQuotes = bookQuotes
      .map((entry) => ({
        book: entry.book,
        odds: topSide === "home" ? entry.quote.homeOdds : entry.quote.awayOdds,
      }))
      .filter(
        (entry): entry is { book: BookKey; odds: number } => entry.odds != null
      )

    const moneylineBottomQuotes = bookQuotes
      .map((entry) => ({
        book: entry.book,
        odds: bottomSide === "home" ? entry.quote.homeOdds : entry.quote.awayOdds,
      }))
      .filter(
        (entry): entry is { book: BookKey; odds: number } => entry.odds != null
      )

    const spreadTopQuotes = bookQuotes
      .map((entry) => ({
        book: entry.book,
        odds: topSide === "home" ? entry.quote.homeSpreadOdds : entry.quote.awaySpreadOdds,
        line: topSide === "home" ? entry.quote.homeSpreadLine : entry.quote.awaySpreadLine,
      }))
      .filter(
        (entry): entry is { book: BookKey; odds: number; line: number | null } =>
          entry.odds != null
      )

    const spreadBottomQuotes = bookQuotes
      .map((entry) => ({
        book: entry.book,
        odds: bottomSide === "home" ? entry.quote.homeSpreadOdds : entry.quote.awaySpreadOdds,
        line: bottomSide === "home" ? entry.quote.homeSpreadLine : entry.quote.awaySpreadLine,
      }))
      .filter(
        (entry): entry is { book: BookKey; odds: number; line: number | null } =>
          entry.odds != null
      )

    const overQuotes = bookQuotes
      .map((entry) => ({
        book: entry.book,
        odds: entry.quote.overOdds,
        line: entry.quote.totalLine ?? null,
      }))
      .filter(
        (entry): entry is { book: BookKey; odds: number; line: number | null } =>
          entry.odds != null
      )

    const underQuotes = bookQuotes
      .map((entry) => ({
        book: entry.book,
        odds: entry.quote.underOdds,
        line: entry.quote.totalLine ?? null,
      }))
      .filter(
        (entry): entry is { book: BookKey; odds: number; line: number | null } =>
          entry.odds != null
      )

    const totalLines = bookQuotes
      .map((entry) => entry.quote.totalLine)
      .filter((line): line is number => line != null)
    const totalConsensusLine = resolveConsensusTotalLine(totalLines)

    const hasRelevantOdds =
      moneylineTopQuotes.length > 0 ||
      moneylineBottomQuotes.length > 0 ||
      spreadTopQuotes.length > 0 ||
      spreadBottomQuotes.length > 0 ||
      overQuotes.length > 0 ||
      underQuotes.length > 0
    if (!hasRelevantOdds) continue

    const columnOrder = resolveEventColumnOrder([
      moneylineTopQuotes,
      moneylineBottomQuotes,
      spreadTopQuotes,
      spreadBottomQuotes,
      overQuotes,
      underQuotes,
    ])

    rows.push({
      id: `${edge?.oddsApiId ?? edge?.matchup ?? `${awayTeam}@${homeTeam}`}:${edge?.commenceTime ?? ""}`,
      sport: String(edge?.sport ?? ""),
      sportLabel: SPORT_LABELS[String(edge?.sport ?? "")] ?? "Sport",
      matchup: `${awayTeam} @ ${homeTeam}`,
      awayTeam,
      homeTeam,
      commenceTime: String(edge?.commenceTime ?? ""),
      topTeam: topSide === "home" ? homeTeam : awayTeam,
      bottomTeam: bottomSide === "home" ? homeTeam : awayTeam,
      moneylineTopQuotes,
      moneylineBottomQuotes,
      spreadTopQuotes,
      spreadBottomQuotes,
      overQuotes,
      underQuotes,
      totalConsensusLine,
      columnOrder,
    })
  }

  return rows
    .filter((row) => isFutureEvent(row.commenceTime))
    .sort((a, b) => {
      const aMs = Date.parse(a.commenceTime)
      const bMs = Date.parse(b.commenceTime)
      if (!Number.isFinite(aMs) && !Number.isFinite(bMs)) return 0
      if (!Number.isFinite(aMs)) return 1
      if (!Number.isFinite(bMs)) return -1
      return aMs - bMs
    })
}

const getBookLabel = (book: BookKey) => getOddsSource(book)?.label ?? book.toUpperCase()

const CompactMarket = ({
  title,
  lineLabel,
  topLabel,
  topOdds,
  bottomLabel,
  bottomOdds,
}: {
  title: string
  lineLabel: string
  topLabel: string
  topOdds: string
  bottomLabel: string
  bottomOdds: string
}) => (
  <div className="rounded-lg border border-white/10 bg-black/40 p-2">
    <div className="text-[9px] uppercase tracking-[0.2em] text-white/45">{title}</div>
    <div className="mt-1.5 flex items-stretch gap-2">
      <div className="flex min-w-[48px] items-center justify-center rounded-md border border-white/15 bg-black/70 px-1 text-xs font-semibold text-white/90">
        {lineLabel}
      </div>
      <div className="flex-1 overflow-hidden rounded-md border border-white/15 bg-black/60">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2 py-1">
          <span className="truncate text-[10px] text-white/60">{topLabel}</span>
          <span className="text-xs font-semibold text-emerald-200">{topOdds}</span>
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <span className="truncate text-[10px] text-white/60">{bottomLabel}</span>
          <span className="text-xs font-semibold text-white">{bottomOdds}</span>
        </div>
      </div>
    </div>
  </div>
)

const loadCacheEdgesForSport = async (
  serviceClient: ReturnType<typeof createServiceClient>,
  sport: string
) => {
  const { data } = (await serviceClient
    .from("market_projections_cache" as any)
    .select("edges")
    .eq("sport", sport)
    .single()) as unknown as {
    data: { edges: any[] } | null
  }

  if (!data || !Array.isArray(data.edges)) return []
  return data.edges.map((edge) => ({ ...edge, sport }))
}

export default async function OddsScreenPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const rawSport = searchParams?.sport
  const sportParam = Array.isArray(rawSport) ? rawSport[0] : rawSport
  const selectedSport: SportKey = SPORT_OPTIONS.some((option) => option.key === sportParam)
    ? (sportParam as SportKey)
    : "all"

  const serviceClient = createServiceClient()
  const sportKeys =
    selectedSport === "all" ? ACTIVE_SPORT_KEYS : [selectedSport]

  const edgeGroups = await Promise.all(
    sportKeys.map((sport) => loadCacheEdgesForSport(serviceClient, sport))
  )
  const events = buildEventViews(edgeGroups.flat())

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-2 pb-[96px] pt-4 sm:px-4 sm:pb-0 sm:pt-5">
        <div className="mx-auto w-full max-w-none space-y-4">
          <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/12 to-black p-4 sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.26em] text-emerald-200/80">
              Free Public Odds Screen
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Live Pregame Odds Across Top Sportsbooks and Exchanges
            </h1>
            <p className="mt-2 max-w-4xl text-sm text-white/80">
              Compare live pregame lines for every matchup in one screen. We rank books left-to-right by the most favorable odds per event so you can line shop faster across FanDuel, DraftKings, BetMGM, Caesars, BetRivers, Hard Rock Bet, Fanatics, ESPN BET, Fliff, Circa, Pinnacle, NoVig, ProphetX, Polymarket, and Kalshi.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/50 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-white/50">
              Sport Filter
            </p>
            <div className="flex flex-wrap gap-2">
              {SPORT_OPTIONS.map((option) => {
                const isActive = selectedSport === option.key
                const href = option.key === "all" ? "/odds-screen" : `/odds-screen?sport=${option.key}`
                return (
                  <Link
                    key={`sport-filter-${option.key}`}
                    href={href}
                    className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors ${
                      isActive
                        ? "border-emerald-400/55 bg-emerald-500/15 text-emerald-100"
                        : "border-white/15 bg-black/45 text-white/70 hover:border-white/35 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </Link>
                )
              })}
            </div>
          </section>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-white/65">
              No pregame odds available right now for this filter.
            </div>
          ) : null}

          {events.map((event) => {
            const moneylineTopByBook = new Map(event.moneylineTopQuotes.map((quote) => [quote.book, quote]))
            const moneylineBottomByBook = new Map(event.moneylineBottomQuotes.map((quote) => [quote.book, quote]))
            const spreadTopByBook = new Map(event.spreadTopQuotes.map((quote) => [quote.book, quote]))
            const spreadBottomByBook = new Map(event.spreadBottomQuotes.map((quote) => [quote.book, quote]))
            const overByBook = new Map(event.overQuotes.map((quote) => [quote.book, quote]))
            const underByBook = new Map(event.underQuotes.map((quote) => [quote.book, quote]))

            return (
              <article
                key={event.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <header className="border-b border-white/10 bg-black/40 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-white">{event.matchup}</h2>
                      <p className="text-xs text-white/55">
                        {event.sportLabel} · {formatCommenceTime(event.commenceTime)}
                      </p>
                    </div>
                    <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-emerald-200">
                      Best Books Left
                    </span>
                  </div>
                </header>

                <div className="p-2 sm:p-3">
                  <div className="overflow-x-auto">
                    <div className="flex min-w-max gap-2">
                      {event.columnOrder.map((book) => {
                        const label = getBookLabel(book)
                        const logoSrc = BOOK_LOGOS[book]
                        const mlTop = moneylineTopByBook.get(book)
                        const mlBottom = moneylineBottomByBook.get(book)
                        const spreadTop = spreadTopByBook.get(book)
                        const spreadBottom = spreadBottomByBook.get(book)
                        const over = overByBook.get(book)
                        const under = underByBook.get(book)
                        const totalLine = over?.line ?? under?.line ?? event.totalConsensusLine
                        const spreadLine = spreadTop?.line ?? spreadBottom?.line ?? null

                        return (
                          <div
                            key={`${event.id}-book-${book}`}
                            className="w-[220px] shrink-0 rounded-xl border border-white/15 bg-black/45 p-2"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-black/70">
                                {logoSrc ? (
                                  <Image
                                    src={logoSrc}
                                    alt={`${label} logo`}
                                    width={20}
                                    height={20}
                                    className="h-5 w-5 object-contain"
                                  />
                                ) : (
                                  <span className="text-[8px] font-semibold text-white/80">
                                    {label.slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </span>
                              <span className="truncate text-xs font-medium text-white/85">{label}</span>
                            </div>

                            <div className="space-y-2">
                              <CompactMarket
                                title="Moneyline"
                                lineLabel="ML"
                                topLabel={event.topTeam}
                                topOdds={formatAmericanOdds(mlTop?.odds)}
                                bottomLabel={event.bottomTeam}
                                bottomOdds={formatAmericanOdds(mlBottom?.odds)}
                              />
                              <CompactMarket
                                title="Spread"
                                lineLabel={formatLine(spreadLine)}
                                topLabel={event.topTeam}
                                topOdds={formatAmericanOdds(spreadTop?.odds)}
                                bottomLabel={event.bottomTeam}
                                bottomOdds={formatAmericanOdds(spreadBottom?.odds)}
                              />
                              <CompactMarket
                                title="O/U"
                                lineLabel={formatLine(totalLine)}
                                topLabel="Over"
                                topOdds={formatAmericanOdds(over?.odds)}
                                bottomLabel="Under"
                                bottomOdds={formatAmericanOdds(under?.odds)}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
      <MobileToolsNav />
    </div>
  )
}
