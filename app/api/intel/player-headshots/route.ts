import { NextRequest, NextResponse } from "next/server"

import { searchPlayer } from "@/lib/sports-stats-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const MAX_PLAYERS = 180

const headshotCache = new Map<string, { expiresAt: number; headshot: string | null }>()

const normalizePlayerName = (value?: string | null) =>
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
    const url = `https://site.api.espn.com/apis/search/v2?type=player&limit=8&query=${encodeURIComponent(
      playerName
    )}`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const payload = await res.json()
    const candidates =
      payload?.results?.find((entry: any) => entry?.type === "player")?.contents ?? []
    if (!Array.isArray(candidates) || candidates.length === 0) return null

    const normalizedTarget = normalizeToken(playerName)
    const exact =
      candidates.find((entry: any) => normalizeToken(String(entry?.displayName || "")) === normalizedTarget) ??
      candidates.find((entry: any) =>
        normalizeToken(String(entry?.displayName || "")).includes(normalizedTarget)
      ) ??
      candidates[0]

    const image = exact?.image?.default || exact?.image?.href
    if (typeof image === "string" && image.trim().length > 0) return image

    const link = String(exact?.link?.web || "")
    const idMatch = /\/id\/(\d+)/.exec(link)
    const athleteId = idMatch?.[1]
    if (athleteId) {
      const league = String(exact?.defaultLeagueSlug || "").toLowerCase()
      const leagueSegment =
        league === "nba" || league === "wnba"
          ? "nba"
          : league === "nfl"
            ? "nfl"
            : league === "nhl"
              ? "nhl"
              : league === "mlb"
                ? "mlb"
                : "nfl"
      return `https://a.espncdn.com/i/headshots/${leagueSegment}/players/full/${athleteId}.png`
    }
    return null
  } catch {
    return null
  }
}

const lookupHeadshot = async (playerName: string, sportKey?: string | null) => {
  const scopedSport = resolveSearchSport(sportKey)

  if (scopedSport) {
    try {
      const scoped = await searchPlayer(playerName, scopedSport)
      if (scoped?.headshot) return scoped.headshot
    } catch {}
  }

  try {
    const fallbackSearch = await searchPlayer(playerName)
    if (fallbackSearch?.headshot) return fallbackSearch.headshot
  } catch {}

  return fetchFallbackEspnHeadshot(playerName)
}

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
) => {
  if (!items.length) return [] as R[]
  const safeConcurrency = Math.max(1, Math.floor(concurrency))
  const results = new Array<R>(items.length)
  let index = 0

  const runWorker = async () => {
    while (true) {
      const current = index
      index += 1
      if (current >= items.length) break
      results[current] = await worker(items[current])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(safeConcurrency, items.length) }, () => runWorker())
  )
  return results
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      sportKey?: string
      players?: unknown
    }
    const sportKey = typeof body?.sportKey === "string" ? body.sportKey : undefined
    const rawPlayers = Array.isArray(body?.players) ? body.players : []
    const normalizedPlayers = rawPlayers
      .map((value) => normalizePlayerName(typeof value === "string" ? value : ""))
      .filter((value): value is string => value.length > 0)
      .slice(0, MAX_PLAYERS)

    if (normalizedPlayers.length === 0) {
      return NextResponse.json({
        ok: true,
        headshots: {},
      })
    }

    const deduped = new Map<string, string>()
    for (const playerName of normalizedPlayers) {
      const token = normalizeToken(playerName)
      if (!token) continue
      if (!deduped.has(token)) deduped.set(token, playerName)
    }

    const resolvedByToken = new Map<string, string | null>()
    const pending: Array<{ cacheKey: string; token: string; playerName: string }> = []
    const now = Date.now()

    for (const [token, playerName] of deduped) {
      const cacheKey = `${sportKey || "any"}:${token}`
      const cached = headshotCache.get(cacheKey)
      if (cached && cached.expiresAt > now) {
        resolvedByToken.set(token, cached.headshot)
      } else {
        pending.push({ cacheKey, token, playerName })
      }
    }

    if (pending.length > 0) {
      const lookedUp = await mapWithConcurrency(pending, 6, async (entry) => {
        try {
          const headshot = await lookupHeadshot(entry.playerName, sportKey)
          return { ...entry, headshot: headshot ?? null }
        } catch {
          return { ...entry, headshot: null }
        }
      })

      lookedUp.forEach((entry) => {
        resolvedByToken.set(entry.token, entry.headshot)
        headshotCache.set(entry.cacheKey, {
          headshot: entry.headshot,
          expiresAt: Date.now() + CACHE_TTL_MS,
        })
      })
    }

    const headshots: Record<string, string | null> = {}
    for (const playerName of normalizedPlayers) {
      const token = normalizeToken(playerName)
      if (!token) continue
      headshots[playerName] = resolvedByToken.get(token) ?? null
    }

    return NextResponse.json({
      ok: true,
      headshots,
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to resolve player headshots." },
      { status: 500 }
    )
  }
}
