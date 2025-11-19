import { NextRequest, NextResponse } from "next/server"
import { getLiveScoresData } from "@/lib/live-data-service"

export async function GET(request: NextRequest) {
  const league = request.nextUrl.searchParams.get("league") as any
  const date = request.nextUrl.searchParams.get("date") ?? undefined

  if (!league) {
    return NextResponse.json({ error: "league query param is required" }, { status: 400 })
  }

  try {
    const data = await getLiveScoresData({ league, date })
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=20, stale-while-revalidate=60" } })
  } catch (error) {
    console.error("[llm-live] scores error", error)
    return NextResponse.json({ error: "Unable to fetch live scores" }, { status: 500 })
  }
}
