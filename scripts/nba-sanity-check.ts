import { fetchSbdOdds, mapSbdOddsToOddsGames } from '@/lib/api/sbd'
import { MARKETS, type OddsGame } from '@/lib/types/odds'
import { getTeamStats, type TeamStats as ApiTeamStats } from '@/lib/sports-stats-api'
import { detectInjuries } from '@/lib/services/injury-detector'
import {
  calculateFairSpreadNba,
  calculateFairTotalNba,
  type TeamStats,
} from '@/lib/services/pregame-value-calculator'
import { calculateStyleMatchupAdjustment } from '@/lib/services/matchup-analyzer'

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

const buildTeamMap = (teams: ApiTeamStats[]) => {
  const map = new Map<string, TeamStats>()
  for (const team of teams) {
    const modelStats = toModelStats(team)
    if (!modelStats) continue
    map.set(normalize(team.team), modelStats)
  }
  return map
}

const applyInjuries = async (teamName: string, baseStats: TeamStats) => {
  const injuryReport = await detectInjuries(teamName)
  if (!injuryReport || !injuryReport.injuries.length) return baseStats
  return {
    ...baseStats,
    ortg: baseStats.ortg - injuryReport.totalImpact.ortgDrop,
    drtg: baseStats.drtg + injuryReport.totalImpact.drtgIncrease,
    pace: baseStats.pace + injuryReport.totalImpact.paceDrop,
  }
}

const getScoreboard = async (dateStr: string) => {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr.replace(/-/g, '')}&limit=500`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Scoreboard fetch failed (${dateStr}): ${res.status}`)
  return res.json() as Promise<{ events?: any[] }>
}

const extractMarketLine = (game: OddsGame) => {
  let spreadPoints: number[] = []
  let totalPoints: number[] = []

  for (const book of game.bookmakers || []) {
    const spreadMarket = book.markets.find((market) => market.key === MARKETS.SPREADS)
    if (spreadMarket) {
      const homeOutcome = spreadMarket.outcomes.find(
        (outcome) => normalize(outcome.name) === normalize(game.home_team)
      )
      if (homeOutcome?.point != null) spreadPoints.push(homeOutcome.point)
    }

    const totalMarket = book.markets.find((market) => market.key === MARKETS.TOTALS)
    if (totalMarket) {
      const overOutcome = totalMarket.outcomes.find((outcome) => outcome.name.toLowerCase() === 'over')
      if (overOutcome?.point != null) totalPoints.push(overOutcome.point)
    }
  }

  const avg = (values: number[]) =>
    values.length ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2)) : null

  return {
    spread: avg(spreadPoints),
    total: avg(totalPoints),
    spreadBooks: spreadPoints.length,
    totalBooks: totalPoints.length,
  }
}

const run = async () => {
  const dateStr = new Date().toISOString().split('T')[0]
  const scoreboard = await getScoreboard(dateStr)
  const events = scoreboard?.events || []

  const oddsPayload = await fetchSbdOdds('nba')
  const oddsGames = mapSbdOddsToOddsGames('nba', oddsPayload, [MARKETS.SPREADS, MARKETS.TOTALS])
  const oddsMap = new Map(oddsGames.map((game) => [normalize(`${game.away_team} @ ${game.home_team}`), game]))

  const teams = await getTeamStats('basketball_nba')
  const teamMap = buildTeamMap(teams)

  const results: any[] = []
  for (const event of events) {
    const competition = event?.competitions?.[0]
    const competitors = competition?.competitors || []
    const home = competitors.find((c: any) => c.homeAway === 'home')
    const away = competitors.find((c: any) => c.homeAway === 'away')
    if (!home || !away) continue

    const homeName = home?.team?.displayName || home?.team?.name
    const awayName = away?.team?.displayName || away?.team?.name
    const key = normalize(`${awayName} @ ${homeName}`)

    const homeStatsBase = teamMap.get(normalize(homeName))
    const awayStatsBase = teamMap.get(normalize(awayName))
    if (!homeStatsBase || !awayStatsBase) continue

    const homeStats = await applyInjuries(homeName, homeStatsBase)
    const awayStats = await applyInjuries(awayName, awayStatsBase)
    const styleMatchup = calculateStyleMatchupAdjustment(homeStats, awayStats)

    const modelSpread = -calculateFairSpreadNba(
      homeStats,
      awayStats,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      styleMatchup
    )
    const modelTotal = calculateFairTotalNba(homeStats, awayStats)

    const oddsGame = oddsMap.get(key)
    const market = oddsGame ? extractMarketLine(oddsGame) : { spread: null, total: null, spreadBooks: 0, totalBooks: 0 }

    results.push({
      matchup: `${awayName} @ ${homeName}`,
      status: competition?.status?.type?.shortDetail || competition?.status?.type?.description || '',
      model: {
        spread: Number(modelSpread.toFixed(1)),
        total: Number(modelTotal.toFixed(1)),
        styleNote: styleMatchup.reason || null,
      },
      market: {
        spread: market.spread,
        total: market.total,
        spreadBooks: market.spreadBooks,
        totalBooks: market.totalBooks,
      },
      edge: {
        spread: market.spread != null ? Number((modelSpread - market.spread).toFixed(1)) : null,
        total: market.total != null ? Number((modelTotal - market.total).toFixed(1)) : null,
      },
    })
  }

  console.log(JSON.stringify({ date: dateStr, results }, null, 2))
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
