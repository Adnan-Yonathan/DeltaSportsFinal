"use client"

import { useMemo, useState } from "react"
import {
  americanToDecimal,
  calculateKellyFraction,
  parseNumber,
} from "@/lib/utils/calculators"
import { Field, Output, SectionCard } from "@/components/calculators/atoms"

export default function KellyWidget() {
  const [prob, setProb] = useState("55")
  const [odds, setOdds] = useState("-110")
  const [bankroll, setBankroll] = useState("1000")
  const [fraction, setFraction] = useState("0.5")

  const result = useMemo(() => {
    const p = parseNumber(prob)
    const o = parseNumber(odds)
    const b = parseNumber(bankroll) ?? 0
    const f = parseNumber(fraction) ?? 1
    if (p == null || o == null) return null
    const decimal = americanToDecimal(o)
    if (decimal == null) return null
    const fullKelly = calculateKellyFraction(p / 100, decimal)
    if (fullKelly == null) return null
    const applied = fullKelly * f
    const stake = b > 0 ? b * applied : 0
    return { fullKelly, applied, stake }
  }, [prob, odds, bankroll, fraction])

  return (
    <SectionCard
      title="Kelly Criterion Calculator"
      description="Enter your edge and line price. Output is the fraction of bankroll Kelly says to stake."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Win Probability %"
          value={prob}
          onChange={setProb}
          placeholder="55"
          helper="Your estimated chance the bet wins."
        />
        <Field
          label="American Odds"
          value={odds}
          onChange={setOdds}
          placeholder="-110"
          helper="The price you're getting."
        />
        <Field
          label="Bankroll ($)"
          value={bankroll}
          onChange={setBankroll}
          placeholder="1000"
          helper="Total betting roll."
        />
        <Field
          label="Kelly Fraction"
          value={fraction}
          onChange={setFraction}
          placeholder="0.5"
          helper="0.25 = quarter Kelly, 0.5 = half Kelly, 1 = full."
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Output
          label="Full Kelly %"
          value={result == null ? "--" : `${(result.fullKelly * 100).toFixed(2)}%`}
          tone={result && result.fullKelly > 0 ? "good" : "warn"}
        />
        <Output
          label="Applied %"
          value={result == null ? "--" : `${(result.applied * 100).toFixed(2)}%`}
          tone={result && result.applied > 0 ? "good" : "warn"}
        />
        <Output
          label="Suggested Stake"
          value={
            result == null
              ? "--"
              : result.stake > 0
              ? `$${result.stake.toFixed(2)}`
              : "No bet (negative edge)"
          }
          tone={result && result.stake > 0 ? "good" : "warn"}
        />
      </div>
    </SectionCard>
  )
}
