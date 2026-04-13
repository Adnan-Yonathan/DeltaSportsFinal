import { createServiceClient } from "@/lib/supabase/service"

type MarketType = "spread" | "total" | "moneyline"

type SnapshotInput = {
  sport: string
  edges?: any[]
  recordedAt?: string
}

const MARKETS: MarketType[] = ["spread", "total", "moneyline"]
const SHARP_BOOK_KEYS = ["pinnacle", "circa", "novig", "prophetx"] as const

const coerceFinite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null

const toIsoOrNull = (value: unknown) => {
  if (typeof value !== "string" || !value) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

const collectLimitPairsForMarket = (edge: any, market: MarketType) => {
  const quotes = edge?.[market]?.bookQuotes
  if (!quotes || typeof quotes !== "object") return [] as Array<{ high: number; low: number }>

  const pairs: Array<{ high: number; low: number }> = []

  for (const book of SHARP_BOOK_KEYS) {
    const quote = quotes?.[book]
    if (!quote || typeof quote !== "object") continue

    if (market === "spread" || market === "moneyline") {
      const homeLimit = coerceFinite(quote.homeLimit)
      const awayLimit = coerceFinite(quote.awayLimit)
      if (homeLimit == null || awayLimit == null) continue
      pairs.push({ high: Math.max(homeLimit, awayLimit), low: Math.min(homeLimit, awayLimit) })
      continue
    }

    const overLimit = coerceFinite(quote.overLimit)
    const underLimit = coerceFinite(quote.underLimit)
    if (overLimit == null || underLimit == null) continue
    pairs.push({ high: Math.max(overLimit, underLimit), low: Math.min(overLimit, underLimit) })
  }

  return pairs
}

const aggregateLimitsForMarket = (edge: any, market: MarketType) => {
  const pairs = collectLimitPairsForMarket(edge, market)
  if (!pairs.length) {
    return {
      forLimit: null as number | null,
      againstLimit: null as number | null,
      sampleCount: 0,
    }
  }

  const forLimit = pairs.reduce((sum, pair) => sum + pair.high, 0)
  const againstLimit = pairs.reduce((sum, pair) => sum + pair.low, 0)

  return {
    forLimit,
    againstLimit,
    sampleCount: pairs.length,
  }
}

const resolveLimitLabel = (score: number | null) => {
  if (score == null) return null
  if (score >= 0.2) return "Expansion"
  if (score <= -0.2) return "Contraction"
  return "Balanced"
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
      const { forLimit, againstLimit, sampleCount } = aggregateLimitsForMarket(edge, market)
      if (forLimit == null || againstLimit == null || sampleCount <= 0) continue

      const netLimit = forLimit - againstLimit
      const totalLimit = forLimit + againstLimit
      const score = totalLimit > 0 ? Number((netLimit / totalLimit).toFixed(6)) : null
      const label = resolveLimitLabel(score)

      rows.push({
        sport,
        odds_api_id: typeof edge.oddsApiId === "string" ? edge.oddsApiId : null,
        home_team: homeTeam,
        away_team: awayTeam,
        commence_time: commenceTime,
        market_type: market,
        projection_side: null,
        limit_pressure_score: score,
        limit_pressure_label: label,
        for_limit: forLimit,
        against_limit: againstLimit,
        net_limit: netLimit,
        sample_count: sampleCount,
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
