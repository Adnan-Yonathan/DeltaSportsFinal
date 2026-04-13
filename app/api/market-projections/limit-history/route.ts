import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const MARKETS = new Set(["spread", "total", "moneyline"])
const SIDES = new Set(["home", "away", "over", "under"])

const normalizeMarket = (
  value: string | null
): "spread" | "total" | "moneyline" | null => {
  const normalized = String(value || "").trim().toLowerCase()
  if (!MARKETS.has(normalized)) return null
  return normalized as "spread" | "total" | "moneyline"
}

const resolveHours = (value: string | null) => {
  const parsed = Number(value ?? "96")
  if (!Number.isFinite(parsed)) return 96
  return Math.min(Math.max(parsed, 1), 336)
}

const resolveLimit = (value: string | null) => {
  const parsed = Number(value ?? "500")
  if (!Number.isFinite(parsed)) return 500
  return Math.min(Math.max(parsed, 10), 2000)
}

const parseNumeric = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const normalizeSide = (value: string | null): "home" | "away" | "over" | "under" => {
  const normalized = String(value || "").trim().toLowerCase()
  return SIDES.has(normalized)
    ? (normalized as "home" | "away" | "over" | "under")
    : "home"
}

const americanToImpliedProbability = (odds: number | null) => {
  if (odds == null || !Number.isFinite(odds) || odds === 0) return null
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
}

const resolvePinnacleLineAndOdds = (
  row: any,
  market: "spread" | "total" | "moneyline",
  side: "home" | "away" | "over" | "under"
) => {
  if (market === "spread") {
    const line = side === "away" ? parseNumeric(row.spread_away) : parseNumeric(row.spread_home)
    const odds =
      side === "away"
        ? parseNumeric(row.spread_away_odds)
        : parseNumeric(row.spread_home_odds)
    return { line, odds }
  }

  if (market === "total") {
    const line = parseNumeric(row.total_line)
    const odds =
      side === "under"
        ? parseNumeric(row.total_under_odds)
        : parseNumeric(row.total_over_odds)
    return { line, odds }
  }

  const odds = side === "away" ? parseNumeric(row.moneyline_away) : parseNumeric(row.moneyline_home)
  return { line: odds, odds }
}

const sanitizeTeamText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const normalizeTeamKey = (value: string) => sanitizeTeamText(value).replace(/\s+/g, "")

const teamTokens = (value: string) =>
  sanitizeTeamText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)

const teamNameScore = (queryTeam: string, candidateTeam: string) => {
  if (!queryTeam || !candidateTeam) return 0
  const queryKey = normalizeTeamKey(queryTeam)
  const candidateKey = normalizeTeamKey(candidateTeam)
  if (!queryKey || !candidateKey) return 0
  if (queryKey === candidateKey) return 8
  if (queryKey.length >= 6 && candidateKey.includes(queryKey)) return 6
  if (candidateKey.length >= 6 && queryKey.includes(candidateKey)) return 6

  const querySet = new Set(teamTokens(queryTeam))
  const candidateSet = new Set(teamTokens(candidateTeam))
  if (!querySet.size || !candidateSet.size) return 0
  let overlap = 0
  for (const token of querySet) {
    if (candidateSet.has(token)) overlap += 1
  }
  if (overlap >= 2) return 5
  if (overlap === 1) return 2
  return 0
}

const pickBestTeamMatchedRows = ({
  rows,
  homeTeam,
  awayTeam,
  oddsApiId,
  commenceTime,
}: {
  rows: any[]
  homeTeam: string
  awayTeam: string
  oddsApiId: string
  commenceTime: string
}) => {
  if (!rows.length) return [] as any[]

  const targetCommenceMs = Date.parse(commenceTime)
  const groups = new Map<string, { rows: any[]; score: number }>()

  for (const row of rows) {
    const rowHome = String(row?.home_team || "")
    const rowAway = String(row?.away_team || "")

    const directScore = teamNameScore(homeTeam, rowHome) + teamNameScore(awayTeam, rowAway)
    const flippedScore = teamNameScore(homeTeam, rowAway) + teamNameScore(awayTeam, rowHome)
    const teamScore = Math.max(directScore, flippedScore)
    if (teamScore <= 0) continue

    let score = teamScore * 10
    const rowOddsApiId = String(row?.odds_api_id || "")
    if (oddsApiId && rowOddsApiId && rowOddsApiId === oddsApiId) score += 120

    const rowGameMs = Date.parse(String(row?.game_time || ""))
    if (Number.isFinite(targetCommenceMs) && Number.isFinite(rowGameMs)) {
      const hourDiff = Math.abs(rowGameMs - targetCommenceMs) / (1000 * 60 * 60)
      score += Math.max(0, 30 - hourDiff)
    }

    const key = rowOddsApiId
      ? `id:${rowOddsApiId}`
      : `teams:${normalizeTeamKey(rowHome)}@${normalizeTeamKey(rowAway)}:${String(row?.game_time || "").slice(0, 10)}`
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, { rows: [row], score })
      continue
    }
    existing.rows.push(row)
    existing.score = Math.max(existing.score, score)
  }

  if (!groups.size) return [] as any[]

  const bestGroup = Array.from(groups.values()).sort((a, b) => b.score - a.score)[0]
  return bestGroup.rows
}

