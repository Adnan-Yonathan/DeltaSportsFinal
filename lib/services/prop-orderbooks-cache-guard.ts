type SourceKey = "kalshi" | "polymarket" | "novig" | "prophetx"

type OrderbookSide = {
  wallNotional?: number | null
}

type OrderbookItemLike = {
  source: SourceKey
  sharpLiquidityNotional?: number | null
  sides?: OrderbookSide[]
}

export type SnapshotDiagnostics = {
  sourceCounts: Record<SourceKey, number>
  highLiquidityCount: number
  highLiquidityBySource: Record<SourceKey, number>
  kalshiTopNotionalSum: number
}

const DEFAULT_HIGH_LIQUIDITY_NOTIONAL = 1000

const parseTimestampMs = (value?: string | null) => {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

const resolveItemNotional = (item: OrderbookItemLike) => {
  const sharp = Number(item.sharpLiquidityNotional)
  if (Number.isFinite(sharp) && sharp > 0) return sharp
  const sideWalls = Array.isArray(item.sides)
    ? item.sides
        .map((side) => Number(side?.wallNotional))
        .filter((value) => Number.isFinite(value) && value > 0)
    : []
  if (sideWalls.length === 0) return 0
  return Math.max(...sideWalls)
}

const sumTopNotional = (
  items: OrderbookItemLike[],
  source: SourceKey,
  topN: number
) => {
  const notional = items
    .filter((item) => item.source === source)
    .map(resolveItemNotional)
    .sort((a, b) => b - a)
  return notional.slice(0, topN).reduce((sum, value) => sum + value, 0)
}

export const parseCacheAgeMs = (
  fetchedAt?: string | null,
  nowMs: number = Date.now()
) => {
  const ts = parseTimestampMs(fetchedAt)
  if (ts == null) return null
  return Math.max(0, nowMs - ts)
}

export const resolveSnapshotDiagnostics = (
  items: OrderbookItemLike[],
  highLiquidityThreshold: number = DEFAULT_HIGH_LIQUIDITY_NOTIONAL
): SnapshotDiagnostics => {
  const sourceCounts: Record<SourceKey, number> = {
    kalshi: 0,
    polymarket: 0,
    novig: 0,
    prophetx: 0,
  }
  const highLiquidityBySource: Record<SourceKey, number> = {
    kalshi: 0,
    polymarket: 0,
    novig: 0,
    prophetx: 0,
  }

  let highLiquidityCount = 0
  for (const item of items) {
    sourceCounts[item.source] += 1
    const notional = resolveItemNotional(item)
    if (notional >= highLiquidityThreshold) {
      highLiquidityCount += 1
      highLiquidityBySource[item.source] += 1
    }
  }

  return {
    sourceCounts,
    highLiquidityCount,
    highLiquidityBySource,
    kalshiTopNotionalSum: sumTopNotional(items, "kalshi", 12),
  }
}

export const shouldPersistPropOrderbooksSnapshot = (
  existingItems: OrderbookItemLike[],
  nextItems: OrderbookItemLike[]
) => {
  if (!existingItems.length) return true
  if (!nextItems.length) return false

  const prev = resolveSnapshotDiagnostics(existingItems)
  const next = resolveSnapshotDiagnostics(nextItems)
  const prevKalshi = prev.sourceCounts.kalshi
  const nextKalshi = next.sourceCounts.kalshi

  // Keep prior snapshot if the new one appears to have dropped a large
  // portion of Kalshi coverage and liquidity in a single refresh.
  if (prevKalshi >= 8 && nextKalshi === 0) return false

  const severeKalshiCountDrop =
    prevKalshi >= 20 && nextKalshi <= Math.floor(prevKalshi * 0.55)
  const severeKalshiLiquidityDrop =
    prev.kalshiTopNotionalSum > 0 &&
    next.kalshiTopNotionalSum < prev.kalshiTopNotionalSum * 0.55
  const severeHighLiquidityKalshiDrop =
    prev.highLiquidityBySource.kalshi >= 4 &&
    next.highLiquidityBySource.kalshi <
      Math.max(2, Math.floor(prev.highLiquidityBySource.kalshi * 0.5))

  if (
    severeKalshiCountDrop &&
    (severeKalshiLiquidityDrop || severeHighLiquidityKalshiDrop)
  ) {
    return false
  }

  return true
}
