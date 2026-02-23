export type TeamMarketKey = "spreads" | "totals" | "h2h"

export type TeamMarketOrderbookLevel = {
  priceCents: number
  notional: number
}

export type TeamMarketOrderbookSide = {
  key: "yes" | "no"
  outcomeLabel: string
  levels: TeamMarketOrderbookLevel[]
  totalNotional: number
  wallPriceCents: number | null
  wallNotional: number | null
  wallAmericanOdds: number | null
  sharpLinePriceCents: number | null
  sharpLineAmericanOdds: number | null
}

export type TeamMarketOrderbookItem = {
  id: string
  source: "kalshi"
  sportKey: string
  sportLabel: string
  marketKey: TeamMarketKey
  marketTitle: string
  matchup: string
  homeTeam: string | null
  awayTeam: string | null
  line: number | null
  eventDate?: string
  ticker?: string
  sides: TeamMarketOrderbookSide[]
  sharpLiquiditySide: "yes" | "no" | null
  sharpLiquidityOutcomeLabel: string | null
  sharpLiquidityNotional: number | null
  sharpOrderAmericanOdds: number | null
  sharpLeanSide: "yes" | "no" | null
  sharpLeanOutcomeLabel: string | null
  sharpLeanAmericanOdds: number | null
  updatedAt: string
}

export type TeamMarketOrderbooksSnapshot = {
  updatedAt: string
  items: TeamMarketOrderbookItem[]
}

