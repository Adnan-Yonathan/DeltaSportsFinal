import { NextRequest, NextResponse } from "next/server"
import { getPlayerSeasonStats } from "@/lib/live-data-service"

interface Params {
  params: {
    playerId: string
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const league = request.nextUrl.searchParams.get("league") as any
  if (!league) {
    return NextResponse.json({ error: "league query param is required" }, { status: 400 })
  }

  try {
    const payload = await getPlayerSeasonStats(league, params.playerId)
    return NextResponse.json(payload, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=300" } })
  } catch (error) {
    console.error("[llm-live] player stats error", error)
    return NextResponse.json({ error: "Unable to load player stats" }, { status: 500 })
  }
}
