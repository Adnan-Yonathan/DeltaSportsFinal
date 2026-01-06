import { getTeamStats, type TeamStats as ApiTeamStats } from '@/lib/sports-stats-api'
import { calculateFairSpreadNba, type TeamStats, type NbaHierarchyWeights } from '@/lib/services/pregame-value-calculator'

const DAYS_BACK = Number(process.argv[2] ?? 14)

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  return null
}

const toOptional = (value: unknown): number | undefined => {
  const num = toNumber(value)
  return num == null ? undefined : num
}

const findStat = (stats: Record<string, unknown>, patterns: string[]) => {
  for (const [key, value] of Object.entries(stats)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    const upper = key.toUpperCase()
    if (patterns.some((pattern) => upper.includes(pattern))) return value
  }
  return null
}

const toModelStats = (team: ApiTeamStats): TeamStats | null => {
  const stats = (team.stats || {}) as Record<string, unknown>
  const gamesPlayed = toNumber(stats.gamesPlayed)
  const pointsFor = toNumber(stats.pointsFor)
  const pointsAgainst = toNumber(stats.pointsAgainst)
  const rawPpg = toNumber(stats.pointsForPerGame) ??
    (pointsFor != null && gamesPlayed ? pointsFor / gamesPlayed : null)
  const rawPapg = toNumber(stats.pointsAgainstPerGame) ??
    (pointsAgainst != null && gamesPlayed ? pointsAgainst / gamesPlayed : null)

  const validRating = (value: number | null) => value != null && value >= 50 && value <= 150 ? value : null
  const validPace = (value: number | null) => value != null && value >= 70 && value <= 120 ? value : null

  const pace =
    validPace(toNumber(stats.pace)) ??
    validPace(findStat(stats, ['PACE']))
  const ortg =
    validRating(toNumber(stats.offensiveRating)) ??
    validRating(findStat(stats, ['OFFENSIVE_RATING', 'OFF_RTG', 'ORTG'])) ??
    (rawPpg != null && pace ? Number(((rawPpg / pace) * 100).toFixed(1)) : null)
  const drtg =
    validRating(toNumber(stats.defensiveRating)) ??
    validRating(findStat(stats, ['DEFENSIVE_RATING', 'DEF_RTG', 'DRTG'])) ??
    (rawPapg != null && pace ? Number(((rawPapg / pace) * 100).toFixed(1)) : null)

  if (ortg == null || drtg == null || pace == null) return null

  return {
    ortg,
    drtg,
    pace,
    eFG: toOptional(stats.effectiveFgPct ?? stats.effectiveFieldGoalPct),
    ts: toOptional(stats.trueShootingPct),
    threePointPct: toOptional(stats.threePointPct),
    fieldGoalPct: toOptional(stats.fieldGoalPct),
    turnoverPct: toOptional(stats.turnoverPct),
    offensiveReboundPct: toOptional(stats.offensiveReboundPct),
    defensiveReboundPct: toOptional(stats.defensiveReboundPct),
    freeThrowRate: toOptional(stats.freeThrowRate),
    pointsForPerGame: rawPpg ?? undefined,
    pointsAgainstPerGame: rawPapg ?? undefined,
    oppEfgPct: toOptional(stats.oppEfgPct),
    oppTsPct: toOptional(stats.oppTsPct),
    oppPtsPerGame: toOptional(stats.oppPtsPerGame),
    oppTovPerGame: toOptional(stats.oppTovPerGame),
    oppRebPerGame: toOptional(stats.oppRebPerGame),
    oppPaintPtsPerGame: toOptional(stats.oppPaintPtsPerGame),
    oppFastbreakPtsPerGame: toOptional(stats.oppFastbreakPtsPerGame),
    oppSecondChancePtsPerGame: toOptional(stats.oppSecondChancePtsPerGame),
    oppPtsOffToPerGame: toOptional(stats.oppPtsOffToPerGame),
  }
}

const getScoreboard = async (dateStr: string) => {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr.replace(/-/g, '')}&limit=500`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Scoreboard fetch failed (${dateStr}): ${res.status}`)
  return res.json() as Promise<{ events?: any[] }>
}

const getCompletedGames = async () => {
  const games: Array<{ home: string; away: string; homeScore: number; awayScore: number }> = []
  const today = new Date()

  for (let i = 1; i <= DAYS_BACK; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const scoreboard = await getScoreboard(dateStr)
    const events = scoreboard?.events || []

    for (const event of events) {
      const competition = event?.competitions?.[0]
      const status = competition?.status?.type?.state
      if (status !== 'post' && status !== 'final' && status !== 'completed') continue

      const competitors = competition?.competitors || []
      const home = competitors.find((c: any) => c.homeAway === 'home')
      const away = competitors.find((c: any) => c.homeAway === 'away')
      if (!home || !away) continue

      const homeScore = Number(home?.score)
      const awayScore = Number(away?.score)
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue

      games.push({
        home: home?.team?.displayName || home?.team?.name,
        away: away?.team?.displayName || away?.team?.name,
        homeScore,
        awayScore,
      })
    }
  }

  return games
}

const buildTeamMap = (teams: ApiTeamStats[]) => {
  const map = new Map<string, TeamStats>()
  for (const team of teams) {
    const modelStats = toModelStats(team)
    if (!modelStats) continue
    map.set(normalize(team.team), modelStats)
  }
  return map
}

const evaluateWeights = (
  games: Array<{ home: string; away: string; homeScore: number; awayScore: number }>,
  teamMap: Map<string, TeamStats>,
  weights: NbaHierarchyWeights
) => {
  let count = 0
  let mae = 0
  let rmse = 0

  for (const game of games) {
    const homeStats = teamMap.get(normalize(game.home))
    const awayStats = teamMap.get(normalize(game.away))
    if (!homeStats || !awayStats) continue

    const predicted = calculateFairSpreadNba(
      homeStats,
      awayStats,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      weights
    )
    const actual = game.homeScore - game.awayScore
    const error = predicted - actual
    mae += Math.abs(error)
    rmse += error * error
    count += 1
  }

  if (!count) return null
  return {
    count,
    mae: mae / count,
    rmse: Math.sqrt(rmse / count),
  }
}

const run = async () => {
  const games = await getCompletedGames()
  const teams = await getTeamStats('basketball_nba')
  const teamMap = buildTeamMap(teams)

  const efficiencyWeights = [0.2, 0.25, 0.3, 0.35, 0.4]
  const playTypeWeights = [0.1, 0.15, 0.2]

  let best: { weights: NbaHierarchyWeights; mae: number; rmse: number; count: number } | null = null

  for (const efficiency of efficiencyWeights) {
    for (const playType of playTypeWeights) {
      const core = 1 - efficiency - playType
      if (core < 0.45) continue
      const weights = { core, efficiency, playType }
      const metrics = evaluateWeights(games, teamMap, weights)
      if (!metrics) continue
      if (!best || metrics.mae < best.mae) {
        best = { weights, ...metrics }
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        daysBack: DAYS_BACK,
        gameCount: games.length,
        evaluated: best?.count ?? 0,
        best,
      },
      null,
      2
    )
  )
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
