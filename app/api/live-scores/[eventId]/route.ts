import { NextRequest, NextResponse } from "next/server"
import { fetchGameDetails, type LeagueId } from "@/lib/live-scores"

interface RouteParams {
  params: {
    eventId: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { eventId } = params
  const leagueParam = request.nextUrl.searchParams.get("league") as LeagueId | null

  if (!eventId || !leagueParam) {
    return NextResponse.json({ error: "Missing league or event id" }, { status: 400 })
  }

  try {
    const data = await fetchGameDetails(leagueParam, eventId)
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=15, stale-while-revalidate=30",
      },
    })
  } catch (error) {
    console.error("[live-scores] detail api error", error)
    return NextResponse.json({ error: "Unable to load box score for this game." }, { status: 500 })
  }
}
