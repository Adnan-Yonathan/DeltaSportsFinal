import { NextRequest, NextResponse } from "next/server"
import { getTeamSnapshot } from "@/lib/live-data-service"

interface Params {
  params: { teamId: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const league = request.nextUrl.searchParams.get("league") as any
  if (!league) {
    return NextResponse.json({ error: "league is required" }, { status: 400 })
  }

  try {
    const teamData = await getTeamSnapshot(league, params.teamId)
    return NextResponse.json(teamData, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=300" } })
  } catch (error) {
    console.error("[llm-live] team snapshot error", error)
    return NextResponse.json({ error: "Unable to load team data" }, { status: 500 })
  }
}
