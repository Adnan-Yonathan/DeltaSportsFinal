import { NextResponse } from "next/server"

const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports"

const LEAGUES: Record<string, { sport: string; league: string; label: string }> = {
  nba: { sport: "basketball", league: "nba", label: "NBA" },
  nfl: { sport: "football", league: "nfl", label: "NFL" },
  mlb: { sport: "baseball", league: "mlb", label: "MLB" },
  nhl: { sport: "hockey", league: "nhl", label: "NHL" },
  cbb: { sport: "basketball", league: "mens-college-basketball", label: "CBB" },
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
  const isAll = leagueParam === "all"
  const league = LEAGUES[leagueParam]

  if (!isAll && !league) {
    return NextResponse.json({ error: "Unsupported league" }, { status: 400 })
  }

  try {
    if (isAll) {
      const cappedLimit = Math.max(1, Math.min(limit, 40))
      const results = await Promise.allSettled(
        Object.entries(LEAGUES).map(async ([key, entry]) => {
          const res = await fetch(
            `${ESPN_BASE_URL}/${entry.sport}/${entry.league}/news?limit=10`,
            { cache: "no-store" }
          )
          if (!res.ok) return []
          const data = await res.json()
          const items: any[] =
            data?.articles || data?.headlines || data?.news || data?.items || []
          return normalizeArticles(items, key)
        })
      )
      const merged = results
        .flatMap((result) =>
          result.status === "fulfilled" ? result.value : []
        )
        .sort((a, b) => {
          const aTime = a.published ? Date.parse(a.published) : 0
          const bTime = b.published ? Date.parse(b.published) : 0
          return bTime - aTime
        })
        .slice(0, cappedLimit)
      return NextResponse.json({ articles: merged, league: "all" })
    }

    const res = await fetch(
      `${ESPN_BASE_URL}/${league.sport}/${league.league}/news?limit=${Math.max(
        1,
        Math.min(limit, 10)
      )}`,
      {
        cache: "no-store",
      }
    )
    if (!res.ok) {
      return NextResponse.json(
        { error: `News fetch failed (${res.status})` },
        { status: 502 }
      )
    }
    const data = await res.json()
    const items: any[] =
      data?.articles || data?.headlines || data?.news || data?.items || []
    const articles = normalizeArticles(items, leagueParam).slice(
      0,
      limit || 3
    )
    return NextResponse.json({ articles, league: leagueParam })
  } catch (err) {
    console.error("[news/latest] failed", err)
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 })
  }
}
