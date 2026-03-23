"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import BoxLoader from "@/components/ui/box-loader"
import ShareSharpPropsToolButton from "@/components/ShareSharpPropsToolButton"
import { shouldPersistPropOrderbooksSnapshot } from "@/lib/services/prop-orderbooks-cache-guard"
import { SHARP_PROPS_SOURCE_ORDER } from "@/lib/config/odds-sources"
import {
  isWithinSharpRefreshWindow,
  SHARP_REFRESH_INTERVAL_MS,
  SHARP_REFRESH_WINDOW_LABEL,
} from "@/lib/utils/sharp-refresh-window"

type OrderbookLevel = {
  priceCents: number
  notional: number
}

type OrderbookSide = {
  outcome: string
  propSide: "Over" | "Under" | null
  platformSide: "yes" | "no" | null
  levels: OrderbookLevel[]
  totalNotional: number
  wallPriceCents: number | null
  wallNotional: number | null
  wallAmericanOdds: number | null
  sharpLinePriceCents: number | null
  sharpLineAmericanOdds: number | null
}

type SourceKey = "kalshi" | "polymarket" | "novig" | "prophetx"
type SharpBookKey = (typeof SHARP_PROPS_SOURCE_ORDER)[number]
type SharpBookFilter = "all" | SharpBookKey

export type OrderbookItem = {
  id: string
  source: SourceKey
  sportKey: string
  sportLabel: string
  matchup?: string
  marketTitle: string
  playerName: string | null
  propType: string | null
  propLine: number | null
  eventDate?: string
  ticker?: string
  slug?: string
  sharpLiquiditySide: "Over" | "Under" | null
  sharpLiquidityNotional: number | null
  sharpOrderAmericanOdds: number | null
  sharpLeanSide: "Over" | "Under" | null
  sharpLeanAmericanOdds: number | null
  sharpLeanBestOdds: number | null
  sharpLeanBestBookTitle: string | null
  pinnacleLeanOdds: number | null
  pinnacleLeanBookTitle: string | null
  fanduelLeanOdds: number | null
  fanduelLeanBookTitle: string | null
  sportsbookOddsByBook?: Record<
    string,
    { over?: number | null; under?: number | null; title?: string | null }
  >
  updatedAt: string
  sides: OrderbookSide[]
}

type DisplayOrderbookItem = OrderbookItem & {
  sources: SourceKey[]
  sourceItems: OrderbookItem[]
}

type OrderbooksInitialData = {
  items: OrderbookItem[]
  updatedAt: string
  cache: {
    source: "persistent" | "persistent_all_fallback"
    fetchedAt: string | null
  }
} | null

type OrderbooksApiResponse = {
  ok?: boolean
  updatedAt?: string
  items?: OrderbookItem[]
  cache?: {
    source?: string
    fetchedAt?: string | null
    cacheWriteSkippedDegraded?: boolean
    fallbackToPersistent?: boolean
  }
  error?: string
}

type PlayerHeadshotResponse = {
  ok?: boolean
  headshots?: Record<string, string | null>
}

type PlayerPropOddsRow = {
  player?: string | null
  market?: string | null
  point?: number | null
  odds?: Record<string, { over?: number; under?: number }>
}

type PlayerPropOddsResponse = {
  props?: PlayerPropOddsRow[]
}

type LadderRow = {
  id: string
  side: "Over" | "Under" | null
  odds: number | null
  notional: number
  sources: SourceKey[]
}

type OddsPreset = "all" | "default" | "underdog200" | "plusMoney" | "evenish" | "favorites" | "custom"

const BACKGROUND_ITEM_RETENTION_MS = 15 * 60 * 1000
const SPORT_FILTER_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All Leagues" },
  { key: "basketball_nba", label: "NBA" },
  { key: "basketball_ncaab", label: "NCAAB" },
  { key: "americanfootball_nfl", label: "NFL" },
  { key: "americanfootball_ncaaf", label: "NCAAF" },
  { key: "icehockey_nhl", label: "NHL" },
  { key: "baseball_mlb", label: "MLB" },
]

const SOURCE_ORDER: SourceKey[] = ["kalshi", "polymarket", "novig", "prophetx"]
const SOURCE_LOGOS: Record<SourceKey, { label: string; src: string }> = {
  kalshi: { label: "Kalshi", src: "/kalshi.png" },
  polymarket: { label: "Polymarket", src: "/polymarket.png" },
  novig: { label: "NoVig", src: "/Novig.png" },
  prophetx: { label: "ProphetX", src: "/ProphetX.png" },
}

const SHARP_BOOK_ORDER: SharpBookKey[] = [...SHARP_PROPS_SOURCE_ORDER]

const SHARP_BOOK_LOGOS: Record<SharpBookKey, { label: string; src?: string }> = {
  polymarket: { label: "Polymarket", src: "/polymarket.png" },
  kalshi: { label: "Kalshi", src: "/kalshi.png" },
  novig: { label: "NoVig", src: "/Novig.png" },
  pinnacle: { label: "Pinnacle", src: "/pinnacle.jpg" },
  circa: { label: "Circa", src: "/circasports.png" },
  prophetx: { label: "ProphetX", src: "/ProphetX.png" },
  prizepicks: { label: "PrizePicks", src: "/prizepicks.png" },
  underdog: { label: "Underdog", src: "/underdogfantasy.png" },
  draftkings_pick6: { label: "Pick6", src: "/pick6.png" },
  sleeper: { label: "Sleeper", src: "/sleeper.png" },
}

const ODDS_API_BOOK_KEYS = [
  "polymarket",
  "kalshi",
  "novig",
  "pinnacle",
  "circa",
  "prophetx",
  "prizepicks",
  "underdog",
  "draftkings_pick6",
  "sleeper",
] as const

const ODDS_API_BOOK_ALIASES: Record<(typeof ODDS_API_BOOK_KEYS)[number], string[]> = {
  polymarket: ["polymarket"],
  kalshi: ["kalshi"],
  novig: ["novig", "novigus"],
  pinnacle: ["pinnacle"],
  circa: ["circa", "circasports"],
  prophetx: ["prophetx", "prophet_x", "prophet"],
  prizepicks: ["prizepicks", "prize_picks"],
  underdog: ["underdog", "underdog_fantasy"],
  draftkings_pick6: ["draftkings_pick6", "draftkings-pick6", "dk_pick6", "pick6", "pick_6"],
  sleeper: ["sleeper"],
}

const normalizeBookToken = (value?: string | null) =>
  String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "")

const resolveSharpBookKey = (value?: string | null): SharpBookKey | null => {
  const normalized = normalizeBookToken(value)
  if (!normalized) return null
  const direct = SHARP_BOOK_ORDER.find((key) => normalizeBookToken(key) === normalized)
  if (direct) return direct
  for (const key of ODDS_API_BOOK_KEYS) {
    const aliases = ODDS_API_BOOK_ALIASES[key] ?? []
    if (aliases.some((alias) => normalizeBookToken(alias) === normalized)) {
      return key
    }
  }
  return null
}

const ODDS_API_MARKETS_BY_PROP_TYPE: Record<string, string[]> = {
  points: ["player_points"],
  rebounds: ["player_rebounds"],
  assists: ["player_assists"],
  threes: ["player_threes"],
  points_rebounds_assists: ["player_points_rebounds_assists"],
  points_rebounds: ["player_points_rebounds"],
  points_assists: ["player_points_assists"],
  rebounds_assists: ["player_rebounds_assists"],
  blocks: ["player_blocks"],
  steals: ["player_steals"],
  turnovers: ["player_turnovers"],
  goals: ["player_goals"],
  shots: ["player_shots_on_goal"],
  blocked_shots: ["player_blocked_shots"],
  saves: ["player_saves", "player_total_saves"],
  hits: ["player_hits"],
  total_bases: ["player_total_bases"],
  home_runs: ["player_home_runs"],
  rbis: ["player_rbis"],
  runs: ["player_runs_scored"],
  strikeouts: ["player_strikeouts"],
  walks: ["player_walks"],
}

