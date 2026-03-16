import { TEAMS_REGISTRY } from "@/lib/data/teams-registry"
import { normalizeTeamKey } from "@/lib/identity/sport"
import { KALSHI_BASE_CANDIDATES, withKalshiBase } from "@/lib/api/kalshi-base"
import { probabilityToAmericanOdds } from "@/lib/utils/statistics"
import type {
  TeamMarketKey,
  TeamMarketOrderbookItem,
  TeamMarketOrderbookLevel,
  TeamMarketOrderbookSide,
  TeamMarketOrderbooksSnapshot,
} from "@/lib/types/market-orderbooks"

const KALSHI_BASE =
  KALSHI_BASE_CANDIDATES[0] ?? "https://api.elections.kalshi.com/trade-api/v2"
const CACHE_TTL_MS = 60 * 1000
const MAX_KALSHI_PAGES = 5
const KALSHI_RETRY_ATTEMPTS = 2
const KALSHI_RETRY_BASE_DELAY_MS = 250
const US_MARKET_TIME_ZONE = "America/New_York"
const US_MARKET_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: US_MARKET_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

type SnapshotMode = "fast" | "full"

type KalshiMarket = {
  ticker: string
  title?: string
  yes_sub_title?: string
  no_sub_title?: string
}

type TeamSeries = {
  ticker: string
  marketKey: TeamMarketKey
  sportKey: string
  sportLabel: string
}

const TEAM_SERIES: TeamSeries[] = [
  { ticker: "KXNBASPREAD", marketKey: "spreads", sportKey: "basketball_nba", sportLabel: "NBA" },
  { ticker: "KXNBATOTAL", marketKey: "totals", sportKey: "basketball_nba", sportLabel: "NBA" },
  { ticker: "KXNBAGAME", marketKey: "h2h", sportKey: "basketball_nba", sportLabel: "NBA" },
  { ticker: "KXNFLSPREAD", marketKey: "spreads", sportKey: "americanfootball_nfl", sportLabel: "NFL" },
  { ticker: "KXNFLTOTAL", marketKey: "totals", sportKey: "americanfootball_nfl", sportLabel: "NFL" },
  { ticker: "KXNFLGAME", marketKey: "h2h", sportKey: "americanfootball_nfl", sportLabel: "NFL" },
  { ticker: "KXNCAAMBSPREAD", marketKey: "spreads", sportKey: "basketball_ncaab", sportLabel: "NCAAB" },
  { ticker: "KXNCAAMBTOTAL", marketKey: "totals", sportKey: "basketball_ncaab", sportLabel: "NCAAB" },
  { ticker: "KXNCAAMBGAME", marketKey: "h2h", sportKey: "basketball_ncaab", sportLabel: "NCAAB" },
  { ticker: "KXNHLSPREAD", marketKey: "spreads", sportKey: "icehockey_nhl", sportLabel: "NHL" },
  { ticker: "KXNHLTOTAL", marketKey: "totals", sportKey: "icehockey_nhl", sportLabel: "NHL" },
  { ticker: "KXNHLGAME", marketKey: "h2h", sportKey: "icehockey_nhl", sportLabel: "NHL" },
]

const SUPPORTED_TEAM_SPORTS = new Set([
  "basketball_nba",
  "basketball_ncaab",
  "americanfootball_nfl",
  "icehockey_nhl",
])

const TEAM_LOOKUP = new Map<string, string>()
for (const team of TEAMS_REGISTRY) {
  if (!SUPPORTED_TEAM_SPORTS.has(team.sport)) continue
  TEAM_LOOKUP.set(`${team.sport}:${team.abbreviation.toUpperCase()}`, team.name)
}

type CacheEntry = {
  fetchedAt: number
  updatedAt: string
  items: TeamMarketOrderbookItem[]
}

const snapshotCache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<TeamMarketOrderbooksSnapshot>>()

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const getUsMarketDayKey = (date = new Date()) => {
  try {
    const value = US_MARKET_DAY_FORMATTER.format(date)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  } catch {}
  return date.toISOString().slice(0, 10)
}

const normalizePriceCents = (value: number) => (value <= 1 ? value * 100 : value)

const priceCentsToAmericanOdds = (priceCents: number | null) => {
  if (priceCents == null) return null
  const probability = priceCents / 100
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return null
  return probabilityToAmericanOdds(probability)
}

