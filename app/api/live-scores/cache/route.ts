import { NextRequest, NextResponse } from "next/server"
import { loadCachedScores, listCacheMeta, saveCachedScores } from "@/lib/live-score-cache"
import { fetchAllLiveScores } from "@/lib/live-scores"

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? undefined
  try {
    const cached = loadCachedScores()
    if (cached) {
      return NextResponse.json({ source: "cache", meta: listCacheMeta(), data: cached })
    }

    const fresh = await fetchAllLiveScores({ date })
    saveCachedScores(fresh)
    return NextResponse.json({ source: "live", meta: [], data: fresh })
  } catch (error) {
    console.error("[live-cache] fetch fallback error", error)
    return NextResponse.json({ error: "Unable to load live scores cache" }, { status: 500 })
  }
}
