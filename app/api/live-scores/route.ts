import { NextRequest, NextResponse } from "next/server"
import { fetchAllLiveScores } from "@/lib/live-scores"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date") ?? undefined
    const includeNews = searchParams.get("includeNews") === "true"
    const data = await fetchAllLiveScores({ date, includeNews })
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
