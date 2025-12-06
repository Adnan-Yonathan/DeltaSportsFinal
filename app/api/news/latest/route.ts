import { NextResponse } from "next/server"

const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports"

const LEAGUES: Record<string, { sport: string; league: string; label: string }> = {
  nba: { sport: "basketball", league: "nba", label: "NBA" },
  nfl: { sport: "football", league: "nfl", label: "NFL" },
  mlb: { sport: "baseball", league: "mlb", label: "MLB" },
  nhl: { sport: "hockey", league: "nhl", label: "NHL" },
}

type Article = {
  title: string
  description?: string
  url: string
  image?: string
  published?: string
  byline?: string
  league: string
}

const normalizeArticles = (items: any[], league: string): Article[] => {
  return items
    .map((n) => {
      const headline = n?.headline || n?.title || n?.name
      const link = n?.links?.web?.href || n?.link || n?.url
      const summary = n?.description || n?.summary || n?.teaser
      const image = n?.images?.[0]?.url || n?.image?.url
      const published = n?.published || n?.lastModified
      const byline = n?.byline
      if (!headline || !link) return null
      return {
        title: headline,
        description: summary,
        url: link,
        image,
        published,
        byline,
        league,
      }
    })
    .filter(Boolean) as Article[]
}

export const GET = async (req: Request) => {
  const { searchParams } = new URL(req.url)
  const leagueParam = (searchParams.get("league") || "nba").toLowerCase()
  const limit = Number(searchParams.get("limit") || "3")
  const league = LEAGUES[leagueParam]

  if (!league) {
    return NextResponse.json({ error: "Unsupported league" }, { status: 400 })
  }

  try {
    const res = await fetch(`${ESPN_BASE_URL}/${league.sport}/${league.league}/news?limit=${Math.max(1, Math.min(limit, 10))}`, {
      cache: "no-store",
    })
    if (!res.ok) {
      return NextResponse.json({ error: `News fetch failed (${res.status})` }, { status: 502 })
    }
    const data = await res.json()
    const items: any[] = data?.articles || data?.headlines || data?.news || data?.items || []
    const articles = normalizeArticles(items, leagueParam).slice(0, limit || 3)
    return NextResponse.json({ articles, league: leagueParam })
  } catch (err) {
    console.error("[news/latest] failed", err)
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 })
  }
}
