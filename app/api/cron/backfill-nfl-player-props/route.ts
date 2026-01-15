import { NextRequest, NextResponse } from "next/server"
import { ingestWhaleTradeHistory } from "@/lib/services/whale-trade-history"
import { analyzeSharpPlayerProps } from "@/lib/services/sharp-player-prop-analyzer"

export const dynamic = "force-dynamic"

const EASTERN_TIMEZONE = "America/New_York"

const BACKFILL_WINDOW = {
  start: "2026-01-16",
  end: "2026-01-18",
}

const getEasternDateParts = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

const isWithinBackfillWindow = (dateKey: string) =>
  dateKey >= BACKFILL_WINDOW.start && dateKey <= BACKFILL_WINDOW.end

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    const dateKey = getEasternDateParts(now)
    if (!dateKey || !isWithinBackfillWindow(dateKey)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Outside backfill window.",
        dateKey,
        window: BACKFILL_WINDOW,
      })
    }

    const ingestResult = await ingestWhaleTradeHistory({
      sportKey: "americanfootball_nfl",
      minNotional: 1000,
      limit: 1200,
    })

    const analysis = await analyzeSharpPlayerProps({
      sportKey: "americanfootball_nfl",
      minNotional: 1000,
      limit: 150,
      topPicksCount: 8,
    })

    const propsWithOdds = analysis.props.filter(
      (prop) => prop.sportsbookAvgProbability != null
    )
    const volumeProps = propsWithOdds.filter(
      (prop) => prop.betCount >= 2 || prop.totalNotional >= 5000
    )

    return NextResponse.json({
      ok: true,
      dateKey,
      window: BACKFILL_WINDOW,
      ingested: ingestResult,
      summary: {
        totalTrades: analysis.totalTrades,
        props: analysis.props.length,
        propsWithOdds: propsWithOdds.length,
        volumeProps: volumeProps.length,
      },
      topPicks: analysis.topPicks.slice(0, 5),
    })
  } catch (error: any) {
    console.error("[cron/backfill-nfl-player-props] error:", error)
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
