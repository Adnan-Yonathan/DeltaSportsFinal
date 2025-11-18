import { Database } from '@/lib/supabase/types'
import { getTeamStats, TeamStats } from '@/lib/sports-stats-api'
import { fetchOdds } from '@/lib/api/odds-api'
import {
  CustomModelConfigPayload,
  CustomModelHierarchyTier,
  CustomModelStatConfig,
  StatNormalization,
} from './custom-model-types'
import { openai, AI_MODELS } from '@/lib/ai-gateway-client'
import { buildGameContext, GameContextPayload } from '@/lib/context/game-context'

type CustomModelRow = Database['public']['Tables']['custom_models']['Row']

export interface RunModelOptions {
  sportKey?: string
  teams?: string[] // e.g., ['Lakers', 'Celtics']
  matchup?: {
    focus: string
    opponent: string
  }
  notes?: string
  userData?: UserDataOverride[]
  hierarchy?: CustomModelHierarchyTier[]
}

export interface RunModelSlateOptions {
  sportKey?: string
  day?: 'today' | 'tomorrow'
  limit?: number
  live?: boolean
  minConfidence?: number
  userData?: UserDataOverride[]
  hierarchy?: CustomModelHierarchyTier[]
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

export interface UserDataOverride {
  statKey: string
  teamValues: Record<string, number>
  note?: string
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
  customInstructions?: string
  uploadedFiles?: Array<{
    fileName: string
    fileType: string
    data: any
  }>
  enrichmentContext?: GameContextPayload | null
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

function buildHierarchyMap(
  tiers?: CustomModelHierarchyTier[]
): Map<string, number> {
  const map = new Map<string, number>()
  if (!tiers) return map

  for (const tier of tiers) {
    const weight = typeof tier.weight === 'number' ? tier.weight : 1
    if (Array.isArray(tier.statKeys)) {
      for (const key of tier.statKeys) {
        map.set(key, weight)
      }
    }
  }
  return map
}

function buildUserDataLookup(overrides?: UserDataOverride[]) {
  const lookup = new Map<string, Map<string, number>>()
  if (!overrides) return lookup

  overrides.forEach((entry) => {
    if (!entry?.statKey || !entry.teamValues) return
    const byTeam = new Map<string, number>()
    Object.entries(entry.teamValues).forEach(([team, value]) => {
      const key = sanitizeTeamName(team)
      if (typeof value === 'number' && key) {
        byTeam.set(key, value)
      }
    })
    lookup.set(entry.statKey, byTeam)
  })
  return lookup
}

function getUserStatValue(
  lookup: Map<string, Map<string, number>>,
  statKey: string,
  teamName?: string
): number | undefined {
  if (!teamName) return undefined
  const statMap = lookup.get(statKey)
  if (!statMap) return undefined
  return statMap.get(sanitizeTeamName(teamName))
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
  const hasKey = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY)
  if (!hasKey) return null

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

    // Build system message with optional custom instructions
    let systemMessage = 'You are DELTA\'s advanced statistical engine. Given weighted stats, baselines, and confidence intervals, produce a JSON object with keys: point_estimate (number), lower_bound (number), upper_bound (number), probability_over_target (0-1), confidence_label ("low"|"medium"|"high"), summary (<=80 words), key_drivers (array of short phrases). Keep the math self-consistent and never output anything besides JSON.'

    if (input.customInstructions) {
      systemMessage += `\n\n## Custom Model Instructions:\n${input.customInstructions}\n\nApply these instructions when analyzing the data and generating projections.`
    }

    // Build user message with optional file data
    let userMessage = `Projection request:\n${JSON.stringify(payload, null, 2)}`

