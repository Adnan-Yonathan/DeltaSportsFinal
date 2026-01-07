import {
  searchAthlete,
  getEventSnapshot,
  getPlayerGameLogs,
  getTeamSchedule,
} from '@/lib/services/espn-orchestrator'
import { searchPlayer } from '@/lib/sports-stats-api'
import { resolveEspnTeamId } from '@/lib/utils/espn-team-lookup'
import {
  NBA_PROP_MARKET_KEYS,
  collectNbaLogStats,
  getNbaMarketValueFromStats,
} from '@/lib/services/nba-player-prop-model'
import { getNBATeamStats } from '@/lib/sports-stats-api'
import { fetchBasketballReferenceGameLogs } from '@/lib/providers/sports-reference'

type BacktestRow = {
  player: string
  market: string
  games: number
  mae: number
  avgError: number
  accuracy: number
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const getFlag = (flag: string) => {
    const idx = args.indexOf(flag)
    if (idx === -1) return undefined
    return args[idx + 1]
  }
  const players = (getFlag('--players') || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const markets = (getFlag('--markets') || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  const recentGames = Number(getFlag('--recent') || 5)
  const recentWeight = Number(getFlag('--weight') || 0.4)
  const lookback = Number(getFlag('--lookback') || 10)
  const season = Number(getFlag('--season') || 0)
  const months = (getFlag('--months') || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  const startDate = getFlag('--start')
  const endDate = getFlag('--end')
  return {
    players,
    markets,
    recentGames,
    recentWeight,
    lookback,
    season,
    months,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  }
}

const average = (values: number[]) =>
  values.reduce((sum, val) => sum + val, 0) / values.length

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

const trimmedMean = (values: number[], trimRatio: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const trim = Math.floor(sorted.length * trimRatio)
  const start = Math.min(trim, sorted.length - 1)
  const end = Math.max(sorted.length - trim, start + 1)
  const slice = sorted.slice(start, end)
  return slice.length ? average(slice) : average(sorted)
}

const weightedAverage = (values: number[], decay: number) => {
  let weightedSum = 0
  let weightTotal = 0
  for (let idx = 0; idx < values.length; idx += 1) {
    const weight = Math.pow(decay, idx)
    weightedSum += values[idx] * weight
    weightTotal += weight
  }
  return weightTotal ? weightedSum / weightTotal : average(values)
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)
const POINTS_MINUTES_CLAMP: [number, number] = [0.85, 1.15]

const computeProjection = (
  priorLogs: Record<string, number>[],
  marketKey: string,
  recentGames: number,
  recentWeight: number,
  opponentPAPG?: number,
  leaguePAPG?: number,
  opponentDefRating?: number,
  leagueDefRating?: number,
  opponentPace?: number,
  leaguePace?: number,
  isHome?: boolean
) => {
  const values = priorLogs
    .map((stats) => getNbaMarketValueFromStats(stats, marketKey))
    .filter((value): value is number => value != null && Number.isFinite(value))
  if (!values.length) return null

  const seasonAvg = average(values)
  const recentSlice = values.slice(-recentGames)
  const recentAvg = recentSlice.length ? average(recentSlice) : seasonAvg
  let projection = seasonAvg * (1 - recentWeight) + recentAvg * recentWeight
  if (marketKey === 'points' && values.length >= 6) {
    const minutesAll = priorLogs.map((s) => s['MIN']).filter((v): v is number => Number.isFinite(v))
    const minutesRecent = priorLogs
      .slice(-recentGames)
      .map((s) => s['MIN'])
      .filter((v): v is number => Number.isFinite(v))
    const minutesRecent3 = priorLogs
      .slice(-3)
      .map((s) => s['MIN'])
      .filter((v): v is number => Number.isFinite(v))
    const seasonMinutes = minutesAll.length ? trimmedMean(minutesAll, 0.1) : null
    const recentMinutes = minutesRecent.length ? average(minutesRecent) : seasonMinutes
    const recentMinutes3 = minutesRecent3.length ? average(minutesRecent3) : recentMinutes
    const minutesBase = seasonMinutes ?? recentMinutes ?? 32
    let expectedMinutes = minutesBase
    if (recentMinutes != null && minutesBase != null) {
      expectedMinutes =
        minutesBase * 0.3 + (recentMinutes ?? minutesBase) * 0.35 + (recentMinutes3 ?? recentMinutes ?? minutesBase) * 0.35
      expectedMinutes = clamp(
        expectedMinutes,
        minutesBase * POINTS_MINUTES_CLAMP[0],
        minutesBase * POINTS_MINUTES_CLAMP[1]
      )
    }

    const sample = priorLogs.slice(-Math.max(10, recentGames))
    const statSeries = (key: string) =>
      sample.map((s) => s[key]).filter((v): v is number => Number.isFinite(v))
    const fga = statSeries('FGA')
    const fgm = statSeries('FGM')
    const tpa = statSeries('3PA')
    const tpm = statSeries('3PM')
    const fta = statSeries('FTA')
    const ftm = statSeries('FTM')
    const tov = statSeries('TOV')
    const mins = statSeries('MIN')

    const useMinutes = expectedMinutes && Number.isFinite(expectedMinutes)
    let shotProjection = null as number | null
    if (fga.length && fgm.length && tpa.length && tpm.length && fta.length && ftm.length) {
      const avgFGA = average(fga)
      const avgFGM = average(fgm)
      const avg3PA = average(tpa)
      const avg3PM = average(tpm)
      const avgFTA = average(fta)
      const avgFTM = average(ftm)
      const twoPA = Math.max(avgFGA - avg3PA, 0)
      const twoPM = Math.max(avgFGM - avg3PM, 0)
      const twoPpct = twoPA ? twoPM / twoPA : 0
      const threePpct = avg3PA ? avg3PM / avg3PA : 0
      const ftpct = avgFTA ? avgFTM / avgFTA : 0

      let expFGA = avgFGA
      let exp3PA = avg3PA
      let expFTA = avgFTA
      if (useMinutes && mins.length) {
        const fgaRate = avgFGA / average(mins)
        const tpaRate = avg3PA / average(mins)
        const ftaRate = avgFTA / average(mins)
        expFGA = fgaRate * expectedMinutes
        exp3PA = Math.min(expFGA, tpaRate * expectedMinutes)
        expFTA = ftaRate * expectedMinutes
      }

      const expected2PM = Math.max(expFGA - exp3PA, 0) * twoPpct
      const expected3PM = exp3PA * threePpct
      const expectedFTM = expFTA * ftpct
      shotProjection = expected2PM * 2 + expected3PM * 3 + expectedFTM
    }

    const recentLogSlice = priorLogs.slice(-15)
    const recentPoints = recentLogSlice
      .map((s) => s['PTS'])
      .filter((v): v is number => Number.isFinite(v))
    const recentMinutesAll = recentLogSlice
      .map((s) => s['MIN'])
      .filter((v): v is number => Number.isFinite(v))
    const ppmSeries = recentLogSlice
      .map((s) => {
        const pts = s['PTS']
        const min = s['MIN']
        if (!Number.isFinite(pts) || !Number.isFinite(min) || min <= 0) return null
        return pts / min
      })
      .filter((v): v is number => v != null && Number.isFinite(v))
    const weightedPPM = ppmSeries.length
      ? weightedAverage([...ppmSeries].reverse(), 0.85)
      : null
    const weightedMinutes = recentMinutesAll.length
      ? weightedAverage([...recentMinutesAll].reverse(), 0.9)
      : expectedMinutes
    const baseline =
      weightedPPM != null && weightedMinutes != null
        ? weightedPPM * weightedMinutes
        : null
    const medianRecent = recentPoints.length ? median(recentPoints.slice(-7)) : null

    let usageProjection: number | null = null
    const usageSeries = recentLogSlice
      .map((s) => {
        const fgaVal = s['FGA']
        const ftaVal = s['FTA']
        const tovVal = s['TOV'] ?? 0
        const minVal = s['MIN']
        if (!Number.isFinite(fgaVal) || !Number.isFinite(ftaVal) || !Number.isFinite(minVal) || minVal <= 0) {
          return null
        }
        return (fgaVal + 0.44 * ftaVal + (Number.isFinite(tovVal) ? tovVal : 0)) / minVal
      })
      .filter((v): v is number => v != null && Number.isFinite(v))
    const ptsPerUsageSeries = recentLogSlice
      .map((s) => {
        const ptsVal = s['PTS']
        const fgaVal = s['FGA']
        const ftaVal = s['FTA']
        const tovVal = s['TOV'] ?? 0
        const usage = Number.isFinite(fgaVal) && Number.isFinite(ftaVal)
          ? fgaVal + 0.44 * ftaVal + (Number.isFinite(tovVal) ? tovVal : 0)
          : null
        if (!Number.isFinite(ptsVal) || !usage || usage <= 0) return null
        return ptsVal / usage
      })
      .filter((v): v is number => v != null && Number.isFinite(v))
    if (usageSeries.length && expectedMinutes != null) {
      const usagePerMin = weightedAverage([...usageSeries].reverse(), 0.85)
      const ptsPerUsage = ptsPerUsageSeries.length
        ? clamp(average(ptsPerUsageSeries), 0.7, 1.5)
        : 1.0
      usageProjection = usagePerMin * expectedMinutes * ptsPerUsage
    }

    const baseCandidates = [baseline, usageProjection, medianRecent, seasonAvg]
      .filter((v): v is number => v != null && Number.isFinite(v))
    if (baseCandidates.length) {
      projection =
        seasonAvg * 0.55 +
        (medianRecent ?? seasonAvg) * 0.2 +
        (baseline ?? seasonAvg) * 0.15 +
        (usageProjection ?? seasonAvg) * 0.1
    }
    if (shotProjection != null && Number.isFinite(shotProjection)) {
      projection = projection * 0.85 + shotProjection * 0.15
    }

    if (
      opponentPAPG &&
      leaguePAPG &&
      Number.isFinite(opponentPAPG) &&
      Number.isFinite(leaguePAPG)
    ) {
      const factor = clamp(opponentPAPG / leaguePAPG, 0.88, 1.12)
      projection *= factor
    }
    if (
      opponentDefRating &&
      leagueDefRating &&
      Number.isFinite(opponentDefRating) &&
      Number.isFinite(leagueDefRating)
    ) {
      const factor = clamp(opponentDefRating / leagueDefRating, 0.9, 1.12)
      projection *= factor
    }
    if (opponentPace && leaguePace && Number.isFinite(opponentPace) && Number.isFinite(leaguePace)) {
      const factor = clamp(opponentPace / leaguePace, 0.9, 1.1)
      projection *= factor
    }
    if (isHome === true) projection *= 1.02
    if (isHome === false) projection *= 0.98
  }
  return { projection, seasonAvg, recentAvg }
}

const stdDev = (values: number[]) => {
  if (values.length < 2) return 0
  const avg = average(values)
  const variance = average(values.map((v) => (v - avg) ** 2))
  return Math.sqrt(variance)
}

const computePointFeatures = (
  priorLogs: Array<{ date: string; stats: Record<string, number>; isHome?: boolean }>,
  currentDate: string,
  recentGames: number,
  opponent: { papg?: number | null; defRating?: number | null; pace?: number | null } | undefined,
  league: { papg?: number; defRating?: number; pace?: number },
  isHome?: boolean,
  teamContext?: { impliedTotal?: number | null; pointsFor?: number | null }
) => {
  const pointsSeries = priorLogs
    .map((s) => s.stats['PTS'])
    .filter((v): v is number => Number.isFinite(v))
  if (!pointsSeries.length) return null
  const seasonAvg = average(pointsSeries)
  const recentSlice = pointsSeries.slice(-recentGames)
  const recentAvg = recentSlice.length ? average(recentSlice) : seasonAvg
  const recentAvg3 = pointsSeries.length >= 3 ? average(pointsSeries.slice(-3)) : recentAvg
  const recentAvg7 = pointsSeries.length >= 7 ? average(pointsSeries.slice(-7)) : recentAvg
  const medianRecent = pointsSeries.length >= 3 ? median(pointsSeries.slice(-7)) : seasonAvg

  const minutesAll = priorLogs
    .map((s) => s.stats['MIN'])
    .filter((v): v is number => Number.isFinite(v))
  const minutesRecent = priorLogs
    .slice(-recentGames)
    .map((s) => s.stats['MIN'])
    .filter((v): v is number => Number.isFinite(v))
  const minutesRecent3 = priorLogs
    .slice(-3)
    .map((s) => s.stats['MIN'])
    .filter((v): v is number => Number.isFinite(v))
  const seasonMinutes = minutesAll.length ? trimmedMean(minutesAll, 0.1) : null
  const recentMinutes = minutesRecent.length ? average(minutesRecent) : seasonMinutes
  const recentMinutes3 = minutesRecent3.length ? average(minutesRecent3) : recentMinutes
  const minutesBase = seasonMinutes ?? recentMinutes ?? 32
  let expectedMinutes = minutesBase
  if (minutesBase && (recentMinutes != null || recentMinutes3 != null)) {
    expectedMinutes =
      minutesBase * 0.3 +
      (recentMinutes ?? minutesBase) * 0.35 +
      (recentMinutes3 ?? recentMinutes ?? minutesBase) * 0.35
    expectedMinutes = clamp(
      expectedMinutes,
      minutesBase * POINTS_MINUTES_CLAMP[0],
      minutesBase * POINTS_MINUTES_CLAMP[1]
    )
  }

  const sample = priorLogs.slice(-Math.max(10, recentGames))
  const statSeries = (key: string) =>
    sample.map((s) => s.stats[key]).filter((v): v is number => Number.isFinite(v))
  const fga = statSeries('FGA')
  const fgm = statSeries('FGM')
  const tpa = statSeries('3PA')
  const tpm = statSeries('3PM')
  const fta = statSeries('FTA')
  const ftm = statSeries('FTM')
  const mins = statSeries('MIN')

  let shotProjection: number | null = null
  if (fga.length && fgm.length && tpa.length && tpm.length && fta.length && ftm.length) {
    const avgFGA = average(fga)
    const avgFGM = average(fgm)
    const avg3PA = average(tpa)
    const avg3PM = average(tpm)
    const avgFTA = average(fta)
    const avgFTM = average(ftm)
    const twoPA = Math.max(avgFGA - avg3PA, 0)
    const twoPM = Math.max(avgFGM - avg3PM, 0)
    const twoPpct = twoPA ? twoPM / twoPA : 0
    const threePpct = avg3PA ? avg3PM / avg3PA : 0
    const ftpct = avgFTA ? avgFTM / avgFTA : 0

    let expFGA = avgFGA
    let exp3PA = avg3PA
    let expFTA = avgFTA
    if (expectedMinutes && mins.length) {
      const fgaRate = avgFGA / average(mins)
      const tpaRate = avg3PA / average(mins)
      const ftaRate = avgFTA / average(mins)
      expFGA = fgaRate * expectedMinutes
      exp3PA = Math.min(expFGA, tpaRate * expectedMinutes)
      expFTA = ftaRate * expectedMinutes
    }
    const expected2PM = Math.max(expFGA - exp3PA, 0) * twoPpct
    const expected3PM = exp3PA * threePpct
    const expectedFTM = expFTA * ftpct
    shotProjection = expected2PM * 2 + expected3PM * 3 + expectedFTM
  }

  const recentLogSlice = priorLogs.slice(-15)
  const ppmSeries = recentLogSlice
    .map((s) => {
      const pts = s.stats['PTS']
      const min = s.stats['MIN']
      if (!Number.isFinite(pts) || !Number.isFinite(min) || min <= 0) return null
      return pts / min
    })
    .filter((v): v is number => v != null && Number.isFinite(v))
  const weightedPPM = ppmSeries.length ? weightedAverage([...ppmSeries].reverse(), 0.85) : null
  const weightedMinutes = minutesRecent.length
    ? weightedAverage([...minutesRecent].reverse(), 0.9)
    : expectedMinutes
  const baseline =
    weightedPPM != null && weightedMinutes != null ? weightedPPM * weightedMinutes : null

  const usageSeries = recentLogSlice
    .map((s) => {
      const fgaVal = s.stats['FGA']
      const ftaVal = s.stats['FTA']
      const tovVal = s.stats['TOV'] ?? 0
      const minVal = s.stats['MIN']
      if (!Number.isFinite(fgaVal) || !Number.isFinite(ftaVal) || !Number.isFinite(minVal) || minVal <= 0) {
        return null
      }
      return (fgaVal + 0.44 * ftaVal + (Number.isFinite(tovVal) ? tovVal : 0)) / minVal
    })
    .filter((v): v is number => v != null && Number.isFinite(v))
  const ptsPerUsageSeries = recentLogSlice
    .map((s) => {
      const ptsVal = s.stats['PTS']
      const fgaVal = s.stats['FGA']
      const ftaVal = s.stats['FTA']
      const tovVal = s.stats['TOV'] ?? 0
      const usage = Number.isFinite(fgaVal) && Number.isFinite(ftaVal)
        ? fgaVal + 0.44 * ftaVal + (Number.isFinite(tovVal) ? tovVal : 0)
        : null
      if (!Number.isFinite(ptsVal) || !usage || usage <= 0) return null
      return ptsVal / usage
    })
    .filter((v): v is number => v != null && Number.isFinite(v))
  let usageProjection: number | null = null
  if (usageSeries.length && expectedMinutes != null) {
    const usagePerMin = weightedAverage([...usageSeries].reverse(), 0.85)
    const ptsPerUsage = ptsPerUsageSeries.length
      ? clamp(average(ptsPerUsageSeries), 0.7, 1.5)
      : 1.0
    usageProjection = usagePerMin * expectedMinutes * ptsPerUsage
  }

  const minutesTrend =
    recentMinutes != null && seasonMinutes != null ? recentMinutes - seasonMinutes : 0

  const seasonFga = priorLogs
    .map((s) => s.stats['FGA'])
    .filter((v): v is number => Number.isFinite(v))
  const seasonFta = priorLogs
    .map((s) => s.stats['FTA'])
    .filter((v): v is number => Number.isFinite(v))
  const seasonMinForUsage = priorLogs
    .map((s) => s.stats['MIN'])
    .filter((v): v is number => Number.isFinite(v) && v > 0)
  const seasonUsageProxy =
    seasonFga.length && seasonFta.length && seasonMinForUsage.length
      ? (average(seasonFga) + 0.44 * average(seasonFta)) / average(seasonMinForUsage)
      : null

  const recentFga = priorLogs
    .slice(-recentGames)
    .map((s) => s.stats['FGA'])
    .filter((v): v is number => Number.isFinite(v))
  const recentFta = priorLogs
    .slice(-recentGames)
    .map((s) => s.stats['FTA'])
    .filter((v): v is number => Number.isFinite(v))
  const recentMinForUsage = priorLogs
    .slice(-recentGames)
    .map((s) => s.stats['MIN'])
    .filter((v): v is number => Number.isFinite(v) && v > 0)
  const usageRecentProxy =
    recentFga.length && recentFta.length && recentMinForUsage.length
      ? (average(recentFga) + 0.44 * average(recentFta)) / average(recentMinForUsage)
      : null
  const usageTrend =
    usageRecentProxy != null && seasonUsageProxy != null
      ? usageRecentProxy - seasonUsageProxy
      : 0

  const papg = opponent?.papg ?? league.papg ?? null
  const defRating = opponent?.defRating ?? league.defRating ?? null
  const pace = opponent?.pace ?? league.pace ?? null
  const homeFlag = isHome === true ? 1 : isHome === false ? 0 : 0.5

  const recentPoints5 = pointsSeries.slice(-5)
  const recentMinutes5 = minutesAll.slice(-5)
  const pointsStd5 = recentPoints5.length ? stdDev(recentPoints5) : 0
  const minutesStd5 = recentMinutes5.length ? stdDev(recentMinutes5) : 0

  const currentDateObj = new Date(`${currentDate}T00:00:00Z`)
  const lastDateRaw = priorLogs[priorLogs.length - 1]?.date
  const lastDateObj = lastDateRaw ? new Date(`${lastDateRaw}T00:00:00Z`) : null
  const diffDays =
    lastDateObj && Number.isFinite(currentDateObj.getTime()) && Number.isFinite(lastDateObj.getTime())
      ? Math.max(0, Math.round((currentDateObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24)))
      : null
  const restDays = diffDays != null ? Math.max(0, diffDays - 1) : 1
  const backToBack = diffDays === 1 ? 1 : 0
  const recentDates = priorLogs.slice(-4).map((g) => g.date)
  const gamesInLast4Days = recentDates.filter((d) => {
    const dt = new Date(`${d}T00:00:00Z`)
    const delta = Math.round((currentDateObj.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24))
    return delta >= 1 && delta <= 4
  }).length
  const consecutiveAway = priorLogs
    .slice(-3)
    .reduce((count, g) => (!g.isHome ? count + 1 : count), 0)

  const leagueDefRating = league.defRating
  const leaguePace = league.pace
  const oppDefAdj =
    defRating && leagueDefRating
      ? clamp(leagueDefRating / defRating, 0.9, 1.12)
      : 1
  const oppPaceAdj =
    pace && leaguePace ? clamp(pace / leaguePace, 0.9, 1.12) : 1
  const oppAdjustedRecentAvg = recentAvg * oppDefAdj * oppPaceAdj

  const volatilityPenalty = pointsStd5 * 0.35

  const seasonPoints = seasonAvg
  let archetype: 'primary' | 'secondary' | 'role' = 'role'
  if (seasonPoints >= 24) archetype = 'primary'
  else if (seasonPoints >= 15) archetype = 'secondary'

  const last3Minutes = recentMinutes3
  const starterProxy =
    last3Minutes != null ? (last3Minutes >= 28 ? 'starter' : last3Minutes <= 24 ? 'bench' : 'swing') : 'swing'

  const impliedTotal = teamContext?.impliedTotal ?? null
  const teamPointsFor = teamContext?.pointsFor ?? null
  const impliedTotalFactor =
    impliedTotal != null && teamPointsFor != null
      ? clamp(impliedTotal / teamPointsFor, 0.9, 1.12)
      : null

  return {
    seasonAvg,
    recentAvg,
    recentAvg3,
    recentAvg7,
    medianRecent,
    oppAdjustedRecentAvg,
    expectedMinutes,
    baseline: baseline ?? seasonAvg,
    usageProjection: usageProjection ?? seasonAvg,
    shotProjection: shotProjection ?? seasonAvg,
    impliedTotal,
    impliedTotalFactor,
    papg,
    defRating,
    pace,
    homeFlag,
    pointsStd5,
    minutesStd5,
    volatilityPenalty,
    restDays,
    backToBack,
    gamesInLast4Days,
    consecutiveAway,
    minutesTrend,
    usageTrend,
    archetype,
    starterProxy,
  }
}

const buildMatrix = (rows: Array<number[]>, cols: number) => {
  const matrix: number[][] = []
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const out: number[] = []
    for (let c = 0; c < cols; c += 1) out.push(row[c] ?? 0)
    matrix.push(out)
  }
  return matrix
}

const transpose = (a: number[][]) => a[0].map((_, i) => a.map((row) => row[i]))

const multiply = (a: number[][], b: number[][]) => {
  const out: number[][] = Array.from({ length: a.length }, () => Array(b[0].length).fill(0))
  for (let i = 0; i < a.length; i += 1) {
    for (let k = 0; k < b.length; k += 1) {
      const val = a[i][k]
      if (!val) continue
      for (let j = 0; j < b[0].length; j += 1) {
        out[i][j] += val * b[k][j]
      }
    }
  }
  return out
}

const invert = (matrix: number[][]) => {
  const n = matrix.length
  const aug = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ])
  for (let i = 0; i < n; i += 1) {
    let pivot = aug[i][i]
    if (!pivot) {
      for (let r = i + 1; r < n; r += 1) {
        if (Math.abs(aug[r][i]) > 1e-8) {
          const tmp = aug[i]
          aug[i] = aug[r]
          aug[r] = tmp
          pivot = aug[i][i]
          break
        }
      }
    }
    if (!pivot) return null
    for (let c = 0; c < 2 * n; c += 1) aug[i][c] /= pivot
    for (let r = 0; r < n; r += 1) {
      if (r === i) continue
      const factor = aug[r][i]
      for (let c = 0; c < 2 * n; c += 1) {
        aug[r][c] -= factor * aug[i][c]
      }
    }
  }
  return aug.map((row) => row.slice(n))
}

