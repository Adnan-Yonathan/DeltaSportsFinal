import { NextRequest, NextResponse } from "next/server"

import { fetchSbdOdds, fetchSbdTrends, resolveSbdLeague, type SbdLeague } from "@/lib/api/sbd"
import { getTeamStats, type TeamStats } from "@/lib/sports-stats-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TeamMetric = {
  label: string
  value: string
}

type TeamProfile = {
  name: string
  abbr: string | null
  logoUrl: string | null
  record: string | null
  metrics: TeamMetric[]
  trend: {
    spreadRecord: string | null
    spreadRoi: string | null
    totalsRecord: string | null
    totalsRoi: string | null
    moneylineRecord: string | null
    moneylineRoi: string | null
  } | null
}

type MatchupIntelPayload = {
  updatedAt: string
  matchup: {
    sportKey: string
    commenceTime: string | null
    awayTeam: TeamProfile
    homeTeam: TeamProfile
  }
  sbd: {
    league: SbdLeague | null
    matched: boolean
    gameId: string | null
    status: string | null
    splits: {
      updatedAt: string | null
      moneyline: {
        homeBetsPct: number | null
        homeMoneyPct: number | null
        awayBetsPct: number | null
        awayMoneyPct: number | null
      } | null
      spread: {
        homeBetsPct: number | null
        homeMoneyPct: number | null
        awayBetsPct: number | null
        awayMoneyPct: number | null
      } | null
      total: {
        overBetsPct: number | null
        overMoneyPct: number | null
        underBetsPct: number | null
        underMoneyPct: number | null
      } | null
    } | null
  }
  insights: string[]
}

const CACHE_TTL_MS = 90_000
const responseCache = new Map<string, { expiresAt: number; payload: MatchupIntelPayload }>()

const SUPPORTED_SPORTS = new Set([
  "basketball_nba",
  "basketball_ncaab",
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "baseball_mlb",
  "icehockey_nhl",
])

const normalizeKey = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

const normalizeText = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "")
    if (!cleaned) return null
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const formatMetricValue = (label: string, value: number) => {
  if (label.includes("%")) {
    const pctValue = Math.abs(value) <= 1 ? value * 100 : value
    return `${pctValue.toFixed(1)}%`
  }
  if (Math.abs(value) >= 100) return value.toFixed(0)
  return value.toFixed(1)
}

const statValueByAliases = (stats: Record<string, unknown>, aliases: string[]) => {
  const normalized = new Map<string, unknown>()
  for (const [key, value] of Object.entries(stats)) {
    normalized.set(normalizeKey(key), value)
  }

  for (const alias of aliases) {
    if (alias in stats) {
      const parsed = parseNumber(stats[alias])
      if (parsed != null) return parsed
    }
    const parsed = parseNumber(normalized.get(normalizeKey(alias)))
    if (parsed != null) return parsed
  }

  return null
}

