import { NextRequest, NextResponse } from "next/server"

import { getPlayerSeasonStats, searchPlayer, type PlayerStats } from "@/lib/sports-stats-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PlayerIntelRequest = {
  name: string
  propType?: string | null
  propLine?: number | null
}

type PlayerIntelPayload = {
  playerName: string
  team: string | null
  position: string | null
  season: string | null
  headshotUrl: string | null
  stats: Array<{ label: string; value: string }>
  trend: {
    metric: string
    average: string
    sampleSize: number
    hitRateLabel: string | null
  } | null
  insights: string[]
}

const CACHE_TTL_MS = 10 * 60 * 1000
const MAX_PLAYERS = 120

const intelCache = new Map<string, { expiresAt: number; payload: PlayerIntelPayload | null }>()

const normalizeName = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")

const normalizeToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()

const normalizeStatKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim()

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/%/g, "")
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race<T | null>([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const formatNumber = (value: number, decimals = 1) => {
  if (!Number.isFinite(value)) return "--"
  const rounded = Number(value.toFixed(decimals))
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals)
}

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
) => {
  if (!items.length) return [] as R[]
  const safeConcurrency = Math.max(1, Math.floor(concurrency))
  const results = new Array<R>(items.length)
  let cursor = 0

  const runWorker = async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) break
      results[index] = await worker(items[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(safeConcurrency, items.length) }, () => runWorker())
  )
  return results
}

const METRIC_ALIASES: Record<string, { label: string; aliases: string[] }> = {
  points: { label: "Points", aliases: ["ppg", "pts", "points", "pointspergame"] },
  rebounds: { label: "Rebounds", aliases: ["rpg", "reb", "trb", "rebounds"] },
  assists: { label: "Assists", aliases: ["apg", "ast", "assists"] },
  threes: { label: "3PM", aliases: ["3pm", "threepm", "threepmpergame", "threepmade"] },
  blocks: { label: "Blocks", aliases: ["blk", "bpg", "blocks"] },
  steals: { label: "Steals", aliases: ["stl", "spg", "steals"] },
  turnovers: { label: "Turnovers", aliases: ["tov", "turnovers"] },
  passing_yards: { label: "Pass Yds", aliases: ["passingyards", "passyds", "passyards"] },
  rushing_yards: { label: "Rush Yds", aliases: ["rushingyards", "rushyds", "rushyards"] },
  receiving_yards: { label: "Rec Yds", aliases: ["receivingyards", "recyds", "recyards"] },
  receptions: { label: "Receptions", aliases: ["receptions", "rec"] },
  passing_tds: { label: "Pass TD", aliases: ["passingtds", "passingtouchdowns", "passtds"] },
  rushing_tds: { label: "Rush TD", aliases: ["rushingtds", "rushingtouchdowns", "rushtds"] },
  goals: { label: "Goals", aliases: ["goals"] },
  shots: { label: "Shots", aliases: ["shots", "shotsongoal", "sog"] },
  saves: { label: "Saves", aliases: ["saves"] },
  strikeouts: { label: "Strikeouts", aliases: ["strikeouts", "k", "ks"] },
}

const SPORT_STAT_PRIORITY: Record<string, Array<{ label: string; aliases: string[] }>> = {
  basketball_nba: [
    { label: "PPG", aliases: ["ppg", "pts", "points"] },
    { label: "RPG", aliases: ["rpg", "reb", "trb"] },
    { label: "APG", aliases: ["apg", "ast"] },
    { label: "3PM", aliases: ["3pm", "threepm"] },
    { label: "FG%", aliases: ["fgpercent", "fgpct", "fg"] },
    { label: "MPG", aliases: ["mpg", "minutespergame"] },
  ],
  basketball_ncaab: [
    { label: "Points", aliases: ["pts", "points"] },
    { label: "Reb", aliases: ["reb", "trb", "rebounds"] },
    { label: "Ast", aliases: ["ast", "assists"] },
    { label: "Stl", aliases: ["stl", "steals"] },
    { label: "Blk", aliases: ["blk", "blocks"] },
  ],
  americanfootball_nfl: [
    { label: "Pass Yds", aliases: ["passingyards", "passyards"] },
    { label: "Rush Yds", aliases: ["rushingyards", "rushyards"] },
    { label: "Rec Yds", aliases: ["receivingyards", "recyards"] },
    { label: "Receptions", aliases: ["receptions", "rec"] },
    { label: "Pass TD", aliases: ["passingtds", "passtds"] },
    { label: "Rush TD", aliases: ["rushingtds", "rushtds"] },
  ],
  americanfootball_ncaaf: [
    { label: "Pass Yds", aliases: ["passingyards", "passyards"] },
    { label: "Rush Yds", aliases: ["rushingyards", "rushyards"] },
    { label: "Rec Yds", aliases: ["receivingyards", "recyards"] },
    { label: "Receptions", aliases: ["receptions", "rec"] },
    { label: "Pass TD", aliases: ["passingtouchdowns", "passingtds"] },
    { label: "Rush TD", aliases: ["rushingtouchdowns", "rushingtds"] },
  ],
  icehockey_nhl: [
    { label: "Goals", aliases: ["goals"] },
    { label: "Assists", aliases: ["assists"] },
    { label: "Points", aliases: ["points"] },
    { label: "Shots", aliases: ["shots", "shotsongoal"] },
    { label: "+/-", aliases: ["plusminus"] },
  ],
  baseball_mlb: [
    { label: "AVG", aliases: ["avg"] },
    { label: "OPS", aliases: ["ops"] },
    { label: "HR", aliases: ["hr", "homeruns"] },
    { label: "RBI", aliases: ["rbi", "rbis"] },
    { label: "Runs", aliases: ["runs"] },
    { label: "SO", aliases: ["strikeouts", "k", "ks"] },
  ],
}

