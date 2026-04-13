import { fetchPropOrderbooksSnapshot } from "@/lib/services/prop-liquidity-detector"

const run = async () => {
  const snapshot = await fetchPropOrderbooksSnapshot({ sportKey: "all", limit: 300, depth: 8, minSharpNotional: 100, mode: "full" })
  const kalshi = snapshot.items.filter((item) => item.source === "kalshi")

  let total = 0
  let yesOver = 0
  let yesUnder = 0
  let noOver = 0
  let noUnder = 0
  let other = 0
  const bad: Array<Record<string, unknown>> = []

  for (const item of kalshi) {
    for (const side of item.sides) {
      if (!side.platformSide || !side.propSide) continue
      total += 1
      if (side.platformSide === "yes" && side.propSide === "Over") yesOver++
      else if (side.platformSide === "yes" && side.propSide === "Under") {
        yesUnder++
        if (bad.length < 20) bad.push({ kind: "yes->under", outcome: side.outcome, player: item.playerName, propType: item.propType, line: item.propLine, marketTitle: item.marketTitle, ticker: item.ticker })
      } else if (side.platformSide === "no" && side.propSide === "Under") noUnder++
      else if (side.platformSide === "no" && side.propSide === "Over") {
        noOver++
        if (bad.length < 20) bad.push({ kind: "no->over", outcome: side.outcome, player: item.playerName, propType: item.propType, line: item.propLine, marketTitle: item.marketTitle, ticker: item.ticker })
      } else {
        other++
      }
    }
  }

  console.log(JSON.stringify({ total, yesOver, yesUnder, noUnder, noOver, other, bad }, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
