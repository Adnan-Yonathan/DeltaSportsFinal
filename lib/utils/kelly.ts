import { americanToDecimal } from './odds'

export interface KellyInput {
  americanOdds?: number
  decimalOdds?: number
  winProbability: number // 0-1
  fraction?: number // 0-1, default 0.25 (quarter Kelly)
  bankroll?: number
  unitSize?: number
  maxStakePct?: number // cap as % of bankroll
}

export interface KellyResult {
  kellyPercent: number
  appliedPercent: number
  edgePercent: number
  impliedProbability: number
  suggestedStake?: number
  suggestedUnits?: number
  warnings: string[]
}

export function calculateKellyStake(input: KellyInput): KellyResult {
  const decimal =
    input.decimalOdds ??
    (typeof input.americanOdds === 'number' ? americanToDecimal(input.americanOdds) : undefined)

  if (!decimal || decimal <= 1) {
    return {
      kellyPercent: 0,
      appliedPercent: 0,
      edgePercent: 0,
      impliedProbability: 0,
      warnings: ['Invalid odds provided.'],
    }
  }

  const p = Math.max(0, Math.min(1, input.winProbability))
  const q = 1 - p
  const implied = 1 / decimal
  const edgePercent = (p - implied) * 100

  const b = decimal - 1
  const rawKellyFraction = (b * p - q) / b // classic Kelly fraction of bankroll
  const kellyPercent = Math.max(0, rawKellyFraction * 100)

  const fraction = input.fraction != null ? input.fraction : 0.25
  const fractionClamped = Math.max(0, Math.min(1, fraction))
  const appliedPercent = kellyPercent * fractionClamped

  const warnings: string[] = []
  if (kellyPercent === 0 || p <= implied) {
    warnings.push('Edge is negative or zero; Kelly suggests no bet.')
  }
  if (fraction < 0.1) warnings.push('Using a very small Kelly fraction; stake will be very conservative.')
  if (fraction > 1) warnings.push('Kelly fraction above 1 is aggressive; consider capping at 1.0.')

  let suggestedStake: number | undefined
  const maxStakePct = input.maxStakePct ?? 0.05

  if (typeof input.bankroll === 'number' && input.bankroll > 0) {
    suggestedStake = input.bankroll * (Math.max(0, rawKellyFraction) * fractionClamped)
    const cap = input.bankroll * maxStakePct
    if (suggestedStake > cap) {
      suggestedStake = cap
      warnings.push(`Stake capped at ${(maxStakePct * 100).toFixed(1)}% of bankroll.`)
    }
    if (suggestedStake > input.bankroll * 0.1) {
      warnings.push('Stake exceeds 10% of bankroll; consider lowering fraction or reviewing your edge.')
    }
  }

  let suggestedUnits: number | undefined
  if (suggestedStake != null && typeof input.unitSize === 'number' && input.unitSize > 0) {
    suggestedUnits = suggestedStake / input.unitSize
  }

  return {
    kellyPercent,
    appliedPercent,
    edgePercent,
    impliedProbability: implied * 100,
    suggestedStake,
    suggestedUnits,
    warnings,
  }
}