const getStatByAliases = (
  stats: Record<string, number | string>,
  aliases: string[]
): number | null => {
  const normalized = new Map<string, number>()
  for (const [key, raw] of Object.entries(stats)) {
    const parsed = parseNumber(raw)
    if (parsed == null) continue
    normalized.set(normalizeStatKey(key), parsed)
  }

  for (const alias of aliases) {
    const hit = normalized.get(normalizeStatKey(alias))
    if (hit != null) return hit
  }
  return null
}

const buildStatCards = (sportKey: string, stats: Record<string, number | string>) => {
  const priorities = SPORT_STAT_PRIORITY[sportKey] ?? SPORT_STAT_PRIORITY.basketball_nba
  const cards: Array<{ label: string; value: string }> = []
  for (const item of priorities) {
    const value = getStatByAliases(stats, item.aliases)
    if (value == null) continue
    cards.push({ label: item.label, value: formatNumber(value) })
    if (cards.length >= 6) break
  }
  return cards
}

const resolveMetricConfig = (propType?: string | null) => {
  if (!propType) return null
  return METRIC_ALIASES[propType] ?? null
}

const resolveRecentMetricValues = (
  recent: NonNullable<PlayerStats["recent"]>,
  aliases: string[]
) => {
  const metricKeys = aliases.map((alias) => normalizeStatKey(alias))
  const values: Array<{ date: string; opponent: string; value: number }> = []

  for (const game of recent) {
    if (!game?.stats || typeof game.stats !== "object") continue
    let matched: number | null = null
    for (const [key, raw] of Object.entries(game.stats)) {
      if (!metricKeys.includes(normalizeStatKey(key))) continue
      const parsed = parseNumber(raw)
      if (parsed == null) continue
      matched = parsed
      break
    }
    if (matched == null) continue
    values.push({
      date: game.date || "",
      opponent: game.opponent || "",
      value: matched,
    })
  }
  return values
}

const buildInsights = (params: {
  metricLabel: string | null
  seasonValue: number | null
  recentAverage: number | null
  propLine: number | null
  hitRate: number | null
  sampleSize: number
}) => {
  const { metricLabel, seasonValue, recentAverage, propLine, hitRate, sampleSize } = params
  const insights: string[] = []

  if (metricLabel && recentAverage != null && sampleSize > 0) {
    insights.push(
      `Recent form: ${formatNumber(recentAverage)} ${metricLabel.toLowerCase()} average across last ${sampleSize} games.`
    )
  }

  if (propLine != null && hitRate != null) {
    insights.push(
      `Cleared ${propLine} in ${Math.round(hitRate)}% of sampled games.`
    )
  }

  if (seasonValue != null && recentAverage != null) {
    const diff = recentAverage - seasonValue
    if (Math.abs(diff) >= 0.75) {
      insights.push(
        `Trend vs season: ${diff > 0 ? "+" : ""}${formatNumber(diff)} ${metricLabel?.toLowerCase() || "units"} from season baseline.`
      )
    }
  }

  if (insights.length === 0) {
    insights.push("No strong recent signal yet; monitor updates as more games settle.")
  }
  return insights.slice(0, 4)
}

