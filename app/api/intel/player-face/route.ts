import { NextRequest, NextResponse } from "next/server"

import { searchPlayer } from "@/lib/sports-stats-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const faceCache = new Map<string, { expiresAt: number; url: string | null }>()

const normalizeName = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")

const normalizeToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()

const resolveSearchSport = (sportKey?: string | null) => {
  if (!sportKey) return undefined
  if (sportKey === "basketball_nba") return "basketball_nba"
  if (sportKey === "basketball_ncaab") return "basketball_ncaab"
  if (sportKey === "americanfootball_nfl") return "americanfootball_nfl"
  if (sportKey === "americanfootball_ncaaf") return "americanfootball_ncaaf"
  if (sportKey === "baseball_mlb") return "baseball_mlb"
  if (sportKey === "icehockey_nhl") return "icehockey_nhl"
  return undefined
}

const fetchFallbackEspnHeadshot = async (playerName: string): Promise<string | null> => {
  try {
    const url = `https://site.api.espn.com/apis/search/v2?type=player&limit=6&query=${encodeURIComponent(
      playerName
    )}`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const payload = await res.json()
    const candidates =
      payload?.results?.find((entry: any) => entry?.type === "player")?.contents ?? []
    if (!Array.isArray(candidates) || candidates.length === 0) return null

    const target = normalizeToken(playerName)
    const exact =
      candidates.find((entry: any) => normalizeToken(String(entry?.displayName || "")) === target) ??
      candidates.find((entry: any) =>
        normalizeToken(String(entry?.displayName || "")).includes(target)
      ) ??
      candidates[0]

    const image = exact?.image?.default || exact?.image?.href
    return typeof image === "string" && image.trim().length > 0 ? image : null
  } catch {
    return null
  }
}

const resolveHeadshot = async (playerName: string, sportKey?: string | null) => {
  const scopedSport = resolveSearchSport(sportKey)
  if (scopedSport) {
    try {
      const scoped = await searchPlayer(playerName, scopedSport)
      if (scoped?.headshot) return scoped.headshot
    } catch {}
  }

  try {
    const fallback = await searchPlayer(playerName)
    if (fallback?.headshot) return fallback.headshot
  } catch {}

  return fetchFallbackEspnHeadshot(playerName)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sportKey = searchParams.get("sportKey")
  const name = normalizeName(searchParams.get("name"))
  if (!name) {
    return NextResponse.json({ error: "Missing player name." }, { status: 400 })
  }

  const cacheKey = `${sportKey || "any"}:${normalizeToken(name)}`
  const cached = faceCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.url) return NextResponse.json({ error: "Face not found." }, { status: 404 })
    return NextResponse.redirect(
      new URL(`/api/image-proxy?url=${encodeURIComponent(cached.url)}`, req.url),
      { status: 307 }
    )
  }

  try {
    const headshot = await resolveHeadshot(name, sportKey)
    faceCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      url: headshot ?? null,
    })
    if (!headshot) {
      return NextResponse.json({ error: "Face not found." }, { status: 404 })
    }
    return NextResponse.redirect(
      new URL(`/api/image-proxy?url=${encodeURIComponent(headshot)}`, req.url),
      { status: 307 }
    )
  } catch {
    return NextResponse.json({ error: "Failed to resolve player face." }, { status: 500 })
  }
}
