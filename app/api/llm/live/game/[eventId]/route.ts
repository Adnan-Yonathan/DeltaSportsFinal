import { NextRequest, NextResponse } from "next/server"
import { getGameDetailsData } from "@/lib/live-data-service"

interface Params {
  params: {
    eventId: string
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const league = request.nextUrl.searchParams.get("league") as any
  if (!league) {
    return NextResponse.json({ error: "league query param is required" }, { status: 400 })
  }

  try {
    const payload = await getGameDetailsData({ league, eventId: params.eventId })
    return NextResponse.json(payload, { headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" } })
  } catch (error) {
    console.error("[llm-live] game details error", error)
    return NextResponse.json({ error: "Unable to fetch game details" }, { status: 500 })
  }
}