const parseLineFromTitle = (title?: string | null) => {
  if (!title) return null
  const match = title.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

const parseKalshiDate = (ticker: string) => {
  const match = ticker.match(/-(\d{2})([A-Z]{3})(\d{2})/)
  if (!match) return null
  const months: Record<string, string> = {
    JAN: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    MAY: "05",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12",
  }
  const [, yy, mon, dd] = match
  const month = months[mon]
  if (!month) return null
  return `20${yy}-${month}-${dd}`
}

const parseTeamsFromTicker = (ticker: string) => {
  const match = ticker.match(/-\d{2}[A-Z]{3}\d{2}([A-Z]{2,4})([A-Z]{2,4})-/)
  if (!match) return null
  return { awayCode: match[1], homeCode: match[2] }
}

const parseCombinedTeamCodesFromTicker = (ticker: string) => {
  const match = ticker.match(/-\d{2}[A-Z]{3}\d{2}([A-Z]{4,8})-/)
  return match?.[1] ?? null
}

const splitCombinedTeamCodes = (sportKey: string, combined: string) => {
  const normalized = combined.toUpperCase()
  const preferredSplits = [3, 2, 4]
  const dynamicSplits: number[] = []
  for (let i = 2; i <= normalized.length - 2; i += 1) {
    if (!preferredSplits.includes(i)) dynamicSplits.push(i)
  }

  for (const splitIndex of [...preferredSplits, ...dynamicSplits]) {
    if (splitIndex <= 1 || splitIndex >= normalized.length - 1) continue
    const awayCode = normalized.slice(0, splitIndex)
    const homeCode = normalized.slice(splitIndex)
    if (awayCode.length < 2 || awayCode.length > 4) continue
    if (homeCode.length < 2 || homeCode.length > 4) continue
    if (
      TEAM_LOOKUP.has(`${sportKey}:${awayCode}`) &&
      TEAM_LOOKUP.has(`${sportKey}:${homeCode}`)
    ) {
      return { awayCode, homeCode }
    }
  }

  return null
}

const parseTeamCodeFromTicker = (ticker: string) => {
  const lastSegment = ticker.split("-").pop() ?? ""
  const match = lastSegment.match(/^([A-Z]{2,4})/)
  return match?.[1] ?? null
}

const resolveTeamNameFromCode = (sportKey: string, code: string | null) => {
  if (!code) return null
  return TEAM_LOOKUP.get(`${sportKey}:${code}`) ?? null
}

const resolveKalshiTeams = (sportKey: string, ticker: string) => {
  const direct = parseTeamsFromTicker(ticker)
  if (direct?.awayCode && direct.homeCode) {
    return {
      awayCode: direct.awayCode,
      homeCode: direct.homeCode,
      awayTeam: resolveTeamNameFromCode(sportKey, direct.awayCode),
      homeTeam: resolveTeamNameFromCode(sportKey, direct.homeCode),
    }
  }

  const combined = parseCombinedTeamCodesFromTicker(ticker)
  if (!combined) return null
  const split = splitCombinedTeamCodes(sportKey, combined)
  if (!split) return null
  return {
    awayCode: split.awayCode,
    homeCode: split.homeCode,
    awayTeam: resolveTeamNameFromCode(sportKey, split.awayCode),
    homeTeam: resolveTeamNameFromCode(sportKey, split.homeCode),
  }
}

const parseKalshiLevels = (levels: number[][]): TeamMarketOrderbookLevel[] => {
  const parsed: TeamMarketOrderbookLevel[] = []
  for (const level of levels) {
    const priceRaw = Number(level?.[0])
    const size = Number(level?.[1])
    if (!Number.isFinite(priceRaw) || !Number.isFinite(size)) continue
    const priceCents = normalizePriceCents(priceRaw)
    const notional = (priceCents / 100) * size
    if (!Number.isFinite(notional) || notional <= 0) continue
    parsed.push({ priceCents, notional })
  }
  return parsed
}

const summarizeSide = (
  key: "yes" | "no",
  outcomeLabel: string,
  levels: TeamMarketOrderbookLevel[],
  depth: number
): TeamMarketOrderbookSide => {
  const byNotional = [...levels].sort((a, b) => b.notional - a.notional)
  const trimmed = byNotional.slice(0, depth)
  const totalNotional = levels.reduce((sum, level) => sum + level.notional, 0)
  const wall = trimmed[0] ?? null
  const wallPriceCents = wall?.priceCents ?? null
  const wallNotional = wall?.notional ?? null
  const wallAmericanOdds = priceCentsToAmericanOdds(wallPriceCents)
  const sharpLinePriceCents =
    wallPriceCents != null ? Math.max(0, Math.min(100, 100 - wallPriceCents)) : null
  const sharpLineAmericanOdds = priceCentsToAmericanOdds(sharpLinePriceCents)

  return {
    key,
    outcomeLabel,
    levels: trimmed,
    totalNotional,
    wallPriceCents,
    wallNotional,
    wallAmericanOdds,
    sharpLinePriceCents,
    sharpLineAmericanOdds,
  }
}

const resolveOutcomeLabels = (opts: {
  marketKey: TeamMarketKey
  line: number | null
  lineTeamName: string | null
  opponentName: string | null
  homeTeam: string | null
  awayTeam: string | null
  fallbackYes?: string
  fallbackNo?: string
}) => {
  const {
    marketKey,
    line,
    lineTeamName,
    opponentName,
    homeTeam,
    awayTeam,
    fallbackYes,
    fallbackNo,
  } = opts

  if (marketKey === "totals") {
    if (line != null) return { yes: `Over ${line}`, no: `Under ${line}` }
    return { yes: "Over", no: "Under" }
  }

  if (marketKey === "spreads") {
    if (lineTeamName && opponentName && line != null) {
      const abs = Math.abs(line)
      return { yes: `${lineTeamName} -${abs}`, no: `${opponentName} +${abs}` }
    }
    return {
      yes: fallbackYes ?? "Spread side",
      no: fallbackNo ?? "Opposite spread side",
    }
  }

  if (lineTeamName && opponentName) {
    return { yes: lineTeamName, no: opponentName }
  }

  return {
    yes: homeTeam ?? awayTeam ?? fallbackYes ?? "Home",
    no: awayTeam ?? homeTeam ?? fallbackNo ?? "Away",
  }
}

const fetchKalshiJson = async <T,>(url: string): Promise<T | null> => {
  const candidateUrls = KALSHI_BASE_CANDIDATES.map((base) => withKalshiBase(base, url))
  for (const candidateUrl of candidateUrls) {
    for (let attempt = 0; attempt <= KALSHI_RETRY_ATTEMPTS; attempt += 1) {
      let res: Response
      try {
        res = await fetch(candidateUrl, { cache: "no-store" })
      } catch {
        if (attempt < KALSHI_RETRY_ATTEMPTS) {
          await sleep(KALSHI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt))
          continue
        }
        break
      }
      if (res.ok) {
        try {
          return (await res.json()) as T
        } catch {
          return null
        }
      }
      if (res.status !== 429 && res.status < 500) break
      if (attempt < KALSHI_RETRY_ATTEMPTS) {
        await sleep(KALSHI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt))
      }
    }
  }
  return null
}

