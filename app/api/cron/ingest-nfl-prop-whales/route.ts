import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2"

// NFL player prop series
const NFL_PROP_SERIES = [
  { ticker: "KXNFLRSHYDS", propType: "rushing_yards", name: "Rushing Yards" },
  { ticker: "KXNFLRECYDS", propType: "receiving_yards", name: "Receiving Yards" },
  { ticker: "KXNFLPASSYDS", propType: "passing_yards", name: "Passing Yards" },
  { ticker: "KXNFLPASSTDS", propType: "passing_tds", name: "Passing TDs" },
  { ticker: "KXNFLANYTD", propType: "anytime_td", name: "Anytime TD" },
  { ticker: "KXNFLREC", propType: "receptions", name: "Receptions" },
]

const MIN_NOTIONAL = 1000

type KalshiMarket = {
  ticker: string
  title: string
  yes_sub_title?: string
}

type KalshiTrade = {
  trade_id: string
  ticker: string
  count: number
  created_time: string
  taker_side: "yes" | "no"
  yes_price?: number
  no_price?: number
}

const MAX_MARKET_PAGES = 10

const parsePlayerName = (title?: string | null) => {
  if (!title) return null
  const colonMatch = title.match(/^([^:]+):/)
  if (colonMatch?.[1]) return colonMatch[1].trim()
  const recordMatch = title.match(
    /^([A-Za-z\s.'-]+?)(?:\s+(?:records|scores|to score)\b)/i
  )
  if (recordMatch?.[1]) return recordMatch[1].trim()
  return null
}

async function fetchMarkets(seriesTicker: string): Promise<KalshiMarket[]> {
  try {
    const markets: KalshiMarket[] = []
    let cursor: string | null = null

    for (let page = 0; page < MAX_MARKET_PAGES; page += 1) {
      const url = new URL(`${KALSHI_BASE}/markets`)
      url.searchParams.set("series_ticker", seriesTicker)
      url.searchParams.set("limit", "500")
      if (cursor) url.searchParams.set("cursor", cursor)

      const res = await fetch(url.toString(), { cache: "no-store" })
      if (!res.ok) break

      const data = await res.json()
      const batch = data.markets || []
      if (!Array.isArray(batch) || batch.length === 0) break
      markets.push(...batch)

      cursor = data.cursor || null
      if (!cursor) break
    }

    return markets
  } catch {
    return []
  }
}

async function fetchTradesForMarket(ticker: string): Promise<KalshiTrade[]> {
  try {
    const res = await fetch(`${KALSHI_BASE}/markets/trades?ticker=${ticker}&limit=500`, {
      cache: "no-store",
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.trades || []
  } catch {
    return []
  }
}

function parseLineFromTicker(ticker: string): number | null {
  const parts = ticker.split("-")
  if (parts.length < 4) return null
  const line = parseInt(parts[parts.length - 1], 10)
  return isNaN(line) ? null : line
}

function parseEventDateFromTicker(ticker: string): string | null {
  const match = ticker.match(/-(\d{2})([A-Z]{3})(\d{2})/)
  if (!match) return null
  const [, yy, mon, dd] = match
  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04",
    MAY: "05", JUN: "06", JUL: "07", AUG: "08",
    SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  }
  const month = months[mon]
  if (!month) return null
  return `20${yy}-${month}-${dd}`
}

function parseTeamsFromTicker(ticker: string): { home: string; away: string } | null {
  const match = ticker.match(/-\d{2}[A-Z]{3}\d{2}([A-Z]{2,3})([A-Z]{2,3})-/)
  if (!match) return null

  const teamCodes: Record<string, string> = {
    ARI: "Arizona Cardinals", ATL: "Atlanta Falcons", BAL: "Baltimore Ravens",
    BUF: "Buffalo Bills", CAR: "Carolina Panthers", CHI: "Chicago Bears",
    CIN: "Cincinnati Bengals", CLE: "Cleveland Browns", DAL: "Dallas Cowboys",
    DEN: "Denver Broncos", DET: "Detroit Lions", GB: "Green Bay Packers",
    HOU: "Houston Texans", IND: "Indianapolis Colts", JAC: "Jacksonville Jaguars",
    KC: "Kansas City Chiefs", LV: "Las Vegas Raiders", LAC: "Los Angeles Chargers",
    LA: "Los Angeles Rams", MIA: "Miami Dolphins", MIN: "Minnesota Vikings",
    NE: "New England Patriots", NO: "New Orleans Saints", NYG: "New York Giants",
    NYJ: "New York Jets", PHI: "Philadelphia Eagles", PIT: "Pittsburgh Steelers",
    SF: "San Francisco 49ers", SEA: "Seattle Seahawks", TB: "Tampa Bay Buccaneers",
    TEN: "Tennessee Titans", WAS: "Washington Commanders",
  }

  const away = teamCodes[match[1]] || match[1]
  const home = teamCodes[match[2]] || match[2]
  return { away, home }
}

function getMinEventDate(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Cron: NFL Prop Whales] Starting ingestion")

    const supabase = createServiceClient()
    const allRows: Record<string, unknown>[] = []
    const minEventDate = getMinEventDate()
    let totalTrades = 0
    let whaleCount = 0

    for (const series of NFL_PROP_SERIES) {
      const markets = await fetchMarkets(series.ticker)

      // Filter to upcoming games only
      const upcomingMarkets = markets.filter((m) => {
        const eventDate = parseEventDateFromTicker(m.ticker)
        if (!eventDate) return false
        return eventDate >= minEventDate
      })

      for (const market of upcomingMarkets) {
        const trades = await fetchTradesForMarket(market.ticker)
        totalTrades += trades.length

        // Find whale trades
        const whaleTrades = trades.filter((t) => {
          const price = t.taker_side === "yes"
            ? (t.yes_price || 50)
            : (t.no_price || 50)
          const notional = t.count * (price / 100)
          return notional >= MIN_NOTIONAL
        })

        if (whaleTrades.length === 0) continue

        whaleCount += whaleTrades.length

        // Extract player name
        let playerName: string | undefined

        if (series.propType === "anytime_td" && market.yes_sub_title) {
          playerName = market.yes_sub_title.trim()
          if (playerName === "No Touchdown") continue
        }

        if (!playerName) {
          playerName = parsePlayerName(market.title)
        }

        if (!playerName) {
          playerName = "Unknown"
        }

        const propLine = parseLineFromTicker(market.ticker)
        const eventDate = parseEventDateFromTicker(market.ticker)
        const teams = parseTeamsFromTicker(market.ticker)

        for (const trade of whaleTrades) {
          const price = trade.taker_side === "yes"
            ? (trade.yes_price || 50)
            : (trade.no_price || 50)
          const notional = trade.count * (price / 100)

          const side = series.propType === "anytime_td"
            ? (trade.taker_side === "yes" ? "Yes" : "No")
            : (trade.taker_side === "yes" ? "Over" : "Under")

          allRows.push({
            source: "kalshi",
            trade_id: `kalshi:${trade.trade_id}`,
            sport_key: "americanfootball_nfl",
            event_time: eventDate ? `${eventDate}T20:00:00Z` : null,
            event_date: eventDate,
            trade_time: trade.created_time,
            market_type: "player_prop",
            side,
            home_team: teams?.home || null,
            away_team: teams?.away || null,
            matchup_key: teams
              ? `${teams.away.toLowerCase().replace(/\s+/g, "-")}@${teams.home.toLowerCase().replace(/\s+/g, "-")}`
              : null,
            player_name: playerName,
            prop_type: series.propType,
            prop_line: propLine,
            market_title: market.title,
            outcome: market.yes_sub_title || `${playerName}: ${propLine}+`,
            notional,
            contracts: trade.count,
            price_cents: price,
            american_odds: price > 50
              ? Math.round(-100 * price / (100 - price))
              : Math.round(100 * (100 - price) / price),
            is_pregame: true,
          })
        }

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 25))
      }
    }

    if (allRows.length === 0) {
      console.log("[Cron: NFL Prop Whales] No whale trades found")
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        totalTrades,
        whaleCount: 0,
        inserted: 0,
      })
    }

    // Insert in chunks
    const chunkSize = 100
    let inserted = 0

    for (let i = 0; i < allRows.length; i += chunkSize) {
      const chunk = allRows.slice(i, i + chunkSize)
      const { data, error } = await supabase
        .from("whale_trade_history" as any)
        .upsert(chunk as any, { onConflict: "source,trade_id" } as any)
        .select("id")

      if (error) {
        console.error("[Cron: NFL Prop Whales] Insert error:", error.message)
        continue
      }
      inserted += data?.length || 0
    }

    console.log(
      `[Cron: NFL Prop Whales] Done: ${totalTrades} scanned, ${whaleCount} whales, ${inserted} inserted`
    )

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      totalTrades,
      whaleCount,
      inserted,
    })
  } catch (error: any) {
    console.error("[Cron: NFL Prop Whales] Fatal error:", error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
