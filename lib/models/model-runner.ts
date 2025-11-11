import { Database } from '@/lib/supabase/types'
import { getTeamStats, TeamStats } from '@/lib/sports-stats-api'
import { CustomModelConfigPayload, CustomModelStatConfig, StatNormalization } from './custom-model-types'

type CustomModelRow = Database['public']['Tables']['custom_models']['Row']

export interface RunModelOptions {
  sportKey?: string
  teams?: string[] // e.g., ['Lakers', 'Celtics']
  matchup?: {
    focus: string
    opponent: string
  }
  notes?: string
}

export interface StatBreakdown {
  statKey: string
  label: string
  weight: number
  importance: number
  rawValue: number
  normalizedValue: number
  leagueAverage?: number
  leagueStdDev?: number
  normalization: StatNormalization
  direction: CustomModelStatConfig['direction']
  scope: CustomModelStatConfig['scope']
  sourceTeam?: string
  details?: string
}

export interface RunModelResult {
  modelId: string
  modelName: string
  sportKey: string
  score: number
  lowerBound: number
  upperBound: number
  confidenceLevel: number
  breakdown: StatBreakdown[]
  interpretation: string
  context: {
    teamsUsed: string[]
    notes?: string
  }
}

const SAMPLE_SIZE_MAP: Record<string, number> = {
  season: 82,
  last_5: 5,
  last_10: 10,
  playoffs: 7,
  default: 30,
}

const Z_TABLE: Record<number, number> = {
  0.8: 1.28,
  0.9: 1.64,
  0.95: 1.96,
}

interface StatMetrics {
  mean: number
  stdDev: number
  min: number
  max: number
}

function sanitizeTeamName(name?: string) {
  return name?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
}

function findTeamStats(
  leagueStats: TeamStats[],
  teamName?: string
): TeamStats | undefined {
  if (!teamName) return undefined
  const target = sanitizeTeamName(teamName)
  return leagueStats.find((team) => sanitizeTeamName(team.team).includes(target) || target.includes(sanitizeTeamName(team.team)))
}

function computeLeagueMetrics(
  leagueStats: TeamStats[],
  statKey: string
): StatMetrics | undefined {
  const values = leagueStats
    .map((team) => {
      const raw = team.stats?.[statKey]
      return typeof raw === 'number' ? raw : undefined
    })
    .filter((value): value is number => typeof value === 'number')

  if (!values.length) return undefined

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return { mean, stdDev, min, max }
}

function normalizeValue(
  value: number,
  statConfig: CustomModelStatConfig,
  metrics?: StatMetrics
) {
  let normalized = value

  switch (statConfig.normalization) {
    case 'zscore':
      if (metrics && metrics.stdDev > 0) {
        normalized = (value - metrics.mean) / metrics.stdDev
      } else {
        normalized = 0
      }
      break
    case 'minmax': {
      const min = statConfig.minValue ?? metrics?.min ?? 0
      const max = statConfig.maxValue ?? metrics?.max ?? 1
      if (max === min) {
        normalized = 0
      } else {
        normalized = (value - min) / (max - min)
      }
      break
    }
    case 'raw':
    default:
      normalized = value
      break
  }

  if (statConfig.direction === 'lower_better') {
    normalized = -normalized
  }

  return normalized
}

function determineSampleSize(statConfig: CustomModelStatConfig) {
  if (!statConfig.sampleSource) return SAMPLE_SIZE_MAP.default
  const key = statConfig.sampleSource.toLowerCase()
  return SAMPLE_SIZE_MAP[key] ?? SAMPLE_SIZE_MAP.default
}

function determineVariance(
  statConfig: CustomModelStatConfig,
  metrics?: StatMetrics
) {
  if (typeof statConfig.varianceOverride === 'number') {
    return Math.max(statConfig.varianceOverride, 0.0001)
  }

  if (metrics && metrics.stdDev > 0) {
    return Math.pow(metrics.stdDev, 2)
  }

  return 1 // fallback variance
}

function describeScore(score: number, lower: number, upper: number) {
  if (score > 1.5) return `Very strong leaning with tight interval [${lower.toFixed(2)}, ${upper.toFixed(2)}]`
  if (score > 0.75) return `Moderate positive signal within [${lower.toFixed(2)}, ${upper.toFixed(2)}]`
  if (score < -1.5) return `Strong negative signal within [${lower.toFixed(2)}, ${upper.toFixed(2)}]`
  if (score < -0.75) return `Moderate negative lean within [${lower.toFixed(2)}, ${upper.toFixed(2)}]`
  return `Neutral signal, confidence band [${lower.toFixed(2)}, ${upper.toFixed(2)}]`
}

