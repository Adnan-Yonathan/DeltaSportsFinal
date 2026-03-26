import { createServiceClient } from "@/lib/supabase/service"

type MarketType = "spread" | "total" | "moneyline"

type SnapshotInput = {
  sport: string
  edges?: any[]
  recordedAt?: string
}

const MARKETS: MarketType[] = ["spread", "total", "moneyline"]

const coerceFinite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null

const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

const resolveSideForHomeAwayMarkets = (
  side: string | undefined,
  homeTeam?: string,
  awayTeam?: string
): "home" | "away" | null => {
  const token = normalizeToken(side ?? "")
  if (!token) return null
  if (token.includes("home")) return "home"
  if (token.includes("away")) return "away"
  if (homeTeam && normalizeToken(homeTeam) === token) return "home"
  if (awayTeam && normalizeToken(awayTeam) === token) return "away"
  if (homeTeam && token.includes(normalizeToken(homeTeam))) return "home"
  if (awayTeam && token.includes(normalizeToken(awayTeam))) return "away"
  return null
}

const resolveSideForTotalMarket = (side: string | undefined): "over" | "under" | null => {
  const token = normalizeToken(side ?? "")
  if (!token) return null
  if (token.includes("over")) return "over"
  if (token.includes("under")) return "under"
  return null
}

const aggregateLimitsForMarket = (edge: any, market: MarketType) => {
  const quotes = edge?.[market]?.bookQuotes
  if (!quotes || typeof quotes !== "object") {
    return { forLimit: null as number | null, againstLimit: null as number | null, samples: 0 }
  }

  const projectionSide = edge?.sharpProjections?.[market]?.side as string | undefined
  const homeAwaySide = resolveSideForHomeAwayMarkets(
    projectionSide,
    edge?.homeTeam,
    edge?.awayTeam
  )
  const totalSide = resolveSideForTotalMarket(projectionSide)

  let forLimit = 0
  let againstLimit = 0
  let samples = 0

  for (const quote of Object.values(quotes as Record<string, any>)) {
    if (!quote || typeof quote !== "object") continue

    if (market === "spread" || market === "moneyline") {
      const homeLimit = coerceFinite(quote.homeLimit)
      const awayLimit = coerceFinite(quote.awayLimit)
      if (homeLimit == null || awayLimit == null) continue

      if (homeAwaySide === "home") {
        forLimit += homeLimit
        againstLimit += awayLimit
      } else if (homeAwaySide === "away") {
        forLimit += awayLimit
        againstLimit += homeLimit
      } else {
        const high = Math.max(homeLimit, awayLimit)
        const low = Math.min(homeLimit, awayLimit)
        forLimit += high
        againstLimit += low
      }
      samples += 1
      continue
    }

    const overLimit = coerceFinite(quote.overLimit)
    const underLimit = coerceFinite(quote.underLimit)
    if (overLimit == null || underLimit == null) continue

    if (totalSide === "over") {
      forLimit += overLimit
      againstLimit += underLimit
    } else if (totalSide === "under") {
      forLimit += underLimit
      againstLimit += overLimit
    } else {
      const high = Math.max(overLimit, underLimit)
      const low = Math.min(overLimit, underLimit)
      forLimit += high
      againstLimit += low
    }
    samples += 1
  }

  if (!samples) {
    return { forLimit: null as number | null, againstLimit: null as number | null, samples: 0 }
  }

  return { forLimit, againstLimit, samples }
}

const toIsoOrNull = (value: unknown) => {
  if (typeof value !== "string" || !value) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

export const snapshotMarketLimitHistory = async ({
  sport,
  edges,
  recordedAt,
}: SnapshotInput) => {
  if (!Array.isArray(edges) || edges.length === 0) {
    return { inserted: 0, rows: 0 }
  }

  const snapshotTime = toIsoOrNull(recordedAt) ?? new Date().toISOString()
  const rows: Array<Record<string, unknown>> = []

  for (const edge of edges) {
    if (!edge || typeof edge !== "object") continue
    const homeTeam = typeof edge.homeTeam === "string" ? edge.homeTeam : null
    const awayTeam = typeof edge.awayTeam === "string" ? edge.awayTeam : null
    const commenceTime = toIsoOrNull(edge.commenceTime ?? edge.commence_time)
    if (!homeTeam || !awayTeam) continue

    for (const market of MARKETS) {
      const projection = edge?.sharpProjections?.[market]
      const score = coerceFinite(projection?.limitPressureScore)
      const label =
        typeof projection?.limitPressureLabel === "string" && projection.limitPressureLabel.trim()
          ? projection.limitPressureLabel.trim()
          : null

      const { forLimit, againstLimit, samples } = aggregateLimitsForMarket(edge, market)
      if (score == null && !label && forLimit == null && againstLimit == null) continue

      const netLimit =
        forLimit != null && againstLimit != null ? forLimit - againstLimit : null

      rows.push({
        sport,
        odds_api_id: typeof edge.oddsApiId === "string" ? edge.oddsApiId : null,
        home_team: homeTeam,
        away_team: awayTeam,
        commence_time: commenceTime,
        market_type: market,
        projection_side:
          typeof projection?.side === "string" && projection.side.trim()
            ? projection.side.trim()
            : null,
        limit_pressure_score: score,
        limit_pressure_label: label,
        for_limit: forLimit,
        against_limit: againstLimit,
        net_limit: netLimit,
        sample_count: samples || null,
        recorded_at: snapshotTime,
      })
    }
  }

  if (!rows.length) {
    return { inserted: 0, rows: 0 }
  }

  const supabase = createServiceClient()
  let inserted = 0
  const chunkSize = 500

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = (await supabase
      .from("market_limit_history" as any)
      .insert(chunk as any)) as unknown as { error: any }
    if (error) {
      console.error("[market-limit-history] snapshot insert failed", error)
      continue
    }
    inserted += chunk.length
  }

  return { inserted, rows: rows.length }
}