const fetchKalshiTeamMarkets = async (seriesTicker: string, maxPages: number) => {
  const markets: KalshiMarket[] = []
  let cursor: string | null = null
  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`${KALSHI_BASE}/markets`)
    url.searchParams.set("series_ticker", seriesTicker)
    url.searchParams.set("limit", "500")
    if (cursor) url.searchParams.set("cursor", cursor)
    const data = await fetchKalshiJson<{ markets?: KalshiMarket[]; cursor?: string | null }>(
      url.toString()
    )
    if (!data) break
    const batch = Array.isArray(data.markets) ? data.markets : []
    if (batch.length === 0) break
    markets.push(...batch)
    cursor = data.cursor ?? null
    if (!cursor) break
  }
  return markets
}

const fetchKalshiTeamOrderbook = async (ticker: string, depth: number) => {
  const url = new URL(`${KALSHI_BASE}/markets/${ticker}/orderbook`)
  url.searchParams.set("depth", String(Math.max(depth, 8)))
  const data = await fetchKalshiJson<{ orderbook?: { yes?: number[][]; no?: number[][] } }>(
    url.toString()
  )
  if (!data) return null
  const yesRaw = Array.isArray(data.orderbook?.yes) ? data.orderbook?.yes ?? [] : []
  const noRaw = Array.isArray(data.orderbook?.no) ? data.orderbook?.no ?? [] : []
  return {
    yes: parseKalshiLevels(yesRaw),
    no: parseKalshiLevels(noRaw),
  }
}

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R | null>
) => {
  if (!items.length) return [] as R[]
  const size = Math.max(1, Math.floor(concurrency))
  const results: R[] = []
  let index = 0

  const runWorker = async () => {
    while (true) {
      const current = index
      index += 1
      if (current >= items.length) break
      const value = await worker(items[current], current)
      if (value != null) results.push(value)
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => runWorker()))
  return results
}