    if (input.uploadedFiles && input.uploadedFiles.length > 0) {
      userMessage += '\n\n## Uploaded Reference Data:\n'
      for (const file of input.uploadedFiles) {
        userMessage += `\n### File: ${file.fileName} (${file.fileType})\n`

        if (file.fileType === 'csv' || file.fileType === 'xlsx') {
          // Format as table preview for CSV/Excel
          if (Array.isArray(file.data) && file.data.length > 0) {
            const headers = Object.keys(file.data[0])
            const previewRows = file.data.slice(0, 10)
            userMessage += `Columns: ${headers.join(', ')}\n`
            userMessage += `Sample data (first 10 rows):\n${JSON.stringify(previewRows, null, 2)}\n`
          }
        } else if (file.fileType === 'pdf' || file.fileType === 'txt') {
          // Include text content
          const text = file.data?.text || file.data
          const preview = typeof text === 'string' && text.length > 1000
            ? text.substring(0, 1000) + '...(truncated)'
            : text
          userMessage += `Content:\n${preview}\n`
        }
      }
      userMessage += '\n\nUse this uploaded data as additional context for your analysis and projections.'
    }

    // Add enrichment context if available
    if (input.enrichmentContext) {
      userMessage += '\n\n## 📊 Matchup Context & Advanced Stats:\n'

      // Injuries
      if (input.enrichmentContext.injuries && input.enrichmentContext.injuries.length > 0) {
        userMessage += '\n### Injuries:\n'
        for (const injury of input.enrichmentContext.injuries) {
          userMessage += `- ${injury.player} (${injury.team}): ${injury.status}${injury.injury ? ` - ${injury.injury}` : ''}\n`
        }
      }

      // Team Summaries
      if (input.enrichmentContext.teamSummaries && input.enrichmentContext.teamSummaries.length > 0) {
        userMessage += '\n### Team Summaries:\n'
        for (const team of input.enrichmentContext.teamSummaries) {
          userMessage += `**${team.team}**`
          if (team.record) userMessage += `: Record ${team.record}`
          if (team.rank) userMessage += `, Rank: #${team.rank}`
          if (team.streak) userMessage += `, Streak: ${team.streak}`
          if (team.recentFormNote) userMessage += `, ${team.recentFormNote}`
          if (team.homeAwayNote) userMessage += `, ${team.homeAwayNote}`
          userMessage += '\n'
        }
      }

      // Recent Form
      if (input.enrichmentContext.recentForm) {
        userMessage += '\n### Recent Form (Last 10 Games):\n'
        const homeForm = input.enrichmentContext.recentForm.home || []
        const awayForm = input.enrichmentContext.recentForm.away || []

        if (homeForm.length > 0) {
          userMessage += `**Home Team**: ${homeForm.length} recent games\n`
          const recentGames = homeForm.slice(0, 5).map(g =>
            `${g.result || 'N/A'} vs ${g.opponent} (${g.game_date})`
          ).join(', ')
          userMessage += `  ${recentGames}\n`
        }

        if (awayForm.length > 0) {
          userMessage += `**Away Team**: ${awayForm.length} recent games\n`
          const recentGames = awayForm.slice(0, 5).map(g =>
            `${g.result || 'N/A'} vs ${g.opponent} (${g.game_date})`
          ).join(', ')
          userMessage += `  ${recentGames}\n`
        }
      }

      // Pace & Efficiency
      if (input.enrichmentContext.paceEfficiency) {
        userMessage += '\n### Pace & Efficiency:\n'
        const homePace = input.enrichmentContext.paceEfficiency.home
        const awayPace = input.enrichmentContext.paceEfficiency.away

        if (homePace) {
          userMessage += `**Home Team** (${homePace.games} games):\n`
          if (homePace.pace) userMessage += `  - Avg Pace: ${homePace.pace.toFixed(2)}\n`
          if (homePace.offensive_rating) userMessage += `  - Offensive Rating: ${homePace.offensive_rating.toFixed(2)}\n`
          if (homePace.defensive_rating) userMessage += `  - Defensive Rating: ${homePace.defensive_rating.toFixed(2)}\n`
          if (homePace.net_rating) userMessage += `  - Net Rating: ${homePace.net_rating.toFixed(2)}\n`
        }

        if (awayPace) {
          userMessage += `**Away Team** (${awayPace.games} games):\n`
          if (awayPace.pace) userMessage += `  - Avg Pace: ${awayPace.pace.toFixed(2)}\n`
          if (awayPace.offensive_rating) userMessage += `  - Offensive Rating: ${awayPace.offensive_rating.toFixed(2)}\n`
          if (awayPace.defensive_rating) userMessage += `  - Defensive Rating: ${awayPace.defensive_rating.toFixed(2)}\n`
          if (awayPace.net_rating) userMessage += `  - Net Rating: ${awayPace.net_rating.toFixed(2)}\n`
        }
      }

      // Market Trends
      if (input.enrichmentContext.marketTrends) {
        userMessage += '\n### Current Market Lines:\n'
        const mt = input.enrichmentContext.marketTrends
        userMessage += `${mt.gameDescription}\n`
        if (mt.bestSpreadHome || mt.bestSpreadAway) {
          userMessage += `Spread: ${mt.bestSpreadHome || 'N/A'} / ${mt.bestSpreadAway || 'N/A'}\n`
        }
        if (mt.bestMoneylineHome || mt.bestMoneylineAway) {
          userMessage += `Moneyline: ${mt.bestMoneylineHome || 'N/A'} / ${mt.bestMoneylineAway || 'N/A'}\n`
        }
        if (mt.bestTotalOver || mt.bestTotalUnder) {
          userMessage += `Total: ${mt.bestTotalOver || 'N/A'} / ${mt.bestTotalUnder || 'N/A'}\n`
        }
        if (mt.notes) {
          userMessage += `Notes: ${mt.notes}\n`
        }
      }

      // Head to Head
      if (input.enrichmentContext.headToHead && input.enrichmentContext.headToHead.length > 0) {
        userMessage += '\n### Head-to-Head History:\n'
        const h2h = input.enrichmentContext.headToHead.slice(0, 5)
        for (const game of h2h) {
          const loser = game.winner === game.team_one ? game.team_two : game.team_one
          userMessage += `- ${game.matchup_date}: ${game.winner || 'Unknown'} defeated ${loser}\n`
        }
      }

      userMessage += '\n**Use this enrichment context to enhance your projection analysis and account for current injuries, momentum, matchup history, and market sentiment.**\n'
    }

