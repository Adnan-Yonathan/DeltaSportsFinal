type SharpSignalLike = {
  type: string
  market?: string
  side?: string
  strength?: number
}

const SIGNAL_COPY: Record<
  string,
  {
    label: string
    explanation: string
  }
> = {
  RLM: {
    label: "Line moved against most public bets",
    explanation:
      "The number moved the opposite way of ticket count, which often points to respected money influencing the market.",
  },
  STEAM: {
    label: "Fast move across books",
    explanation:
      "Multiple books adjusted quickly in the same direction, which usually means coordinated sharp action.",
  },
  SHARP_MONEY: {
    label: "Respected money leaning this side",
    explanation:
      "Larger and more influential money appears to be concentrated on this side.",
  },
  STALLED: {
    label: "Early move lost momentum",
    explanation:
      "The move started but stopped carrying through, so conviction may be fading.",
  },
}

const MARKET_LABELS: Record<string, string> = {
  spread: "spread",
  total: "total",
  moneyline: "moneyline",
}

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

export const getSharpSignalPlainLabel = (type: string) => {
  const normalized = String(type || "").toUpperCase()
  const known = SIGNAL_COPY[normalized]
  if (known) return known.label
  return titleCase(normalized)
}

export const getSharpSignalPlainExplanation = (type: string) => {
  const normalized = String(type || "").toUpperCase()
  const known = SIGNAL_COPY[normalized]
  if (known) return known.explanation
  return "Market behavior suggests a directional lean, but signal detail is limited."
}

export const getSharpSignalStrengthPlain = (strength: number) => {
  if (strength >= 5) return "elite pro move"
  if (strength >= 4) return "strong pro pressure"
  if (strength >= 3) return "credible pro lean"
  if (strength >= 2) return "early sharp hint"
  return "weak signal"
}

export const formatSharpSignalStrengthPlain = (strength: number) =>
  `${getSharpSignalStrengthPlain(strength)} (${strength}/5)`

export const formatSharpSignalSummaryLine = (signal: SharpSignalLike) => {
  const market = MARKET_LABELS[String(signal.market || "").toLowerCase()] ?? "market"
  const side = signal.side ?? "this side"
  const strengthValue =
    signal.strength != null && Number.isFinite(signal.strength)
      ? Math.max(1, Math.min(5, Math.round(signal.strength)))
      : null
  const strengthText =
    strengthValue != null ? formatSharpSignalStrengthPlain(strengthValue) : "signal detected"

  return `${getSharpSignalPlainLabel(signal.type)}: pros are leaning ${side} on the ${market} (${strengthText}).`
}
