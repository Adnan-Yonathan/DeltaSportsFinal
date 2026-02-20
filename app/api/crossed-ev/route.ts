import { NextResponse } from "next/server"
import { fetchSbdGamePropsList, resolveSbdLeague } from "@/lib/api/sbd"

export const dynamic = "force-dynamic"

const CACHE_TTL_MS = 10 * 60 * 1000
type CacheEntry = { ts: number; payload: any }
const responseCache = new Map<string, CacheEntry>()

const BASE_SPORTS = [
  "basketball_nba",
  "basketball_ncaab",
  "americanfootball_nfl",
  "icehockey_nhl",
  "baseball_mlb",
]
const ALL_SPORTS_TARGET = [
  "basketball_nba",
  "basketball_ncaab",
  "icehockey_nhl",
]

const SUPPORTED_SPORTS = ["all", ...BASE_SPORTS]

const SPORT_MARKETS: Record<string, string[]> = {
  basketball_nba: [
    "points",
    "rebounds",
    "assists",
    "threes",
    "pra",
    "points_rebounds",
    "points_assists",
    "rebounds_assists",
    "blocks",
    "steals",
    "turnovers",
  ],
  basketball_ncaab: [
    "points",
    "rebounds",
    "assists",
    "threes",
    "pra",
    "points_rebounds",
    "points_assists",
    "rebounds_assists",
  ],
  americanfootball_nfl: [
    "passing_yards",
    "passing_touchdowns",
    "passing_completions",
    "passing_attempts",
    "interceptions",
    "rushing_yards",
    "rushing_touchdowns",
    "receptions",
    "receiving_yards",
    "receiving_touchdowns",
    "longest_reception",
    "longest_rush",
  ],
  icehockey_nhl: [
    "points",
    "goals",
    "assists",
    "shots_on_goal",
    "blocked_shots",
    "saves",
  ],
  baseball_mlb: [
    "hits",
    "total_bases",
    "home_runs",
    "rbis",
    "runs",
    "strikeouts",
    "walks",
  ],
}

const BOOK_ALLOWLIST = [
  "betrivers",
  "betmgm",
  "caesars",
  "fanduel",
  "draftkings",
  "hardrockbet",
  "espnbet",
  "fanatics",
  "pinnacle",
  "underdog",
  "prizepicks",
  "betr",
  "pick6",
  "sleeper",
  "novig",
  "prophetx",
  "bet365",
]

const CONSENSUS_BOOKS = [
  "betrivers",
  "betmgm",
  "caesars",
  "fanduel",
  "draftkings",
  "hardrockbet",
  "espnbet",
  "fanatics",
  "pinnacle",
  "bet365",
]

const EXCHANGE_BOOKS = ["novig", "prophetx"]

const BOOK_ALIASES: Record<string, string> = {
  betmgm: "betmgm",
  mgm: "betmgm",
  betmgmus: "betmgm",
  betmgm_us: "betmgm",
  williamhillus: "caesars",
  williamhill_us: "caesars",
  caesars: "caesars",
  caesars_us: "caesars",
  caesarsbook: "caesars",
  williamhill: "caesars",
  williamhillnewjersey: "caesars",
  fanduel: "fanduel",
  draftkings: "draftkings",
  dk: "draftkings",
  betrivers: "betrivers",
  bet_rivers: "betrivers",
  "bet-rivers": "betrivers",
  hardrockbet: "hardrockbet",
  hardrock: "hardrockbet",
  espnbet: "espnbet",
  fanatics: "fanatics",
  fanaticssportsbook: "fanatics",
  pinnacle: "pinnacle",
  underdog: "underdog",
  prizepicks: "prizepicks",
  betr: "betr",
  betr_pick6: "pick6",
  betrpick6: "pick6",
  pick6: "pick6",
  sleeper: "sleeper",
  sleeperfantasy: "sleeper",
  novig: "novig",
  novig_us: "novig",
  prophetx: "prophetx",
  prophetx_us: "prophetx",
  bet365: "bet365",
  bet365us: "bet365",
  bet365usnj: "bet365",
  bet365nj: "bet365",
}

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "")

const resolveBookKey = (value: string) => {
  const normalized = normalizeKey(value)
  return BOOK_ALIASES[normalized] || normalized
}

