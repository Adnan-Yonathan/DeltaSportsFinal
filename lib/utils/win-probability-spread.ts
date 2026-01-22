import { inverseNormalCDF } from "@/lib/utils/statistics"

export type WinProbSpreadInput = {
  winProbHome: number
  minutesRemaining: number
  totalMinutes?: number
  pregameSigma?: number
  minSigma?: number
  confidenceLevel?: number
}

export type WinProbSpreadOutput = {
  fairLine: number
  intervalLower: number
  intervalUpper: number
  intervalRange: number
  sigma: number
  confidence: "low" | "medium" | "high"
  crossesZero: boolean
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function calculateSpreadFromWinProb({
  winProbHome,
  minutesRemaining,
  totalMinutes = 48,
  pregameSigma = 12,
  minSigma = 4,
  confidenceLevel = 0.8,
}: WinProbSpreadInput): WinProbSpreadOutput {
  const safeProb = clamp(winProbHome, 0.01, 0.99)
  const remaining = clamp(minutesRemaining, 0, totalMinutes)
  const progress = totalMinutes > 0 ? 1 - remaining / totalMinutes : 0

  const sigma = Math.max(minSigma, pregameSigma * Math.sqrt(remaining / totalMinutes))
  const z = inverseNormalCDF(safeProb)
  const mean = sigma * z

  const ciZ = inverseNormalCDF(0.5 + confidenceLevel / 2)
  const intervalLower = mean - ciZ * sigma
  const intervalUpper = mean + ciZ * sigma

  let confidence: WinProbSpreadOutput["confidence"] = "low"
  if (progress >= 0.7) confidence = "high"
  else if (progress >= 0.4) confidence = "medium"

  return {
    fairLine: mean,
    intervalLower,
    intervalUpper,
    intervalRange: intervalUpper - intervalLower,
    sigma,
    confidence,
    crossesZero: intervalLower <= 0 && intervalUpper >= 0,
  }
}
