import { getTeamStats, type TeamStats as ApiTeamStats } from '@/lib/sports-stats-api'
import { calculateFairSpreadNba, calculateFairTotalNba, type TeamStats } from '@/lib/services/pregame-value-calculator'

const YEAR = 2025
const MONTH = 11 // 0-based December

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

const getCompletedGamesInMonth = async () => {
  const games: Array<{
    home: string
    away: string
    homeScore: number
    awayScore: number
    overUnder: number | null
  }> = []
  const daysInMonth = new Date(YEAR, MONTH + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(YEAR, MONTH, day))
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
      const odds = competition?.odds?.[0]
      const overUnder = toNumber(odds?.overUnder)

      games.push({
        home: home?.team?.displayName || home?.team?.name,
        away: away?.team?.displayName || away?.team?.name,
        homeScore,
        awayScore,
        overUnder,
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

const run = async () => {
  const games = await getCompletedGamesInMonth()
  const teams = await getTeamStats('basketball_nba')
  const teamMap = buildTeamMap(teams)

  const unitStake = 100
  const winProfit = unitStake / 1.1

  let spreadCount = 0
  let spreadMae = 0
  let spreadRmse = 0
  let spreadWinPick = 0

  let moneylineWins = 0
  let moneylineLosses = 0
  let moneylineProfit = 0

  let totalCount = 0
  let totalMae = 0
  let totalRmse = 0
  let totalBets = 0
  let totalWins = 0
  let totalLosses = 0
  let totalPushes = 0
  let totalProfit = 0

  for (const game of games) {
    const homeStats = teamMap.get(normalize(game.home))
    const awayStats = teamMap.get(normalize(game.away))
    if (!homeStats || !awayStats) continue

    const predictedMargin = calculateFairSpreadNba(homeStats, awayStats)
    const actualMargin = game.homeScore - game.awayScore
    const spreadError = predictedMargin - actualMargin

    spreadMae += Math.abs(spreadError)
    spreadRmse += spreadError * spreadError
    spreadCount += 1

    const predictedWinner = predictedMargin > 0 ? 'home' : 'away'
    const actualWinner = actualMargin > 0 ? 'home' : 'away'
    if (predictedWinner === actualWinner) spreadWinPick += 1
    if (predictedWinner === actualWinner) {
      moneylineWins += 1
      moneylineProfit += winProfit
    } else {
      moneylineLosses += 1
      moneylineProfit -= unitStake
    }

    const predictedTotal = calculateFairTotalNba(homeStats, awayStats)
    const actualTotal = game.homeScore + game.awayScore
    const totalError = predictedTotal - actualTotal

    totalMae += Math.abs(totalError)
    totalRmse += totalError * totalError
    totalCount += 1

    if (game.overUnder != null) {
      const pick = predictedTotal > game.overUnder ? 'over' : 'under'
      const actual =
        actualTotal > game.overUnder ? 'over' : actualTotal < game.overUnder ? 'under' : 'push'
      if (actual === 'push') {
        totalPushes += 1
      } else {
        totalBets += 1
        if (pick === actual) {
          totalWins += 1
          totalProfit += winProfit
        } else {
          totalLosses += 1
          totalProfit -= unitStake
        }
      }
    }
  }

  const spreadMaeOut = spreadCount ? spreadMae / spreadCount : null
  const spreadRmseOut = spreadCount ? Math.sqrt(spreadRmse / spreadCount) : null
  const totalMaeOut = totalCount ? totalMae / totalCount : null
  const totalRmseOut = totalCount ? Math.sqrt(totalRmse / totalCount) : null
  const winPct = spreadCount ? (spreadWinPick / spreadCount) * 100 : null

  console.log(
    JSON.stringify(
      {
        period: `${YEAR}-${String(MONTH + 1).padStart(2, '0')}`,
        games: games.length,
        evaluated: spreadCount,
        spread: {
          mae: spreadMaeOut,
          rmse: spreadRmseOut,
          winnerAccuracyPct: winPct,
        },
        total: {
          mae: totalMaeOut,
          rmse: totalRmseOut,
        },
        moneyline: {
          bets: moneylineWins + moneylineLosses,
          wins: moneylineWins,
          losses: moneylineLosses,
          profit: moneylineProfit,
          unitStake,
          price: -110,
        },
        totalsBetting: {
          bets: totalBets,
          wins: totalWins,
          losses: totalLosses,
          pushes: totalPushes,
          profit: totalProfit,
          unitStake,
          price: -110,
        },
        note: 'Uses current team stats (approximate), no as-of snapshots.'
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
