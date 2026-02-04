import { NextResponse } from "next/server"
import { fetchTheOddsApiPlayerProps } from "@/lib/api/the-odds-api"

export const dynamic = "force-dynamic"

const CACHE_TTL_MS = 10 * 60 * 1000
type CacheEntry = { ts: number; payload: any }
const responseCache = new Map<string, CacheEntry>()

const SUPPORTED_SPORTS = [
  "basketball_nba",
  "basketball_ncaab",
  "americanfootball_nfl",
  "icehockey_nhl",
  "baseball_mlb",
]

const SPORT_MARKETS: Record<string, string[]> = {
  basketball_nba: [
    "player_points",
    "player_rebounds",
    "player_assists",
    "player_threes",
    "player_points_rebounds_assists",
    "player_points_rebounds",
    "player_points_assists",
    "player_rebounds_assists",
    "player_blocks",
    "player_steals",
    "player_turnovers",
  ],
  basketball_ncaab: [
    "player_points",
    "player_rebounds",
    "player_assists",
    "player_threes",
    "player_points_rebounds_assists",
    "player_points_rebounds",
    "player_points_assists",
    "player_rebounds_assists",
  ],
  americanfootball_nfl: [
    "player_pass_yds",
    "player_pass_tds",
    "player_pass_completions",
    "player_pass_attempts",
    "player_interceptions",
    "player_rush_yds",
    "player_rush_tds",
    "player_receptions",
    "player_reception_yds",
    "player_receiving_tds",
    "player_longest_reception",
    "player_longest_rush",
  ],
  icehockey_nhl: [
    "player_points",
    "player_goals",
    "player_assists",
    "player_shots_on_goal",
    "player_blocked_shots",
    "player_saves",
  ],
  baseball_mlb: [
    "player_hits",
    "player_total_bases",
    "player_home_runs",
    "player_rbis",
    "player_runs_scored",
    "player_strikeouts",
    "player_walks",
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

const resolveBookKeyFromTitle = (value: string) => {
  const normalized = value.toLowerCase()
  if (normalized.includes("bet rivers") || normalized.includes("betrivers")) return "betrivers"
  if (normalized.includes("betmgm") || normalized.includes("mgm")) return "betmgm"
  if (normalized.includes("caesars") || normalized.includes("william hill")) return "caesars"
  if (normalized.includes("bet365")) return "bet365"
  if (normalized.includes("fanduel")) return "fanduel"
  if (normalized.includes("draftkings")) return "draftkings"
  if (normalized.includes("hard rock")) return "hardrockbet"
  if (normalized.includes("espn bet")) return "espnbet"
  if (normalized.includes("fanatics")) return "fanatics"
  if (normalized.includes("pinnacle")) return "pinnacle"
  if (normalized.includes("underdog")) return "underdog"
  if (normalized.includes("prizepicks")) return "prizepicks"
  if (normalized.includes("pick 6")) return "pick6"
  if (normalized.includes("betr")) return "betr"
  if (normalized.includes("novig")) return "novig"
  if (normalized.includes("prophetx") || normalized.includes("prophet x")) return "prophetx"
  return ""
}

const resolveBookKeyFromBook = (book: { key?: string; title?: string }) => {
  const keyCandidate = book.key ? resolveBookKey(book.key) : ""
  if (keyCandidate && BOOK_ALLOWLIST.includes(keyCandidate)) {
    return keyCandidate
  }
  const titleCandidate = book.title ? resolveBookKeyFromTitle(book.title) : ""
  if (titleCandidate && BOOK_ALLOWLIST.includes(titleCandidate)) {
    return titleCandidate
  }
  return ""
}

const isOverUnder = (value: string) => {
  const normalized = value.toLowerCase()
  return normalized === "over" || normalized === "under"
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get("sport") || "basketball_nba"
  const normalizedSport = SUPPORTED_SPORTS.includes(sport)
    ? sport
    : "basketball_nba"
  const markets = SPORT_MARKETS[normalizedSport] || SPORT_MARKETS.basketball_nba
  const cacheKey = `${normalizedSport}:${markets.join(",")}`

  const cached = responseCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.payload, cached: true })
  }

  try {
    const events = await fetchTheOddsApiPlayerProps(normalizedSport, {
      markets: markets.join(","),
      regions: "us,us2,eu",
      bookmakers: BOOK_ALLOWLIST,
      oddsFormat: "american",
      dateFormat: "iso",
    })

    const offersByProp = new Map<string, { base: PropBase; offers: Record<string, BookOffer> }>()

    for (const event of events || []) {
      const gameLabel = `${event.away_team} @ ${event.home_team}`
      for (const book of event.bookmakers || []) {
        const bookKey = resolveBookKeyFromBook(book)
        if (!bookKey) continue

        for (const market of book.markets || []) {
          const marketKey = market.key
          for (const outcome of market.outcomes || []) {
            const rawName = String(outcome.name || "").trim()
            const rawDesc = String((outcome as any).description || "").trim()
            const side = isOverUnder(rawName)
              ? rawName.toLowerCase()
              : isOverUnder(rawDesc)
                ? rawDesc.toLowerCase()
                : ""
            if (side !== "over" && side !== "under") continue

            const player = isOverUnder(rawName) ? rawDesc : rawName
            if (!player) continue

            const point = typeof outcome.point === "number" ? outcome.point : null
            if (point == null) continue

            const price = Number(outcome.price)
            if (!Number.isFinite(price)) continue

            const propKey = `${event.id}:${player}:${marketKey}`
            const existing = offersByProp.get(propKey) || {
              base: {
                id: propKey,
                player,
                market: marketKey,
                game: gameLabel,
                commenceTime: event.commence_time,
                homeTeam: event.home_team,
                awayTeam: event.away_team,
                teams: [event.home_team, event.away_team].filter(Boolean),
              },
              offers: {} as Record<string, BookOffer>,
            }

            const current = existing.offers[bookKey] || { point }
            // If a book returns multiple points for the same player/market, prefer the one that
            // has both sides filled.
            if (current.point !== point) {
              const currentFilled = Number.isFinite(current.over) && Number.isFinite(current.under)
              const nextFilled =
                (side === "over" ? Number.isFinite(price) : Number.isFinite(current.over)) &&
                (side === "under" ? Number.isFinite(price) : Number.isFinite(current.under))
              if (currentFilled && !nextFilled) {
                // keep existing
              } else {
                current.point = point
                delete current.over
                delete current.under
              }
            }

            if (side === "over") current.over = price
            if (side === "under") current.under = price
            existing.offers[bookKey] = current
            offersByProp.set(propKey, existing)
          }
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

    const payload = {
      sport: normalizedSport,
      updatedAt: new Date().toISOString(),
      markets,
      books: BOOK_ALLOWLIST.map((key) => ({
        key,
        label: toDisplayBook(key),
        isConsensus: CONSENSUS_BOOKS.includes(key),
      })),
      rows: rows.slice(0, 1500),
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
