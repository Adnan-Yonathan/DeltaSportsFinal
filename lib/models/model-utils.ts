import { CustomModelStatConfig, CustomModelStatInput } from './custom-model-types'

const IMPORTANCE_WEIGHT_MAP: Record<number, number> = {
  1: 0.5,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
}

export const DEFAULT_CONFIDENCE = 0.9

export function normalizeConfidence(level: number) {
  if (![0.8, 0.9, 0.95].includes(level)) {
    return DEFAULT_CONFIDENCE
  }
  return level
}

export function normalizeStatWeights(stats: CustomModelStatInput[]): CustomModelStatConfig[] {
  if (!stats.length) {
    throw new Error('At least one stat is required for a custom model')
  }

  const weighted = stats.map((stat) => {
    const importance = Math.min(5, Math.max(1, Math.round(stat.importance || 3)))
    const rawWeight = IMPORTANCE_WEIGHT_MAP[importance] ?? IMPORTANCE_WEIGHT_MAP[3]
    return {
      ...stat,
      importance,
      rawWeight,
    }
  })

  const weightSum = weighted.reduce((acc, stat) => acc + stat.rawWeight, 0)
  if (weightSum === 0) {
    throw new Error('Unable to normalize stat weights (total is zero)')
  }

  return weighted.map((stat) => ({
    statKey: stat.statKey,
    label: stat.label,
    scope: stat.scope,
    importance: stat.importance,
    weight: parseFloat((stat.rawWeight / weightSum).toFixed(4)),
    direction: stat.direction,
    normalization: stat.normalization || 'zscore',
    sampleSource: stat.sampleSource,
    varianceOverride: stat.varianceOverride,
    minValue: stat.minValue,
    maxValue: stat.maxValue,
    notes: stat.notes,
  }))
}
