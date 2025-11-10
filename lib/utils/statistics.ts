/**
 * Statistical utility functions for probability calculations
 */

/**
 * Standard normal cumulative distribution function (CDF)
 * Uses the approximation method for efficiency
 * @param z - Z-score
 * @returns Probability (0-1)
 */
export function normalCDF(z: number): number {
  // Using the approximation formula by Abramowitz and Stegun
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))

  return z > 0 ? 1 - p : p
}

/**
 * Calculate Z-score from a value, mean, and standard deviation
 * @param value - The observed value
 * @param mean - The expected mean
 * @param stdDev - The standard deviation
 * @returns Z-score
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0
  return (value - mean) / stdDev
}

/**
 * Calculate standard deviation from a set of values
 * @param values - Array of numbers
 * @returns Standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length

  return Math.sqrt(variance)
}

/**
 * Calculate mean (average) from a set of values
 * @param values - Array of numbers
 * @returns Mean
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Inverse normal CDF (quantile function)
 * Converts probability to z-score
 * @param p - Probability (0-1)
 * @returns Z-score
 */
export function inverseNormalCDF(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error('Probability must be between 0 and 1')
  }

  // Approximation using the Beasley-Springer-Moro algorithm
  const a = [
    -39.69683028665376,
    220.9460984245205,
    -275.9285104469687,
    138.357751867269,
    -30.66479806614716,
    2.506628277459239
  ]

  const b = [
    -54.47609879822406,
    161.5858368580409,
    -155.6989798598866,
    66.80131188771972,
    -13.28068155288572
  ]

  const c = [
    -0.007784894002430293,
    -0.3223964580411365,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783
  ]

  const d = [
    0.007784695709041462,
    0.3224671290700398,
    2.445134137142996,
    3.754408661907416
  ]

  const pLow = 0.02425
  const pHigh = 1 - pLow

  let q: number, r: number

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= pHigh) {
    q = p - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
}

/**
 * Calculate confidence interval
 * @param mean - Sample mean
 * @param stdDev - Standard deviation
 * @param sampleSize - Sample size
 * @param confidenceLevel - Confidence level (e.g., 0.95 for 95%)
 * @returns Object with lower and upper bounds
 */
export function confidenceInterval(
  mean: number,
  stdDev: number,
  sampleSize: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number } {
  const alpha = 1 - confidenceLevel
  const zScore = inverseNormalCDF(1 - alpha / 2)
  const margin = zScore * (stdDev / Math.sqrt(sampleSize))

  return {
    lower: mean - margin,
    upper: mean + margin
  }
}

/**
 * Convert American odds to implied probability
 * @param americanOdds - American odds (e.g., -110, +150)
 * @returns Implied probability (0-1)
 */
export function oddsToImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100)
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)
  }
}

/**
 * Convert implied probability to American odds
 * @param probability - Probability (0-1)
 * @returns American odds
 */
export function probabilityToAmericanOdds(probability: number): number {
  if (probability >= 0.5) {
    return -Math.round((probability / (1 - probability)) * 100)
  } else {
    return Math.round(((1 - probability) / probability) * 100)
  }
}

/**
 * Calculate expected value of a bet
 * @param probability - Win probability (0-1)
 * @param odds - American odds
 * @param stake - Bet amount
 * @returns Expected value
 */
export function calculateExpectedValue(
  probability: number,
  odds: number,
  stake: number = 100
): number {
  const winAmount = odds > 0 ? (stake * odds) / 100 : (stake * 100) / Math.abs(odds)
  const loseAmount = -stake

  return (probability * winAmount) + ((1 - probability) * loseAmount)
}

/**
 * Calculate Kelly Criterion bet sizing
 * @param probability - Win probability (0-1)
 * @param odds - American odds
 * @param bankroll - Current bankroll
 * @returns Recommended bet size
 */
export function kellyBetSize(
  probability: number,
  odds: number,
  bankroll: number
): number {
  const decimalOdds = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1
  const q = 1 - probability
  const b = decimalOdds - 1

  const kellyFraction = (b * probability - q) / b

  // Use fractional Kelly (1/4 Kelly is common for safety)
  const fractionalKelly = kellyFraction / 4

  return Math.max(0, fractionalKelly * bankroll)
}