  const result = await openai.chat.completions.create({
    model: AI_MODELS.modelRunner,
    temperature: 0.2,
    max_completion_tokens: 2000,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ],
  })

    const content = result.choices[0].message.content
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
  options: RunModelOptions = {},
  supabaseClient?: any // Optional Supabase client for loading files
): Promise<RunModelResult> {
  const config = model.config as unknown as CustomModelConfigPayload
  const sportKey = options.sportKey || model.sport_key
  const leagueStats = await getTeamStats(sportKey)
  const userDataLookup = buildUserDataLookup(options.userData)
  const hierarchyMap = buildHierarchyMap(options.hierarchy || config.hierarchy)

  // Load uploaded files if they exist and supabase client is provided
  let uploadedFiles: Array<{ fileName: string; fileType: string; data: any }> = []
  if (supabaseClient && model.file_metadata) {
    const fileMetadata = model.file_metadata as any[]
    if (Array.isArray(fileMetadata) && fileMetadata.length > 0) {
      try {
        const { data: filesData } = await supabaseClient
          .from('model_files')
          .select('*')
          .eq('model_id', model.id)

        if (filesData && filesData.length > 0) {
          uploadedFiles = filesData.map((file: any) => ({
            fileName: file.file_name,
            fileType: file.file_type,
            data: file.parsed_data,
          }))
        }
      } catch (error) {
        console.error('Error loading model files:', error)
        // Continue without files if there's an error
      }
    }
  }

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
    const hierarchyMultiplier = hierarchyMap.get(statConfig.statKey) ?? 1
    const appliedWeight = statConfig.weight * hierarchyMultiplier

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
    let usedUserData = false

    if (statConfig.scope === 'matchup_diff') {
      const userFocus = getUserStatValue(userDataLookup, statConfig.statKey, teamsToUse[0])
      const userOpp = getUserStatValue(userDataLookup, statConfig.statKey, teamsToUse[1])
      const focusValue =
        userFocus ??
        (focusTeamStats?.stats?.[statConfig.statKey] as number | undefined) ??
        metrics?.mean
      const oppValue =
        userOpp ??
        (opponentStats?.stats?.[statConfig.statKey] as number | undefined) ??
        metrics?.mean

      if (typeof focusValue === 'number' && typeof oppValue === 'number') {
        rawValue = focusValue - oppValue
        sourceTeam = teamsToUse.slice(0, 2).join(' vs ')
        usedUserData = typeof userFocus === 'number' || typeof userOpp === 'number'
        details = `Difference between ${teamsToUse[0] || 'focus'} and ${teamsToUse[1] || 'league avg'}`
      }
    } else {
      const team = focusTeamStats ?? opponentStats
      const value =
        getUserStatValue(userDataLookup, statConfig.statKey, team?.team) ??
        (team?.stats?.[statConfig.statKey] as number | undefined) ??
        metrics?.mean

      if (typeof value === 'number') {
        rawValue = value
        sourceTeam = team?.team
        usedUserData = Boolean(getUserStatValue(userDataLookup, statConfig.statKey, team?.team))
        details = team ? `Value from ${team.team}` : 'Fallback to league average'
      }
    }

    if (typeof rawValue !== 'number') {
      breakdown.push({
        statKey: statConfig.statKey,
        label: statConfig.label,
        weight: appliedWeight,
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
    weightedScore += appliedWeight * normalizedValue

    const variance = determineVariance(statConfig, metrics)
    combinedVariance += Math.pow(appliedWeight, 2) * variance
    effectiveSampleSize += appliedWeight * determineSampleSize(statConfig)

    breakdown.push({
      statKey: statConfig.statKey,
      label: statConfig.label,
      weight: appliedWeight,
      importance: statConfig.importance,
      rawValue,
      normalizedValue,
      leagueAverage: metrics?.mean,
      leagueStdDev: metrics?.stdDev,
      normalization: statConfig.normalization,
      direction: statConfig.direction,
      scope: statConfig.scope,
      sourceTeam,
      details: usedUserData ? `${details || 'Value loaded'} (user data override)` : details,
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

  // Fetch enrichment context (injuries, recent form, market trends, etc.)
  let enrichmentContext: GameContextPayload | null = null
  if (supabaseClient && teamsToUse.length >= 2) {
    try {
      console.log('[MODEL] Enriching with game context...')
      enrichmentContext = await buildGameContext({
        sport: sportKey,
        homeTeam: teamsToUse[0],
        awayTeam: teamsToUse[1],
        includeMarketTrends: true,
        supabase: supabaseClient,
      })
      console.log('[MODEL] Successfully enriched model with game context')
    } catch (error) {
      console.error('[MODEL] Failed to enrich with game context:', error)
      // Continue without enrichment - not critical to model execution
    }
  }

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
      customInstructions: model.instructions || undefined,
      uploadedFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      enrichmentContext,
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

export async function runCustomModelAcrossSlate(
  model: CustomModelRow,
  options: RunModelSlateOptions = {},
  supabaseClient?: any
): Promise<
  Array<{
    game: string
    sportKey: string
    commenceTime?: string
    homeTeam: string
    awayTeam: string
    result: RunModelResult
  }>
> {
  const sportKey = options.sportKey || model.sport_key
  const odds = await fetchOdds(sportKey, ['h2h'], {
    live: options.live ?? false,
    revalidateSeconds: options.live ? 10 : 0,
  })

  const dayFilter = options.day
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)
  if (dayFilter === 'tomorrow') {
    start.setDate(start.getDate() + 1)
    end.setDate(end.getDate() + 1)
  }
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  const games = odds
    .filter((game) => {
      if (!dayFilter) return true
      const when = new Date(game.commence_time || now)
      return when >= start && when <= end
    })
    .slice(0, options.limit ?? 8)

  const results: Array<{
    game: string
    sportKey: string
    commenceTime?: string
    homeTeam: string
    awayTeam: string
    result: RunModelResult
  }> = []

  for (const game of games) {
    const home = game.home_team
    const away = game.away_team
    if (!home || !away) continue

    const result = await runCustomModel(
      model,
      {
        sportKey,
        teams: [home, away],
        userData: options.userData,
        hierarchy: options.hierarchy,
      },
      supabaseClient
    )

    if (options.minConfidence && result.confidenceLevel < options.minConfidence) {
      continue
    }

    results.push({
      game: `${away} @ ${home}`,
      sportKey,
      commenceTime: game.commence_time,
      homeTeam: home,
      awayTeam: away,
      result,
    })
  }

  return results
}