const buildMatchupKey = (sportKey: string, awayTeam: string | null, homeTeam: string | null) => {
  const away = awayTeam ? normalizeTeamKey(awayTeam) : ""
  const home = homeTeam ? normalizeTeamKey(homeTeam) : ""
  if (!away || !home) return null
  return `${sportKey}:${away}@${home}`
}

const interleaveBySport = (items: TeamMarketOrderbookItem[], max: number) => {
  const grouped = new Map<string, TeamMarketOrderbookItem[]>()
  for (const item of items) {
    const group = grouped.get(item.sportKey) ?? []
    group.push(item)
    grouped.set(item.sportKey, group)
  }

  const preferredSports = ["basketball_nba", "basketball_ncaab", "icehockey_nhl", "americanfootball_nfl"]
  const orderedSports = [
    ...preferredSports,
    ...Array.from(grouped.keys()).filter((sportKey) => !preferredSports.includes(sportKey)),
  ]
  const indexes = new Map<string, number>()
  const result: TeamMarketOrderbookItem[] = []

  while (result.length < max) {
    let appended = false
    for (const sportKey of orderedSports) {
      const group = grouped.get(sportKey)
      if (!group || group.length === 0) continue
      const index = indexes.get(sportKey) ?? 0
      if (index >= group.length) continue
      result.push(group[index])
      indexes.set(sportKey, index + 1)
      appended = true
      if (result.length >= max) break
    }
    if (!appended) break
  }
  return result
}

