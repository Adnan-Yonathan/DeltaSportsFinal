/**
 * Prop Probability Calculator
 * Uses Poisson distribution to calculate probability of hitting prop thresholds
 * based on a player's season average for counting stats (3PM, points, rebounds, assists)
 */

/**
 * Calculate factorial (with memoization for efficiency)
 */
const factorialCache = new Map<number, number>()
function factorial(n: number): number {
  if (n <= 1) return 1
  if (factorialCache.has(n)) return factorialCache.get(n)!
  const result = n * factorial(n - 1)
  factorialCache.set(n, result)
  return result
}

/**
 * Calculate Poisson probability mass function
 * P(X = k) = (lambda^k * e^-lambda) / k!
 */
function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
}

/**
 * Calculate probability of hitting at least X occurrences
 * P(X >= threshold) = 1 - P(X < threshold) = 1 - sum(P(X = i) for i in 0..threshold-1)
 */
export function calculateOverProbability(
  seasonAverage: number,
  threshold: number,
  adjustmentFactor: number = 1.0
): number {
  // Apply adjustment factor (e.g., for pace, opponent defense)
  const lambda = seasonAverage * adjustmentFactor

  // Calculate P(X >= threshold) = 1 - P(X < threshold)
  let probUnder = 0
  for (let k = 0; k < threshold; k++) {
    probUnder += poissonPMF(lambda, k)
  }

  return Math.max(0, Math.min(1, 1 - probUnder))
}

/**
 * Calculate probability of staying under X occurrences
 * P(X < threshold)
 */
export function calculateUnderProbability(
  seasonAverage: number,
  threshold: number,
  adjustmentFactor: number = 1.0
): number {
  const lambda = seasonAverage * adjustmentFactor

  let probUnder = 0
  for (let k = 0; k < threshold; k++) {
    probUnder += poissonPMF(lambda, k)
  }

  return Math.max(0, Math.min(1, probUnder))
}

/**
 * For continuous stats like points, use normal distribution approximation
 * More appropriate for high-variance stats
 */
export function calculateOverProbabilityNormal(
  seasonAverage: number,
  threshold: number,
  stdDev?: number
): number {
  // Estimate standard deviation as ~40% of mean for NBA counting stats if not provided
  const sigma = stdDev ?? seasonAverage * 0.4

  if (sigma <= 0) return seasonAverage >= threshold ? 1 : 0

  // Z-score calculation
  const z = (threshold - 0.5 - seasonAverage) / sigma // -0.5 for continuity correction

  // Use error function approximation for CDF
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))

  return z > 0 ? probability : 1 - probability
}

/**
 * Player prop probability result
 */
export interface PropProbabilityResult {
  playerName: string
  team: string
  propType: string
  threshold: number
  seasonAverage: number
  probability: number
  probabilityPercent: string
  confidenceLevel: 'high' | 'medium' | 'low'
  edge?: string
}

/**
 * Get confidence level based on probability
 */
export function getConfidenceLevel(probability: number): 'high' | 'medium' | 'low' {
  if (probability >= 0.75) return 'high'
  if (probability >= 0.55) return 'medium'
  return 'low'
}

/**
 * Format probability as percentage string
 */
export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`
}
