import { NextRequest, NextResponse } from "next/server"
import { fetchAllLiveScores } from "@/lib/live-scores"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date") ?? undefined
    const data = await fetchAllLiveScores({ date })
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[live-scores] api error", error)
    return NextResponse.json(
      { error: "Unable to fetch live scores right now." },
      {
        status: 500,
      }
    )
  }
}
