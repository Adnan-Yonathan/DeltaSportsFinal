import { NextResponse } from "next/server"
import { getTeams, getTeamSchedule, getPlayerGameLogs, getRoster, getEventSnapshot } from "@/lib/services/espn-orchestrator"

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
              totals[aid] = { id: aid, name, games: 0, pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, passYds: 0, rushYds: 0, recYds: 0 }
            }
            const slot = totals[aid]
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

  const sortTop = (arr: any[], key: string) =>
    arr
      .filter((p) => p[key] != null)
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .slice(0, topN)

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
    const first = recent[0] as any
    const name = (first?.athlete?.displayName || first?.athlete?.fullName || first?.athlete?.name || p.name || "").trim() || p.id
    summaries.push({
      ...p,
      name,
      sample: recent.length,
      avgPts: recent.length ? pts / recent.length : null,
      avgReb: recent.length ? reb / recent.length : null,
      avgAst: recent.length ? ast / recent.length : null,
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
    return NextResponse.json({
      league: leagueKey,
      teamRecent,
      playerRecent,
      playerLeaders: finalLeaders,
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