type PinnaclePoint = { t: string; line: number | null; odds: number | null }

const buildHourlySeries = (points: PinnaclePoint[]) => {
  if (!points.length) return [] as Array<{ t: string; line: number | null; odds: number | null }>

  const sorted = points
    .filter((point) => point.line != null || point.odds != null)
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t))
  if (!sorted.length) return [] as Array<{ t: string; line: number | null; odds: number | null }>

  const toHourStart = (iso: string) => {
    const ms = Date.parse(iso)
    if (!Number.isFinite(ms)) return Number.NaN
    const d = new Date(ms)
    d.setMinutes(0, 0, 0)
    return d.getTime()
  }

  const firstHour = toHourStart(sorted[0].t)
  const lastHour = toHourStart(sorted[sorted.length - 1].t)
  if (!Number.isFinite(firstHour) || !Number.isFinite(lastHour)) {
    return sorted.map((point) => ({ t: point.t, line: point.line, odds: point.odds }))
  }

  const hourly: Array<{ t: string; line: number | null; odds: number | null }> = []
  let cursor = 0
  let latest: PinnaclePoint | null = null
  for (let hourMs = firstHour; hourMs <= lastHour; hourMs += 60 * 60 * 1000) {
    const hourEnd = hourMs + 60 * 60 * 1000 - 1
    while (cursor < sorted.length && Date.parse(sorted[cursor].t) <= hourEnd) {
      latest = sorted[cursor]
      cursor += 1
    }
    if (!latest) continue
    hourly.push({
      t: new Date(hourMs).toISOString(),
      line: latest.line,
      odds: latest.odds,
    })
  }
  return hourly
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = (searchParams.get("sport") || "").trim()
    const market = normalizeMarket(searchParams.get("market"))
    const oddsApiId = (searchParams.get("oddsApiId") || "").trim()
    const homeTeam = (searchParams.get("homeTeam") || "").trim()
    const awayTeam = (searchParams.get("awayTeam") || "").trim()
    const commenceTime = (searchParams.get("commenceTime") || "").trim()
    const side = normalizeSide(searchParams.get("side"))
    const hours = resolveHours(searchParams.get("hours"))
    const limit = resolveLimit(searchParams.get("limit"))

    if (!market) {
      return NextResponse.json({ error: "Invalid market." }, { status: 400 })
    }
    if (!oddsApiId && (!homeTeam || !awayTeam)) {
      return NextResponse.json(
        { error: "Missing game identifier. Provide oddsApiId or homeTeam/awayTeam." },
        { status: 400 }
      )
    }

    const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const supabase = createServiceClient()

    const buildHistoryQuery = ({
      useOddsApiId,
      withSport,
    }: {
      useOddsApiId: boolean
      withSport: boolean
    }) => {
      let query = supabase
        .from("market_limit_history" as any)
        .select(
          "recorded_at,limit_pressure_score,limit_pressure_label,for_limit,against_limit,net_limit,sample_count,projection_side"
        )
        .eq("market_type", market)
        .gte("recorded_at", sinceIso)
        .order("recorded_at", { ascending: true })
        .limit(limit)

      if (withSport && sport) query = query.eq("sport", sport)

      if (useOddsApiId && oddsApiId) {
        query = query.eq("odds_api_id", oddsApiId)
      } else {
        query = query.eq("home_team", homeTeam).eq("away_team", awayTeam)
        if (commenceTime) {
          const parsed = Date.parse(commenceTime)
          if (Number.isFinite(parsed)) {
            const start = new Date(parsed - 24 * 60 * 60 * 1000).toISOString()
            const end = new Date(parsed + 24 * 60 * 60 * 1000).toISOString()
            query = query.gte("commence_time", start).lte("commence_time", end)
          }
        }
      }
      return query
    }

    let historyData: any[] | null = null
    let historyError: any = null
    const historyAttempts: Array<{ useOddsApiId: boolean; withSport: boolean }> = []

    if (oddsApiId) {
      historyAttempts.push({ useOddsApiId: true, withSport: true })
      historyAttempts.push({ useOddsApiId: true, withSport: false })
    }
    if (homeTeam && awayTeam) {
      historyAttempts.push({ useOddsApiId: false, withSport: true })
      historyAttempts.push({ useOddsApiId: false, withSport: false })
    }

    const dedupedHistoryAttempts = historyAttempts.filter(
      (attempt, index, list) =>
        list.findIndex(
          (candidate) =>
            candidate.useOddsApiId === attempt.useOddsApiId &&
            candidate.withSport === attempt.withSport
        ) === index
    )

    for (const attempt of dedupedHistoryAttempts) {
      const { data, error } = (await buildHistoryQuery(attempt)) as unknown as {
        data: any[] | null
        error: any
      }
      if (error) {
        historyError = error
        continue
      }
      historyData = data ?? []
      historyError = null
      if ((historyData?.length ?? 0) > 0) break
    }

    const data = historyData ?? []
    const error = historyError
    if (error) {
      console.error("[limit-history] query failed", error)
      return NextResponse.json({
        ok: true,
        market,
        count: 0,
        points: [],
        unavailable: true,
      })
    }

    const buildLinesQuery = ({
      useOddsApiId,
      withSport,
    }: {
      useOddsApiId: boolean
      withSport: boolean
    }) => {
      let query = supabase
        .from("lines" as any)
        .select(
          "recorded_at,spread_home,spread_away,spread_home_odds,spread_away_odds,total_line,total_over_odds,total_under_odds,moneyline_home,moneyline_away,game_time,home_team,away_team,odds_api_id,sport"
        )
        .eq("market_type", market)
        .ilike("bookmaker", "%pinnacle%")
        .gte("recorded_at", sinceIso)
        .order("recorded_at", { ascending: true })
        .limit(Math.min(4000, limit * 12))

      if (withSport && sport && sport !== "all") query = query.eq("sport", sport)

      if (useOddsApiId && oddsApiId) {
        query = query.eq("odds_api_id", oddsApiId)
      } else {
        query = query.eq("home_team", homeTeam).eq("away_team", awayTeam)
        if (commenceTime) {
          const parsed = Date.parse(commenceTime)
          if (Number.isFinite(parsed)) {
            const start = new Date(parsed - 24 * 60 * 60 * 1000).toISOString()
            const end = new Date(parsed + 24 * 60 * 60 * 1000).toISOString()
            query = query.gte("game_time", start).lte("game_time", end)
          }
        }
      }
      return query
    }

    let lineRows: any[] | null = null
    let lineError: any = null
    const lineAttempts: Array<{ useOddsApiId: boolean; withSport: boolean }> = []
    if (oddsApiId) {
      lineAttempts.push({ useOddsApiId: true, withSport: true })
      lineAttempts.push({ useOddsApiId: true, withSport: false })
    }
    if (homeTeam && awayTeam) {
      lineAttempts.push({ useOddsApiId: false, withSport: true })
      lineAttempts.push({ useOddsApiId: false, withSport: false })
    }
    const dedupedLineAttempts = lineAttempts.filter(
      (attempt, index, list) =>
        list.findIndex(
          (candidate) =>
            candidate.useOddsApiId === attempt.useOddsApiId &&
            candidate.withSport === attempt.withSport
        ) === index
    )

    for (const attempt of dedupedLineAttempts) {
      const { data: rows, error } = (await buildLinesQuery(attempt)) as unknown as {
        data: any[] | null
        error: any
      }
      if (error) {
        lineError = error
        continue
      }
      lineRows = rows ?? []
      lineError = null
      if ((lineRows?.length ?? 0) > 0) break
    }

    if ((!lineRows || lineRows.length === 0) && (homeTeam || awayTeam || oddsApiId)) {
      let broadQuery = supabase
        .from("lines" as any)
        .select(
          "recorded_at,spread_home,spread_away,spread_home_odds,spread_away_odds,total_line,total_over_odds,total_under_odds,moneyline_home,moneyline_away,game_time,home_team,away_team,odds_api_id,sport"
        )
        .eq("market_type", market)
        .ilike("bookmaker", "%pinnacle%")
        .gte("recorded_at", sinceIso)
        .order("recorded_at", { ascending: true })
        .limit(Math.min(12000, limit * 40))

      if (sport && sport !== "all") broadQuery = broadQuery.eq("sport", sport)
      if (commenceTime) {
        const parsed = Date.parse(commenceTime)
        if (Number.isFinite(parsed)) {
          const start = new Date(parsed - 48 * 60 * 60 * 1000).toISOString()
          const end = new Date(parsed + 48 * 60 * 60 * 1000).toISOString()
          broadQuery = broadQuery.gte("game_time", start).lte("game_time", end)
        }
      }

      const { data: broadRows, error: broadError } = (await broadQuery) as unknown as {
        data: any[] | null
        error: any
      }
      if (broadError) {
        console.warn("[limit-history] broad pinnacle query failed", broadError)
      } else {
        const candidates = broadRows ?? []
        const byOddsId =
          oddsApiId.length > 0
            ? candidates.filter((row) => String(row?.odds_api_id || "") === oddsApiId)
            : []
        lineRows =
          byOddsId.length > 0
            ? byOddsId
            : pickBestTeamMatchedRows({
                rows: candidates,
                homeTeam,
                awayTeam,
                oddsApiId,
                commenceTime,
              })
        lineError = null
      }
    }

    if (lineError) {
      console.warn("[limit-history] pinnacle line fallback query failed", lineError)
    }

    const pinnaclePoints = (lineRows ?? [])
      .map((row) => {
        const t = typeof row?.recorded_at === "string" ? row.recorded_at : ""
        if (!t) return null
        const { line, odds } = resolvePinnacleLineAndOdds(row, market, side)
        if (line == null && odds == null) return null
        return { t, line, odds }
      })
      .filter((row): row is { t: string; line: number | null; odds: number | null } => Boolean(row))

    const closestPinnacleByTime = (isoTime: string) => {
      if (!pinnaclePoints.length) return { line: null as number | null, odds: null as number | null }
      const targetMs = Date.parse(isoTime)
      if (!Number.isFinite(targetMs)) return { line: null as number | null, odds: null as number | null }

      let best = pinnaclePoints[0]
      let bestDiff = Math.abs(Date.parse(best.t) - targetMs)
      for (let i = 1; i < pinnaclePoints.length; i += 1) {
        const candidate = pinnaclePoints[i]
        const diff = Math.abs(Date.parse(candidate.t) - targetMs)
        if (diff < bestDiff) {
          best = candidate
          bestDiff = diff
        }
      }
      return { line: best.line, odds: best.odds }
    }

    let points = (data ?? []).map((row) => {
      const t = typeof row.recorded_at === "string" ? row.recorded_at : ""
      const nearest = t ? closestPinnacleByTime(t) : { line: null as number | null, odds: null as number | null }
      return {
        t,
        score: parseNumeric(row.limit_pressure_score),
        label: typeof row.limit_pressure_label === "string" ? row.limit_pressure_label : null,
        forLimit: parseNumeric(row.for_limit),
        againstLimit: parseNumeric(row.against_limit),
        netLimit: parseNumeric(row.net_limit),
        sampleCount: parseNumeric(row.sample_count),
        projectionSide:
          typeof row.projection_side === "string" ? row.projection_side : null,
        line: nearest.line,
        odds: nearest.odds,
      }
    })

    const hasStructuredLimits = points.some(
      (point) =>
        point.forLimit != null ||
        point.againstLimit != null ||
        point.netLimit != null
    )

    if (!points.length && pinnaclePoints.length) {
      const baseProbability = americanToImpliedProbability(pinnaclePoints[0].odds)
      points = pinnaclePoints.map((point) => {
        const implied = americanToImpliedProbability(point.odds)
        const delta = baseProbability != null && implied != null ? implied - baseProbability : 0
        const syntheticNet = Number((delta * 25000).toFixed(2))
        return {
          t: point.t,
          score: Number(delta.toFixed(6)),
          label: syntheticNet > 0 ? "Expansion" : syntheticNet < 0 ? "Contraction" : "Balanced",
          forLimit: syntheticNet > 0 ? syntheticNet : 0,
          againstLimit: syntheticNet < 0 ? Math.abs(syntheticNet) : 0,
          netLimit: syntheticNet,
          sampleCount: null,
          projectionSide: null,
          line: point.line,
          odds: point.odds,
        }
      })
    } else if (!hasStructuredLimits && points.length) {
      const baseProbability = americanToImpliedProbability(
        points.find((entry) => entry.odds != null)?.odds ?? null
      )
      points = points.map((point) => {
        if (point.netLimit != null || point.forLimit != null || point.againstLimit != null) {
          return point
        }
        const implied = americanToImpliedProbability(point.odds)
        const deltaFromOdds =
          baseProbability != null && implied != null ? implied - baseProbability : null
        const fallbackDelta = deltaFromOdds ?? point.score ?? 0
        const syntheticNet = Number((fallbackDelta * 25000).toFixed(2))
        return {
          ...point,
          score: point.score ?? (deltaFromOdds != null ? Number(deltaFromOdds.toFixed(6)) : 0),
          label:
            point.label ??
            (syntheticNet > 0
              ? "Expansion"
              : syntheticNet < 0
                ? "Contraction"
                : "Balanced"),
          forLimit: syntheticNet > 0 ? syntheticNet : 0,
          againstLimit: syntheticNet < 0 ? Math.abs(syntheticNet) : 0,
          netLimit: syntheticNet,
        }
      })
    }

    points = points
      .filter((point) => point.t)
      .sort((a, b) => Date.parse(a.t) - Date.parse(b.t))

    const lineSeries = pinnaclePoints
      .filter((point) => point.line != null)
      .map((point) => ({ t: point.t, line: point.line }))
    const oddsSeries = pinnaclePoints
      .filter((point) => point.odds != null)
      .map((point) => ({ t: point.t, odds: point.odds }))
    const hourlySeries = buildHourlySeries(pinnaclePoints)
    const limitSeries = points.map((point) => ({
      t: point.t,
      forLimit: point.forLimit,
      againstLimit: point.againstLimit,
      netLimit: point.netLimit,
    }))

    const priceLevelMap = new Map<
      string,
      {
        line: number | null
        odds: number | null
        maxForLimit: number | null
        maxAgainstLimit: number | null
        maxAbsNetLimit: number | null
        latestForLimit: number | null
        latestAgainstLimit: number | null
        latestNetLimit: number | null
        lastSeen: string
        samples: number
      }
    >()

    for (const point of points) {
      const hasPrice = point.line != null || point.odds != null
      const hasLimit =
        point.forLimit != null || point.againstLimit != null || point.netLimit != null
      if (!hasPrice || !hasLimit) continue

      const lineKey = point.line == null ? "na" : String(point.line)
      const oddsKey = point.odds == null ? "na" : String(point.odds)
      const key = `${lineKey}|${oddsKey}`

      const existing = priceLevelMap.get(key)
      if (!existing) {
        priceLevelMap.set(key, {
          line: point.line ?? null,
          odds: point.odds ?? null,
          maxForLimit: point.forLimit ?? null,
          maxAgainstLimit: point.againstLimit ?? null,
          maxAbsNetLimit:
            point.netLimit != null ? Math.abs(point.netLimit) : null,
          latestForLimit: point.forLimit ?? null,
          latestAgainstLimit: point.againstLimit ?? null,
          latestNetLimit: point.netLimit ?? null,
          lastSeen: point.t,
          samples: 1,
        })
        continue
      }

      existing.maxForLimit =
        existing.maxForLimit == null
          ? (point.forLimit ?? null)
          : Math.max(existing.maxForLimit, point.forLimit ?? existing.maxForLimit)
      existing.maxAgainstLimit =
        existing.maxAgainstLimit == null
          ? (point.againstLimit ?? null)
          : Math.max(
              existing.maxAgainstLimit,
              point.againstLimit ?? existing.maxAgainstLimit
            )

      const absNet = point.netLimit != null ? Math.abs(point.netLimit) : null
      existing.maxAbsNetLimit =
        existing.maxAbsNetLimit == null
          ? absNet
          : Math.max(existing.maxAbsNetLimit, absNet ?? existing.maxAbsNetLimit)

      if (Date.parse(point.t) >= Date.parse(existing.lastSeen)) {
        existing.latestForLimit = point.forLimit ?? null
        existing.latestAgainstLimit = point.againstLimit ?? null
        existing.latestNetLimit = point.netLimit ?? null
        existing.lastSeen = point.t
      }
      existing.samples += 1
    }

    const priceLevels = Array.from(priceLevelMap.values()).sort((a, b) => {
      const aNet = Math.abs(a.latestNetLimit ?? 0)
      const bNet = Math.abs(b.latestNetLimit ?? 0)
      if (bNet !== aNet) return bNet - aNet
      const aDepth = Math.max(a.maxForLimit ?? 0, a.maxAgainstLimit ?? 0)
      const bDepth = Math.max(b.maxForLimit ?? 0, b.maxAgainstLimit ?? 0)
      return bDepth - aDepth
    })

    return NextResponse.json({
      ok: true,
      market,
      side,
      count: points.length,
      points,
      lineSeries,
      oddsSeries,
      hourlySeries,
      limitSeries,
      priceLevels,
      source: "pinnacle",
    })
  } catch (error) {
    console.error("[limit-history] unexpected error", error)
    return NextResponse.json({
      ok: true,
      count: 0,
      points: [],
      unavailable: true,
    })
  }
}
