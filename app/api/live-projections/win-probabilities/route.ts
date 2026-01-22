import { NextRequest, NextResponse } from "next/server"
import { getCachedGameDetails } from "@/lib/services/live-game-cache"
import type { LeagueId } from "@/lib/live-scores"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const leagueParam = (searchParams.get("league") as LeagueId | null) || "nba"
  const eventIdsParam = searchParams.get("eventIds")

  if (!eventIdsParam) {
    return NextResponse.json({ error: "Missing eventIds" }, { status: 400 })
  }

  const eventIds = eventIdsParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  if (!eventIds.length) {
    return NextResponse.json({ error: "No eventIds provided" }, { status: 400 })
  }

  try {
    const results = await Promise.all(
      eventIds.map(async (eventId) => {
        try {
          const details = await getCachedGameDetails(leagueParam, eventId)
          if (!details?.winProbability) return null
          return { eventId, winProbability: details.winProbability }
        } catch (error) {
          console.warn("[live-win-prob] fetch failed", eventId, error)
          return null
        }
      })
    )

    const data: Record<string, { home: number; away: number; updatedAt?: string }> = {}
    results.forEach((entry) => {
      if (!entry) return
      data[entry.eventId] = entry.winProbability
    })

    return NextResponse.json(
      {
        ok: true,
        updatedAt: new Date().toISOString(),
        data,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("[live-win-prob] api error", error)
    return NextResponse.json(
      { error: "Unable to fetch win probabilities." },
      { status: 500 }
    )
  }
}
