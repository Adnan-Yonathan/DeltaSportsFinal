"use client"

import { useEffect, useMemo, useState } from "react"

type PropMarket = {
  line: number
  projection?: number
}

type PlayerProp = {
  player: string
  team?: string
  game?: string
  markets: Record<string, PropMarket>
}

type PlayerProjection = {
  id?: string
  player: string
  team?: string
  teamAbbr?: string
  game?: string
  projections: Record<string, number | null>
}

type Row = {
  player: string
  team?: string
  game?: string
  markets: Record<string, { line?: number; projection?: number; edge?: number }>
  maxEdge: number
}

const MARKETS = ["points", "rebounds", "assists"] as const

const MARKET_LABELS: Record<string, string> = {
  points: "PTS",
  rebounds: "REB",
  assists: "AST",
}

const formatNumber = (value?: number | null) => {
  if (!Number.isFinite(value)) return "n/a"
  return Number(value).toFixed(1)
}

const formatEdge = (value?: number) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return `${value.toFixed(1)}%`
}

const normalizeToken = (value?: string | null) =>
  (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")

const makePlayerKey = (player?: string | null, team?: string | null) => {
  const name = normalizeToken(player)
  const club = normalizeToken(team)
  return club ? `${name}|${club}` : name
}

const computeEdgePercent = (projection?: number, line?: number) => {
  if (!Number.isFinite(projection) || !Number.isFinite(line) || line === 0) {
    return null
  }
  return (Math.abs((projection as number) - (line as number)) / Math.abs(line as number)) * 100
}

export default function PlayerProjectionsTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setErrorMessage(null)
      try {
        const [projectionsRes, propsRes] = await Promise.all([
          fetch("/api/player-projections", { cache: "no-store" }),
          fetch(
            "/api/player-props?sport=basketball_nba&market=points,rebounds,assists",
            { cache: "no-store" }
          ),
        ])

        if (!projectionsRes.ok) {
          throw new Error("Failed to load player projections.")
        }

        const projectionsPayload = await projectionsRes.json()
        const projections: PlayerProjection[] = Array.isArray(
          projectionsPayload?.data
        )
          ? projectionsPayload.data
          : []

        const lineByPlayer = new Map<string, PlayerProp>()
        if (propsRes.ok) {
          const propsPayload = await propsRes.json()
          const propsData: PlayerProp[] = Array.isArray(propsPayload?.data)
            ? propsPayload.data
            : []
          for (const entry of propsData) {
            const key = makePlayerKey(entry.player, entry.team)
            if (!key) continue
            if (!lineByPlayer.has(key)) {
              lineByPlayer.set(key, entry)
            }
          }
        }

        const grouped: Row[] = []
        const seen = new Set<string>()
        for (const entry of projections) {
          const key = makePlayerKey(entry.player, entry.teamAbbr || entry.team)
          if (seen.has(key)) continue
          seen.add(key)

          const lineEntry =
            lineByPlayer.get(key) ||
            lineByPlayer.get(makePlayerKey(entry.player, null))
          const markets: Row["markets"] = {}
          let maxEdge = 0
          for (const market of MARKETS) {
            const projection = Number.isFinite(entry.projections?.[market])
              ? Number(entry.projections?.[market])
              : undefined
            const line = lineEntry?.markets?.[market]
              ? lineEntry.markets[market].line
              : undefined
            const edge = computeEdgePercent(projection, line) ?? undefined
            if (edge != null) {
              maxEdge = Math.max(maxEdge, edge)
            }
            markets[market] = { line, projection, edge }
          }

          grouped.push({
            player: entry.player,
            team: entry.teamAbbr || entry.team,
            game: entry.game ?? lineEntry?.game,
            markets,
            maxEdge,
          })
        }

        if (active) setRows(grouped)
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to load projections."
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => b.maxEdge - a.maxEdge)
  }, [rows])

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="grid grid-cols-[220px_160px_repeat(3,minmax(0,1fr))] gap-2 bg-black/70 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
        <span>Player</span>
        <span>Matchup</span>
        <span>Points</span>
        <span>Rebounds</span>
        <span>Assists</span>
      </div>
      {loading ? (
        <div className="px-4 py-6 text-sm text-white/60">
          Loading projections...
        </div>
      ) : errorMessage ? (
        <div className="px-4 py-6 text-sm text-red-200">{errorMessage}</div>
      ) : sortedRows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-white/60">
          No NBA projections found for today.
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {sortedRows.map((row) => (
            <div
              key={`${row.player}-${row.team ?? "team"}`}
              className="grid grid-cols-[220px_160px_repeat(3,minmax(0,1fr))] gap-2 px-3 py-3 text-[13px] text-white/70"
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">
                  {row.player}
                </div>
                <div className="text-xs text-white/50">
                  {row.team ?? "Team n/a"}
                </div>
              </div>
              <div className="text-xs text-white/70">
                {row.game ?? "Matchup n/a"}
              </div>
              {MARKETS.map((market) => {
                const data = row.markets[market]
                return (
                  <div key={market} className="space-y-1 text-xs text-white/70">
                    <div className="rounded bg-white/10 px-1.5 py-0.5">
                      {MARKET_LABELS[market]} {formatNumber(data?.line)}
                    </div>
                    <div className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                      Delta {formatNumber(data?.projection)}
                    </div>
                    <div className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                      Edge {formatEdge(data?.edge)}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