export const fetchTeamMarketOrderbooksSnapshot = async (opts?: {
  sportKey?: string | "all"
  marketKey?: TeamMarketKey | "all"
  limit?: number
  depth?: number
  minSharpNotional?: number
  mode?: SnapshotMode
}): Promise<TeamMarketOrderbooksSnapshot> => {
  const sportFilter = opts?.sportKey ?? "all"
  const marketFilter = opts?.marketKey ?? "all"
  const requestedLimit = opts?.limit ?? 80
  const depth = opts?.depth ?? 8
  const minSharpNotional = opts?.minSharpNotional ?? 2000
  const mode = opts?.mode ?? "fast"
  const now = Date.now()
  const isFastMode = mode === "fast"
  const collectionLimit =
    sportFilter === "all"
      ? isFastMode
        ? Math.min(Math.max(requestedLimit + 20, requestedLimit), 140)
        : Math.min(Math.max(requestedLimit * 3, requestedLimit), 320)
      : requestedLimit
  const cacheKey = `${sportFilter}:${marketFilter}:${requestedLimit}:${depth}:${minSharpNotional}:${mode}`
  const cached = snapshotCache.get(cacheKey)

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return {
      updatedAt: cached.updatedAt,
      items: cached.items.slice(0, requestedLimit),
    }
  }

  const pending = inFlight.get(cacheKey)
  if (pending) return pending

  const computePromise = (async (): Promise<TeamMarketOrderbooksSnapshot> => {
    const today = getUsMarketDayKey()
    const updatedAt = new Date().toISOString()
    const pageLimit = isFastMode ? 1 : MAX_KALSHI_PAGES
    const concurrency = isFastMode ? 10 : 5
    const selectedSeries = TEAM_SERIES.filter((series) => {
      if (sportFilter !== "all" && series.sportKey !== sportFilter) return false
      if (marketFilter !== "all" && series.marketKey !== marketFilter) return false
      return true
    })

    const builtItems: TeamMarketOrderbookItem[] = []
    for (const series of selectedSeries) {
      if (builtItems.length >= collectionLimit) break
      const markets = await fetchKalshiTeamMarkets(series.ticker, pageLimit)
      const upcoming = markets.filter((market) => {
        const eventDate = parseKalshiDate(market.ticker)
        return Boolean(eventDate && eventDate >= today)
      })
      const candidates = upcoming.slice(0, isFastMode ? 32 : 120)

      const results = await mapWithConcurrency(candidates, concurrency, async (market) => {
        const orderbook = await fetchKalshiTeamOrderbook(market.ticker, depth)
        if (!orderbook) return null
        if (orderbook.yes.length === 0 && orderbook.no.length === 0) return null

        const teamMeta = resolveKalshiTeams(series.sportKey, market.ticker)
        const awayTeam = teamMeta?.awayTeam ?? null
        const homeTeam = teamMeta?.homeTeam ?? null
        const matchup = awayTeam && homeTeam ? `${awayTeam} @ ${homeTeam}` : market.title ?? market.ticker
        const line = parseLineFromTitle(market.title ?? "")
        const lineTeamCode = parseTeamCodeFromTicker(market.ticker)
        const lineTeamName = resolveTeamNameFromCode(series.sportKey, lineTeamCode)
        const opponentName =
          lineTeamName && awayTeam && homeTeam
            ? lineTeamName === awayTeam
              ? homeTeam
              : lineTeamName === homeTeam
                ? awayTeam
                : null
            : null

        const outcomes = resolveOutcomeLabels({
          marketKey: series.marketKey,
          line,
          lineTeamName,
          opponentName,
          homeTeam,
          awayTeam,
          fallbackYes: market.yes_sub_title,
          fallbackNo: market.no_sub_title,
        })

        const yesSide = summarizeSide("yes", outcomes.yes, orderbook.yes, depth)
        const noSide = summarizeSide("no", outcomes.no, orderbook.no, depth)
        const sides = [yesSide, noSide]

        const eligible = sides
          .filter((side) => (side.wallNotional ?? 0) > 0)
          .filter((side) => (side.wallNotional ?? 0) >= minSharpNotional)
          .sort((a, b) => (b.wallNotional ?? 0) - (a.wallNotional ?? 0))
        const top = eligible[0] ?? null
        const sharpLiquiditySide = top?.key ?? null
        const sharpLiquidityOutcomeLabel = top?.outcomeLabel ?? null
        const sharpLiquidityNotional = top?.wallNotional ?? null
        const sharpOrderAmericanOdds = top?.wallAmericanOdds ?? null
        const sharpLeanSide = top ? (top.key === "yes" ? "no" : "yes") : null
        const sharpLeanSideData = sharpLeanSide
          ? sides.find((side) => side.key === sharpLeanSide) ?? null
          : null
        const sharpLeanOutcomeLabel = sharpLeanSideData?.outcomeLabel ?? null
        const sharpLeanAmericanOdds = top?.sharpLineAmericanOdds ?? null

        return {
          id: `kalshi:${market.ticker}`,
          source: "kalshi" as const,
          sportKey: series.sportKey,
          sportLabel: series.sportLabel,
          marketKey: series.marketKey,
          marketTitle: market.title ?? market.ticker,
          matchup,
          homeTeam,
          awayTeam,
          line,
          eventDate: parseKalshiDate(market.ticker) ?? undefined,
          ticker: market.ticker,
          sides,
          sharpLiquiditySide,
          sharpLiquidityOutcomeLabel,
          sharpLiquidityNotional,
          sharpOrderAmericanOdds,
          sharpLeanSide,
          sharpLeanOutcomeLabel,
          sharpLeanAmericanOdds,
          updatedAt,
        } satisfies TeamMarketOrderbookItem
      })

      builtItems.push(...results)
    }

    const deduped = new Map<string, TeamMarketOrderbookItem>()
    for (const item of builtItems) {
      const matchupKey = buildMatchupKey(item.sportKey, item.awayTeam, item.homeTeam)
      const fallbackKey = `${item.sportKey}:${item.marketKey}:${item.matchup.toLowerCase()}`
      const key = `${item.marketKey}:${matchupKey ?? fallbackKey}`
      const existing = deduped.get(key)
      if (!existing) {
        deduped.set(key, item)
        continue
      }
      const existingSize = existing.sharpLiquidityNotional ?? 0
      const nextSize = item.sharpLiquidityNotional ?? 0
      if (nextSize > existingSize) deduped.set(key, item)
    }

    const sorted = Array.from(deduped.values()).sort((a, b) => {
      const aSize = a.sharpLiquidityNotional ?? 0
      const bSize = b.sharpLiquidityNotional ?? 0
      if (bSize !== aSize) return bSize - aSize
      return a.marketTitle.localeCompare(b.marketTitle)
    })

    const finalItems =
      sportFilter === "all" ? interleaveBySport(sorted, requestedLimit) : sorted.slice(0, requestedLimit)

    snapshotCache.set(cacheKey, {
      fetchedAt: Date.now(),
      updatedAt,
      items: finalItems,
    })

    return {
      updatedAt,
      items: finalItems,
    }
  })()

  inFlight.set(cacheKey, computePromise)
  try {
    return await computePromise
  } finally {
    inFlight.delete(cacheKey)
  }
}
