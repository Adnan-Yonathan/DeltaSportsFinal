import { fetchPropOrderbooksSnapshot } from "@/lib/services/prop-liquidity-detector"

type Side = "Over" | "Under"

const normalize = (v?: string | null) => String(v ?? "").toLowerCase()

const inferExpectedFromOutcome = (outcome: string): Side | null => {
  const text = normalize(outcome)
  if (!text) return null
  if (text.includes(" over ") || text.startsWith("over ") || text === "over") return "Over"
  if (text.includes(" under ") || text.startsWith("under ") || text === "under") return "Under"
  if (text === "yes") return "Over"
  if (text === "no") return "Under"
  return null
}

const run = async () => {
  const snapshot = await fetchPropOrderbooksSnapshot({ sportKey: "all", limit: 300, depth: 8, minSharpNotional: 100, mode: "full" })
  const kalshi = snapshot.items.filter((item) => item.source === "kalshi")

  let totalSides = 0
  let withPropSide = 0
  let explicitExpected = 0
  let explicitMismatch = 0
  const mismatches: Array<Record<string, unknown>> = []

  for (const item of kalshi) {
    for (const side of item.sides) {
      totalSides += 1
      if (side.propSide) withPropSide += 1
      const expected = inferExpectedFromOutcome(side.outcome)
      if (!expected || !side.propSide) continue
      explicitExpected += 1
      if (side.propSide !== expected) {
        explicitMismatch += 1
        if (mismatches.length < 20) {
          mismatches.push({
            player: item.playerName,
            propType: item.propType,
            line: item.propLine,
            sport: item.sportKey,
            outcome: side.outcome,
            propSide: side.propSide,
            expected,
            wallNotional: side.wallNotional,
            wallOdds: side.wallAmericanOdds,
            liquiditySide: item.sharpLiquiditySide,
            leanSide: item.sharpLeanSide,
            marketTitle: item.marketTitle,
            ticker: item.ticker,
          })
        }
      }
    }
  }

  const homeRuns = kalshi.filter((item) => item.propType === "home_runs")
  const homeRunsSummary = {
    count: homeRuns.length,
    byOutcomeLabel: Object.fromEntries(homeRuns.flatMap((item) => item.sides.map((s) => [normalize(s.outcome), 1]))
      .reduce((acc, [k, v]) => acc.set(k, (acc.get(k) ?? 0) + v), new Map<string, number>())),
    sample: homeRuns.slice(0, 20).map((item) => ({
      player: item.playerName,
      line: item.propLine,
      outcomes: item.sides.map((s) => ({ outcome: s.outcome, propSide: s.propSide, platformSide: s.platformSide, wallNotional: s.wallNotional, wallOdds: s.wallAmericanOdds })),
      liquiditySide: item.sharpLiquiditySide,
      leanSide: item.sharpLeanSide,
      marketTitle: item.marketTitle,
      ticker: item.ticker,
    })),
  }

  console.log(JSON.stringify({
    totalKalshiItems: kalshi.length,
    totalSides,
    withPropSide,
    explicitExpected,
    explicitMismatch,
    mismatches,
    homeRunsSummary,
  }, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
