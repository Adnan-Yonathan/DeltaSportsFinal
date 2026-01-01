import type { PlayerStats } from './pregame-value-calculator'

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export const getPlayerImpactScore = (
  playerStats?: PlayerStats | null
): number => {
  if (!playerStats) return 0
  const scores: number[] = []

  const per = playerStats.per
  const rating = playerStats.nbaRating
  const ppg = playerStats.seasonAverage
  const usage = playerStats.usage
  const ts = playerStats.trueShootingPct
  const minutes = playerStats.minutesPerGame

  if (per != null && Number.isFinite(per)) scores.push((per - 15) / 2.5)
  if (rating != null && Number.isFinite(rating)) scores.push((rating - 15) / 5)
  if (ppg != null && Number.isFinite(ppg)) scores.push((ppg - 12) / 5)
  if (usage != null && Number.isFinite(usage)) scores.push((usage - 20) / 6)
  if (ts != null && Number.isFinite(ts)) scores.push((ts - 55) / 6)
  if (minutes != null && Number.isFinite(minutes)) scores.push((minutes - 18) / 10)

  if (!scores.length) return 0
  const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length
  return clamp(avg, -2, 6)
}
