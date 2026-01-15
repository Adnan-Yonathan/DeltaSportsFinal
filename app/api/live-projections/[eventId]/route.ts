import { NextRequest, NextResponse } from "next/server"
import { projectLiveNbaSpread } from "@/lib/services/live-projection"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: {
    eventId: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const eventId = params.eventId
  if (!eventId) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 })
  }

  try {
    const payload = await projectLiveNbaSpread(eventId)
    if (!payload.gameState.isLive) {
      return NextResponse.json(
        { error: "Game is not live yet." },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      )
    }
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to project live spread."
    const status = message.toLowerCase().includes("timed out") ? 504 : 500
    console.error("[live-projections] api error", message)
    return NextResponse.json({ error: message }, { status })
  }
}
