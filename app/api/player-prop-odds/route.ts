import { NextResponse } from "next/server"
import { fetchTheOddsApiPlayerProps } from "@/lib/api/the-odds-api"

export const dynamic = "force-dynamic"

const CACHE_TTL_MS = 15 * 60 * 1000
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
]

const BOOK_ALIASES: Record<string, string> = {
  betmgm: "betmgm",
  mgm: "betmgm",
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
  if (normalized.includes("prophetx")) return "prophetx"
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
    default:
      return key
  }
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
      regions: "us,us2",
      oddsFormat: "american",
      dateFormat: "iso",
    })

    const rows = new Map<string, any>()
    const booksSeen = new Set<string>()

    for (const event of events || []) {
      const gameLabel = `${event.away_team} @ ${event.home_team}`
      for (const book of event.bookmakers || []) {
        const bookKey = resolveBookKeyFromBook(book)
        if (!bookKey) continue
        const bookTitle = toDisplayBook(bookKey)

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
            if (!side) continue
            const player = isOverUnder(rawName) ? rawDesc : rawName
            if (!player) continue
            const point = typeof outcome.point === "number" ? outcome.point : null
            const price = Number(outcome.price)
            if (!Number.isFinite(price)) continue

            const key = `${event.id}:${player}:${marketKey}:${point ?? "na"}`
            const existing =
              rows.get(key) || {
                id: key,
                player,
                market: marketKey,
                point,
                game: gameLabel,
                commenceTime: event.commence_time,
                homeTeam: event.home_team,
                awayTeam: event.away_team,
                teams: [event.home_team, event.away_team].filter(Boolean),
                odds: {},
              }

            if (!existing.odds[bookKey]) {
              existing.odds[bookKey] = {}
            }
            existing.odds[bookKey][side] = price
            booksSeen.add(bookKey)
            rows.set(key, existing)
          }
        }
      }
    }

    const computeSideGap = (row: any, side: "over" | "under") => {
      let min: number | null = null
      let max: number | null = null
      for (const odds of Object.values(row.odds || {})) {
        const price = (odds as any)?.[side]
        if (!Number.isFinite(price)) continue
        const value = price as number
        min = min == null ? value : Math.min(min, value)
        max = max == null ? value : Math.max(max, value)
      }
      if (min == null || max == null) return 0
      return max - min
    }

    const props = Array.from(rows.values()).map((row) => {
      const discrepancy = Math.max(
        computeSideGap(row, "over"),
        computeSideGap(row, "under")
      )
      return { ...row, discrepancy }
    })

    const payload = {
      sport: normalizedSport,
      updatedAt: new Date().toISOString(),
      markets,
      books: BOOK_ALLOWLIST.filter((key) => booksSeen.has(key)).map((key) => ({
        key,
        label: toDisplayBook(key),
      })),
      props,
      cached: false,
    }

    responseCache.set(cacheKey, { ts: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load player prop odds." },
      { status: 500 }
    )
  }
}