export async function runCustomModel(
  model: CustomModelRow,
  options: RunModelOptions = {}
): Promise<RunModelResult> {
  const config = model.config as unknown as CustomModelConfigPayload
  const sportKey = options.sportKey || model.sport_key
  const leagueStats = await getTeamStats(sportKey)

  const teamsToUse = options.matchup
    ? [options.matchup.focus, options.matchup.opponent].filter(Boolean) as string[]
    : options.teams || []

  const focusTeamStats = findTeamStats(leagueStats, teamsToUse[0])
  const opponentStats = findTeamStats(leagueStats, teamsToUse[1])

  const statMetricsCache = new Map<string, StatMetrics>()
  const breakdown: StatBreakdown[] = []

  let weightedScore = 0
  let combinedVariance = 0
  let effectiveSampleSize = 0

  for (const statConfig of config.stats) {
    if (!statMetricsCache.has(statConfig.statKey)) {
      const metrics = computeLeagueMetrics(leagueStats, statConfig.statKey)
      if (metrics) {
        statMetricsCache.set(statConfig.statKey, metrics)
      }
    }
    const metrics = statMetricsCache.get(statConfig.statKey)

    let rawValue: number | undefined
    let sourceTeam: string | undefined
    let details: string | undefined

    if (statConfig.scope === 'matchup_diff') {
      const focusValue =
        (focusTeamStats?.stats?.[statConfig.statKey] as number | undefined) ??
        metrics?.mean
      const oppValue =
        (opponentStats?.stats?.[statConfig.statKey] as number | undefined) ??
        metrics?.mean

      if (typeof focusValue === 'number' && typeof oppValue === 'number') {
        rawValue = focusValue - oppValue
        sourceTeam = teamsToUse.slice(0, 2).join(' vs ')
        details = `Difference between ${teamsToUse[0] || 'focus'} and ${teamsToUse[1] || 'league avg'}`
      }
    } else {
      const team = focusTeamStats ?? opponentStats
      const value =
        (team?.stats?.[statConfig.statKey] as number | undefined) ??
        metrics?.mean

      if (typeof value === 'number') {
        rawValue = value
        sourceTeam = team?.team
        details = team ? `Value from ${team.team}` : 'Fallback to league average'
      }
    }

    if (typeof rawValue !== 'number') {
      breakdown.push({
        statKey: statConfig.statKey,
        label: statConfig.label,
        weight: statConfig.weight,
        importance: statConfig.importance,
        rawValue: 0,
        normalizedValue: 0,
        leagueAverage: metrics?.mean,
        leagueStdDev: metrics?.stdDev,
        normalization: statConfig.normalization,
        direction: statConfig.direction,
        scope: statConfig.scope,
        sourceTeam,
        details: 'Unable to locate stat value; defaulting to 0',
      })
      continue
    }

    const normalizedValue = normalizeValue(rawValue, statConfig, metrics)
    weightedScore += statConfig.weight * normalizedValue

    const variance = determineVariance(statConfig, metrics)
    combinedVariance += Math.pow(statConfig.weight, 2) * variance
    effectiveSampleSize += statConfig.weight * determineSampleSize(statConfig)

    breakdown.push({
      statKey: statConfig.statKey,
      label: statConfig.label,
      weight: statConfig.weight,
      importance: statConfig.importance,
      rawValue,
      normalizedValue,
      leagueAverage: metrics?.mean,
      leagueStdDev: metrics?.stdDev,
      normalization: statConfig.normalization,
      direction: statConfig.direction,
      scope: statConfig.scope,
      sourceTeam,
      details,
    })
  }

  const confidenceLevel = config.confidence || model.confidence_level || 0.9
  const zScore = Z_TABLE[confidenceLevel] ?? Z_TABLE[0.9]
  const sampleSize = Math.max(1, effectiveSampleSize || SAMPLE_SIZE_MAP.default)
  const standardError = Math.sqrt(combinedVariance) / Math.sqrt(sampleSize)
  const lowerBound = weightedScore - zScore * standardError
  const upperBound = weightedScore + zScore * standardError

  return {
    modelId: model.id,
    modelName: model.model_name,
    sportKey,
    score: parseFloat(weightedScore.toFixed(4)),
    lowerBound: parseFloat(lowerBound.toFixed(4)),
    upperBound: parseFloat(upperBound.toFixed(4)),
    confidenceLevel,
    breakdown,
    interpretation: describeScore(weightedScore, lowerBound, upperBound),
    context: {
      teamsUsed: teamsToUse.filter(Boolean),
      notes: options.notes,
    },
  }
}