const ridgeRegression = (xRows: number[][], y: number[], lambda = 1.0) => {
  if (!xRows.length) return null
  const X = buildMatrix(xRows, xRows[0].length)
  const Xt = transpose(X)
  const XtX = multiply(Xt, X)
  for (let i = 0; i < XtX.length; i += 1) XtX[i][i] += lambda
  const XtXInv = invert(XtX)
  if (!XtXInv) return null
  const yCol = y.map((v) => [v])
  const XtY = multiply(Xt, yCol)
  const weights = multiply(XtXInv, XtY)
  return weights.map((row) => row[0])
}

const dot = (a: number[], b: number[]) => a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0)

const normalizeName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const collectStatsFromPlayerBox = (player: any, labels?: string[]) => {
  if (labels && Array.isArray(player?.stats)) {
    const stats: Record<string, number> = {}
    const labelToKey = (label: string) => {
      const k = label.toUpperCase().replace(/\s+/g, '_')
      if (k === 'FG') return 'FG'
      if (k === 'FT') return 'FT'
      if (k === '3PT') return '3PT'
      if (k === '3_PT' || k === '3POINTERS') return '3PM'
      return k
    }
    labels.forEach((label, idx) => {
      const key = labelToKey(label)
      const raw = player.stats?.[idx]
      if (typeof raw === 'string' && raw.includes('-')) {
        const parts = raw.split('-')
        const made = Number(parts[0])
        const att = Number(parts[1])
        if (Number.isFinite(made) && Number.isFinite(att)) {
          if (key === 'FG') {
            stats['FGM'] = made
            stats['FGA'] = att
            return
          }
          if (key === '3PT') {
            stats['3PM'] = made
            stats['3PA'] = att
            return
          }
          if (key === 'FT') {
            stats['FTM'] = made
            stats['FTA'] = att
            return
          }
        }
      }
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        stats[key] = raw
      } else if (typeof raw === 'string') {
        const num = Number(raw.replace(/[^\d.-]/g, ''))
        if (Number.isFinite(num)) stats[key] = num
      }
    })
    if (Object.keys(stats).length) return stats
  }
  if (Array.isArray(player?.statistics) && player.statistics.length) {
    return collectNbaLogStats(player)
  }
  return {}
}

