export type ModelStatScope = 'team' | 'matchup_diff' | 'player'
export type StatDirection = 'higher_better' | 'lower_better'
export type StatNormalization = 'zscore' | 'minmax' | 'raw'

export interface CustomModelStatInput {
  statKey: string
  label: string
  scope: ModelStatScope
  importance: number
  direction: StatDirection
  normalization?: StatNormalization
  sampleSource?: string
  varianceOverride?: number
  minValue?: number
  maxValue?: number
  notes?: string
}

export interface CustomModelStatConfig extends Omit<CustomModelStatInput, 'importance'> {
  weight: number
  importance: number
  normalization: StatNormalization
}

export interface CustomModelConfigPayload {
  stats: CustomModelStatConfig[]
  dataHints?: string
  confidence: number
}