const buildPayloadForPlayer = async (
  sportKey: string,
  request: PlayerIntelRequest
): Promise<PlayerIntelPayload | null> => {
  try {
    const playerName = normalizeName(request.name)
    if (!playerName) return null

    const fallbackSearch = await withTimeout(searchPlayer(playerName, sportKey), 1500)
    const statsPayload =
      (await withTimeout(getPlayerSeasonStats(playerName, sportKey), 2500)) ?? null

    if (!statsPayload && !fallbackSearch) return null

    const stats = (statsPayload?.stats ?? {}) as Record<string, number | string>
    const metricConfig = resolveMetricConfig(request.propType)
    const seasonMetricValue = metricConfig ? getStatByAliases(stats, metricConfig.aliases) : null

    const statCards = buildStatCards(sportKey, stats)
    const recentValues =
      metricConfig && statsPayload?.recent?.length
        ? resolveRecentMetricValues(statsPayload.recent, metricConfig.aliases)
        : []
    const sampleSize = recentValues.length
    const recentAverage =
      sampleSize > 0
        ? recentValues.reduce((sum, game) => sum + game.value, 0) / sampleSize
        : null
    const propLine = Number.isFinite(request.propLine as number) ? Number(request.propLine) : null
    const hitRate =
      propLine != null && sampleSize > 0
        ? (recentValues.filter((game) => game.value >= propLine).length / sampleSize) * 100
        : null

    return {
      playerName,
      team: statsPayload?.team ?? fallbackSearch?.team ?? null,
      position: statsPayload?.position ?? fallbackSearch?.position ?? null,
      season: statsPayload?.season ?? null,
      headshotUrl:
        typeof statsPayload?.headshot === "string" && statsPayload.headshot.trim().length > 0
          ? statsPayload.headshot
          : typeof fallbackSearch?.headshot === "string" && fallbackSearch.headshot.trim().length > 0
            ? fallbackSearch.headshot
            : null,
      stats: statCards,
      trend:
        metricConfig && recentAverage != null
          ? {
              metric: metricConfig.label,
              average: formatNumber(recentAverage),
              sampleSize,
              hitRateLabel:
                propLine != null && hitRate != null
                  ? `${Math.round(hitRate)}% hit rate vs ${propLine}`
                  : null,
            }
          : null,
      insights: buildInsights({
        metricLabel: metricConfig?.label ?? null,
        seasonValue: seasonMetricValue,
        recentAverage,
        propLine,
        hitRate,
        sampleSize,
      }),
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      sportKey?: string
      players?: unknown
    }
    const sportKey = normalizeName(body?.sportKey)
    if (!sportKey) {
      return NextResponse.json({ ok: false, error: "sportKey is required." }, { status: 400 })
    }

    const playersRaw = Array.isArray(body?.players) ? body.players : []
    const players = playersRaw
      .map((value) => {
        if (!value || typeof value !== "object") return null
        const item = value as Partial<PlayerIntelRequest>
        const name = normalizeName(item.name)
        if (!name) return null
        return {
          name,
          propType: normalizeName(item.propType ?? undefined) || null,
          propLine:
            item.propLine != null && Number.isFinite(Number(item.propLine))
              ? Number(item.propLine)
              : null,
        } as PlayerIntelRequest
      })
      .filter((value): value is PlayerIntelRequest => Boolean(value))
      .slice(0, MAX_PLAYERS)

    if (players.length === 0) {
      return NextResponse.json({ ok: true, players: {} })
    }

    const deduped = new Map<string, PlayerIntelRequest>()
    for (const player of players) {
      const key = `${sportKey}:${normalizeToken(player.name)}:${player.propType || ""}:${String(
        player.propLine ?? ""
      )}`
      if (!deduped.has(key)) deduped.set(key, player)
    }

    const now = Date.now()
    const pending: Array<{ cacheKey: string; request: PlayerIntelRequest }> = []
    const resolvedByCacheKey = new Map<string, PlayerIntelPayload | null>()

    for (const [cacheKey, player] of deduped) {
      const cached = intelCache.get(cacheKey)
      if (cached && cached.expiresAt > now) {
        resolvedByCacheKey.set(cacheKey, cached.payload)
      } else {
        pending.push({ cacheKey, request: player })
      }
    }

    if (pending.length > 0) {
      const loaded = await mapWithConcurrency(pending, 5, async (entry) => {
        const payload = await buildPayloadForPlayer(sportKey, entry.request)
        return { cacheKey: entry.cacheKey, payload }
      })
      loaded.forEach((entry) => {
        resolvedByCacheKey.set(entry.cacheKey, entry.payload)
        intelCache.set(entry.cacheKey, {
          payload: entry.payload,
          expiresAt: Date.now() + CACHE_TTL_MS,
        })
      })
    }

    const responsePlayers: Record<string, PlayerIntelPayload | null> = {}
    for (const player of players) {
      const cacheKey = `${sportKey}:${normalizeToken(player.name)}:${player.propType || ""}:${String(
        player.propLine ?? ""
      )}`
      responsePlayers[player.name] = resolvedByCacheKey.get(cacheKey) ?? null
    }

    return NextResponse.json({
      ok: true,
      players: responsePlayers,
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load player intel." },
      { status: 500 }
    )
  }
}