const extractStatsFromSnapshot = (snapshot: any, playerId: string, playerName: string) => {
  const targetName = normalizeName(playerName)
  const boxPlayers = snapshot?.boxscore?.players || []
  for (const group of boxPlayers) {
    const statBlocks: any[] = Array.isArray(group?.statistics) ? group.statistics : []
    for (const block of statBlocks) {
      const labels: string[] = Array.isArray(block?.labels) ? block.labels : undefined
      const athletes = block?.athletes || []
      for (const a of athletes) {
        const id = String(a?.athlete?.id || a?.id || '')
        const name = a?.athlete?.displayName || a?.athlete?.fullName || a?.name || ''
        const nameMatch = targetName && normalizeName(name) === targetName
        if ((id && id === String(playerId)) || nameMatch) {
          const stats = collectStatsFromPlayerBox(a, labels)
          if (Object.keys(stats).length) return stats
        }
      }
    }
  }
  return null
}

const buildLogsFromBasketballReference = async (
  playerName: string,
  seasonYear: number,
  monthFilters: number[],
  startDate?: string,
  endDate?: string
) => {
  const logs = await fetchBasketballReferenceGameLogs(playerName, seasonYear)
  if (!logs.length) return []
  const start = startDate ? new Date(`${startDate}T00:00:00Z`) : null
  const end = endDate ? new Date(`${endDate}T00:00:00Z`) : null
  return logs
    .filter((log) => {
      const d = new Date(`${log.date}T00:00:00Z`)
      if (start && d < start) return false
      if (end && d > end) return false
      if (!monthFilters.length) return true
      const month = d.getUTCMonth() + 1
      return monthFilters.includes(month)
    })
    .map((log) => ({
      date: log.date,
      stats: log.stats,
      opponentAbbr: log.opponentAbbr,
      isHome: log.isHome,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

const buildLogsFromSchedule = async (
  playerId: string,
  playerName: string,
  teamName: string,
  teamAbbr: string | undefined,
  seasonYear: number,
  monthFilters: number[],
  startDate?: string,
  endDate?: string
) => {
  const teamMeta = await resolveEspnTeamId('nba', teamAbbr || teamName)
  if (!teamMeta?.id) return []
  const schedule = await getTeamSchedule('nba', teamMeta.id, seasonYear, 2)
  if (!schedule.length) return []
  const start = startDate ? new Date(`${startDate}T00:00:00Z`) : null
  const end = endDate ? new Date(`${endDate}T00:00:00Z`) : null

  const logs: Array<{
    date: string
    stats: Record<string, number>
    opponentAbbr?: string
    isHome?: boolean
  }> = []
  const teamAbbrUpper = teamAbbr?.toUpperCase()
  for (const event of schedule) {
    if (!event?.eventId || !event?.date) continue
    if (monthFilters.length) {
      const d = new Date(`${event.date}T00:00:00Z`)
      const month = d.getUTCMonth() + 1
      if (!monthFilters.includes(month)) continue
    }
    if (start || end) {
      const d = new Date(`${event.date}T00:00:00Z`)
      if (start && d < start) continue
      if (end && d > end) continue
    }
    const snapshot = await getEventSnapshot('nba', event.eventId)
    const stats = extractStatsFromSnapshot(snapshot, playerId, playerName)
    if (stats && Object.keys(stats).length) {
      const competitors: any[] = snapshot?.competition?.competitors || []
      const opponent = competitors.find((c) => {
        const abbr = String(c?.team?.abbreviation || '').toUpperCase()
        return abbr && abbr !== teamAbbrUpper
      })
      const opponentAbbr = opponent?.team?.abbreviation
      logs.push({ date: event.date, stats, opponentAbbr, isHome: event.isHome })
    }
  }
  return logs
}

const runBacktestForPlayer = async (playerName: string, options: ReturnType<typeof parseArgs>) => {
  const athlete = await searchAthlete('nba', playerName)
  if (!athlete?.id) {
    console.log(`No ESPN athlete found for ${playerName}`)
    return []
  }

  const rosterPlayer = await searchPlayer(playerName, 'basketball_nba')
  const teamName = rosterPlayer?.team || ''
  const teamAbbr = rosterPlayer?.teamAbbr

  const seasonYear =
    options.season && Number.isFinite(options.season)
      ? options.season
      : new Date().getUTCMonth() >= 8
        ? new Date().getUTCFullYear() + 1
        : new Date().getUTCFullYear()
  const monthFilters = options.months
    .map((m) => m.toLowerCase())
    .map((m) => {
      if (/^\d+$/.test(m)) return Number(m)
      if (m.startsWith('jan')) return 1
      if (m.startsWith('feb')) return 2
      if (m.startsWith('mar')) return 3
      if (m.startsWith('apr')) return 4
      if (m.startsWith('may')) return 5
      if (m.startsWith('jun')) return 6
      if (m.startsWith('jul')) return 7
      if (m.startsWith('aug')) return 8
      if (m.startsWith('sep')) return 9
      if (m.startsWith('oct')) return 10
      if (m.startsWith('nov')) return 11
      if (m.startsWith('dec')) return 12
      return null
    })
    .filter((m): m is number => Number.isFinite(m))

  let normalized: Array<{
    date: string
    stats: Record<string, number>
    opponentAbbr?: string
    isHome?: boolean
  }> = []
  normalized = await buildLogsFromBasketballReference(
    playerName,
    seasonYear,
    monthFilters,
    options.startDate,
    options.endDate
  )

  if (!normalized.length && teamName) {
    const scheduleLogs = await buildLogsFromSchedule(
      athlete.id,
      playerName,
      teamName,
      teamAbbr,
      seasonYear,
      monthFilters,
      options.startDate,
      options.endDate
    )
    normalized = scheduleLogs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  }
  if (!normalized.length) {
    const logsRaw = await getPlayerGameLogs('nba', athlete.id, seasonYear, 2).catch(() => [])
    const logs = Array.isArray(logsRaw) ? logsRaw : []
    normalized = logs
      .map((log: any) => ({
        date: String(log?.date || log?.gameDate || log?.game_date || ''),
        stats: collectNbaLogStats(log),
      }))
      .filter((g) => g.date)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  }

  if (!normalized.length) {
    console.log(`No game logs for ${playerName}`)
    return []
  }

  const filteredLogs = normalized.filter((g) => {
    const d = new Date(`${g.date}T00:00:00Z`)
    if (options.startDate) {
      const start = new Date(`${options.startDate}T00:00:00Z`)
      if (d < start) return false
    }
    if (options.endDate) {
      const end = new Date(`${options.endDate}T00:00:00Z`)
      if (d > end) return false
    }
    if (monthFilters.length) {
      const month = d.getUTCMonth() + 1
      if (!monthFilters.includes(month)) return false
    }
    return true
  })

  const markets = options.markets.length ? options.markets : NBA_PROP_MARKET_KEYS
  const results: BacktestRow[] = []

  const teamStats = await getNBATeamStats()
  const toNum = (val: unknown) => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : null
    const n = Number(val)
    return Number.isFinite(n) ? n : null
  }
  const pickStat = (entry: { stats?: Record<string, number | string | null> }, keys: string[]) => {
    for (const key of keys) {
      const val = entry?.stats?.[key]
      const num = toNum(val)
      if (num != null) return num
    }
    return null
  }
  const papgValues = teamStats
    .map((entry) =>
      pickStat(entry, ['pointsAgainstPerGame', 'pointsAgainst', 'oppPointsPerGame'])
    )
    .filter((value): value is number => value != null && Number.isFinite(value))
  const defRatingValues = teamStats
    .map((entry) => pickStat(entry, ['defensiveRating', 'dRating']))
    .filter((value): value is number => value != null && Number.isFinite(value))
  const paceValues = teamStats
    .map((entry) => pickStat(entry, ['pace']))
    .filter((value): value is number => value != null && Number.isFinite(value))
  const leaguePAPG = papgValues.length ? average(papgValues) : undefined
  const leagueDefRating = defRatingValues.length ? average(defRatingValues) : undefined
  const leaguePace = paceValues.length ? average(paceValues) : undefined
  const teamStatsMap = new Map(
    teamStats
      .map((entry) => ({
        teamAbbr: entry.teamAbbr,
        papg: pickStat(entry, ['pointsAgainstPerGame', 'pointsAgainst', 'oppPointsPerGame']),
        defRating: pickStat(entry, ['defensiveRating', 'dRating']),
        pace: pickStat(entry, ['pace']),
      }))
      .filter(
        (entry) =>
          entry.teamAbbr &&
          (entry.papg != null || entry.defRating != null || entry.pace != null)
      )
      .map((entry) => [String(entry.teamAbbr).toUpperCase(), entry])
  )

  for (const marketKey of markets) {
    const errors: number[] = []
    const counts: number[] = []
    let withinTol = 0
    const tol = marketKey === 'points' ? 4 : 2
    for (let i = options.lookback; i < filteredLogs.length; i++) {
      const priorLogs = filteredLogs.slice(0, i).map((g) => g.stats)
      const opponentAbbr = filteredLogs[i]?.opponentAbbr?.toUpperCase()
      const opponentEntry = opponentAbbr ? teamStatsMap.get(opponentAbbr) : undefined
      const opponentPAPG = opponentEntry?.papg ?? undefined
      const opponentDefRating = opponentEntry?.defRating ?? undefined
      const opponentPace = opponentEntry?.pace ?? undefined
      const isHome = filteredLogs[i]?.isHome
      const projection = computeProjection(
        priorLogs,
        marketKey,
        options.recentGames,
        options.recentWeight,
        opponentPAPG,
        leaguePAPG,
        opponentDefRating,
        leagueDefRating,
        opponentPace,
        leaguePace,
        isHome
      )
      if (!projection) continue
      const actual = getNbaMarketValueFromStats(filteredLogs[i].stats, marketKey)
      if (actual == null || !Number.isFinite(actual)) continue
      const error = actual - projection.projection
      errors.push(Math.abs(error))
      counts.push(error)
      if (Math.abs(error) <= tol) withinTol += 1
    }
    if (!errors.length) continue
    results.push({
      player: playerName,
      market: marketKey,
      games: errors.length,
      mae: Number(average(errors).toFixed(2)),
      avgError: Number(average(counts).toFixed(2)),
      accuracy: Number(((withinTol / errors.length) * 100).toFixed(1)),
    })
  }

  return results
}

const runPointsModelBacktest = async (
  playerLogs: Record<
    string,
    Array<{
      date: string
      stats: Record<string, number>
      opponentAbbr?: string
      isHome?: boolean
      teamAbbr?: string
    }>
  >,
  options: ReturnType<typeof parseArgs>
) => {
  const teamStats = await getNBATeamStats()
  const toNum = (val: unknown) => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : null
    const n = Number(val)
    return Number.isFinite(n) ? n : null
  }
  const pickStat = (entry: { stats?: Record<string, number | string | null> }, keys: string[]) => {
    for (const key of keys) {
      const val = entry?.stats?.[key]
      const num = toNum(val)
      if (num != null) return num
    }
    return null
  }
  const papgValues = teamStats
    .map((entry) =>
      pickStat(entry, ['pointsAgainstPerGame', 'pointsAgainst', 'oppPointsPerGame'])
    )
    .filter((value): value is number => value != null && Number.isFinite(value))
  const defRatingValues = teamStats
    .map((entry) => pickStat(entry, ['defensiveRating', 'dRating']))
    .filter((value): value is number => value != null && Number.isFinite(value))
  const paceValues = teamStats
    .map((entry) => pickStat(entry, ['pace']))
    .filter((value): value is number => value != null && Number.isFinite(value))
  const league = {
    papg: papgValues.length ? average(papgValues) : undefined,
    defRating: defRatingValues.length ? average(defRatingValues) : undefined,
    pace: paceValues.length ? average(paceValues) : undefined,
  }
  const teamStatsMap = new Map(
    teamStats
      .map((entry) => ({
        teamAbbr: entry.teamAbbr,
        papg: pickStat(entry, ['pointsAgainstPerGame', 'pointsAgainst', 'oppPointsPerGame']),
        defRating: pickStat(entry, ['defensiveRating', 'dRating']),
        pace: pickStat(entry, ['pace']),
        pointsFor: pickStat(entry, ['pointsForPerGame', 'pointsFor', 'ppg']),
      }))
      .filter(
        (entry) =>
          entry.teamAbbr &&
          (entry.papg != null || entry.defRating != null || entry.pace != null)
      )
      .map((entry) => [String(entry.teamAbbr).toUpperCase(), entry])
  )

  const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const num = Number(value)
      return Number.isFinite(num) ? num : null
    }
    return null
  }

  const parseSpreadFromDetails = (
    details: string | null | undefined,
    homeAbbr?: string,
    awayAbbr?: string
  ) => {
    if (!details) return null
    const match = details.match(/([A-Z]{2,3})\s*([+-]?\d+(\.\d+)?)/)
    if (!match) return null
    const team = match[1]
    const value = Number(match[2])
    if (!Number.isFinite(value)) return null
    if (homeAbbr && team === homeAbbr) return value
    if (awayAbbr && team === awayAbbr) return -value
    return null
  }

  const getScoreboard = async (dateStr: string) => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr.replace(/-/g, '')}&limit=500`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json() as Promise<{ events?: any[] }>
  }

  const impliedTotalsByDate = new Map<string, Map<string, number>>()
  const uniqueDates = new Set<string>()
  for (const logs of Object.values(playerLogs)) {
    for (const log of logs) {
      if (log?.date) uniqueDates.add(log.date)
    }
  }
  for (const dateStr of uniqueDates) {
    const scoreboard = await getScoreboard(dateStr)
    if (!scoreboard?.events?.length) continue
    const map = new Map<string, number>()
    for (const event of scoreboard.events) {
      const competition = event?.competitions?.[0]
      const competitors: any[] = competition?.competitors || []
      const home = competitors.find((c) => c.homeAway === 'home')
      const away = competitors.find((c) => c.homeAway === 'away')
      const homeAbbr = String(home?.team?.abbreviation || '').toUpperCase()
      const awayAbbr = String(away?.team?.abbreviation || '').toUpperCase()
      const odds = competition?.odds?.[0]
      const total = toNumber(odds?.overUnder)
      let spreadHome = toNumber(odds?.spread)
      if (spreadHome == null && odds?.details) {
        spreadHome = parseSpreadFromDetails(odds.details, homeAbbr, awayAbbr)
      }
      if (total == null || spreadHome == null) continue
      const homeImplied = total / 2 + spreadHome / 2
      const awayImplied = total / 2 - spreadHome / 2
      if (homeAbbr) map.set(homeAbbr, homeImplied)
      if (awayAbbr) map.set(awayAbbr, awayImplied)
    }
    if (map.size) impliedTotalsByDate.set(dateStr, map)
  }

  const xTrain: number[][] = []
  const yTrain: number[] = []
  const xTest: number[][] = []
  const yTest: number[] = []
  const featureTest: Array<ReturnType<typeof computePointFeatures>> = []
  const perPlayerErrors: number[] = []
  let perPlayerWithin = 0
  let perPlayerCount = 0
  const perPlayerBlendErrors: number[] = []
  let perPlayerBlendWithin = 0
  let perPlayerBlendCount = 0

  const tuneBlendWeight = (
    trainFeatures: Array<NonNullable<ReturnType<typeof computePointFeatures>>>,
    trainActuals: number[],
    getRecent: (f: NonNullable<ReturnType<typeof computePointFeatures>>) => number
  ) => {
    let bestWeight = 0.5
    let bestMae = Number.POSITIVE_INFINITY
    for (let w = 0; w <= 1.0001; w += 0.05) {
      const errors = trainFeatures.map((f, idx) => {
        const pred = f.seasonAvg * w + getRecent(f) * (1 - w)
        return Math.abs(trainActuals[idx] - pred)
      })
      const mae = average(errors)
      if (mae < bestMae) {
        bestMae = mae
        bestWeight = Number(w.toFixed(2))
      }
    }
    return bestWeight
  }

  for (const [player, logs] of Object.entries(playerLogs)) {
    const filteredLogs = options.months.length
      ? logs.filter((g) => {
          const d = new Date(`${g.date}T00:00:00Z`)
          const month = d.getUTCMonth() + 1
          return options.months
            .map((m) => m.toLowerCase())
            .map((m) => {
              if (/^\d+$/.test(m)) return Number(m)
              if (m.startsWith('jan')) return 1
              if (m.startsWith('feb')) return 2
              if (m.startsWith('mar')) return 3
              if (m.startsWith('apr')) return 4
              if (m.startsWith('may')) return 5
              if (m.startsWith('jun')) return 6
              if (m.startsWith('jul')) return 7
              if (m.startsWith('aug')) return 8
              if (m.startsWith('sep')) return 9
              if (m.startsWith('oct')) return 10
              if (m.startsWith('nov')) return 11
              if (m.startsWith('dec')) return 12
              return null
            })
            .filter((m): m is number => Number.isFinite(m))
            .includes(month)
        })
      : logs
    if (filteredLogs.length < options.lookback + 2) continue
    const splitIdx = Math.floor(filteredLogs.length * 0.7)
    const playerTrainX: number[][] = []
    const playerTrainY: number[] = []
    const playerTestX: number[][] = []
    const playerTestY: number[] = []
    const playerTrainFeatures: Array<NonNullable<ReturnType<typeof computePointFeatures>>> = []
    const playerTestFeatures: Array<NonNullable<ReturnType<typeof computePointFeatures>>> = []
    for (let i = options.lookback; i < filteredLogs.length; i += 1) {
      const priorLogs = filteredLogs.slice(0, i).map((g) => g.stats)
      const opponentAbbr = filteredLogs[i]?.opponentAbbr?.toUpperCase()
      const teamAbbr = filteredLogs[i]?.teamAbbr?.toUpperCase()
      const opponentEntry = opponentAbbr ? teamStatsMap.get(opponentAbbr) : undefined
      const teamEntry = teamAbbr ? teamStatsMap.get(teamAbbr) : undefined
      const impliedTotal =
        teamAbbr && impliedTotalsByDate.get(filteredLogs[i].date)
          ? impliedTotalsByDate.get(filteredLogs[i].date)?.get(teamAbbr) ?? null
          : null
      const features = computePointFeatures(
        filteredLogs.slice(0, i).map((g) => ({ date: g.date, stats: g.stats, isHome: g.isHome })),
        filteredLogs[i].date,
        options.recentGames,
        opponentEntry,
        league,
        filteredLogs[i]?.isHome,
        {
          impliedTotal,
          pointsFor: teamEntry?.pointsFor ?? null,
        }
      )
      const actual = getNbaMarketValueFromStats(filteredLogs[i].stats, 'points')
      if (!features || actual == null || !Number.isFinite(actual)) continue
      const row = [
        1,
        features.seasonAvg,
        features.recentAvg,
        features.recentAvg3,
        features.recentAvg7,
        features.medianRecent,
        features.oppAdjustedRecentAvg,
        features.expectedMinutes,
        features.baseline,
        features.usageProjection,
        features.shotProjection,
        features.papg ?? league.papg ?? 0,
        features.defRating ?? league.defRating ?? 0,
        features.pace ?? league.pace ?? 0,
        features.homeFlag,
        features.impliedTotalFactor ?? 1,
        features.pointsStd5,
        features.minutesStd5,
        features.volatilityPenalty,
        features.restDays,
        features.backToBack,
        features.gamesInLast4Days,
        features.consecutiveAway,
        features.minutesTrend,
        features.usageTrend,
      ]
      if (i < splitIdx) {
        xTrain.push(row)
        yTrain.push(actual)
        playerTrainX.push(row)
        playerTrainY.push(actual)
        playerTrainFeatures.push(features)
      } else {
        xTest.push(row)
        yTest.push(actual)
        featureTest.push(features)
        playerTestX.push(row)
        playerTestY.push(actual)
        playerTestFeatures.push(features)
      }
    }
    if (playerTestX.length && playerTrainX.length) {
      const playerWeights = ridgeRegression(playerTrainX, playerTrainY, 2.0)
      if (playerWeights) {
        for (let i = 0; i < playerTestX.length; i += 1) {
          const pred = dot(playerWeights, playerTestX[i])
          const actual = playerTestY[i]
          const error = actual - pred
          perPlayerErrors.push(Math.abs(error))
          if (Math.abs(error) <= 4) perPlayerWithin += 1
          perPlayerCount += 1
        }
      }
    }
    if (playerTrainFeatures.length && playerTestFeatures.length) {
      const bestWeight = tuneBlendWeight(
        playerTrainFeatures,
        playerTrainY,
        (f) => f.oppAdjustedRecentAvg
      )
      for (let i = 0; i < playerTestFeatures.length; i += 1) {
        const f = playerTestFeatures[i]
        const pred = f.seasonAvg * bestWeight + f.oppAdjustedRecentAvg * (1 - bestWeight)
        const actual = playerTestY[i]
        const error = actual - pred
        perPlayerBlendErrors.push(Math.abs(error))
        if (Math.abs(error) <= 4) perPlayerBlendWithin += 1
        perPlayerBlendCount += 1
      }
    }
  }

  const weights = ridgeRegression(xTrain, yTrain, 3.0)
  if (!xTest.length || !featureTest.length) return null

  const errors: number[] = []
  let withinTol = 0
  for (let i = 0; i < xTest.length; i += 1) {
    const pred = weights ? dot(weights, xTest[i]) : dot(xTest[i], xTest[i].map(() => 0))
    const actual = yTest[i]
    const error = actual - pred
    errors.push(Math.abs(error))
    if (Math.abs(error) <= 4) withinTol += 1
  }
  if (!errors.length) return null
  const ridgeSummary = {
    name: 'ridge',
    mae: Number(average(errors).toFixed(2)),
    accuracy: Number(((withinTol / errors.length) * 100).toFixed(1)),
  }
  const perPlayerSummary =
    perPlayerCount && perPlayerErrors.length
      ? {
          name: 'per_player_ridge',
          mae: Number(average(perPlayerErrors).toFixed(2)),
          accuracy: Number(((perPlayerWithin / perPlayerCount) * 100).toFixed(1)),
        }
      : null
  const perPlayerBlendSummary =
    perPlayerBlendCount && perPlayerBlendErrors.length
      ? {
          name: 'per_player_blend',
          mae: Number(average(perPlayerBlendErrors).toFixed(2)),
          accuracy: Number(((perPlayerBlendWithin / perPlayerBlendCount) * 100).toFixed(1)),
        }
      : null

  const evalHeuristic = (name: string, fn: (f: NonNullable<ReturnType<typeof computePointFeatures>>) => number) => {
    const errs: number[] = []
    let within = 0
    for (let i = 0; i < featureTest.length; i += 1) {
      const f = featureTest[i]
      if (!f) continue
      const pred = fn(f)
      const actual = yTest[i]
      const err = actual - pred
      errs.push(Math.abs(err))
      if (Math.abs(err) <= 4) within += 1
    }
    if (!errs.length) return null
    return {
      name,
      mae: Number(average(errs).toFixed(2)),
      accuracy: Number(((within / errs.length) * 100).toFixed(1)),
    }
  }

  const runWeightSearch = () => {
    const minuteWeights = [0.15, 0.2, 0.25, 0.3, 0.35]
    const usageWeights = [10, 12, 14, 16, 18]
    let best: { name: string; mae: number; accuracy: number } | null = null
    for (const mWeight of minuteWeights) {
      for (const uWeight of usageWeights) {
        const name = `grid_role_shift_m${mWeight}_u${uWeight}`
        const result = evalHeuristic(name, (f) => {
          const minutesClamp = clamp(f.minutesTrend, -6, 6)
          const usageClamp = clamp(f.usageTrend, -0.08, 0.08)
          const starterAdj = f.starterProxy === 'starter' ? 0.05 : f.starterProxy === 'bench' ? -0.05 : 0
          const volatilityGuard = f.pointsStd5 > 6 ? -f.volatilityPenalty * 0.2 : 0
          return (
            f.seasonAvg +
            minutesClamp * (mWeight + starterAdj) +
            usageClamp * uWeight +
            volatilityGuard
          )
        })
        if (!result) continue
        if (!best || result.mae < best.mae) best = result
      }
    }
    return best
  }

  const runAccuracySearch = () => {
    const minuteWeights = [0.1, 0.15, 0.2, 0.25, 0.3]
    const usageWeights = [8, 10, 12, 14, 16]
    let best: { name: string; mae: number; accuracy: number } | null = null
    for (const mWeight of minuteWeights) {
      for (const uWeight of usageWeights) {
        const name = `grid_acc_m${mWeight}_u${uWeight}`
        const result = evalHeuristic(name, (f) => {
          const minutesClamp = clamp(f.minutesTrend, -6, 6)
          const usageClamp = clamp(f.usageTrend, -0.08, 0.08)
          const starterAdj = f.starterProxy === 'starter' ? 0.05 : f.starterProxy === 'bench' ? -0.05 : 0
          const volatilityGuard = f.pointsStd5 > 6 ? -f.volatilityPenalty * 0.2 : 0
          return (
            f.seasonAvg +
            minutesClamp * (mWeight + starterAdj) +
            usageClamp * uWeight +
            volatilityGuard
          )
        })
        if (!result) continue
        if (
          !best ||
          result.accuracy > best.accuracy ||
          (result.accuracy === best.accuracy && result.mae < best.mae)
        ) {
          best = result
        }
      }
    }
    return best
  }

  const gridBestByMae = runWeightSearch()
  const gridBestByAccuracy = runAccuracySearch()

  const heuristics = [
    evalHeuristic('seasonAvg', (f) => f.seasonAvg),
    evalHeuristic('recentAvg', (f) => f.recentAvg),
    evalHeuristic('recentAvg3', (f) => f.recentAvg3),
    evalHeuristic('recentAvg7', (f) => f.recentAvg7),
    evalHeuristic('medianRecent', (f) => f.medianRecent),
    evalHeuristic('oppAdjRecent', (f) => f.oppAdjustedRecentAvg),
    evalHeuristic('implied_total_factor', (f) =>
      f.impliedTotalFactor != null ? f.seasonAvg * f.impliedTotalFactor : f.seasonAvg
    ),
    evalHeuristic('baseline', (f) => f.baseline),
    evalHeuristic('usageProjection', (f) => f.usageProjection),
    evalHeuristic('shotProjection', (f) => f.shotProjection),
    evalHeuristic('trend_minutes_only', (f) => f.seasonAvg + clamp(f.minutesTrend, -6, 6) * 0.35),
    evalHeuristic('trend_usage_only', (f) =>
      f.seasonAvg + clamp(f.usageTrend, -0.08, 0.08) * 18
    ),
    evalHeuristic('role_shift_best', (f) => {
      const minutesClamp = clamp(f.minutesTrend, -6, 6)
      const usageClamp = clamp(f.usageTrend, -0.08, 0.08)
      const starterAdj = f.starterProxy === 'starter' ? 0.05 : f.starterProxy === 'bench' ? -0.05 : 0
      const volatilityGuard = f.pointsStd5 > 6 ? -f.volatilityPenalty * 0.2 : 0
      return f.seasonAvg + minutesClamp * (0.15 + starterAdj) + usageClamp * 10 + volatilityGuard
    }),
    evalHeuristic('role_shift_gated', (f) => {
      const minutesClamp = clamp(f.minutesTrend, -6, 6)
      const usageClamp = clamp(f.usageTrend, -0.08, 0.08)
      const volatilityGuard = f.pointsStd5 > 6 ? -f.volatilityPenalty * 0.2 : 0
      let minutesWeight = 0.25
      let usageWeight = 16
      if (f.archetype === 'primary') {
        minutesWeight = 0.2
        usageWeight = 14
      } else if (f.archetype === 'secondary') {
        minutesWeight = 0.25
        usageWeight = 16
      } else {
        minutesWeight = 0.3
        usageWeight = 18
      }
      if (f.starterProxy === 'starter') minutesWeight += 0.05
      if (f.starterProxy === 'bench') minutesWeight -= 0.05
      return f.seasonAvg + minutesClamp * minutesWeight + usageClamp * usageWeight + volatilityGuard
    }),
    evalHeuristic('role_shift_heavy', (f) => {
      const minutesClamp = clamp(f.minutesTrend, -7, 7)
      const usageClamp = clamp(f.usageTrend, -0.1, 0.1)
      let minutesWeight = f.archetype === 'primary' ? 0.18 : f.archetype === 'secondary' ? 0.24 : 0.32
      let usageWeight = f.archetype === 'primary' ? 12 : f.archetype === 'secondary' ? 16 : 20
      if (f.starterProxy === 'starter') minutesWeight += 0.06
      if (f.starterProxy === 'bench') minutesWeight -= 0.06
      return f.seasonAvg + minutesClamp * minutesWeight + usageClamp * usageWeight
    }),
    evalHeuristic('trend_minutes_usage', (f) =>
      f.seasonAvg +
        clamp(f.minutesTrend, -6, 6) * 0.25 +
        clamp(f.usageTrend, -0.08, 0.08) * 18
    ),
    evalHeuristic('volatility_penalty', (f) => f.seasonAvg - f.volatilityPenalty),
    evalHeuristic('blend_60_40_recent', (f) => f.seasonAvg * 0.4 + f.recentAvg * 0.6),
    evalHeuristic('blend_60_40_season', (f) => f.seasonAvg * 0.6 + f.recentAvg * 0.4),
    evalHeuristic('blend_implied_recent', (f) => {
      const base = f.seasonAvg * 0.45 + f.oppAdjustedRecentAvg * 0.55
      return f.impliedTotalFactor != null ? base * f.impliedTotalFactor : base
    }),
    evalHeuristic('blend_implied_season', (f) => {
      const base = f.seasonAvg * 0.7 + f.oppAdjustedRecentAvg * 0.3
      return f.impliedTotalFactor != null ? base * f.impliedTotalFactor : base
    }),
    evalHeuristic('blend_opp_recent', (f) => f.seasonAvg * 0.45 + f.oppAdjustedRecentAvg * 0.55),
    evalHeuristic('blend_opp_recent_stable', (f) =>
      f.seasonAvg * 0.5 + f.oppAdjustedRecentAvg * 0.5 - f.volatilityPenalty * 0.25
    ),
    evalHeuristic('blend_trend', (f) =>
      f.seasonAvg * 0.5 +
        f.oppAdjustedRecentAvg * 0.3 +
        clamp(f.minutesTrend, -6, 6) * 0.2 +
        clamp(f.usageTrend, -0.08, 0.08) * 12
    ),
    evalHeuristic('archetype_blend', (f) => {
      const weight =
        f.archetype === 'primary' ? 0.4 : f.archetype === 'secondary' ? 0.5 : 0.6
      return f.seasonAvg * weight + f.oppAdjustedRecentAvg * (1 - weight)
    }),
    evalHeuristic('blend_usage_season', (f) => f.usageProjection * 0.55 + f.seasonAvg * 0.45),
    evalHeuristic('blend_baseline_season', (f) => f.baseline * 0.55 + f.seasonAvg * 0.45),
    evalHeuristic('blend_combo', (f) => f.seasonAvg * 0.5 + f.recentAvg * 0.2 + f.baseline * 0.2 + f.usageProjection * 0.1),
  ].filter(Boolean) as Array<{ name: string; mae: number; accuracy: number }>

  const ranked = [
    ridgeSummary,
    ...(perPlayerSummary ? [perPlayerSummary] : []),
    ...(perPlayerBlendSummary ? [perPlayerBlendSummary] : []),
    ...(gridBestByMae ? [gridBestByMae] : []),
    ...(gridBestByAccuracy ? [gridBestByAccuracy] : []),
    ...heuristics,
  ].sort(
    (a, b) => a.mae - b.mae
  )

  return {
    mae: ridgeSummary.mae,
    accuracy: ridgeSummary.accuracy,
    weights: weights ?? [],
    games: errors.length,
    ranked,
  }
}

const run = async () => {
  const options = parseArgs()
  if (!options.players.length) {
    console.log('Usage: ts-node scripts/nba-prop-backtest.ts --players "Player A,Player B" [--markets "points,rebounds"] [--recent 5] [--weight 0.4] [--lookback 10] [--season 2026] [--months "nov,dec"]')
    process.exit(1)
  }

  const allRows: BacktestRow[] = []
  const playerLogs: Record<
    string,
    Array<{
      date: string
      stats: Record<string, number>
      opponentAbbr?: string
      isHome?: boolean
      teamAbbr?: string
    }>
  > = {}
  for (const playerName of options.players) {
    const rows = await runBacktestForPlayer(playerName, options)
    allRows.push(...rows)
    const athlete = await searchAthlete('nba', playerName)
    const rosterPlayer = await searchPlayer(playerName, 'basketball_nba')
    const teamName = rosterPlayer?.team || ''
    const teamAbbr = rosterPlayer?.teamAbbr
    const seasonYear =
      options.season && Number.isFinite(options.season)
        ? options.season
        : new Date().getUTCMonth() >= 8
          ? new Date().getUTCFullYear() + 1
          : new Date().getUTCFullYear()
    const monthFilters = options.months
      .map((m) => m.toLowerCase())
      .map((m) => {
        if (/^\d+$/.test(m)) return Number(m)
        if (m.startsWith('jan')) return 1
        if (m.startsWith('feb')) return 2
        if (m.startsWith('mar')) return 3
        if (m.startsWith('apr')) return 4
        if (m.startsWith('may')) return 5
        if (m.startsWith('jun')) return 6
        if (m.startsWith('jul')) return 7
        if (m.startsWith('aug')) return 8
        if (m.startsWith('sep')) return 9
        if (m.startsWith('oct')) return 10
        if (m.startsWith('nov')) return 11
        if (m.startsWith('dec')) return 12
        return null
      })
      .filter((m): m is number => Number.isFinite(m))
    let normalized: Array<{
      date: string
      stats: Record<string, number>
      opponentAbbr?: string
      isHome?: boolean
      teamAbbr?: string
    }> = []
    normalized = await buildLogsFromBasketballReference(playerName, seasonYear, monthFilters)
    if (!normalized.length && teamName && athlete?.id) {
      normalized = await buildLogsFromSchedule(
        athlete.id,
        playerName,
        teamName,
        teamAbbr,
        seasonYear,
        monthFilters
      )
    }
    if (normalized.length) {
      playerLogs[playerName] = normalized.map((log) => ({ ...log, teamAbbr }))
    }
  }

  if (!allRows.length) {
    console.log('No backtest rows generated.')
    return
  }

  if (!options.markets.length || options.markets.includes('points')) {
    const pointsModel = await runPointsModelBacktest(playerLogs, options)
    if (pointsModel) {
      console.log(
        `\nRidge Points Model | games=${pointsModel.games} | MAE=${pointsModel.mae} | accuracy=${pointsModel.accuracy}%`
      )
      if (pointsModel.ranked?.length) {
        const top = pointsModel.ranked.slice(0, 5)
        console.log(
          `Top heuristics: ${top
            .map((r) => `${r.name} (MAE ${r.mae}, acc ${r.accuracy}%)`)
            .join(' | ')}`
        )
      }
    } else {
      console.log('\nRidge Points Model | no results')
    }
  }

  console.log('NBA Prop Backtest Results')
  for (const row of allRows) {
    console.log(
      `${row.player} | ${row.market} | games=${row.games} | MAE=${row.mae} | avgError=${row.avgError} | accuracy=${row.accuracy}%`
    )
  }

  const sumWeightedAccuracy = (rows: BacktestRow[]) =>
    rows.reduce((acc, row) => acc + row.accuracy * row.games, 0)
  const sumGames = (rows: BacktestRow[]) => rows.reduce((acc, row) => acc + row.games, 0)
  const overallGames = sumGames(allRows)
  const overallAccuracy =
    overallGames > 0 ? Number((sumWeightedAccuracy(allRows) / overallGames).toFixed(1)) : 0
  const pointsRows = allRows.filter((row) => row.market === 'points')
  const pointsGames = sumGames(pointsRows)
  const pointsAccuracy =
    pointsGames > 0 ? Number((sumWeightedAccuracy(pointsRows) / pointsGames).toFixed(1)) : 0
  const nonPointsRows = allRows.filter((row) => row.market !== 'points')
  const nonPointsGames = sumGames(nonPointsRows)
  const nonPointsAccuracy =
    nonPointsGames > 0 ? Number((sumWeightedAccuracy(nonPointsRows) / nonPointsGames).toFixed(1)) : 0

  console.log(
    `Accuracy Summary | overall=${overallAccuracy}% | points(+/-4)=${pointsAccuracy}% | non-points(+/-2)=${nonPointsAccuracy}%`
  )
}

run().catch((err) => {
  console.error('Backtest failed:', err)
  process.exit(1)
})