const COMPACT_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})

const formatCompactCurrency = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "--"
  return COMPACT_USD.format(value)
}

const formatAmericanOdds = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "--"
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`
}

const formatSourceLabel = (source: OrderbookItem["source"]) => {
  if (source === "kalshi") return "Kalshi"
  if (source === "polymarket") return "Polymarket"
  if (source === "novig") return "NoVig"
  return "ProphetX"
}

const sortSources = (sources: SourceKey[]) =>
  [...sources].sort(
    (a, b) => SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b)
  )

const formatLineKey = (value: number | null) =>
  value == null || !Number.isFinite(value) ? "none" : Number(value).toFixed(2)

const buildOrderbookGroupKey = (item: OrderbookItem) => {
  const playerKey = normalizePlayerToken(item.playerName)
  const propTypeKey = String(item.propType ?? "unknown").toLowerCase().trim()
  const dateKey = String(item.eventDate ?? "").slice(0, 10)
  const fallbackMarketKey =
    item.propLine == null
      ? String(item.marketTitle ?? "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
      : ""
  return [
    item.sportKey,
    dateKey,
    playerKey,
    propTypeKey,
    formatLineKey(item.propLine),
    fallbackMarketKey,
  ].join(":")
}

const formatDateLabel = (value?: string | null) => {
  if (!value) return "TBD"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatCacheLabel = (source?: string | null) => {
  if (!source) return "live"
  if (source === "persistent") return "cached"
  if (source === "persistent_all_fallback") return "cached(all)"
  if (source.includes("fast_refresh")) return "live fast"
  if (source.includes("fast")) return "live"
  if (source.includes("full")) return "live full"
  return source.replace(/_/g, " ")
}

const parseTimestampMs = (value?: string | null) => {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const mergeBackgroundItems = (
  previousItems: OrderbookItem[],
  incomingItems: OrderbookItem[],
  limit: number
) => {
  if (!previousItems.length) return incomingItems.slice(0, limit)
  if (!incomingItems.length) return previousItems.slice(0, limit)

  const now = Date.now()
  const cutoff = now - BACKGROUND_ITEM_RETENTION_MS
  const incomingIds = new Set(incomingItems.map((item) => item.id))
  const retained = previousItems.filter((item) => {
    if (incomingIds.has(item.id)) return false
    return parseTimestampMs(item.updatedAt) >= cutoff
  })

  return [...incomingItems, ...retained].slice(0, limit)
}

const resolveLargestWall = (item: OrderbookItem) =>
  [...item.sides]
    .filter((side) => (side.wallNotional ?? 0) > 0)
    .sort((a, b) => (b.wallNotional ?? 0) - (a.wallNotional ?? 0))[0] ?? null

const resolveDisplayOrderSize = (item: OrderbookItem) => {
  if ((item.sharpLiquidityNotional ?? 0) > 0) return item.sharpLiquidityNotional
  return resolveLargestWall(item)?.wallNotional ?? null
}

const resolveOppositeSide = (side: "Over" | "Under" | null) => {
  if (side === "Over") return "Under"
  if (side === "Under") return "Over"
  return null
}

const resolveSideLevelOdds = (side: OrderbookSide | null, mode: "direct" | "sharp" = "direct") => {
  if (!side) return null
  for (const level of side.levels) {
    const priceCents =
      mode === "direct"
        ? level.priceCents
        : Math.max(0, Math.min(100, 100 - level.priceCents))
    const odds = priceCentsToAmericanOdds(priceCents)
    if (odds != null) return odds
  }
  return null
}

const resolveRecommendedSideOddsForItem = (
  item: OrderbookItem,
  side: "Over" | "Under" | null | undefined
) => {
  if (!side) return null
  const directSide = item.sides.find((entry) => entry.propSide === side) ?? null
  const oppositeSide = item.sides.find((entry) => entry.propSide === resolveOppositeSide(side)) ?? null

  return (
    directSide?.wallAmericanOdds ??
    resolveSideLevelOdds(directSide, "direct") ??
    oppositeSide?.sharpLineAmericanOdds ??
    resolveSideLevelOdds(oppositeSide, "sharp")
  )
}

const pickBestAvailableOdds = (values: Array<number | null | undefined>) => {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  if (!valid.length) return null
  return valid.reduce((best, current) => (current > best ? current : best), valid[0])
}

const resolveSharpBookOddsForItem = (
  item: DisplayOrderbookItem,
  recommendedSide: "Over" | "Under" | null
): Record<SharpBookKey, number | null> => {
  const oddsByBook = Object.fromEntries(
    SHARP_BOOK_ORDER.map((key) => [key, null])
  ) as Record<SharpBookKey, number | null>

  const sourceOdds: Record<SourceKey, number | null> = {
    kalshi: null,
    polymarket: null,
    novig: null,
    prophetx: null,
  }

  for (const source of SOURCE_ORDER) {
    const candidates = item.sourceItems
      .filter((entry) => entry.source === source)
      .map((entry) => resolveRecommendedSideOddsForItem(entry, recommendedSide))
    sourceOdds[source] = pickBestAvailableOdds(candidates)
  }

  oddsByBook.prophetx = sourceOdds.prophetx
  oddsByBook.novig = sourceOdds.novig
  oddsByBook.polymarket = sourceOdds.polymarket
  oddsByBook.kalshi = sourceOdds.kalshi
  oddsByBook.pinnacle = item.pinnacleLeanOdds ?? null

  const sideKey = recommendedSide?.toLowerCase() as "over" | "under" | undefined
  if (sideKey) {
    for (const sourceItem of item.sourceItems) {
      const byBook = sourceItem.sportsbookOddsByBook ?? {}
      for (const [rawKey, value] of Object.entries(byBook)) {
        const resolvedKey = resolveSharpBookKey(rawKey) ?? resolveSharpBookKey(value?.title)
        if (!resolvedKey) continue
        const quote = parseFiniteNumber(value?.[sideKey])
        if (quote == null) continue
        const current = oddsByBook[resolvedKey]
        if (current == null || quote > current) {
          oddsByBook[resolvedKey] = quote
        }
      }
    }
  }

  return oddsByBook
}

const resolveDisplayLeanForFilter = (
  item: DisplayOrderbookItem,
  bookFilter: SharpBookFilter
) => {
  const baseLean = resolveDisplayLean(item)
  if (bookFilter === "all") return baseLean
  const oddsByBook = resolveSharpBookOddsForItem(item, baseLean.side ?? null)
  const preferredOdds = oddsByBook[bookFilter]
  if (preferredOdds == null) return baseLean
  return {
    ...baseLean,
    odds: preferredOdds,
    bestBookTitle: SHARP_BOOK_LOGOS[bookFilter].label,
  }
}

const resolveDisplayLean = (item: OrderbookItem) => {
  const overSide = item.sides.find((side) => side.propSide === "Over") ?? null
  const underSide = item.sides.find((side) => side.propSide === "Under") ?? null
  const largestWallSide = resolveLargestWall(item)?.propSide ?? null
  const liquiditySide = item.sharpLiquiditySide ?? largestWallSide
  const side = item.sharpLeanSide ?? resolveOppositeSide(liquiditySide)
  const liquidityEntry =
    (liquiditySide ? item.sides.find((entry) => entry.propSide === liquiditySide) : null) ??
    resolveLargestWall(item)
  const inverseOddsFromLiquidity =
    liquidityEntry?.sharpLineAmericanOdds ??
    (liquidityEntry?.wallPriceCents != null
      ? priceCentsToAmericanOdds(
          Math.max(0, Math.min(100, 100 - liquidityEntry.wallPriceCents))
        )
      : null)
  const oddsFromSide =
    side === "Over"
      ? overSide?.wallAmericanOdds ??
        resolveSideLevelOdds(overSide, "direct") ??
        underSide?.sharpLineAmericanOdds ??
        resolveSideLevelOdds(underSide, "sharp")
      : side === "Under"
        ? underSide?.wallAmericanOdds ??
          resolveSideLevelOdds(underSide, "direct") ??
          overSide?.sharpLineAmericanOdds ??
          resolveSideLevelOdds(overSide, "sharp")
        : null
  const odds =
    inverseOddsFromLiquidity ??
    item.sharpLeanAmericanOdds ??
    oddsFromSide ??
    item.pinnacleLeanOdds ??
    item.sharpLeanBestOdds
  const bestBookTitle =
    inverseOddsFromLiquidity != null
      ? null
      : item.pinnacleLeanOdds != null
        ? item.pinnacleLeanBookTitle
        : item.sharpLeanBestBookTitle

  return {
    side,
    odds,
    liquiditySide,
    bestBookTitle,
  }
}

const resolvePropText = (item: OrderbookItem, side?: "Over" | "Under" | null) => {
  const propType = item.propType?.replace(/_/g, " ") ?? "prop"
  const line = item.propLine != null ? `${item.propLine}` : ""
  if (side && line) return `${item.playerName ?? "Unknown"} ${side} ${line} ${propType}`
  if (side) return `${item.playerName ?? "Unknown"} ${side} ${propType}`
  return `${item.playerName ?? "Unknown"} ${propType}${line ? ` ${line}` : ""}`
}

const normalizePlayerToken = (value?: string | null) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()

const parseFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const resolveOddsApiBookOddsForItem = (
  item: DisplayOrderbookItem,
  recommendedSide: "Over" | "Under" | null,
  oddsFeed: PlayerPropOddsResponse | null | undefined
) => {
  const emptyResult: Partial<Record<(typeof ODDS_API_BOOK_KEYS)[number], number | null>> = {}
  if (!recommendedSide || !item.playerName) return emptyResult
  const rows = Array.isArray(oddsFeed?.props) ? oddsFeed.props : []
  if (!rows.length) return emptyResult

  const propTypeKey = String(item.propType ?? "").toLowerCase().trim()
  const marketAllowlist = ODDS_API_MARKETS_BY_PROP_TYPE[propTypeKey] ?? []
  if (!marketAllowlist.length) return emptyResult
  const marketAllowlistSet = new Set(marketAllowlist)
  const sideKey = recommendedSide.toLowerCase() as "over" | "under"
  const playerKey = normalizePlayerToken(item.playerName)
  if (!playerKey) return emptyResult

  let bestRow: PlayerPropOddsRow | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const row of rows) {
    const rowPlayer = normalizePlayerToken(row?.player)
    if (!rowPlayer || rowPlayer !== playerKey) continue

    const marketKey = String(row?.market ?? "").toLowerCase().trim()
    if (!marketAllowlistSet.has(marketKey)) continue

    const rowLine = parseFiniteNumber(row?.point)
    const targetLine = item.propLine
    const lineDiff =
      rowLine != null && targetLine != null ? Math.abs(rowLine - targetLine) : null
    if (lineDiff != null && lineDiff > 0.15) continue

    const hasSideOdds = ODDS_API_BOOK_KEYS.some((bookKey) => {
      const aliases = ODDS_API_BOOK_ALIASES[bookKey] ?? [bookKey]
      return aliases.some((alias) => {
        const candidate = parseFiniteNumber(row?.odds?.[alias]?.[sideKey])
        return candidate != null
      })
    })
    if (!hasSideOdds) continue

    const score =
      (lineDiff == null ? 0 : 100 - lineDiff * 100) +
      (targetLine != null && rowLine != null && lineDiff != null && lineDiff < 0.01 ? 50 : 0)
    if (score > bestScore) {
      bestScore = score
      bestRow = row
    }
  }

  if (!bestRow) return emptyResult

  const result: Partial<Record<(typeof ODDS_API_BOOK_KEYS)[number], number | null>> = {}
  for (const bookKey of ODDS_API_BOOK_KEYS) {
    const aliases = ODDS_API_BOOK_ALIASES[bookKey] ?? [bookKey]
    let value: number | null = null
    for (const alias of aliases) {
      value = parseFiniteNumber(bestRow.odds?.[alias]?.[sideKey])
      if (value != null) break
    }
    result[bookKey] = value
  }
  return result
}

const buildPlayerHeadshotKey = (sportKey: string, playerName: string) =>
  `${sportKey}:${normalizePlayerToken(playerName)}`

const buildPlayerFaceRoute = (sportKey: string, playerName?: string | null) =>
  playerName
    ? `/api/intel/player-face?sportKey=${encodeURIComponent(sportKey)}&name=${encodeURIComponent(
        playerName
      )}`
    : null

const hasOwn = (obj: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key)

const resolvePlayerHeadshot = (
  item: OrderbookItem,
  headshotsByKey: Record<string, string | null>
) => {
  if (!item.playerName) return null
  const key = buildPlayerHeadshotKey(item.sportKey, item.playerName)
  if (!hasOwn(headshotsByKey, key)) return null
  return headshotsByKey[key]
}

const resolvePlayerInitials = (name?: string | null) => {
  if (!name) return "?"
  const parts = name.split(" ").filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

const probabilityToAmericanOdds = (probability: number) => {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return null
  if (probability >= 0.5) {
    return -Math.round((probability / (1 - probability)) * 100)
  }
  return Math.round(((1 - probability) / probability) * 100)
}

const oddsToImpliedProbability = (odds: number) => {
  if (!Number.isFinite(odds) || odds === 0) return null
  if (odds > 0) return 100 / (odds + 100)
  const absolute = Math.abs(odds)
  return absolute / (absolute + 100)
}

const priceCentsToAmericanOdds = (priceCents: number | null) => {
  if (priceCents == null) return null
  const probability = priceCents / 100
  return probabilityToAmericanOdds(probability)
}

const resolveMiniBarShares = (item: OrderbookItem) => {
  const overNotional =
    item.sides
      .filter((side) => side.propSide === "Over")
      .reduce((sum, side) => sum + (side.wallNotional ?? 0), 0) ?? 0
  const underNotional =
    item.sides
      .filter((side) => side.propSide === "Under")
      .reduce((sum, side) => sum + (side.wallNotional ?? 0), 0) ?? 0
  const total = overNotional + underNotional
  if (total <= 0) return { overPct: 0, underPct: 0 }
  return {
    overPct: Math.round((overNotional / total) * 100),
    underPct: Math.round((underNotional / total) * 100),
  }
}

const resolveSideWallNotional = (
  item: OrderbookItem,
  side: "Over" | "Under" | null | undefined
) => {
  if (!side) return 0
  return (
    item.sides
      .filter((entry) => entry.propSide === side)
      .reduce((sum, entry) => sum + (entry.wallNotional ?? 0), 0) ?? 0
  )
}

const mergeSidesAcrossSources = (sourceItems: OrderbookItem[]): OrderbookSide[] => {
  const sideBuckets = new Map<
    string,
    {
      outcome: string
      propSide: "Over" | "Under" | null
      platformSide: "yes" | "no" | null
      levels: Map<number, number>
    }
  >()

  for (const sourceItem of sourceItems) {
    for (const side of sourceItem.sides) {
      const key = side.propSide ?? side.platformSide ?? side.outcome.toLowerCase().trim()
      const existing = sideBuckets.get(key) ?? {
        outcome: side.outcome,
        propSide: side.propSide,
        platformSide: side.platformSide,
        levels: new Map<number, number>(),
      }

      if (side.levels.length > 0) {
        for (const level of side.levels) {
          const current = existing.levels.get(level.priceCents) ?? 0
          existing.levels.set(level.priceCents, current + level.notional)
        }
      } else if (
        (side.wallNotional ?? 0) > 0 &&
        side.wallPriceCents != null &&
        Number.isFinite(side.wallPriceCents)
      ) {
        const current = existing.levels.get(side.wallPriceCents) ?? 0
        existing.levels.set(side.wallPriceCents, current + (side.wallNotional ?? 0))
      }

      sideBuckets.set(key, existing)
    }
  }

  const mergedSides = Array.from(sideBuckets.values())
    .map((bucket) => {
      const levels = Array.from(bucket.levels.entries())
        .map(([priceCents, notional]) => ({ priceCents, notional }))
        .filter((level) => level.notional > 0)
        .sort((a, b) => b.notional - a.notional)

      const wall = levels[0] ?? null
      const sharpLinePrice =
        wall != null ? Math.max(0, Math.min(100, 100 - wall.priceCents)) : null

      return {
        outcome: bucket.outcome,
        propSide: bucket.propSide,
        platformSide: bucket.platformSide,
        levels,
        totalNotional: levels.reduce((sum, level) => sum + level.notional, 0),
        wallPriceCents: wall?.priceCents ?? null,
        wallNotional: wall?.notional ?? null,
        wallAmericanOdds: wall ? priceCentsToAmericanOdds(wall.priceCents) : null,
        sharpLinePriceCents: sharpLinePrice,
        sharpLineAmericanOdds:
          sharpLinePrice != null ? priceCentsToAmericanOdds(sharpLinePrice) : null,
      } satisfies OrderbookSide
    })
    .filter((side) => side.levels.length > 0 || (side.wallNotional ?? 0) > 0)
    .sort((a, b) => {
      const rank = (side: OrderbookSide) =>
        side.propSide === "Over" ? 0 : side.propSide === "Under" ? 1 : 2
      const rankDiff = rank(a) - rank(b)
      if (rankDiff !== 0) return rankDiff
      return a.outcome.localeCompare(b.outcome)
    })

  return mergedSides
}

const mergeOrderbookItemsByProp = (items: OrderbookItem[]): DisplayOrderbookItem[] => {
  const grouped = new Map<string, OrderbookItem[]>()
  for (const item of items) {
    const key = buildOrderbookGroupKey(item)
    const bucket = grouped.get(key) ?? []
    bucket.push(item)
    grouped.set(key, bucket)
  }

  const merged: DisplayOrderbookItem[] = []
  for (const groupItems of grouped.values()) {
    const sortedByLiquidity = [...groupItems].sort(
      (a, b) => (resolveDisplayOrderSize(b) ?? 0) - (resolveDisplayOrderSize(a) ?? 0)
    )
    const primary = sortedByLiquidity[0]
    const sources = sortSources(
      Array.from(new Set(groupItems.map((entry) => entry.source)))
    )
    const sides = mergeSidesAcrossSources(groupItems)
    const largestWall =
      [...sides]
        .filter((side) => (side.wallNotional ?? 0) > 0)
        .sort((a, b) => (b.wallNotional ?? 0) - (a.wallNotional ?? 0))[0] ?? null

    let bestLeanOdds: number | null = null
    let bestLeanBookTitle: string | null = null
    let pinnacleLeanOdds: number | null = null
    let pinnacleLeanBookTitle: string | null = null
    let fanduelLeanOdds: number | null = null
    let fanduelLeanBookTitle: string | null = null

    for (const item of groupItems) {
      const displayLean = resolveDisplayLean(item)
      if (
        displayLean.odds != null &&
        (bestLeanOdds == null || displayLean.odds > bestLeanOdds)
      ) {
        bestLeanOdds = displayLean.odds
        bestLeanBookTitle = displayLean.bestBookTitle ?? formatSourceLabel(item.source)
      }
      if (
        item.pinnacleLeanOdds != null &&
        (pinnacleLeanOdds == null || item.pinnacleLeanOdds > pinnacleLeanOdds)
      ) {
        pinnacleLeanOdds = item.pinnacleLeanOdds
        pinnacleLeanBookTitle = item.pinnacleLeanBookTitle
      }
      if (
        item.fanduelLeanOdds != null &&
        (fanduelLeanOdds == null || item.fanduelLeanOdds > fanduelLeanOdds)
      ) {
        fanduelLeanOdds = item.fanduelLeanOdds
        fanduelLeanBookTitle = item.fanduelLeanBookTitle
      }
    }

    merged.push({
      ...primary,
      id: buildOrderbookGroupKey(primary),
      source: primary.source,
      sources,
      sourceItems: groupItems,
      marketTitle:
        primary.marketTitle ||
        groupItems.find((item) => item.marketTitle)?.marketTitle ||
        primary.id,
      matchup:
        primary.matchup ??
        groupItems.find((item) => item.matchup)?.matchup,
      eventDate:
        primary.eventDate ??
        groupItems.find((item) => item.eventDate)?.eventDate,
      sides,
      sharpLiquiditySide: primary.sharpLiquiditySide ?? largestWall?.propSide ?? null,
      sharpLiquidityNotional:
        largestWall?.wallNotional ??
        primary.sharpLiquidityNotional,
      sharpOrderAmericanOdds:
        largestWall?.wallAmericanOdds ??
        primary.sharpOrderAmericanOdds,
      sharpLeanSide:
        primary.sharpLeanSide ??
        resolveOppositeSide(primary.sharpLiquiditySide ?? largestWall?.propSide ?? null),
      sharpLeanAmericanOdds: primary.sharpLeanAmericanOdds,
      sharpLeanBestOdds: bestLeanOdds ?? primary.sharpLeanBestOdds,
      sharpLeanBestBookTitle:
        bestLeanBookTitle ?? primary.sharpLeanBestBookTitle,
      pinnacleLeanOdds: pinnacleLeanOdds ?? primary.pinnacleLeanOdds,
      pinnacleLeanBookTitle:
        pinnacleLeanBookTitle ?? primary.pinnacleLeanBookTitle,
      fanduelLeanOdds: fanduelLeanOdds ?? primary.fanduelLeanOdds,
      fanduelLeanBookTitle:
        fanduelLeanBookTitle ?? primary.fanduelLeanBookTitle,
    })
  }

  return merged
}

const buildLadderRows = (
  item: DisplayOrderbookItem,
  limit: number,
  recommendedSide?: "Over" | "Under" | null
) => {
  const hasDirectRecommendedLiquidity = (() => {
    if (!recommendedSide) return false
    return item.sourceItems.some((sourceItem) =>
      sourceItem.sides.some((side) => {
        if (side.propSide !== recommendedSide) return false
        if (side.levels.length > 0) return true
        return (side.wallNotional ?? 0) > 0 && side.wallPriceCents != null
      })
    )
  })()

  const rowMap = new Map<
    string,
    {
      id: string
      side: "Over" | "Under" | null
      odds: number | null
      notional: number
      sources: Set<SourceKey>
    }
  >()

  for (const sourceItem of item.sourceItems) {
    for (const side of sourceItem.sides) {
      const includeDirect = !recommendedSide || side.propSide === recommendedSide
      const includeComplement =
        Boolean(recommendedSide) &&
        !hasDirectRecommendedLiquidity &&
        side.propSide === resolveOppositeSide(recommendedSide ?? null)
      if (!includeDirect && !includeComplement) continue

      const levels =
        side.levels.length > 0
          ? side.levels
          : side.wallPriceCents != null && (side.wallNotional ?? 0) > 0
            ? [{ priceCents: side.wallPriceCents, notional: side.wallNotional ?? 0 }]
            : []

      for (const level of levels) {
        const resolvedPriceCents =
          includeComplement && recommendedSide
            ? Math.max(0, Math.min(100, 100 - level.priceCents))
            : level.priceCents
        const resolvedSide = recommendedSide ?? side.propSide
        const odds = priceCentsToAmericanOdds(resolvedPriceCents)
        const key = `${resolvedSide ?? "none"}:${odds != null ? Math.round(odds) : "na"}`
        const existing = rowMap.get(key) ?? {
          id: `${item.id}:${key}`,
          side: resolvedSide,
          odds,
          notional: 0,
          sources: new Set<SourceKey>(),
        }
        existing.notional += level.notional
        existing.sources.add(sourceItem.source)
        rowMap.set(key, existing)
      }
    }
  }

  return Array.from(rowMap.values())
    .map((row) => ({
      id: row.id,
      side: row.side,
      odds: row.odds,
      notional: row.notional,
      sources: sortSources(Array.from(row.sources)),
    }))
    .filter((row) => row.notional > 0)
    .sort((a, b) => b.notional - a.notional)
    .slice(0, limit)
}

const resolveWeightedAverageOdds = (rows: LadderRow[]) => {
  let weightedProbability = 0
  let totalNotional = 0
  for (const row of rows) {
    if (row.odds == null) continue
    const implied = oddsToImpliedProbability(row.odds)
    if (implied == null) continue
    weightedProbability += implied * row.notional
    totalNotional += row.notional
  }
  if (totalNotional <= 0) return null
  return probabilityToAmericanOdds(weightedProbability / totalNotional)
}

const resolveRecommendedLiquidityForItem = (
  item: DisplayOrderbookItem,
  recommendedSide: "Over" | "Under" | null
) => {
  const rows = buildLadderRows(item, 12, recommendedSide)
  return rows.reduce((sum, row) => sum + row.notional, 0)
}

export default function PropOrderbooksPanel({
  sport = "all",
  limit = 200,
  depth = 8,
  minSharpNotional = 100,
  initialData = null,
}: {
  sport?: string
  limit?: number
  depth?: number
  minSharpNotional?: number
  initialData?: OrderbooksInitialData
}) {
  const [selectedSport, setSelectedSport] = useState<string>(sport)
  const [items, setItems] = useState<OrderbookItem[]>(initialData?.items ?? [])
  const [search, setSearch] = useState("")
  const [oddsPreset, setOddsPreset] = useState<OddsPreset>("evenish")
  const [selectedBookFilter, setSelectedBookFilter] = useState<SharpBookFilter>("all")
  const [minOdds, setMinOdds] = useState<string>("-200")
  const [maxOdds, setMaxOdds] = useState<string>("")
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialData?.items?.[0]?.id ?? null
  )
  const [loading, setLoading] = useState((initialData?.items?.length ?? 0) === 0)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(
    initialData?.updatedAt ?? null
  )
  const [cacheSource, setCacheSource] = useState<string | null>(
    initialData?.cache?.source ?? null
  )
  const [cacheFetchedAt, setCacheFetchedAt] = useState<string | null>(
    initialData?.cache?.fetchedAt ?? null
  )
  const [playerHeadshotsByKey, setPlayerHeadshotsByKey] = useState<Record<string, string | null>>({})
  const [headshotLoadingByKey, setHeadshotLoadingByKey] = useState<Record<string, boolean>>({})
  const [refreshWindowOpen, setRefreshWindowOpen] = useState<boolean>(() =>
    isWithinSharpRefreshWindow()
  )

  const requestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasItemsRef = useRef((initialData?.items?.length ?? 0) > 0)
  const itemsRef = useRef<OrderbookItem[]>(initialData?.items ?? [])
  const lastUpdatedAtRef = useRef<string | null>(initialData?.updatedAt ?? null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    setSelectedSport(sport)
  }, [sport])

  useEffect(() => {
    const updateWindow = () => setRefreshWindowOpen(isWithinSharpRefreshWindow())
    updateWindow()
    const timer = window.setInterval(updateWindow, 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  const load = useCallback(
    async ({
      forceRefresh = false,
      background = false,
    }: {
      forceRefresh?: boolean
      background?: boolean
    }) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      if (background) {
        setRefreshing(true)
        if (!hasItemsRef.current) setLoading(true)
      } else {
        setLoading(true)
      }

      try {
        const shouldForceRefresh = forceRefresh && false
        const params = new URLSearchParams({
          sport: "all",
          limit: String(limit),
          depth: String(depth),
          minSharpNotional: String(minSharpNotional),
        })
        if (shouldForceRefresh) {
          params.set("refresh", "1")
          params.set("mode", "full")
        }

        const res = await fetch(`/api/prop-orderbooks?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        })

        const payload = (await res.json().catch(() => ({}))) as OrderbooksApiResponse
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to load order books.")
        }
        if (requestId !== requestIdRef.current) return

        const nextItems = Array.isArray(payload?.items) ? payload.items : []
        const previousItems = itemsRef.current
        const previousUpdatedAtMs = parseTimestampMs(lastUpdatedAtRef.current)
        const nextUpdatedAtMs = parseTimestampMs(payload?.updatedAt ?? null)
        const hasNewerSnapshot = nextUpdatedAtMs > previousUpdatedAtMs
        const sourceLabel = String(payload?.cache?.source ?? "")
        const isOvernightSnapshot = sourceLabel.includes("overnight")
        const shouldAcceptBackground =
          !background ||
          hasNewerSnapshot ||
          isOvernightSnapshot ||
          shouldPersistPropOrderbooksSnapshot(previousItems, nextItems) ||
          payload?.cache?.fallbackToPersistent === true
        const resolvedItems = background
          ? shouldAcceptBackground
            ? mergeBackgroundItems(previousItems, nextItems, limit)
            : previousItems.slice(0, limit)
          : nextItems
        hasItemsRef.current = resolvedItems.length > 0
        itemsRef.current = resolvedItems
        setItems(resolvedItems)
        setSelectedItemId((prev) => {
          if (!resolvedItems.length) return null
          if (prev && resolvedItems.some((item) => item.id === prev)) return prev
          return resolvedItems[0].id
        })
        const resolvedUpdatedAt = payload?.updatedAt ?? new Date().toISOString()
        lastUpdatedAtRef.current = resolvedUpdatedAt
        setLastUpdatedAt(resolvedUpdatedAt)
        setCacheSource(payload?.cache?.source ?? null)
        setCacheFetchedAt(payload?.cache?.fetchedAt ?? null)
        setErrorMessage(null)
      } catch (error: any) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return
        setErrorMessage(error?.message ?? "Failed to load order books.")
      } finally {
        if (requestId !== requestIdRef.current) return
        setLoading(false)
        setRefreshing(false)
      }
    },
    [depth, limit, minSharpNotional]
  )

  useEffect(() => {
    requestIdRef.current += 1
    abortControllerRef.current?.abort()
    const seededItems = initialData?.items ?? []
    hasItemsRef.current = seededItems.length > 0
    itemsRef.current = seededItems
    setItems(seededItems)
    setSelectedItemId(seededItems[0]?.id ?? null)
    setLoading(!seededItems.length)
    setRefreshing(false)
    setErrorMessage(null)
    lastUpdatedAtRef.current = initialData?.updatedAt ?? null
    setLastUpdatedAt(initialData?.updatedAt ?? null)
    setCacheSource(initialData?.cache?.source ?? null)
    setCacheFetchedAt(initialData?.cache?.fetchedAt ?? null)
    setPlayerHeadshotsByKey({})
    setHeadshotLoadingByKey({})
    setSearch("")
    setOddsPreset("evenish")
    setSelectedBookFilter("all")
    setMinOdds("-120")
    setMaxOdds("120")
  }, [initialData, sport])

  useEffect(() => {
    const hasSeededItems = itemsRef.current.length > 0
    const useBackgroundRefresh = hasSeededItems

    load({
      forceRefresh: false,
      background: useBackgroundRefresh,
    })
  }, [initialData, load, sport])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isWithinSharpRefreshWindow()) return
      load({ forceRefresh: false, background: true })
    }, SHARP_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [load])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  const pendingHeadshotGroups = useMemo(() => {
    const groups = new Map<string, Array<{ playerName: string; key: string }>>()
    const seen = new Set<string>()

    for (const item of items) {
      if (!item.playerName) continue
      const playerName = item.playerName.trim()
      if (!playerName) continue
      const key = buildPlayerHeadshotKey(item.sportKey, playerName)
      if (seen.has(key)) continue
      seen.add(key)
      if (hasOwn(playerHeadshotsByKey, key) || headshotLoadingByKey[key]) continue
      const group = groups.get(item.sportKey) ?? []
      group.push({ playerName, key })
      groups.set(item.sportKey, group)
    }

    return Array.from(groups.entries()).map(([sportKey, players]) => ({ sportKey, players }))
  }, [items, playerHeadshotsByKey, headshotLoadingByKey])

  useEffect(() => {
    let cancelled = false
    if (pendingHeadshotGroups.length === 0) return

    const run = async () => {
      const chunkSize = 20
      for (const group of pendingHeadshotGroups) {
        for (let i = 0; i < group.players.length; i += chunkSize) {
          if (cancelled) return
          const chunk = group.players.slice(i, i + chunkSize)
          const names = chunk.map((entry) => entry.playerName)

          setHeadshotLoadingByKey((prev) => {
            const next = { ...prev }
            chunk.forEach((entry) => {
              next[entry.key] = true
            })
            return next
          })

          try {
            const res = await fetch("/api/intel/player-headshots", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
              body: JSON.stringify({
                sportKey: group.sportKey,
                players: names,
              }),
            })
            const payload = (await res.json().catch(() => ({}))) as PlayerHeadshotResponse
            if (!res.ok) {
              throw new Error("Failed to preload player headshots.")
            }
            if (!payload?.ok || !payload?.headshots || typeof payload.headshots !== "object") {
              throw new Error("Invalid player headshot payload.")
            }
            if (cancelled) return

            setPlayerHeadshotsByKey((prev) => {
              const next = { ...prev }
              chunk.forEach((entry) => {
                const value = payload?.headshots?.[entry.playerName]
                next[entry.key] =
                  typeof value === "string" && value.trim().length > 0 ? value : null
              })
              return next
            })
          } catch {
            if (cancelled) return
            // Keep keys unresolved on request failure so subsequent renders can retry.
          } finally {
            if (!isMountedRef.current) return
            setHeadshotLoadingByKey((prev) => {
              const next = { ...prev }
              chunk.forEach((entry) => {
                delete next[entry.key]
              })
              return next
            })
          }
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [pendingHeadshotGroups])

  const mergedItems = useMemo(() => mergeOrderbookItemsByProp(items), [items])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    const resolvedRange = (() => {
      if (oddsPreset === "all") return { min: null as number | null, max: null as number | null }
      if (oddsPreset === "underdog200") return { min: 200, max: null as number | null }
      if (oddsPreset === "plusMoney") return { min: 100, max: null as number | null }
      if (oddsPreset === "evenish") return { min: -120, max: 120 }
      if (oddsPreset === "favorites") return { min: -200, max: -101 }
      if (oddsPreset === "custom") {
        const min = minOdds.trim() === "" ? null : Number(minOdds)
        const max = maxOdds.trim() === "" ? null : Number(maxOdds)
        return {
          min: Number.isFinite(min as number) ? (min as number) : null,
          max: Number.isFinite(max as number) ? (max as number) : null,
        }
      }
      return { min: -200, max: null as number | null }
    })()

    const matchesOddsRange = (candidateOdds: number | null) => {
      if (resolvedRange.min == null && resolvedRange.max == null) return true
      if (candidateOdds == null) return false
      if (resolvedRange.min != null && candidateOdds < resolvedRange.min) return false
      if (resolvedRange.max != null && candidateOdds > resolvedRange.max) return false
      return true
    }

    return mergedItems
      .map((item) => {
        if (selectedSport !== "all" && item.sportKey !== selectedSport) {
          return null
        }
        if (query) {
          const haystack = `${item.playerName ?? ""} ${item.matchup ?? ""} ${item.marketTitle ?? ""}`
            .toLowerCase()
            .trim()
          if (!haystack.includes(query)) return null
        }
        const displayLean = resolveDisplayLeanForFilter(item, selectedBookFilter)
        if (selectedBookFilter !== "all") {
          const oddsByBook = resolveSharpBookOddsForItem(item, displayLean.side ?? null)
          if (oddsByBook[selectedBookFilter] == null) return null
        }
        if (!matchesOddsRange(displayLean.odds)) return null
        return {
          item,
          rankLiquidity: resolveRecommendedLiquidityForItem(item, displayLean.side ?? null),
        }
      })
      .filter((entry): entry is { item: DisplayOrderbookItem; rankLiquidity: number } => entry != null)
      .sort((a, b) => {
        if (b.rankLiquidity !== a.rankLiquidity) return b.rankLiquidity - a.rankLiquidity
        const aSize = resolveDisplayOrderSize(a.item) ?? 0
        const bSize = resolveDisplayOrderSize(b.item) ?? 0
        if (bSize !== aSize) return bSize - aSize
        return a.item.marketTitle.localeCompare(b.item.marketTitle)
      })
      .map((entry) => entry.item)
  }, [maxOdds, mergedItems, minOdds, oddsPreset, search, selectedBookFilter, selectedSport])

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedItemId(null)
      return
    }
    if (!selectedItemId || !filteredItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(filteredItems[0].id)
    }
  }, [filteredItems, selectedItemId])

  const selectedItem = useMemo<DisplayOrderbookItem | null>(
    () => filteredItems.find((item) => item.id === selectedItemId) ?? filteredItems[0] ?? null,
    [filteredItems, selectedItemId]
  )
  const selectedOddsFeed: PlayerPropOddsResponse | null = null

  const selectedDisplayLean = useMemo(
    () => (selectedItem ? resolveDisplayLeanForFilter(selectedItem, selectedBookFilter) : null),
    [selectedBookFilter, selectedItem]
  )
  const selectedSharpBookOdds = useMemo(() => {
    if (!selectedItem) return [] as Array<{ key: SharpBookKey; odds: number | null }>
    const recommendedSide = selectedDisplayLean?.side ?? null
    const oddsByBook = resolveSharpBookOddsForItem(selectedItem, recommendedSide)
    const oddsApiOverrides = resolveOddsApiBookOddsForItem(
      selectedItem,
      recommendedSide,
      selectedOddsFeed
    )
    for (const bookKey of ODDS_API_BOOK_KEYS) {
      const override = oddsApiOverrides[bookKey]
      if (override != null) {
        oddsByBook[bookKey] = override
      }
    }

    return SHARP_BOOK_ORDER.map((key) => ({
      key,
      odds: oddsByBook[key] ?? null,
    }))
  }, [selectedDisplayLean?.side, selectedItem, selectedOddsFeed])
  const selectedPlayerHeadshot = selectedItem
    ? resolvePlayerHeadshot(selectedItem, playerHeadshotsByKey)
    : null
  const selectedFaceSrc = selectedItem
    ? selectedPlayerHeadshot
      ? `/api/image-proxy?url=${encodeURIComponent(selectedPlayerHeadshot)}`
      : buildPlayerFaceRoute(selectedItem.sportKey, selectedItem.playerName)
    : null

  const ladderRows = useMemo(
    () =>
      selectedItem
        ? buildLadderRows(selectedItem, 12, selectedDisplayLean?.side ?? null)
        : [],
    [selectedDisplayLean?.side, selectedItem]
  )
  const maxLadderNotional = useMemo(
    () => ladderRows.reduce((max, row) => Math.max(max, row.notional), 0),
    [ladderRows]
  )
  const ladderVolume = useMemo(
    () => ladderRows.reduce((sum, row) => sum + row.notional, 0),
    [ladderRows]
  )
  const ladderAverageOdds = useMemo(
    () => resolveWeightedAverageOdds(ladderRows),
    [ladderRows]
  )
  const sharpPropsSharePayload = useMemo(() => {
    if (!selectedItem || !selectedDisplayLean) return null

    const topRows = ladderRows.slice(0, 5)
    const topMaxNotional = topRows.reduce((max, row) => Math.max(max, row.notional), 0)
    const playSubtext = selectedDisplayLean.bestBookTitle
      ? `${selectedDisplayLean.bestBookTitle} best price`
      : "Direct inverse from sharp resting liquidity"

    return {
      id: selectedItem.id,
      sportLabel: selectedItem.sportLabel,
      matchup: selectedItem.matchup ?? selectedItem.marketTitle,
      sourceKeys: selectedItem.sources,
      whaleVolumeLabel: formatCompactCurrency(resolveDisplayOrderSize(selectedItem)),
      playLabel: resolvePropText(selectedItem, selectedDisplayLean.side),
      playOddsLabel: formatAmericanOdds(selectedDisplayLean.odds ?? null),
      playSubtext,
      playerImageUrl: selectedFaceSrc,
      playerInitials: resolvePlayerInitials(selectedItem.playerName),
      sharpBookOdds: selectedSharpBookOdds.map((book) => ({
        key: book.key,
        oddsLabel: formatAmericanOdds(book.odds),
      })),
      lineMarker:
        selectedItem.propLine != null && Number.isFinite(selectedItem.propLine)
          ? `${selectedItem.propLine}`
          : null,
      liquidityLevels: topRows.map((row) => {
        const side: "Over" | "Under" | "Neutral" =
          row.side === "Over"
            ? "Over"
            : row.side === "Under"
              ? "Under"
              : "Neutral"
        return {
          id: row.id,
          priceLabel: formatAmericanOdds(row.odds),
          notionalLabel: formatCompactCurrency(row.notional),
          side,
          normalizedHeight:
            topMaxNotional > 0
              ? Math.max((row.notional / topMaxNotional) * 100, 12)
              : 12,
        }
      }),
    }
  }, [
    ladderRows,
    selectedDisplayLean,
    selectedFaceSrc,
    selectedItem,
    selectedSharpBookOdds,
  ])

  const totalCountLabel = `${filteredItems.length} props`
  const updatedLabel = lastUpdatedAt ? formatDateLabel(lastUpdatedAt) : "--"
  const fetchedLabel = cacheFetchedAt ? formatDateLabel(cacheFetchedAt) : null

  if (loading && !items.length) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-6">
        <div className="flex flex-col items-center gap-4">
          <BoxLoader />
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">Loading orderbooks...</span>
        </div>
      </div>
    )
  }

  if (!loading && !items.length && errorMessage) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-red-200">
        {errorMessage}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#06090f]">
      <div className="border-b border-white/10 bg-black/40 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Sharp Prop Orderbook</div>
            <div className="mt-1 text-xs text-white/55">
              {totalCountLabel} | refreshes every 10m ({SHARP_REFRESH_WINDOW_LABEL})
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
            <span>Updated {updatedLabel}</span>
            {fetchedLabel && <span>Cache {fetchedLabel}</span>}
            <span className="rounded-md border border-white/10 px-2 py-1 text-white/60">
              {formatCacheLabel(cacheSource)}
            </span>
            <button
              type="button"
              onClick={() => load({ forceRefresh: false, background: true })}
              disabled={refreshing || !refreshWindowOpen}
              className="rounded-md border border-white/15 px-2.5 py-1 text-white/75 transition-colors hover:border-emerald-400/50 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {!refreshWindowOpen && (
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/40">
                Auto-refresh paused
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedSport}
            onChange={(event) => setSelectedSport(event.target.value)}
            className="h-9 rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          >
            {SPORT_FILTER_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                League: {option.label}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player or matchup"
            className="h-9 w-[220px] rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          />
          <select
            value={oddsPreset}
            onChange={(event) => setOddsPreset(event.target.value as OddsPreset)}
            className="h-9 rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          >
            <option value="all">Odds: Any</option>
            <option value="default">Odds: -200 or better</option>
            <option value="underdog200">Odds: +200 or worse</option>
            <option value="plusMoney">Odds: +100 or worse</option>
            <option value="evenish">Odds: -120 to +120</option>
            <option value="favorites">Odds: -200 to -101</option>
            <option value="custom">Custom range</option>
          </select>
          <select
            value={selectedBookFilter}
            onChange={(event) => setSelectedBookFilter(event.target.value as SharpBookFilter)}
            className="h-9 rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          >
            <option value="all">Book: All</option>
            {SHARP_BOOK_ORDER.map((key) => (
              <option key={key} value={key}>
                Book: {SHARP_BOOK_LOGOS[key].label}
              </option>
            ))}
          </select>
          {oddsPreset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                value={minOdds}
                onChange={(e) => setMinOdds(e.target.value)}
                placeholder="Min"
                inputMode="numeric"
                className="h-9 w-[88px] rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              />
              <span className="text-xs text-white/45">to</span>
              <input
                value={maxOdds}
                onChange={(e) => setMaxOdds(e.target.value)}
                placeholder="Max"
                inputMode="numeric"
                className="h-9 w-[88px] rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              />
            </div>
          )}
          {errorMessage && <span className="text-xs text-amber-200">{errorMessage}</span>}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="px-4 py-10 text-sm text-white/55">No order books match your filters.</div>
      ) : (
        <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="max-h-[72vh] overflow-y-auto border-b border-white/10 bg-black/30 lg:border-b-0 lg:border-r">
            <div className="space-y-2 p-3">
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id
                const orderSize = resolveDisplayOrderSize(item)
                const displayLean = resolveDisplayLeanForFilter(item, selectedBookFilter)
                const miniShares = resolveMiniBarShares(item)
                const directRecommendedSharePct =
                  displayLean.side === "Over"
                    ? miniShares.overPct
                    : displayLean.side === "Under"
                      ? miniShares.underPct
                      : 0
                const fallbackSide = resolveOppositeSide(displayLean.side ?? null)
                const fallbackSharePct =
                  fallbackSide === "Over"
                    ? miniShares.overPct
                    : fallbackSide === "Under"
                      ? miniShares.underPct
                      : 0
                const recommendedSharePct =
                  directRecommendedSharePct > 0 ? directRecommendedSharePct : fallbackSharePct
                const directRecommendedNotional = resolveSideWallNotional(item, displayLean.side)
                const fallbackNotional = resolveSideWallNotional(item, fallbackSide)
                const recommendedNotional =
                  directRecommendedNotional > 0 ? directRecommendedNotional : fallbackNotional
                const playerHeadshot = resolvePlayerHeadshot(item, playerHeadshotsByKey)
                const playerFaceSrc = playerHeadshot
                  ? `/api/image-proxy?url=${encodeURIComponent(playerHeadshot)}`
                  : buildPlayerFaceRoute(item.sportKey, item.playerName)

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-emerald-400/60 bg-emerald-500/10"
                        : "border-white/10 bg-black/40 hover:border-white/25 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-3xl font-bold leading-none text-lime-300">
                        {formatCompactCurrency(orderSize)}
                      </div>
                      <div className="text-[10px] text-white/40">{item.eventDate ?? "TBD"}</div>
                    </div>

                    <div className="mt-2 line-clamp-1 text-sm font-semibold text-white">
                      {item.matchup ?? item.marketTitle}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/45">
                      <span>{item.sportLabel}</span>
                      <div className="flex items-center gap-1">
                        {item.sources.map((source) => {
                          const logo = SOURCE_LOGOS[source]
                          return (
                            <span
                              key={`${item.id}:${source}`}
                              className="flex h-6 w-6 items-center justify-center overflow-hidden rounded border border-white/15 bg-black/40"
                              title={logo.label}
                            >
                              <Image
                                src={logo.src}
                                alt={logo.label}
                                width={24}
                                height={24}
                                className="h-full w-full object-contain"
                                unoptimized
                              />
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-black/45 px-2.5 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5">
                          {playerFaceSrc ? (
                            <Image
                              src={playerFaceSrc}
                              alt={item.playerName ?? "Player"}
                              width={28}
                              height={28}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="text-[10px] font-semibold text-white/65">
                              {resolvePlayerInitials(item.playerName)}
                            </span>
                          )}
                        </div>
                        <div className="line-clamp-1 text-xs text-white/80">
                          {resolvePropText(item, displayLean.side)}
                        </div>
                      </div>
                      <div className="rounded-md bg-lime-500/20 px-2 py-0.5 text-[11px] font-semibold text-lime-300">
                        {formatAmericanOdds(displayLean.odds)}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/40">
                        <span>{displayLean.side ? `${displayLean.side} Liquidity` : "Recommended Liquidity"}</span>
                        <span>{formatCompactCurrency(recommendedNotional)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-lime-400"
                          style={{ width: `${recommendedSharePct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-4">
            {!selectedItem ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-white/60">
                Select a market to inspect the live orderbook.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                  <span>{selectedItem.sportLabel}</span>
                  <span className="text-white/20">|</span>
                  <div className="flex items-center gap-1">
                    {selectedItem.sources.map((source) => {
                      const logo = SOURCE_LOGOS[source]
                      return (
                        <span
                          key={`${selectedItem.id}:${source}:header`}
                          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded border border-white/15 bg-black/40"
                          title={logo.label}
                        >
                          <Image
                            src={logo.src}
                            alt={logo.label}
                            width={30}
                            height={30}
                            className="h-full w-full object-contain"
                            unoptimized
                          />
                        </span>
                      )
                    })}
                  </div>
                </div>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  {selectedItem.matchup ?? selectedItem.marketTitle}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="text-4xl font-bold leading-none text-lime-300">
                    {formatCompactCurrency(resolveDisplayOrderSize(selectedItem))}
                  </div>
                  <div className="text-sm text-white/55">Whale Volume</div>
                  <div className="ml-auto">
                    {sharpPropsSharePayload && (
                      <ShareSharpPropsToolButton payload={sharpPropsSharePayload} />
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/45 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-lime-300">The Play</div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5">
                          {selectedFaceSrc ? (
                            <Image
                              src={selectedFaceSrc}
                              alt={selectedItem.playerName ?? "Player"}
                              width={36}
                              height={36}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="text-xs font-semibold text-white/65">
                              {resolvePlayerInitials(selectedItem.playerName)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 text-base font-semibold text-white">
                          {resolvePropText(selectedItem, selectedDisplayLean?.side)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {selectedDisplayLean?.bestBookTitle
                          ? `${selectedDisplayLean.bestBookTitle} best price`
                          : "Direct inverse from sharp resting liquidity"}
                      </div>
                    </div>
                    <div className="rounded-md bg-lime-500 px-2.5 py-1 text-sm font-semibold text-black">
                      {formatAmericanOdds(selectedDisplayLean?.odds ?? null)}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                      Recommended Side Liquidity
                    </div>
                    <div className="text-xs text-white/50">
                      {formatAmericanOdds(ladderAverageOdds)} avg | {formatCompactCurrency(ladderVolume)} vol
                    </div>
                  </div>

                  <div className="mt-2 space-y-2">
                    {ladderRows.map((row) => {
                      const isHotSide =
                        row.side != null && row.side === selectedDisplayLean?.side
                      const widthPct =
                        maxLadderNotional > 0 ? Math.max((row.notional / maxLadderNotional) * 100, 3) : 0
                      return (
                        <div key={row.id} className="grid grid-cols-[148px_minmax(0,1fr)_84px] items-center gap-2">
                          <div className="flex items-center gap-1">
                            <div className="flex items-center gap-0.5">
                              {row.sources.slice(0, 3).map((source) => {
                                const logo = SOURCE_LOGOS[source]
                                return (
                                  <span
                                    key={`${row.id}:${source}`}
                                    className="flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-white/15 bg-black/40"
                                    title={logo.label}
                                  >
                                    <Image
                                      src={logo.src}
                                      alt={logo.label}
                                      width={26}
                                      height={26}
                                      className="h-full w-full object-contain"
                                      unoptimized
                                    />
                                  </span>
                                )
                              })}
                              {row.sources.length > 3 && (
                                <span className="text-[10px] text-white/55">+{row.sources.length - 3}</span>
                              )}
                            </div>
                            <div
                              className={`text-sm font-semibold ${
                                isHotSide ? "text-lime-300" : "text-slate-200/70"
                              }`}
                            >
                              {formatAmericanOdds(row.odds)}
                            </div>
                          </div>
                          <div className="h-6 overflow-hidden rounded-md border border-white/10 bg-black/35">
                            <div
                              className={`h-full ${
                                isHotSide
                                  ? "bg-gradient-to-r from-lime-500/70 to-lime-400"
                                  : "bg-slate-500/45"
                              }`}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                          <div className="text-right text-xs text-white/70">
                            {formatCompactCurrency(row.notional)}
                          </div>
                        </div>
                      )
                    })}

                    {ladderRows.length === 0 && (
                      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-4 text-sm text-white/55">
                        No actionable resting levels were found for the recommended side.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/45 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                    Current Odds (Snapshot)
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {selectedSharpBookOdds.map((book) => {
                      const logo = SHARP_BOOK_LOGOS[book.key]
                      return (
                        <div
                          key={`${selectedItem.id}:sharp-book:${book.key}`}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-black/50 px-2.5 py-2"
                        >
                          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-white/15 bg-black/40">
                            {logo.src ? (
                              <Image
                                src={logo.src}
                                alt={logo.label}
                                width={26}
                                height={26}
                                className="h-full w-full object-contain"
                                unoptimized
                              />
                            ) : (
                              <span className="text-[9px] font-semibold text-white/65">
                                {logo.label.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-lime-300">
                            {formatAmericanOdds(book.odds)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[10px] text-white/35">
                    Snapshot data only. No live request-time odds are fetched.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
