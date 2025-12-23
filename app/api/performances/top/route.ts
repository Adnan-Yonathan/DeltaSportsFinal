import { NextResponse } from "next/server"
import {
  getTeams,
  getTeamSchedule,
  getPlayerGameLogs,
  getRoster,
  getEventSnapshot,
  getPlayerSeasonStats,
} from "@/lib/services/espn-orchestrator"
import { createClient } from '@/lib/supabase/server'

type LeagueKey = "nba" | "nfl" | "mlb" | "nhl"

const LEAGUES: Record<string, { sport: string; league: string; label: string }> = {
  nba: { sport: "basketball", league: "nba", label: "NBA" },
  nfl: { sport: "football", league: "nfl", label: "NFL" },
  mlb: { sport: "baseball", league: "mlb", label: "MLB" },
  nhl: { sport: "hockey", league: "nhl", label: "NHL" },
}

const STAR_PLAYERS: Record<LeagueKey, string[]> = {
  nba: [
    // curated top/current stars to keep requests low but relevant
    "3975", // Stephen Curry
    "3945274", // Luka Doncic
    "2544", // LeBron James
    "1966", // LeBron legacy id
    "3032977", // Giannis
    "3136193", // Devin Booker
    "4442030", // Jayson Tatum
    "4259", // Kevin Durant
    "4442367", // Anthony Edwards
    "4397014", // Shai Gilgeous-Alexander
    "4066332", // Trae Young
    "4302908", // Ja Morant
    "3138153", // Donovan Mitchell
    "4230549", // Tyrese Haliburton
    "3136776", // Zach LaVine
    "3943423", // Nikola Jokic
    "4695664", // Victor Wembanyama
    "4683021", // Deni Avdija
  ],
  nfl: [],
  mlb: [],
  nhl: [],
}

const toNumber = (val: any): number | null => {
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const num = Number(String(val).replace(/[^\d.-]/g, ""))
  return Number.isFinite(num) ? num : null
}

const lastN = <T>(arr: T[], n: number) => arr.slice(Math.max(0, arr.length - n))

const seasonForSport = (sport: LeagueKey) => {
  // ESPN uses the STARTING year of the season (e.g., 2025 for 2025-26 season)
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-based
  // NBA/NHL: Oct-Dec uses current year, Jan-Sep uses previous year
  if (sport === "nba") return month >= 9 ? year : year - 1
  if (sport === "nhl") return month >= 9 ? year : year - 1
  // NFL: Sep-Dec uses current year, Jan-Aug uses previous year
  if (sport === "nfl") return month >= 8 ? year : year - 1
  if (sport === "mlb") return month >= 2 ? year : year - 1
  return year
}

const formatDate = (d: Date) => {
  const y = d.getUTCFullYear()
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0")
  const day = `${d.getUTCDate()}`.padStart(2, "0")
  return `${y}${m}${day}`
}

