import { NextRequest, NextResponse } from "next/server"
import { loadCachedGameDetails } from "@/lib/live-score-cache"
import { fetchGameDetails, type LeagueId } from "@/lib/live-scores"

interface Params {
  params: {
    eventId: string
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const league = request.nextUrl.searchParams.get("league") as LeagueId | null
  if (!league || !params.eventId) {
    return NextResponse.json({ error: "Missing eventId or league" }, { status: 400 })
  }

  const cached = loadCachedGameDetails(league, params.eventId)
  if (cached) {
    return NextResponse.json({ source: "cache", data: cached })
  }

  try {
    const fresh = await fetchGameDetails(league, params.eventId)
    return NextResponse.json({ source: "live", data: fresh })
  } catch (error) {
    console.error("[live-cache] detail fallback", error)
    return NextResponse.json({ error: "Unable to load box score" }, { status: 500 })
  }
}
