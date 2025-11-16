import OpenAI from 'openai'
import { Database } from '@/lib/supabase/types'
import { getTeamStats, TeamStats } from '@/lib/sports-stats-api'
import { CustomModelConfigPayload, CustomModelStatConfig, StatNormalization } from './custom-model-types'
import { AI_MODELS } from '@/lib/ai-gateway-client'

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
  projection?: {
    pointEstimate: number
    lowerBound?: number
    upperBound?: number
    probabilityOverTarget?: number
    confidenceLabel?: 'low' | 'medium' | 'high'
    summary?: string
    keyDrivers?: string[]
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

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

interface LLMProjectionInput {
  modelName: string
  targetMetric: string
  sportKey: string
  teams: string[]
  confidenceLevel: number
  baseScore: number
  lowerBound: number
  upperBound: number
  breakdown: StatBreakdown[]
  dataHints?: string
  notes?: string
}

interface LLMProjection {
  pointEstimate: number
  lowerBound?: number
  upperBound?: number
  probabilityOverTarget?: number
  confidenceLabel?: 'low' | 'medium' | 'high'
  summary: string
  keyDrivers?: string[]
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

function formatBreakdownForLLM(breakdown: StatBreakdown[]) {
  return breakdown.slice(0, 32).map((stat) => ({
    statKey: stat.statKey,
    label: stat.label,
    weight: Number(stat.weight.toFixed(4)),
    importance: stat.importance,
    normalizedValue: Number(stat.normalizedValue.toFixed(4)),
    rawValue: Number(stat.rawValue.toFixed(4)),
    direction: stat.direction,
    scope: stat.scope,
    details: stat.details,
  }))
}

async function getLLMProjection(input: LLMProjectionInput): Promise<LLMProjection | null> {
  if (!openaiClient) return null

  try {
    const payload = {
      model_name: input.modelName,
      target_metric: input.targetMetric,
      sport_key: input.sportKey,
      teams: input.teams,
      confidence_level: input.confidenceLevel,
      base_score: Number(input.baseScore.toFixed(4)),
      base_range: {
        lower: Number(input.lowerBound.toFixed(4)),
        upper: Number(input.upperBound.toFixed(4)),
      },
      stats: formatBreakdownForLLM(input.breakdown),
      data_hints: input.dataHints,
      notes: input.notes,
    }

    const completion = await openaiClient.chat.completions.create({
      model: AI_MODELS.modelRunner,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are DELTA’s advanced statistical engine. Given weighted stats, baselines, and confidence intervals, produce a JSON object with keys: point_estimate (number), lower_bound (number), upper_bound (number), probability_over_target (0-1), confidence_label ("low"|"medium"|"high"), summary (<=80 words), key_drivers (array of short phrases). Keep the math self-consistent and never output anything besides JSON.',
        },
        {
          role: 'user',
          content: `Projection request:\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content)

    return {
      pointEstimate:
        typeof parsed.point_estimate === 'number'
          ? parsed.point_estimate
          : input.baseScore,
      lowerBound:
        typeof parsed.lower_bound === 'number'
          ? parsed.lower_bound
          : input.lowerBound,
      upperBound:
        typeof parsed.upper_bound === 'number'
          ? parsed.upper_bound
          : input.upperBound,
      probabilityOverTarget:
        typeof parsed.probability_over_target === 'number'
          ? parsed.probability_over_target
          : undefined,
      confidenceLabel:
        typeof parsed.confidence_label === 'string'
          ? parsed.confidence_label
          : undefined,
      summary:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : describeScore(input.baseScore, input.lowerBound, input.upperBound),
      keyDrivers: Array.isArray(parsed.key_drivers)
        ? parsed.key_drivers
        : undefined,
    }
  } catch (error) {
    console.error('[MODELS] Failed to generate GPT projection:', error)
    return null
  }
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

  let finalScore = parseFloat(weightedScore.toFixed(4))
  let finalLowerBound = parseFloat(lowerBound.toFixed(4))
  let finalUpperBound = parseFloat(upperBound.toFixed(4))
  let interpretation = describeScore(finalScore, finalLowerBound, finalUpperBound)
  let projectionDetails: RunModelResult['projection'] | undefined

  if (breakdown.length > 0) {
    const llmProjection = await getLLMProjection({
      modelName: model.model_name,
      targetMetric: model.target_metric || model.market_type || 'target_metric',
      sportKey,
      teams: teamsToUse.filter(Boolean),
      confidenceLevel,
      baseScore: finalScore,
      lowerBound,
      upperBound,
      breakdown,
      dataHints: config.dataHints,
      notes: options.notes,
    })

    if (llmProjection) {
      finalScore = Number(llmProjection.pointEstimate.toFixed(4))
      if (typeof llmProjection.lowerBound === 'number') {
        finalLowerBound = Number(llmProjection.lowerBound.toFixed(4))
      }
      if (typeof llmProjection.upperBound === 'number') {
        finalUpperBound = Number(llmProjection.upperBound.toFixed(4))
      }

      interpretation = llmProjection.summary || interpretation
      projectionDetails = {
        pointEstimate: finalScore,
        lowerBound: llmProjection.lowerBound ?? finalLowerBound,
        upperBound: llmProjection.upperBound ?? finalUpperBound,
        probabilityOverTarget: llmProjection.probabilityOverTarget,
        confidenceLabel: llmProjection.confidenceLabel,
        summary: llmProjection.summary,
        keyDrivers: llmProjection.keyDrivers,
      }
    }
  }

  return {
    modelId: model.id,
    modelName: model.model_name,
    sportKey,
    score: finalScore,
    lowerBound: finalLowerBound,
    upperBound: finalUpperBound,
    confidenceLevel,
    breakdown,
    interpretation,
    context: {
      teamsUsed: teamsToUse.filter(Boolean),
      notes: options.notes,
    },
    projection: projectionDetails,
  }
}