const metricDefinitionBySport: Record<string, Array<{ label: string; aliases: string[] }>> = {
  basketball_nba: [
    { label: "PPG", aliases: ["pointsForPerGame", "points_for_per_game", "ppg", "avgPoints", "points"] },
    { label: "Opp PPG", aliases: ["pointsAgainstPerGame", "points_against_per_game", "papg", "oppPpg"] },
    { label: "Off Rating", aliases: ["offensiveRating", "offensive_rating", "offRtg"] },
    { label: "Def Rating", aliases: ["defensiveRating", "defensive_rating", "defRtg"] },
    { label: "Net Rating", aliases: ["netRating", "net_rating"] },
    { label: "Pace", aliases: ["pace"] },
  ],
  basketball_ncaab: [
    { label: "PPG", aliases: ["pointsForPerGame", "points_for_per_game", "pointsPerGame", "ppg"] },
    { label: "Opp PPG", aliases: ["pointsAgainstPerGame", "points_against_per_game", "oppPpg", "papg"] },
    { label: "FG%", aliases: ["fieldGoalPct", "field_goal_pct", "fgPct", "fg_percent"] },
    { label: "3P%", aliases: ["threePointPct", "three_point_pct", "threePct", "3p_pct"] },
    { label: "Reb", aliases: ["reboundsPerGame", "rebounds_per_game", "rebPerGame"] },
    { label: "Ast", aliases: ["assistsPerGame", "assists_per_game", "astPerGame"] },
  ],
  americanfootball_nfl: [
    { label: "PPG", aliases: ["pointsForPerGame", "points_for_per_game", "ppg"] },
    { label: "Opp PPG", aliases: ["pointsAgainstPerGame", "points_against_per_game", "papg"] },
    { label: "Yds/Play", aliases: ["yardsPerPlay", "yards_per_play"] },
    { label: "EPA/Play", aliases: ["epaPerPlay", "epa_per_play"] },
    { label: "Success%", aliases: ["successRate", "success_rate"] },
    { label: "Turnover Diff", aliases: ["turnoverDiff", "turnover_diff", "turnoverMargin"] },
  ],
  americanfootball_ncaaf: [
    { label: "PPG", aliases: ["pointsForPerGame", "points_for_per_game", "ppg"] },
    { label: "Opp PPG", aliases: ["pointsAgainstPerGame", "points_against_per_game", "papg"] },
    { label: "Yds/Play", aliases: ["yardsPerPlay", "yards_per_play"] },
    { label: "Success%", aliases: ["successRate", "success_rate"] },
    { label: "Pass Rate%", aliases: ["passRate", "pass_rate"] },
    { label: "Rush Rate%", aliases: ["rushRate", "rush_rate"] },
  ],
  baseball_mlb: [
    { label: "Runs/G", aliases: ["runsPerGame", "runs_per_game", "pointsForPerGame"] },
    { label: "Runs Allowed/G", aliases: ["runsAllowedPerGame", "runs_allowed_per_game", "pointsAgainstPerGame"] },
    { label: "OPS", aliases: ["ops", "OPS"] },
    { label: "ERA", aliases: ["era", "ERA"] },
    { label: "WHIP", aliases: ["whip", "WHIP"] },
    { label: "K/9", aliases: ["kPer9", "k_per_9", "strikeoutsPer9"] },
  ],
  icehockey_nhl: [
    { label: "Goals/G", aliases: ["goalsForPerGame", "goals_for_per_game", "pointsForPerGame"] },
    { label: "Goals Against/G", aliases: ["goalsAgainstPerGame", "goals_against_per_game", "pointsAgainstPerGame"] },
    { label: "PP%", aliases: ["powerPlayPct", "power_play_pct", "ppPct"] },
    { label: "PK%", aliases: ["penaltyKillPct", "penalty_kill_pct", "pkPct"] },
    { label: "Shots/G", aliases: ["shotsPerGame", "shots_per_game"] },
    { label: "Shots Against/G", aliases: ["shotsAgainstPerGame", "shots_against_per_game"] },
  ],
}

const buildMetrics = (sportKey: string, stats: Record<string, unknown> | null | undefined): TeamMetric[] => {
  if (!stats || typeof stats !== "object") return []
  const definitions = metricDefinitionBySport[sportKey] ?? metricDefinitionBySport.basketball_nba

  return definitions
    .map((definition) => {
      const metricValue = statValueByAliases(stats, definition.aliases)
      if (metricValue == null) return null
      return {
        label: definition.label,
        value: formatMetricValue(definition.label, metricValue),
      }
    })
    .filter((value): value is TeamMetric => Boolean(value))
}

