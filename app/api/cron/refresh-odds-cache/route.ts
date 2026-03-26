import { NextResponse } from "next/server"
import { fetchOdds } from "@/lib/api/odds-api"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SPORTS = [
  "basketball_nba",
  "americanfootball_nfl",
  "basketball_ncaab",
  "americanfootball_ncaaf",
  "icehockey_nhl",
  "baseball_mlb",
]

export async function GET() {
  const results: Array<{ sport: string; games?: number; error?: string }> = []

  for (const sport of SPORTS) {
    try {
      const games = await fetchOdds(sport, ["h2h", "spreads", "totals"], {
        revalidateSeconds: 600,
        forceProvider: 'the-odds-api',
      })
      results.push({ sport, games: games.length })
    } catch (error: any) {
      results.push({
        sport,
        error: error instanceof Error ? error.message : "Failed to refresh odds",
      })
    }
  }

  return NextResponse.json({ ok: true, results })
}

