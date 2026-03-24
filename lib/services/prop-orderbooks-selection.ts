type SourceKey = "kalshi" | "polymarket" | "novig" | "prophetx"

type OrderbookSide = {
  wallNotional?: number | null
}

export type SelectableOrderbookItem = {
  id: string
  source: SourceKey
  sportKey: string
  marketTitle?: string
  sharpLiquidityNotional?: number | null
  sides?: OrderbookSide[]
}

const HIGH_LIQUIDITY_NOTIONAL = 1000

const resolveItemNotional = (item: SelectableOrderbookItem) => {
  const sharp = Number(item.sharpLiquidityNotional)
  if (Number.isFinite(sharp) && sharp > 0) return sharp
  const walls = Array.isArray(item.sides)
    ? item.sides
        .map((side) => Number(side?.wallNotional))
        .filter((value) => Number.isFinite(value) && value > 0)
    : []
  if (walls.length === 0) return 0
  return Math.max(...walls)
}

const compareByNotional = <T extends SelectableOrderbookItem>(a: T, b: T) => {
  const diff = resolveItemNotional(b) - resolveItemNotional(a)
  if (diff !== 0) return diff
  const titleA = String(a.marketTitle ?? "")
  const titleB = String(b.marketTitle ?? "")
  const titleDiff = titleA.localeCompare(titleB)
  if (titleDiff !== 0) return titleDiff
  return a.id.localeCompare(b.id)
}

const dedupeByStrongestLiquidity = <T extends SelectableOrderbookItem>(items: T[]) => {
  const byId = new Map<string, T>()
  for (const item of items) {
    const existing = byId.get(item.id)
    if (!existing || resolveItemNotional(item) > resolveItemNotional(existing)) {
      byId.set(item.id, item)
    }
  }
  return Array.from(byId.values())
}

const buildSourceCaps = (limit: number): Record<SourceKey, number> => {
  if (limit <= 20) {
    return {
      kalshi: limit,
      polymarket: limit,
      novig: limit,
      prophetx: limit,
    }
  }

  return {
    kalshi: limit,
    polymarket: Math.max(12, Math.ceil(limit * 0.6)),
    novig: Math.max(6, Math.ceil(limit * 0.4)),
    prophetx: Math.max(6, Math.ceil(limit * 0.4)),
  }
}

const buildMinimumSourceTargets = (limit: number): Record<SourceKey, number> => {
  if (limit <= 4) {
    return { kalshi: 1, polymarket: 1, novig: 1, prophetx: 1 }
  }
  if (limit <= 12) {
    return { kalshi: 2, polymarket: 2, novig: 1, prophetx: 1 }
  }
  return { kalshi: 3, polymarket: 3, novig: 2, prophetx: 2 }
}

export const buildFinalPropOrderbookItems = <T extends SelectableOrderbookItem>({
  sportFilter,
  requestedLimit,
  kalshiItems,
  polymarketItems,
  exchangeItems,
}: {
  sportFilter: string
  requestedLimit: number
  kalshiItems: T[]
  polymarketItems: T[]
  exchangeItems: T[]
}) => {
  const allCandidates = dedupeByStrongestLiquidity([
    ...kalshiItems,
    ...polymarketItems,
    ...exchangeItems,
  ]).sort(compareByNotional)

  if (sportFilter !== "all") {
    return allCandidates.slice(0, requestedLimit)
  }

  const sourceCaps = buildSourceCaps(requestedLimit)
  const sourceMinimums = buildMinimumSourceTargets(requestedLimit)
  const selected: T[] = []
  const selectedById = new Set<string>()
  const sourceCounts: Record<SourceKey, number> = {
    kalshi: 0,
    polymarket: 0,
    novig: 0,
    prophetx: 0,
  }

  const pushItem = (item: T) => {
    if (selectedById.has(item.id)) return false
    selected.push(item)
    selectedById.add(item.id)
    sourceCounts[item.source] += 1
    return true
  }

  const candidatesBySource: Record<SourceKey, T[]> = {
    kalshi: [],
    polymarket: [],
    novig: [],
    prophetx: [],
  }
  for (const item of allCandidates) {
    candidatesBySource[item.source].push(item)
  }

  // Seed source diversity so non-Kalshi books are always represented when data exists.
  for (const source of ["kalshi", "polymarket", "novig", "prophetx"] as const) {
    const target = sourceMinimums[source]
    if (target <= 0) continue
    for (const item of candidatesBySource[source]) {
      if (selected.length >= requestedLimit) break
      if (sourceCounts[source] >= target) break
      pushItem(item)
    }
  }

  for (const item of allCandidates) {
    if (selected.length >= requestedLimit) break
    if (resolveItemNotional(item) < HIGH_LIQUIDITY_NOTIONAL) continue
    const cap = sourceCaps[item.source]
    if (sourceCounts[item.source] >= cap) continue
    pushItem(item)
  }

  for (const item of allCandidates) {
    if (selected.length >= requestedLimit) break
    if (selectedById.has(item.id)) continue
    const cap = sourceCaps[item.source]
    if (sourceCounts[item.source] >= cap) continue
    pushItem(item)
  }

  for (const item of allCandidates) {
    if (selected.length >= requestedLimit) break
    if (selectedById.has(item.id)) continue
    pushItem(item)
  }

  return selected.sort(compareByNotional).slice(0, requestedLimit)
}

export const resolveOrderbookItemNotional = resolveItemNotional