const resolveLogoUrl = (sportKey: string, abbr?: string | null) => {
  const cleanedAbbr = String(abbr || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
  if (!cleanedAbbr) return null

  if (sportKey === "basketball_nba") return `https://a.espncdn.com/i/teamlogos/nba/500/${cleanedAbbr}.png`
  if (sportKey === "americanfootball_nfl") return `https://a.espncdn.com/i/teamlogos/nfl/500/${cleanedAbbr}.png`
  if (sportKey === "baseball_mlb") return `https://a.espncdn.com/i/teamlogos/mlb/500/${cleanedAbbr}.png`
  if (sportKey === "icehockey_nhl") return `https://a.espncdn.com/i/teamlogos/nhl/500/${cleanedAbbr}.png`
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${cleanedAbbr}.png`
}

const buildRecord = (team: TeamStats | null) => {
  if (!team) return null
  const wins = Number.isFinite(team.wins) ? team.wins : 0
  const losses = Number.isFinite(team.losses) ? team.losses : 0
  const winPct = Number.isFinite(team.winPct) ? team.winPct : null
  if (winPct != null) {
    return `${wins}-${losses} (${(winPct * 100).toFixed(1)}%)`
  }
  return `${wins}-${losses}`
}

const scoreNameMatch = (expected: string, candidate: string) => {
  const expectedKey = normalizeKey(expected)
  const candidateKey = normalizeKey(candidate)
  if (!expectedKey || !candidateKey) return 0
  if (expectedKey === candidateKey) return 1
  if (candidateKey.includes(expectedKey) || expectedKey.includes(candidateKey)) return 0.75

  const expectedTokens = normalizeText(expected).split(" ").filter(Boolean)
  const candidateTokens = normalizeText(candidate).split(" ").filter(Boolean)
  const overlap = expectedTokens.filter((token) => candidateTokens.includes(token)).length
  if (!overlap) return 0
  return overlap / Math.max(expectedTokens.length, candidateTokens.length)
}

const resolveSbdGameMatch = (
  games: any[],
  homeTeam: string,
  awayTeam: string,
  commenceTime?: string | null
) => {
  let bestScore = 0
  let bestGame: any = null

  const expectedTime = commenceTime ? Date.parse(commenceTime) : Number.NaN

  for (const game of games) {
    const home = `${game?.competitors?.home?.market || ""} ${game?.competitors?.home?.name || ""}`.trim()
    const away = `${game?.competitors?.away?.market || ""} ${game?.competitors?.away?.name || ""}`.trim()

    const directScore = scoreNameMatch(homeTeam, home) + scoreNameMatch(awayTeam, away)
    const flippedScore = scoreNameMatch(homeTeam, away) + scoreNameMatch(awayTeam, home) - 0.15
    let score = Math.max(directScore, flippedScore)

    const gameTime = Date.parse(String(game?.scheduled || ""))
    if (Number.isFinite(expectedTime) && Number.isFinite(gameTime)) {
      const diffHours = Math.abs(expectedTime - gameTime) / (1000 * 60 * 60)
      if (diffHours <= 6) score += 0.35
      else if (diffHours <= 12) score += 0.15
    }

    if (score > bestScore) {
      bestScore = score
      bestGame = game
    }
  }

  if (!bestGame || bestScore < 1.2) return null
  return bestGame
}

const asNullablePct = (value: unknown) => {
  const parsed = parseNumber(value)
  if (parsed == null) return null
  return Math.max(0, Math.min(parsed, 100))
}

const parseSplits = (splits: any) => {
  if (!splits || typeof splits !== "object") return null
  return {
    updatedAt:
      typeof splits?.moneyline?.updated === "string" && splits.moneyline.updated
        ? splits.moneyline.updated
        : typeof splits?.spread?.updated === "string" && splits.spread.updated
          ? splits.spread.updated
          : typeof splits?.total?.updated === "string" && splits.total.updated
            ? splits.total.updated
            : null,
    moneyline: splits?.moneyline
      ? {
          homeBetsPct: asNullablePct(splits.moneyline?.home?.betsPercentage),
          homeMoneyPct: asNullablePct(splits.moneyline?.home?.stakePercentage),
          awayBetsPct: asNullablePct(splits.moneyline?.away?.betsPercentage),
          awayMoneyPct: asNullablePct(splits.moneyline?.away?.stakePercentage),
        }
      : null,
    spread: splits?.spread
      ? {
          homeBetsPct: asNullablePct(splits.spread?.home?.betsPercentage),
          homeMoneyPct: asNullablePct(splits.spread?.home?.stakePercentage),
          awayBetsPct: asNullablePct(splits.spread?.away?.betsPercentage),
          awayMoneyPct: asNullablePct(splits.spread?.away?.stakePercentage),
        }
      : null,
    total: splits?.total
      ? {
          overBetsPct: asNullablePct(splits.total?.over?.betsPercentage),
          overMoneyPct: asNullablePct(splits.total?.over?.stakePercentage),
          underBetsPct: asNullablePct(splits.total?.under?.betsPercentage),
          underMoneyPct: asNullablePct(splits.total?.under?.stakePercentage),
        }
      : null,
  }
}

const toTrendRecord = (wins?: number, losses?: number, ties?: number, overs?: number, unders?: number) => {
  if (Number.isFinite(wins) && Number.isFinite(losses)) {
    const tieLabel = Number.isFinite(ties) && (ties ?? 0) > 0 ? `-${ties}` : ""
    return `${wins}-${losses}${tieLabel}`
  }
  if (Number.isFinite(overs) && Number.isFinite(unders)) {
    const tieLabel = Number.isFinite(ties) && (ties ?? 0) > 0 ? `-${ties}` : ""
    return `${overs}-${unders}${tieLabel}`
  }
  return null
}

const toRoiLabel = (value: unknown) => {
  const parsed = parseNumber(value)
  if (parsed == null) return null
  const asPct = Math.abs(parsed) <= 1 ? parsed * 100 : parsed
  return `${asPct >= 0 ? "+" : ""}${asPct.toFixed(1)}%`
}

const resolveTrendForTeam = (trendsPayload: any, teamName: string, teamAbbr?: string | null) => {
  if (!trendsPayload || typeof trendsPayload !== "object") return null
  const entries = Object.values(trendsPayload).filter((entry) => entry && typeof entry === "object") as any[]
  if (!entries.length) return null

  const abbrKey = normalizeKey(teamAbbr)
  if (abbrKey) {
    const directByKey = Object.entries(trendsPayload).find(([key]) => normalizeKey(key) === abbrKey)
    if (directByKey) return directByKey[1] as any
  }

  const teamKey = normalizeKey(teamName)
  const best = entries
    .map((entry) => {
      const label = `${entry?.name || ""} ${entry?.nickname || ""} ${entry?.stageName || ""}`.trim()
      return { entry, score: scoreNameMatch(teamKey, label) }
    })
    .sort((a, b) => b.score - a.score)[0]

  if (!best || best.score < 0.55) return null
  return best.entry
}

const buildTrendSummary = (entry: any) => {
  if (!entry || typeof entry !== "object") return null
  return {
    spreadRecord: toTrendRecord(entry?.spread?.wins, entry?.spread?.loses, entry?.spread?.ties),
    spreadRoi: toRoiLabel(entry?.spread?.win_roi),
    totalsRecord: toTrendRecord(
      undefined,
      undefined,
      entry?.totals?.ties,
      entry?.totals?.overs,
      entry?.totals?.unders
    ),
    totalsRoi: toRoiLabel(entry?.totals?.over_roi),
    moneylineRecord: toTrendRecord(entry?.moneyline?.wins, entry?.moneyline?.loses, entry?.moneyline?.ties),
    moneylineRoi: toRoiLabel(entry?.moneyline?.win_roi),
  }
}

const safeDiff = (a: number | null, b: number | null) =>
  a != null && b != null && Number.isFinite(a) && Number.isFinite(b) ? a - b : null

const buildInsights = (params: {
  sportKey: string
  home: TeamProfile
  away: TeamProfile
  homeRaw: TeamStats | null
  awayRaw: TeamStats | null
  splits: ReturnType<typeof parseSplits>
}) => {
  const { home, away, homeRaw, awayRaw, splits } = params
  const insights: string[] = []

  const homeStats = (homeRaw?.stats as Record<string, unknown>) ?? {}
  const awayStats = (awayRaw?.stats as Record<string, unknown>) ?? {}

  const homeNet = statValueByAliases(homeStats, ["netRating", "net_rating"])
  const awayNet = statValueByAliases(awayStats, ["netRating", "net_rating"])
  const netDiff = safeDiff(homeNet, awayNet)
  if (netDiff != null && Math.abs(netDiff) >= 2) {
    const side = netDiff > 0 ? home.name : away.name
    insights.push(`${side} owns a ${Math.abs(netDiff).toFixed(1)} net-rating edge in season profile.`)
  }

  const homePace = statValueByAliases(homeStats, ["pace"])
  const awayPace = statValueByAliases(awayStats, ["pace"])
  if (homePace != null && awayPace != null && homePace + awayPace >= 200) {
    insights.push("Combined pace profile is elevated, which can support higher-variance scoring environments.")
  }

  const spreadHomeBets = splits?.spread?.homeBetsPct ?? null
  const spreadHomeMoney = splits?.spread?.homeMoneyPct ?? null
  const spreadDiff = safeDiff(spreadHomeMoney, spreadHomeBets)
  if (spreadDiff != null && Math.abs(spreadDiff) >= 8) {
    const side = spreadDiff > 0 ? home.name : away.name
    insights.push(`${side} shows a spread split divergence of ${Math.abs(spreadDiff).toFixed(1)} pts (money vs bets).`)
  }

  const mlHomeBets = splits?.moneyline?.homeBetsPct ?? null
  const mlHomeMoney = splits?.moneyline?.homeMoneyPct ?? null
  const mlDiff = safeDiff(mlHomeMoney, mlHomeBets)
  if (mlDiff != null && Math.abs(mlDiff) >= 8) {
    const side = mlDiff > 0 ? home.name : away.name
    insights.push(`${side} has a moneyline split divergence of ${Math.abs(mlDiff).toFixed(1)} pts.`)
  }

  const overBets = splits?.total?.overBetsPct ?? null
  const overMoney = splits?.total?.overMoneyPct ?? null
  const totalDiff = safeDiff(overMoney, overBets)
  if (totalDiff != null && Math.abs(totalDiff) >= 8) {
    const side = totalDiff > 0 ? "over" : "under"
    insights.push(`Totals market shows ${side.toUpperCase()} money/bets divergence (${Math.abs(totalDiff).toFixed(1)} pts).`)
  }

  if (home.trend?.spreadRoi && away.trend?.spreadRoi) {
    const homeRoi = parseNumber(home.trend.spreadRoi)
    const awayRoi = parseNumber(away.trend.spreadRoi)
    const roiDiff = safeDiff(homeRoi, awayRoi)
    if (roiDiff != null && Math.abs(roiDiff) >= 5) {
      const side = roiDiff > 0 ? home.name : away.name
      insights.push(`${side} has materially stronger ATS ROI trend in recent history.`)
    }
  }

  if (insights.length === 0) {
    insights.push("No single dominant edge yet; combine line movement and split changes closer to kickoff for confirmation.")
  }

  return insights.slice(0, 6)
}

const buildCacheKey = (sportKey: string, homeTeam: string, awayTeam: string, commenceTime?: string | null) =>
  `${sportKey}:${normalizeKey(homeTeam)}:${normalizeKey(awayTeam)}:${String(commenceTime || "").slice(0, 16)}`

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const sportKey = searchParams.get("sportKey") || ""
  const homeTeam = searchParams.get("homeTeam") || ""
  const awayTeam = searchParams.get("awayTeam") || ""
  const commenceTime = searchParams.get("commenceTime")

  if (!sportKey || !homeTeam || !awayTeam) {
    return NextResponse.json(
      { error: "sportKey, homeTeam, and awayTeam are required." },
      { status: 400 }
    )
  }

  if (!SUPPORTED_SPORTS.has(sportKey)) {
    return NextResponse.json(
      { error: `Unsupported sportKey "${sportKey}".` },
      { status: 400 }
    )
  }

  const cacheKey = buildCacheKey(sportKey, homeTeam, awayTeam, commenceTime)
  const cached = responseCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...cached.payload, cache: { hit: true } })
  }

  try {
    const [homeCandidates, awayCandidates] = await Promise.all([
      getTeamStats(sportKey, homeTeam),
      getTeamStats(sportKey, awayTeam),
    ])

    const homeRaw = (homeCandidates?.[0] as TeamStats | undefined) ?? null
    const awayRaw = (awayCandidates?.[0] as TeamStats | undefined) ?? null

    const homeProfileBase = {
      name: homeRaw?.team || homeTeam,
      abbr: (homeRaw as any)?.teamAbbr ? String((homeRaw as any).teamAbbr) : null,
      logoUrl: resolveLogoUrl(sportKey, (homeRaw as any)?.teamAbbr),
      record: buildRecord(homeRaw),
      metrics: buildMetrics(sportKey, (homeRaw?.stats as Record<string, unknown>) ?? null),
    }
    const awayProfileBase = {
      name: awayRaw?.team || awayTeam,
      abbr: (awayRaw as any)?.teamAbbr ? String((awayRaw as any).teamAbbr) : null,
      logoUrl: resolveLogoUrl(sportKey, (awayRaw as any)?.teamAbbr),
      record: buildRecord(awayRaw),
      metrics: buildMetrics(sportKey, (awayRaw?.stats as Record<string, unknown>) ?? null),
    }

    const sbdLeague = resolveSbdLeague(sportKey)
    let matchedGame: any = null
    let parsedSplits: ReturnType<typeof parseSplits> = null
    let trendsPayload: any = null

    if (sbdLeague) {
      const [oddsResult, trendsResult] = await Promise.allSettled([
        fetchSbdOdds(sbdLeague, { init: { cache: "no-store" } }),
        fetchSbdTrends(sbdLeague, {}, { init: { cache: "no-store" } }),
      ])

      if (oddsResult.status === "fulfilled") {
        const games = Array.isArray(oddsResult.value?.data) ? oddsResult.value.data : []
        matchedGame = resolveSbdGameMatch(games, homeTeam, awayTeam, commenceTime)
        parsedSplits = parseSplits(matchedGame?.bettingSplits)
      }
      if (trendsResult.status === "fulfilled") {
        trendsPayload = trendsResult.value
      }
    }

    const homeTrend = buildTrendSummary(
      resolveTrendForTeam(trendsPayload, homeProfileBase.name, homeProfileBase.abbr)
    )
    const awayTrend = buildTrendSummary(
      resolveTrendForTeam(trendsPayload, awayProfileBase.name, awayProfileBase.abbr)
    )

    const homeProfile: TeamProfile = {
      ...homeProfileBase,
      trend: homeTrend,
    }
    const awayProfile: TeamProfile = {
      ...awayProfileBase,
      trend: awayTrend,
    }

    const payload: MatchupIntelPayload = {
      updatedAt: new Date().toISOString(),
      matchup: {
        sportKey,
        commenceTime: commenceTime ?? null,
        awayTeam: awayProfile,
        homeTeam: homeProfile,
      },
      sbd: {
        league: sbdLeague,
        matched: Boolean(matchedGame),
        gameId: matchedGame?.id ? String(matchedGame.id) : null,
        status: matchedGame?.status ? String(matchedGame.status) : null,
        splits: parsedSplits,
      },
      insights: buildInsights({
        sportKey,
        home: homeProfile,
        away: awayProfile,
        homeRaw,
        awayRaw,
        splits: parsedSplits,
      }),
    }

    responseCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return NextResponse.json({ ...payload, cache: { hit: false } })
  } catch (error: any) {
    console.error("[intel/matchup] failed", error)
    return NextResponse.json(
      { error: error?.message || "Failed to load matchup intel." },
      { status: 500 }
    )
  }
}