const fetchRecentScoreboard = async (league: LeagueKey, days = 30) => {
  const { sport, league: lg } = LEAGUES[league]
  const to = new Date()
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${lg}/scoreboard?dates=${formatDate(from)}-${formatDate(to)}&limit=500`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return []
  const data = await res.json()
  return data?.events || []
}

const SPORT_KEY_MAP: Record<LeagueKey, string> = {
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
}

const formatPct = (value: number | string | null | undefined) => {
  if (value == null) return "n/a"
  const numeric = typeof value === "string" ? Number(value.replace(/[^\d.-]/g, "")) : value
  if (!Number.isFinite(numeric)) return "n/a"
  return `${numeric.toFixed(1)}%`
}

const formatPair = (label: string, away?: number | null, home?: number | null) => {
  if (away == null && home == null) return null
  return `${label}: ${formatPct(away)} / ${formatPct(home)}`
}

const firstDefined = <T,>(...values: Array<T | null | undefined>) => {
  for (const value of values) {
    if (value == null) continue
    const text = String(value).trim()
    if (!text) continue
    if (["n/a", "na", "none", "null", "--", "-"].includes(text.toLowerCase())) continue
    return value
  }
  return undefined
}

const normalizeStatKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

const readStatValue = (stats: any, keys: string[]): number | null => {
  if (!stats) return null
  const normalizedKeys = keys.map(normalizeStatKey)
  const tryMatch = (candidate: any) => {
    const label = String(candidate ?? "")
    const norm = normalizeStatKey(label)
    return normalizedKeys.includes(norm)
  }

  if (Array.isArray(stats)) {
    for (const entry of stats) {
      if (!entry) continue
      const label = entry.name || entry.shortDisplayName || entry.displayName || entry.abbrev || entry.label
      if (!label || !tryMatch(label)) continue
      const raw = firstDefined(entry.value, entry.displayValue, entry.stat, entry.amount)
      const num = toNumber(raw)
      if (num != null) return num
    }
  } else if (typeof stats === "object") {
    for (const key of keys) {
      const value = (stats as any)[key]
      const num = toNumber(value)
      if (num != null) return num
    }
    if (Array.isArray((stats as any).stats)) {
      const nested = readStatValue((stats as any).stats, keys)
      if (nested != null) return nested
    }
    if (Array.isArray((stats as any).categories)) {
      for (const category of (stats as any).categories) {
        const nested = readStatValue(category?.stats || category?.statistics, keys)
        if (nested != null) return nested
      }
    }
  }
  return null
}

const collectStatPayloads = (stats: any) => {
  const payloads: any[] = []
  const push = (value: any) => {
    if (!value) return
    payloads.push(value)
  }

  push(stats)
  push(stats?.stats)

  const statistics = stats?.statistics || stats?.splits || stats?.categories
  if (Array.isArray(statistics)) {
    for (const block of statistics) {
      push(block?.stats)
      if (Array.isArray(block?.splits)) {
        for (const split of block.splits) {
          push(split?.stats)
          if (Array.isArray(split?.categories)) {
            for (const cat of split.categories) {
              push(cat?.stats)
              push(cat?.statistics)
            }
          }
        }
      }
      if (Array.isArray(block?.categories)) {
        for (const cat of block.categories) {
          push(cat?.stats)
          push(cat?.statistics)
        }
      }
    }
  }

  if (Array.isArray(stats?.categories)) {
    for (const cat of stats.categories) {
      push(cat?.stats)
      push(cat?.statistics)
    }
  }

  if (Array.isArray(stats?.splits)) {
    for (const split of stats.splits) {
      push(split?.stats)
      if (Array.isArray(split?.categories)) {
        for (const cat of split.categories) {
          push(cat?.stats)
          push(cat?.statistics)
        }
      }
    }
  }

  return payloads
}

const extractSeasonAverages = (stats: any) => {
  const payloads = collectStatPayloads(stats)
  let pts: number | null = null
  let reb: number | null = null
  let ast: number | null = null
  let threes: number | null = null

  for (const payload of payloads) {
    if (pts == null) pts = readStatValue(payload, ["pointsPerGame", "ptsPerGame", "ppg", "PTS", "points"])
    if (reb == null) reb = readStatValue(payload, ["reboundsPerGame", "totalReboundsPerGame", "rebPerGame", "rpg", "REB", "TRB"])
    if (ast == null) ast = readStatValue(payload, ["assistsPerGame", "assistAvg", "astPerGame", "apg", "AST"])
    if (threes == null) {
      threes = readStatValue(payload, [
        "threePointFieldGoalsPerGame",
        "threePointFieldGoalsMadePerGame",
        "threePointersMadePerGame",
        "threePMade",
        "3PM",
        "3PT",
        "threesPerGame",
      ])
    }
    if (pts != null && reb != null && ast != null && threes != null) break
  }

  return { pts, reb, ast, threes }
}

const fetchSeasonAveragesForPlayers = async (league: LeagueKey, playerIds: string[]) => {
  const sportKey = SPORT_KEY_MAP[league]
  if (!sportKey || !playerIds.length) return new Map<string, any>()
  const season = seasonForSport(league)
  const supa = createClient()
  const seasonMap = new Map<string, any>()
  const chunkSize = 200
  for (let i = 0; i < playerIds.length; i += chunkSize) {
    const chunk = playerIds.slice(i, i + chunkSize)
    const { data, error } = await supa
      .from("player_season_stats")
      .select("player_provider_id, stats")
      .eq("sport_key", sportKey)
      .eq("season", season)
      .in("player_provider_id", chunk)
    if (error) {
      console.warn("[performances/top] season stats query failed", error)
      continue
    }
    for (const row of data || []) {
      seasonMap.set(String(row.player_provider_id), extractSeasonAverages(row.stats))
    }
  }
  return seasonMap
}

const fetchSeasonAveragesFromEspn = async (league: LeagueKey, playerIds: string[], limit = 20) => {
  const season = seasonForSport(league)
  const results = new Map<string, any>()
  const slice = playerIds.slice(0, limit)
  for (const playerId of slice) {
    try {
      const payload = await getPlayerSeasonStats(league, playerId, season)
      if (!payload) continue
      const averages = extractSeasonAverages(payload)
      if (averages.pts != null || averages.reb != null || averages.ast != null || averages.threes != null) {
        results.set(String(playerId), averages)
      }
    } catch (error) {
      console.warn("[performances/top] ESPN season stats failed", error)
    }
  }
  return results
}

const buildBettingSplitEntry = (split: any, league: LeagueKey) => {
  const betsParts = [
    formatPair("Spread bets", split.spreadAwayBetsPct, split.spreadHomeBetsPct),
    formatPair("Total bets", split.totalOverBetsPct, split.totalUnderBetsPct),
    formatPair("ML bets", split.mlAwayBetsPct, split.mlHomeBetsPct),
  ].filter(Boolean)

  const moneyParts = [
    formatPair("Spread money", split.spreadAwayMoneyPct, split.spreadHomeMoneyPct),
    formatPair("Total money", split.totalOverMoneyPct, split.totalUnderMoneyPct),
    formatPair("ML money", split.mlAwayMoneyPct, split.mlHomeMoneyPct),
  ].filter(Boolean)

  const markets: string[] = []
  if (split.spreadAwayBetsPct != null || split.spreadHomeBetsPct != null) markets.push("Spread")
  if (split.totalOverBetsPct != null || split.totalUnderBetsPct != null) markets.push("Total")
  if (split.mlAwayBetsPct != null || split.mlHomeBetsPct != null) markets.push("Moneyline")

  return {
    type: "betting",
    league,
    name: `${split.awayTeam || split.away_team || "Away"} @ ${split.homeTeam || split.home_team || "Home"}`,
    sample: 5,
    marketLabel: markets.join(" + ") || split.market_type || "Betting",
    bets: betsParts.join(" | "),
    money: moneyParts.join(" | "),
    sharp: split.sharpIndicator
      ? `Signal: ${split.sharpIndicator.replace("_", " ")}`
      : "Signal: neutral",
    capturedAt: split.capturedAt || split.captured_at,
  }
}

const buildAtsTrendEntry = (record: any, league: LeagueKey) => {
  const team = record.team_name || record.team_provider_id || "Team"
  const atsRecord = record.record?.formatted || record.record || record.ats_record || "n/a"
  const last10 = record.last_10_ats || "n/a"
  const overUnder = record.over_under_record || "n/a"
  const streakValue =
    record.ats_streak || "n/a"
  const streak = record.ats_streak ? `Streak: ${record.ats_streak}` : "Streak: n/a"

  return {
    type: "betting",
    league,
    name: team,
    sample: 5,
    marketLabel: "ATS / O-U",
    bets: `Season ATS: ${atsRecord}`,
    money: `O/U: ${overUnder}`,
    sharp: "Signal: ATS streak",
    streak,
    capturedAt: record.captured_at,
    sortScore: computeAtsScore(atsRecord, last10, record.ats_streak),
  }
}

const buildPlayerTrendEntry = (player: any, league: LeagueKey) => {
  const avgPts = firstDefined(player.avgPts, player.pts, player.points, player.avg_points)
  const avgReb = firstDefined(player.avgReb, player.reb, player.rebounds, player.avg_reb)
  const avgAst = firstDefined(player.avgAst, player.ast, player.assists, player.avg_ast)
  const avgThrees = firstDefined(player.avgThrees, player.tpm, player.threes, player.avg_threes)
  const seasonAvgPts = firstDefined(player.seasonAvgPts, player.seasonPts, player.season_avg_pts)
  const seasonAvgReb = firstDefined(player.seasonAvgReb, player.seasonReb, player.season_avg_reb)
  const seasonAvgAst = firstDefined(player.seasonAvgAst, player.seasonAst, player.season_avg_ast)
  const seasonAvgThrees = firstDefined(player.seasonAvgThrees, player.seasonThrees, player.season_avg_threes)
  const avgPtsNum = typeof avgPts === "number" ? avgPts : toNumber(avgPts)
  const avgRebNum = typeof avgReb === "number" ? avgReb : toNumber(avgReb)
  const avgAstNum = typeof avgAst === "number" ? avgAst : toNumber(avgAst)
  const avgThreesNum = typeof avgThrees === "number" ? avgThrees : toNumber(avgThrees)
  const seasonAvgPtsNum = typeof seasonAvgPts === "number" ? seasonAvgPts : toNumber(seasonAvgPts)
  const seasonAvgRebNum = typeof seasonAvgReb === "number" ? seasonAvgReb : toNumber(seasonAvgReb)
  const seasonAvgAstNum = typeof seasonAvgAst === "number" ? seasonAvgAst : toNumber(seasonAvgAst)
  const seasonAvgThreesNum = typeof seasonAvgThrees === "number" ? seasonAvgThrees : toNumber(seasonAvgThrees)

  const parts: string[] = []
  if (avgPtsNum != null) parts.push(`${avgPtsNum.toFixed?.(1) ?? avgPtsNum} PTS`)
  if (avgRebNum != null) parts.push(`${avgRebNum.toFixed?.(1) ?? avgRebNum} REB`)
  if (avgAstNum != null) parts.push(`${avgAstNum.toFixed?.(1) ?? avgAstNum} AST`)
  if (avgThreesNum != null) parts.push(`${avgThreesNum.toFixed?.(1) ?? avgThreesNum} 3PM`)

  const trendStats = [
    { key: "PTS", label: "points", avg: avgPtsNum, seasonAvg: seasonAvgPtsNum },
    { key: "REB", label: "rebounds", avg: avgRebNum, seasonAvg: seasonAvgRebNum },
    { key: "AST", label: "assists", avg: avgAstNum, seasonAvg: seasonAvgAstNum },
    { key: "3PM", label: "threes", avg: avgThreesNum, seasonAvg: seasonAvgThreesNum },
  ]
    .filter((stat): stat is { key: string; label: string; avg: number; seasonAvg: number } =>
      stat.avg != null && stat.seasonAvg != null
    )
    .map((stat) => ({
      ...stat,
      delta: stat.avg - stat.seasonAvg,
      score: stat.seasonAvg ? (stat.avg - stat.seasonAvg) / stat.seasonAvg : 0,
    })) as Array<{
    key: string
    label: string
    avg: number
    seasonAvg: number
    delta: number
    score: number
  }>
  const topTrend = trendStats
    .filter((stat) => stat.delta > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  const sampleSize = player.sample ?? 5
  const trendLabel = topTrend ? `Exceeding ${topTrend.label} avg (last ${sampleSize})` : `Player streak (last ${sampleSize})`
  const trendDelta = topTrend?.delta ?? null
  const trendDetail =
    topTrend && trendDelta != null
      ? `Avg: ${topTrend.avg.toFixed?.(1) ?? topTrend.avg} ${topTrend.key} (Season ${topTrend.seasonAvg.toFixed?.(1) ?? topTrend.seasonAvg}, +${trendDelta.toFixed?.(1) ?? trendDelta})`
      : parts.length
      ? `Avg: ${parts.join(" | ")}`
      : "Recent averages unavailable"

  return {
    type: "betting",
    league,
    name: player.name || "Player",
    sample: player.sample ?? 5,
    marketLabel: trendLabel,
    bets: trendDetail,
    money: null,
    sharp: "Signal: hot streak",
    streak: `Streak: last ${player.sample ?? 5} games`,
    capturedAt: new Date().toISOString(),
    trendDelta,
    trendScore: topTrend?.score ?? null,
    sortScore: computePlayerScore({ ...player, trendDelta, trendScore: topTrend?.score }),
  }
}

const fetchAtsRecords = async (league: LeagueKey, limit = 5) => {
  const sportKey = SPORT_KEY_MAP[league]
  if (!sportKey) return []
  const supa = createClient()
  const { data, error } = await supa
    .from("team_ats_records")
    .select("*")
    .eq("sport_key", sportKey)
    .order("captured_at", { ascending: false })
    .limit(Math.max(10, limit))

  if (error) {
    console.error("[performances/top] ATS records query failed", error)
    return []
  }
  return data || []
}

const buildBettingTrends = async (
  league: LeagueKey,
  players: any[],
  fallbackPlayers: any[] = [],
  atsLimit = 5,
  playerLimit = 5
) => {
  const atsRecords = await fetchAtsRecords(league, atsLimit)
  const atsItems = atsRecords.map((record) => buildAtsTrendEntry(record, league))
  const basePlayers = players && players.length ? players : fallbackPlayers
  const playerItems = (basePlayers || [])
    .map((player) => buildPlayerTrendEntry(player, league))
    .filter((item) => typeof item.trendDelta === "number" && item.trendDelta > 0)

  const sortedAts = atsItems.sort((a, b) => (b.sortScore ?? 0) - (a.sortScore ?? 0)).slice(0, atsLimit)
  const sortedPlayers = playerItems.sort((a, b) => (b.sortScore ?? 0) - (a.sortScore ?? 0)).slice(0, playerLimit)

  const mixed: any[] = []
  const max = Math.max(sortedAts.length, sortedPlayers.length)
  for (let i = 0; i < max; i += 1) {
    if (sortedAts[i]) mixed.push(sortedAts[i])
    if (sortedPlayers[i]) mixed.push(sortedPlayers[i])
  }
  return mixed
}

const parseRecord = (value?: string | null) => {
  if (!value) return null
  const match = String(value).match(/(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?/)
  if (!match) return null
  const wins = Number(match[1])
  const losses = Number(match[2])
  const pushes = match[3] ? Number(match[3]) : 0
  const total = wins + losses + pushes
  if (!total) return null
  return { wins, losses, pushes, total, winPct: wins / total }
}

const parseStreak = (value?: string | null) => {
  if (!value) return null
  const match = String(value).match(/([WL])\s*(\d+)/i)
  if (!match) return null
  const dir = match[1].toUpperCase()
  const len = Number(match[2])
  if (!Number.isFinite(len)) return null
  return { dir, len }
}

const computeAtsScore = (record?: string | null, last10?: string | null, streak?: string | null) => {
  const recordStats = parseRecord(record)
  const last10Stats = parseRecord(last10)
  const streakStats = parseStreak(streak)
  const winPct = recordStats?.winPct ?? 0
  const last10Pct = last10Stats?.winPct ?? winPct
  const streakScore = streakStats ? (streakStats.dir === "W" ? streakStats.len : -streakStats.len) : 0
  return winPct * 100 + last10Pct * 50 + streakScore * 5
}

const computePlayerScore = (player: any) => {
  const trendScore = typeof player.trendScore === "number" ? player.trendScore : toNumber(player.trendScore)
  if (trendScore != null && Number.isFinite(trendScore)) return trendScore
  const trendDelta = typeof player.trendDelta === "number" ? player.trendDelta : toNumber(player.trendDelta)
  if (trendDelta != null && Number.isFinite(trendDelta)) return trendDelta
  const values = [
    player.avgPts,
    player.avgReb,
    player.avgAst,
    player.avgThrees,
    player.avgPass,
    player.avgRush,
    player.avgRec,
  ]
    .map((value) => (typeof value === "number" ? value : toNumber(value)))
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  if (!values.length) return 0
  return values.reduce((sum, val) => sum + val, 0)
}

const buildTeamRecent = async (league: LeagueKey, window = 5) => {
  const teams = await getTeams(league)
  const season = seasonForSport(league)
  const trends: any[] = []
  const events = await fetchRecentScoreboard(league, 30)
  const gamesByTeam: Record<string, any[]> = {}

  for (const ev of events) {
    const comp = ev?.competitions?.[0] || {}
    const competitors: any[] = comp?.competitors || []
    if (!competitors.length) continue
    const date = String(ev?.date || comp?.date || "").slice(0, 10)
    const completed = (comp?.status?.type?.completed || comp?.status?.type?.state === "post") ?? false
    if (!completed) continue
    const home = competitors.find((c: any) => (c?.homeAway || c?.homeaway) === "home")
    const away = competitors.find((c: any) => (c?.homeAway || c?.homeaway) === "away")
    const pushGame = (team: any, opp: any) => {
      const teamId = String(team?.team?.id || team?.id || "")
      const oppId = String(opp?.team?.id || opp?.id || "")
      if (!teamId) return
      const ourScore = toNumber(team?.score) ?? null
      const oppScore = toNumber(opp?.score) ?? null
      const result =
        ourScore != null && oppScore != null
          ? ourScore > oppScore
            ? "W"
            : ourScore < oppScore
            ? "L"
            : "T"
          : undefined
      if (!gamesByTeam[teamId]) gamesByTeam[teamId] = []
      gamesByTeam[teamId].push({
        date,
        ourScore,
        oppScore,
        result,
        opponentId: oppId,
        opponentName: opp?.team?.displayName || opp?.team?.shortDisplayName || "",
      })
    }
    if (home && away) {
      pushGame(home, away)
      pushGame(away, home)
    }
  }

  for (const t of teams || []) {
    const teamId = String((t as any).id || (t as any).team?.id || (t as any).uid || "")
    if (!teamId) continue
    let recent = gamesByTeam[teamId] || []
    // Fallback to schedule if scoreboard empty
    if (!recent.length) {
      let sched = await getTeamSchedule(league, teamId, season, 2)
      if (!sched || !sched.length) {
        sched = await getTeamSchedule(league, teamId, season - 1, 2)
      }
      const completed = (sched || []).filter((g: any) => g.result)
      recent = lastN(completed, window)
    } else {
      recent = lastN(recent, window)
    }
    if (!recent.length) continue
    let wins = 0
    let losses = 0
    let scored = 0
    let allowed = 0
    for (const g of recent) {
      if (g.result === "W") wins++
      else if (g.result === "L") losses++
      const ourScore = toNumber(g.ourScore) ?? 0
      const oppScore = toNumber(g.oppScore) ?? 0
      scored += ourScore
      allowed += oppScore
    }
    trends.push({
      type: "team",
      league,
      name: (t as any).displayName || (t as any).name || teamId,
      sample: recent.length,
      wins,
      losses,
      avgFor: recent.length ? scored / recent.length : null,
      avgAgainst: recent.length ? allowed / recent.length : null,
    })
  }
  trends.sort((a, b) => b.wins - a.wins)
  return { trends }
}

const extractGameStats = (g: any, league: LeagueKey) => {
  const statObj: Record<string, number> = {}
  const stats = g?.stats || g?.statistics || []
  const blocks = Array.isArray(stats) ? stats : []
  for (const block of blocks) {
    const statsList: any[] = Array.isArray(block?.stats) ? block.stats : Array.isArray(block) ? block : []
    for (const s of statsList) {
      const label = s?.label || s?.name
      const val = toNumber(s?.value ?? s?.displayValue)
      if (label && val != null) statObj[label.toUpperCase()] = val
    }
  }

  if (league === "nfl") {
    const pass =
      statObj.PASSYDS ??
      statObj["PASSING_YARDS"] ??
      statObj["PASS YDS"] ??
      statObj["PASSING YARDS"] ??
      statObj.YDS ?? // often QB passing yards
      g.passingYards ??
      0
    const rush =
      statObj.RUSHYDS ??
      statObj["RUSHING_YARDS"] ??
      statObj["RUSH YDS"] ??
      statObj["RUSHING YARDS"] ??
      g.rushingYards ??
      0
    const rec =
      statObj.RECYDS ??
      statObj["RECEIVING_YARDS"] ??
      statObj["REC YDS"] ??
      statObj["RECEIVING YARDS"] ??
      g.receivingYards ??
      0
    return {
      passYds: toNumber(pass) ?? 0,
      rushYds: toNumber(rush) ?? 0,
      recYds: toNumber(rec) ?? 0,
      pts: toNumber(statObj.PTS ?? g.points) ?? 0,
    }
  }

  return {
    pts: toNumber(statObj.PTS ?? g.points) ?? 0,
    reb: toNumber(statObj.REB ?? statObj.TRB ?? g.rebounds) ?? 0,
    ast: toNumber(statObj.AST ?? g.assists) ?? 0,
    fgm: toNumber(statObj.FGM ?? statObj.FG) ?? 0,
    fga: toNumber(statObj.FGA) ?? 0,
    tpm: toNumber(statObj["3PM"] ?? statObj.THREEPM ?? statObj["3PT"]) ?? 0,
    tpa: toNumber(statObj["3PA"]) ?? 0,
  }
}

type BoxPlayerTotals = {
  id: string
  name: string
  team?: string
  teamAbbr?: string
  games: number
  pts: number
  reb: number
  ast: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  passYds?: number
  rushYds?: number
  recYds?: number
}

const buildPlayerLeadersFromBox = async (league: LeagueKey, topN = 5, days = 10, maxEvents = 40) => {
  const events = (await fetchRecentScoreboard(league, days)).filter((ev: any) => {
    const comp = ev?.competitions?.[0] || {}
    return (comp?.status?.type?.completed || comp?.status?.type?.state === "post") ?? false
  }).slice(0, maxEvents)

  const totals: Record<string, BoxPlayerTotals> = {}

  for (const ev of events) {
    const comp = ev?.competitions?.[0] || {}
    const eventId = String(ev?.id || comp?.id || "")
    if (!eventId) continue
    try {
      const snap = await getEventSnapshot(league, eventId)
      const players = snap?.boxscore?.players || []
      for (const group of players) {
        const teamName =
          group?.team?.displayName ||
          group?.team?.name ||
          group?.team?.shortDisplayName ||
          group?.team?.abbreviation ||
          undefined
        const teamAbbr = group?.team?.abbreviation || undefined
        const statsBlocks: any[] = Array.isArray(group?.statistics) ? group.statistics : []
        for (const block of statsBlocks) {
          const labels: string[] = Array.isArray(block?.labels) ? block.labels : []
          const athletes: any[] = Array.isArray(block?.athletes) ? block.athletes : []
          for (const a of athletes) {
            const aid = String(a?.athlete?.id || a?.athleteId || a?.id || "")
            if (!aid) continue
            const name = a?.athlete?.displayName || a?.athlete?.fullName || a?.name || aid
            const statsArr: any[] = Array.isArray(a?.stats) ? a.stats : Array.isArray(block?.stats) ? block.stats : []
            let pts = 0, reb = 0, ast = 0, fgm = 0, fga = 0, tpm = 0, tpa = 0, passYds = 0, rushYds = 0, recYds = 0
            statsArr.forEach((val, idx) => {
              const label = (labels[idx] || "").toUpperCase()
              const num = toNumber(val)
              if (num == null) return
              if (label === "PTS") pts = num
              else if (label === "REB") reb = num
              else if (label === "AST") ast = num
              else if (label === "FG") fgm = num
              else if (label === "FGA") fga = num
              else if (label === "3PT") tpm = num
              else if (label === "3PA") tpa = num
              else if (label.includes("PASS") && label.includes("YD")) passYds = num
              else if (label.includes("RUSH") && label.includes("YD")) rushYds = num
              else if ((label.includes("REC") || label.includes("RECEIVING")) && label.includes("YD")) recYds = num
              else if (label === "YDS" && league === "nfl") passYds = num
            })
            if (!totals[aid]) {
              totals[aid] = { id: aid, name, team: teamName, teamAbbr, games: 0, pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, passYds: 0, rushYds: 0, recYds: 0 }
            }
            const slot = totals[aid]
            if (!slot.team && teamName) slot.team = teamName
            if (!slot.teamAbbr && teamAbbr) slot.teamAbbr = teamAbbr
            slot.games += 1
            slot.pts += pts
            slot.reb += reb
            slot.ast += ast
            slot.fgm += fgm
            slot.fga += fga
            slot.tpm += tpm
            slot.tpa += tpa
            slot.passYds! += passYds
            slot.rushYds! += rushYds
            slot.recYds! += recYds
          }
        }
      }
    } catch {
      continue
    }
  }

  const summaries = Object.values(totals).map((p) => ({
    ...p,
    avgPts: p.games ? p.pts / p.games : null,
    avgReb: p.games ? p.reb / p.games : null,
    avgAst: p.games ? p.ast / p.games : null,
    fgPct: p.fga ? p.fgm / p.fga : null,
    tpPct: p.tpa ? p.tpm / p.tpa : null,
    avgPass: p.games ? (p.passYds ?? 0) / p.games : null,
    avgRush: p.games ? (p.rushYds ?? 0) / p.games : null,
    avgRec: p.games ? (p.recYds ?? 0) / p.games : null,
  }))
  const seasonAverages = await fetchSeasonAveragesForPlayers(league, summaries.map((p) => String(p.id)))
  const missing = summaries
    .filter((p) => {
      const entry = seasonAverages.get(String(p.id))
      if (!entry) return true
      return entry.pts == null && entry.reb == null && entry.ast == null && entry.threes == null
    })
    .map((p) => ({
      id: String(p.id),
      score: (p.avgPts ?? 0) + (p.avgReb ?? 0) + (p.avgAst ?? 0) + (p.avgPass ?? 0) + (p.avgRush ?? 0) + (p.avgRec ?? 0),
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 25)
    .map((p) => p.id)
  if (missing.length) {
    const espnAverages = await fetchSeasonAveragesFromEspn(league, missing, 25)
    for (const [key, value] of espnAverages.entries()) {
      seasonAverages.set(key, value)
    }
  }
  const summariesWithSeason = summaries.map((p) => {
    const seasonStats = seasonAverages.get(String(p.id))
    return {
      ...p,
      seasonAvgPts: seasonStats?.pts ?? null,
      seasonAvgReb: seasonStats?.reb ?? null,
      seasonAvgAst: seasonStats?.ast ?? null,
      seasonAvgThrees: seasonStats?.threes ?? null,
    }
  })

  const sortTop = (arr: any[], key: string) =>
    arr
      .filter((p) => p[key] != null)
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .slice(0, topN)

  const passTop = sortTop(summariesWithSeason, "avgPass")
  const rushTop = sortTop(summariesWithSeason, "avgRush")
  const recTop = sortTop(summariesWithSeason, "avgRec")
  const recentTop =
    league === "nfl"
      ? [...passTop.slice(0, topN), ...rushTop.slice(0, topN), ...recTop.slice(0, topN)].slice(0, Math.max(1, topN * 3))
      : sortTop(summariesWithSeason, "avgPts")

  return {
    pts: sortTop(summariesWithSeason, "avgPts"),
    reb: sortTop(summariesWithSeason, "avgReb"),
    ast: sortTop(summariesWithSeason, "avgAst"),
    fgPct: sortTop(summariesWithSeason, "fgPct"),
    tpPct: sortTop(summariesWithSeason, "tpPct"),
    passYds: passTop,
    rushYds: rushTop,
    recYds: recTop,
    recentTop,
    debug: { eventsTried: events.length, playersWithStats: summaries.length },
  }
}

const buildPlayerLeaders = async (league: LeagueKey, window = 5, topN = 5) => {
  const season = seasonForSport(league)
  // Use curated star list only to avoid timeouts and stale rosters
  const players: Array<{ id: string; name: string }> = (STAR_PLAYERS[league] || []).map((id) => ({ id, name: id }))

  const summaries: any[] = []
  let playersTried = 0
  let playersWithLogs = 0
  for (const p of players) {
    playersTried++
    let logs: any = await getPlayerGameLogs(league, p.id, season, 2)
    let base = Array.isArray(logs)
      ? logs
      : logs?.events || logs?.gameLog || logs?.gamelog || logs?.items || logs?.entries || []
    if (!base || (Array.isArray(base) && base.length === 0)) {
      logs = await getPlayerGameLogs(league, p.id, season - 1, 2)
      base = Array.isArray(logs)
        ? logs
        : logs?.events || logs?.gameLog || logs?.gamelog || logs?.items || logs?.entries || []
    }
    const recent: any[] = lastN(base as any[], window) as any[]
    if (!recent.length) continue
    playersWithLogs++
    let pts = 0, reb = 0, ast = 0, fgm = 0, fga = 0, tpm = 0, tpa = 0
    let seasonPts = 0, seasonReb = 0, seasonAst = 0, seasonFgm = 0, seasonFga = 0, seasonTpm = 0, seasonTpa = 0
    let seasonGames = 0
    for (const gRaw of recent) {
      const g = gRaw || {}
      const gs: any = extractGameStats(g, league)
      pts += gs.pts ?? 0
      reb += gs.reb ?? 0
      ast += gs.ast ?? 0
      fgm += gs.fgm ?? 0
      fga += gs.fga ?? 0
      tpm += gs.tpm ?? 0
      tpa += gs.tpa ?? 0
    }
    for (const gRaw of base as any[]) {
      const g = gRaw || {}
      const gs: any = extractGameStats(g, league)
      if (gs.pts == null && gs.reb == null && gs.ast == null && gs.fgm == null && gs.fga == null && gs.tpm == null && gs.tpa == null) continue
      seasonGames += 1
      seasonPts += gs.pts ?? 0
      seasonReb += gs.reb ?? 0
      seasonAst += gs.ast ?? 0
      seasonFgm += gs.fgm ?? 0
      seasonFga += gs.fga ?? 0
      seasonTpm += gs.tpm ?? 0
      seasonTpa += gs.tpa ?? 0
    }
    const first = recent[0] as any
    const name = (first?.athlete?.displayName || first?.athlete?.fullName || first?.athlete?.name || p.name || "").trim() || p.id
    summaries.push({
      ...p,
      name,
      sample: recent.length,
      avgPts: recent.length ? pts / recent.length : null,
      avgReb: recent.length ? reb / recent.length : null,
      avgAst: recent.length ? ast / recent.length : null,
      seasonAvgPts: seasonGames ? seasonPts / seasonGames : null,
      seasonAvgReb: seasonGames ? seasonReb / seasonGames : null,
      seasonAvgAst: seasonGames ? seasonAst / seasonGames : null,
      seasonAvgThrees: seasonGames ? seasonTpm / seasonGames : null,
      fgPct: fga ? fgm / fga : null,
      tpPct: tpa ? tpm / tpa : null,
      avgPass: league === "nfl" ? recent.length ? pts / recent.length : null : null,
      avgRush: league === "nfl" ? recent.length ? reb / recent.length : null : null,
      avgRec: league === "nfl" ? recent.length ? ast / recent.length : null : null,
    })
  }

  const sortTop = (arr: any[], key: string) =>
    arr.filter((p) => p[key] != null).sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).slice(0, topN)

  const passTop = sortTop(summaries, "avgPass")
  const rushTop = sortTop(summaries, "avgRush")
  const recTop = sortTop(summaries, "avgRec")
  const recentTop =
    league === "nfl"
      ? [...passTop.slice(0, topN), ...rushTop.slice(0, topN), ...recTop.slice(0, topN)].slice(0, Math.max(1, topN * 3))
      : sortTop(summaries, "avgPts")

  return {
    pts: sortTop(summaries, "avgPts"),
    reb: sortTop(summaries, "avgReb"),
    ast: sortTop(summaries, "avgAst"),
    fgPct: sortTop(summaries, "fgPct"),
    tpPct: sortTop(summaries, "tpPct"),
    passYds: passTop,
    rushYds: rushTop,
    recYds: recTop,
    recentTop,
    debug: { playersTried, playersWithLogs },
  }
}

export const GET = async (req: Request) => {
  const { searchParams } = new URL(req.url)
  const leagueKey = (searchParams.get("league") || "nba").toLowerCase() as LeagueKey
  const league = LEAGUES[leagueKey]
  if (!league) return NextResponse.json({ error: "Unsupported league" }, { status: 400 })
  const debug = searchParams.get("debug") === "1"
  const window = Math.max(3, Math.min(Number(searchParams.get("window") || "5"), 10))

  try {
    const [{ trends: teamRecent }, boxLeaders, playerLeaders] = await Promise.all([
      buildTeamRecent(leagueKey, window),
      buildPlayerLeadersFromBox(leagueKey, window, 10, 30),
      buildPlayerLeaders(leagueKey, window),
    ])
    const finalLeaders = boxLeaders?.pts?.length ? boxLeaders : playerLeaders
    const playerRecent = finalLeaders?.recentTop || []
    const bettingSource = playerLeaders?.recentTop?.length ? playerLeaders : finalLeaders
    const bettingRecent = bettingSource?.recentTop || playerRecent
    const fallbackPlayers = bettingSource
      ? [
          ...(bettingSource.recentTop || []),
          ...(bettingSource.pts || []),
          ...(bettingSource.reb || []),
          ...(bettingSource.ast || []),
          ...(bettingSource.fgPct || []),
          ...(bettingSource.tpPct || []),
          ...(bettingSource.passYds || []),
          ...(bettingSource.rushYds || []),
          ...(bettingSource.recYds || []),
        ]
      : bettingRecent
    const uniquePlayers = (() => {
      const seen = new Set<string>()
      const result: any[] = []
      for (const player of fallbackPlayers) {
        const key = String(player?.id || player?.name || "").trim()
        if (!key || seen.has(key)) continue
        seen.add(key)
        result.push(player)
      }
      return result
    })()
    const bettingTrends = await buildBettingTrends(leagueKey, bettingRecent, uniquePlayers, 5, 5)
    return NextResponse.json({
      league: leagueKey,
      teamRecent,
      playerRecent,
      playerLeaders: finalLeaders,
      bettingTrends,
      window,
      ...(debug
        ? { seasonUsed: seasonForSport(leagueKey), playerDebug: finalLeaders?.debug }
        : {}),
    })
  } catch (err) {
    console.error("[performances/top] failed", err)
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 })
  }
}