const normalizeSbdMarketKey = (value: string) => {
  const cleaned = value.toLowerCase().replace(/\(.*?\)/g, "").trim()
  if (!cleaned) return ""

  if (cleaned.includes("points plus assists plus rebounds") || cleaned.includes("pts + reb + ast")) return "pra"
  if (cleaned.includes("points plus rebounds") || cleaned.includes("pts + reb")) return "points_rebounds"
  if (cleaned.includes("points plus assists") || cleaned.includes("pts + ast")) return "points_assists"
  if (cleaned.includes("rebounds plus assists") || cleaned.includes("reb + ast")) return "rebounds_assists"
  if (cleaned.includes("blocks plus steals")) return "blocks_steals"
  if (cleaned.includes("3-point") || cleaned.includes("three")) return "threes"
  if (cleaned.includes("turnovers")) return "turnovers"
  if (cleaned.includes("passing yards")) return "passing_yards"
  if (cleaned.includes("passing tds") || cleaned.includes("passing touchdowns")) return "passing_touchdowns"
  if (cleaned.includes("pass completions") || cleaned.includes("passing completions")) return "passing_completions"
  if (cleaned.includes("pass attempts") || cleaned.includes("passing attempts")) return "passing_attempts"
  if (cleaned.includes("interceptions")) return "interceptions"
  if (cleaned.includes("rushing yards")) return "rushing_yards"
  if (cleaned.includes("rushing tds") || cleaned.includes("rushing touchdowns")) return "rushing_touchdowns"
  if (cleaned.includes("receiving yards")) return "receiving_yards"
  if (cleaned.includes("receiving tds") || cleaned.includes("receiving touchdowns")) return "receiving_touchdowns"
  if (cleaned.includes("receptions")) return "receptions"
  if (cleaned.includes("longest rush")) return "longest_rush"
  if (cleaned.includes("longest reception")) return "longest_reception"
  if (cleaned.includes("shots on goal") || cleaned.includes("total shots")) return "shots_on_goal"
  if (cleaned.includes("blocked shots")) return "blocked_shots"
  if (cleaned.includes("saves")) return "saves"
  if (cleaned.includes("total bases")) return "total_bases"
  if (cleaned.includes("home runs") || cleaned.includes("homers")) return "home_runs"
  if (cleaned.includes("rbis") || cleaned.includes("runs batted")) return "rbis"
  if (cleaned.includes("runs scored") || cleaned.includes("total runs")) return "runs"
  if (cleaned.includes("walks")) return "walks"
  if (cleaned.includes("strikeouts")) return "strikeouts"
  if (cleaned.includes("points")) return "points"
  if (cleaned.includes("rebounds")) return "rebounds"
  if (cleaned.includes("assists")) return "assists"
  if (cleaned.includes("goals")) return "goals"
  if (cleaned.includes("hits")) return "hits"

  return cleaned
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

const parseAmericanOdds = (value: unknown) => {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  const normalized = raw.replace(/[^\d+\-.]/g, "")
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  if (parsed > 1 && parsed < 10) {
    if (parsed >= 2) return Math.round((parsed - 1) * 100)
    return Math.round(-100 / (parsed - 1))
  }
  return Math.round(parsed)
}

const normalizePlayerName = (value: string) => {
  const trimmed = value.trim()
  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean)
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`
  return trimmed
}

const getTeamName = (team: any) => {
  if (!team) return ""
  if (typeof team.name === "string") return team.name
  return ""
}

const extractGameTeams = (entry: any) => {
  const homeFromEntry = getTeamName(entry?.home_team)
  const awayFromEntry = getTeamName(entry?.away_team)
  if (homeFromEntry && awayFromEntry) {
    return { homeTeam: homeFromEntry, awayTeam: awayFromEntry }
  }

  const competitors = Array.isArray(entry?.sport_event?.competitors)
    ? entry.sport_event.competitors
    : []
  const homeFromCompetitors = competitors.find((team: any) => String(team?.qualifier || "").toLowerCase() === "home")
  const awayFromCompetitors = competitors.find((team: any) => String(team?.qualifier || "").toLowerCase() === "away")
  return {
    homeTeam: getTeamName(homeFromCompetitors),
    awayTeam: getTeamName(awayFromCompetitors),
  }
}

const toDisplayBook = (key: string) => {
  switch (key) {
    case "betrivers":
      return "BetRivers"
    case "betmgm":
      return "BetMGM"
    case "caesars":
      return "Caesars"
    case "fanduel":
      return "FanDuel"
    case "draftkings":
      return "DraftKings"
    case "hardrockbet":
      return "Hard Rock"
    case "espnbet":
      return "ESPN BET"
    case "fanatics":
      return "Fanatics"
    case "pinnacle":
      return "Pinnacle"
    case "underdog":
      return "Underdog"
    case "prizepicks":
      return "PrizePicks"
    case "betr":
      return "Betr Pick 6"
    case "pick6":
      return "Pick 6"
    case "sleeper":
      return "Sleeper"
    case "novig":
      return "NoVig"
    case "prophetx":
      return "ProphetX"
    case "bet365":
      return "Bet365"
    default:
      return key
  }
}

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

const toImpliedProb = (odds: number) =>
  odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100)

const toDecimalOdds = (odds: number) =>
  odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)

const probToAmericanOdds = (prob: number) => {
  if (!Number.isFinite(prob) || prob <= 0 || prob >= 1) return null
  if (prob < 0.5) {
    return (1 / prob - 1) * 100
  }
  return -(prob / (1 - prob)) * 100
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

type BookOffer = {
  point: number
  over?: number
  under?: number
}

type PropBase = {
  id: string
  sportKey: string
  player: string
  market: string
  game: string
  commenceTime: string
  homeTeam?: string
  awayTeam?: string
  teams?: string[]
}

type PropOfferRow = {
  id: string
  sportKey: string
  player: string
  market: string
  game: string
  commenceTime: string
  homeTeam?: string
  awayTeam?: string
  teams?: string[]
  bookKey: string
  bookLabel: string
  bookPoint: number
  consensusPoint: number
  consensusOverOdds: number | null
  consensusUnderOdds: number | null
  delta: number
  discrepancy: number
  recommendedSide: "over" | "under"
  overOdds?: number
  underOdds?: number
  evPercent: number | null
}

const parseCommenceMs = (value: string) => {
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY
}

const CURRENT_SLATE_LOOKBACK_MS = 1000 * 60 * 60 * 3
const CURRENT_SLATE_LOOKAHEAD_MS = 1000 * 60 * 60 * 48

const isCurrentSlateGame = (commenceTime?: string | null, nowMs = Date.now()) => {
  if (!commenceTime) return false
  const gameTimeMs = Date.parse(commenceTime)
  if (!Number.isFinite(gameTimeMs)) return false
  return (
    gameTimeMs >= nowMs - CURRENT_SLATE_LOOKBACK_MS &&
    gameTimeMs <= nowMs + CURRENT_SLATE_LOOKAHEAD_MS
  )
}

const compareRowsWithinSport = (a: PropOfferRow, b: PropOfferRow) => {
  const timeDiff = parseCommenceMs(a.commenceTime) - parseCommenceMs(b.commenceTime)
  if (timeDiff !== 0) return timeDiff
  const aEv = a.evPercent ?? -Infinity
  const bEv = b.evPercent ?? -Infinity
  if (bEv !== aEv) return bEv - aEv
  if (b.discrepancy !== a.discrepancy) return b.discrepancy - a.discrepancy
  return a.game.localeCompare(b.game)
}

const interleaveRowsBySport = (
  rows: PropOfferRow[],
  sportOrder: string[],
  maxRows: number
) => {
  const grouped = new Map<string, PropOfferRow[]>()
  for (const row of rows) {
    const bucket = grouped.get(row.sportKey) ?? []
    bucket.push(row)
    grouped.set(row.sportKey, bucket)
  }

  for (const group of grouped.values()) {
    group.sort(compareRowsWithinSport)
  }

  const orderedSports = [
    ...sportOrder,
    ...Array.from(grouped.keys()).filter((sport) => !sportOrder.includes(sport)),
  ]
  const indexes = new Map<string, number>()
  const interleaved: PropOfferRow[] = []

  while (interleaved.length < maxRows) {
    let appended = false
    for (const sportKey of orderedSports) {
      const group = grouped.get(sportKey)
      if (!group || group.length === 0) continue
      const index = indexes.get(sportKey) ?? 0
      if (index >= group.length) continue
      interleaved.push(group[index])
      indexes.set(sportKey, index + 1)
      appended = true
      if (interleaved.length >= maxRows) break
    }
    if (!appended) break
  }

  return interleaved
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requestedSport = searchParams.get("sport") || "all"
  const normalizedSport = SUPPORTED_SPORTS.includes(requestedSport)
    ? requestedSport
    : "all"
  const targetSports =
    normalizedSport === "all"
      ? ALL_SPORTS_TARGET
      : ([normalizedSport] as string[])
  const markets = Array.from(
    new Set(targetSports.flatMap((sportKey) => SPORT_MARKETS[sportKey] ?? []))
  )
  const cacheKey = targetSports
    .map((sportKey) => `${sportKey}:${(SPORT_MARKETS[sportKey] ?? []).join(",")}`)
    .join("|")

  const cached = responseCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.payload, cached: true })
  }

  try {
    const entriesBySport = await Promise.all(
      targetSports.map(async (sportKey) => {
        const sportMarkets = SPORT_MARKETS[sportKey] ?? []
        if (!sportMarkets.length) {
          return { sportKey, entries: [] as any[] }
        }

        const league = resolveSbdLeague(sportKey)
        if (!league) {
          return { sportKey, entries: [] as any[] }
        }

        try {
          const payload = await fetchSbdGamePropsList(league, {
            init: { cache: "no-store" },
          })
          const entries = Array.isArray(payload)
            ? payload
            : Array.isArray((payload as any)?.data)
              ? (payload as any).data
              : []
          return { sportKey, entries }
        } catch (error) {
          console.warn(`[crossed-ev] failed to fetch ${sportKey}:`, error)
          return { sportKey, entries: [] as any[] }
        }
      })
    )

    const offersByProp = new Map<string, { base: PropBase; offers: Record<string, BookOffer> }>()
    const nowMs = Date.now()

    for (const { sportKey, entries } of entriesBySport) {
      const allowedMarkets = new Set(SPORT_MARKETS[sportKey] ?? [])

      for (const entry of entries || []) {
        const rawPlayerName = String(entry?.player_name || entry?.player?.name || "").trim()
        if (!rawPlayerName) continue
        const player = normalizePlayerName(rawPlayerName)

        const marketKey = normalizeSbdMarketKey(String(entry?.name || ""))
        if (!marketKey || (allowedMarkets.size > 0 && !allowedMarkets.has(marketKey))) {
          continue
        }

        const commenceTime = String(
          entry?.start_time ||
            entry?.sport_event?.start_time ||
            ""
        )
        if (!isCurrentSlateGame(commenceTime, nowMs)) continue

        const { homeTeam, awayTeam } = extractGameTeams(entry)
        if (!homeTeam || !awayTeam) continue
        const gameLabel = `${awayTeam} @ ${homeTeam}`
        const eventId = String(
          entry?.sport_event?.id ||
            entry?.sde_id ||
            `${sportKey}:${homeTeam}:${awayTeam}:${commenceTime}`
        )

        const sportsbooks = Array.isArray(entry?.sportsbooks) ? entry.sportsbooks : []
        for (const sportsbook of sportsbooks) {
          const bookKey = resolveBookKey(String(sportsbook?.name || ""))
          if (!bookKey || !BOOK_ALLOWLIST.includes(bookKey) || bookKey === "consensus") continue

          const odds = sportsbook?.odds || {}
          const point = Number(
            odds?.over_points ??
              odds?.under_points ??
              sportsbook?.over_points ??
              sportsbook?.under_points
          )
          if (!Number.isFinite(point)) continue

          const overPrice = parseAmericanOdds(
            odds?.over_american ?? odds?.over_decimal ?? sportsbook?.over_odds
          )
          const underPrice = parseAmericanOdds(
            odds?.under_american ?? odds?.under_decimal ?? sportsbook?.under_odds
          )
          if (!Number.isFinite(overPrice) && !Number.isFinite(underPrice)) continue

          const propKey = `${sportKey}:${eventId}:${player}:${marketKey}`
          const existing = offersByProp.get(propKey) || {
            base: {
              id: propKey,
              sportKey,
              player,
              market: marketKey,
              game: gameLabel,
              commenceTime,
              homeTeam,
              awayTeam,
              teams: [homeTeam, awayTeam].filter(Boolean),
            },
            offers: {} as Record<string, BookOffer>,
          }

          const current = existing.offers[bookKey] || { point }
          if (current.point !== point) {
            const currentFilled = Number.isFinite(current.over) && Number.isFinite(current.under)
            const nextFilled =
              (Number.isFinite(overPrice) || Number.isFinite(current.over)) &&
              (Number.isFinite(underPrice) || Number.isFinite(current.under))
            if (!currentFilled || nextFilled) {
              current.point = point
              delete current.over
              delete current.under
            }
          }

          if (Number.isFinite(overPrice)) current.over = overPrice as number
          if (Number.isFinite(underPrice)) current.under = underPrice as number
          existing.offers[bookKey] = current
          offersByProp.set(propKey, existing)
        }
      }
    }

    const rows: PropOfferRow[] = []
    for (const entry of offersByProp.values()) {
      const consensusPoints: number[] = []
      let consensusBookCount = 0
      for (const [bookKey, offer] of Object.entries(entry.offers)) {
        if (!Number.isFinite(offer.point)) continue
        if (CONSENSUS_BOOKS.includes(bookKey)) {
          consensusPoints.push(offer.point)
          consensusBookCount += 1
        }
      }
      if (consensusPoints.length < 3) {
        for (const offer of Object.values(entry.offers)) {
          if (!Number.isFinite(offer.point)) continue
          consensusPoints.push(offer.point)
        }
      }
      const distinctPoints = Array.from(new Set(consensusPoints))
      if (distinctPoints.length < 2) continue
      const consensusPoint = mean(consensusPoints)

      const consensusOverProbs: number[] = []
      const consensusUnderProbs: number[] = []

      const useAllBooksForConsensusOdds = consensusBookCount < 3
      for (const [bookKey, offer] of Object.entries(entry.offers)) {
        const useForConsensusOdds =
          useAllBooksForConsensusOdds || CONSENSUS_BOOKS.includes(bookKey)
        if (!useForConsensusOdds) continue
        if (Number.isFinite(offer.over)) consensusOverProbs.push(toImpliedProb(offer.over as number))
        if (Number.isFinite(offer.under)) consensusUnderProbs.push(toImpliedProb(offer.under as number))
      }

      const consensusOverProb = consensusOverProbs.length
        ? mean(consensusOverProbs)
        : null
      const consensusUnderProb = consensusUnderProbs.length
        ? mean(consensusUnderProbs)
        : null

      const consensusOverOddsRaw =
        consensusOverProb != null ? probToAmericanOdds(consensusOverProb) : null
      const consensusUnderOddsRaw =
        consensusUnderProb != null ? probToAmericanOdds(consensusUnderProb) : null
      const consensusOverOdds =
        consensusOverOddsRaw == null ? null : Math.round(consensusOverOddsRaw)
      const consensusUnderOdds =
        consensusUnderOddsRaw == null ? null : Math.round(consensusUnderOddsRaw)

      for (const [bookKey, offer] of Object.entries(entry.offers)) {
        if (!Number.isFinite(offer.point)) continue
        const delta = offer.point - consensusPoint
        const discrepancy = Math.abs(delta)
        if (!Number.isFinite(discrepancy) || discrepancy <= 0) continue

        const recommendedSide: "over" | "under" = delta < 0 ? "over" : "under"
        const recommendedOdds =
          recommendedSide === "over" ? offer.over : offer.under
        const consensusProb =
          recommendedSide === "over" ? consensusOverProb : consensusUnderProb
        const baseProb = consensusProb
        // Heuristic: if the book is off the consensus line, the win probability shifts in the
        // direction of the better line. This prevents obvious cases (ex: consensus 17 vs book 24)
        // from showing negative EV solely because we used consensus pricing at a different line.
        const lineAdjustment = discrepancy * 0.03
        const adjustedProb =
          baseProb == null
            ? null
            : clamp(baseProb + lineAdjustment, 0.02, 0.98)
        const evPercent =
          Number.isFinite(recommendedOdds) && adjustedProb != null
            ? (adjustedProb * toDecimalOdds(recommendedOdds as number) - 1) * 100
            : null

        if (EXCHANGE_BOOKS.includes(bookKey)) {
          const hasBothSides =
            Number.isFinite(offer.over) && Number.isFinite(offer.under)
          if (!hasBothSides) continue
          if (consensusBookCount < 3) continue
        }

        rows.push({
          ...entry.base,
          bookKey,
          bookLabel: toDisplayBook(bookKey),
          bookPoint: offer.point,
          consensusPoint,
          consensusOverOdds,
          consensusUnderOdds,
          delta,
          discrepancy,
          recommendedSide,
          overOdds: offer.over,
          underOdds: offer.under,
          evPercent: evPercent == null ? null : Number(evPercent.toFixed(2)),
        })
      }
    }

    rows.sort((a, b) => {
      const aEv = a.evPercent ?? -Infinity
      const bEv = b.evPercent ?? -Infinity
      if (bEv !== aEv) return bEv - aEv
      if (b.discrepancy !== a.discrepancy) return b.discrepancy - a.discrepancy
      return a.game.localeCompare(b.game)
    })

    const rankedRows =
      normalizedSport === "all"
        ? interleaveRowsBySport(rows, ALL_SPORTS_TARGET, 1500)
        : rows.slice(0, 1500)

    const payload = {
      sport: normalizedSport,
      updatedAt: new Date().toISOString(),
      markets,
      books: BOOK_ALLOWLIST.map((key) => ({
        key,
        label: toDisplayBook(key),
        isConsensus: CONSENSUS_BOOKS.includes(key),
      })),
      rows: rankedRows,
      cached: false,
    }

    responseCache.set(cacheKey, { ts: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load crossed EV props." },
      { status: 500 }
    )
  }
}
