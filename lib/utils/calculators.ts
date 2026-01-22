export const parseNumber = (value: string) => {
  const cleaned = value.replace(/,/g, '').trim()
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const americanToDecimal = (odds: number) => {
  if (!Number.isFinite(odds) || odds === 0) return null
  if (odds > 0) return odds / 100 + 1
  return 100 / Math.abs(odds) + 1
}

export const decimalToAmerican = (odds: number) => {
  if (!Number.isFinite(odds) || odds <= 1) return null
  const profit = odds - 1
  if (profit >= 1) return Math.round(profit * 100)
  return Math.round(-100 / profit)
}

export const americanToImpliedProbability = (odds: number) => {
  if (!Number.isFinite(odds) || odds === 0) return null
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
}

export const decimalToImpliedProbability = (odds: number) => {
  if (!Number.isFinite(odds) || odds <= 1) return null
  return 1 / odds
}

export const formatOdds = (odds: number | null) => {
  if (odds == null || !Number.isFinite(odds)) return '--'
  const rounded = Math.round(odds)
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

export const formatPercent = (value: number | null, digits = 1) => {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${(value * 100).toFixed(digits)}%`
}

export const formatDecimal = (value: number | null, digits = 3) => {
  if (value == null || !Number.isFinite(value)) return '--'
  return value.toFixed(digits)
}

export const calculateKellyFraction = (probability: number, decimalOdds: number) => {
  if (
    !Number.isFinite(probability) ||
    !Number.isFinite(decimalOdds) ||
    probability <= 0 ||
    probability >= 1 ||
    decimalOdds <= 1
  ) {
    return null
  }
  const b = decimalOdds - 1
  const q = 1 - probability
  const fraction = (b * probability - q) / b
  return fraction
}

export const combinations = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) return []
  if (size === 1) return items.map((item) => [item])
  const combos: T[][] = []
  items.forEach((item, index) => {
    const rest = items.slice(index + 1)
    const restCombos = combinations(rest, size - 1)
    restCombos.forEach((combo) => {
      combos.push([item, ...combo])
    })
  })
  return combos
}
