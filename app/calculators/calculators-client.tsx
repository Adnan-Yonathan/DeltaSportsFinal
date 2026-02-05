"use client"

import { useMemo, useState } from "react"
import {
  americanToDecimal,
  americanToImpliedProbability,
  calculateKellyFraction,
  clampNumber,
  combinations,
  decimalToAmerican,
  decimalToImpliedProbability,
  formatDecimal,
  formatOdds,
  formatPercent,
  parseNumber,
} from "@/lib/utils/calculators"
import { cn } from "@/lib/utils"

type OddsInput = {
  id: string
  value: string
}

const SectionCard = ({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) => (
  <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/55 p-5 backdrop-blur sm:p-6">
    <div aria-hidden className="pointer-events-none absolute inset-0 insider-grid opacity-20" />
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-sm text-white/60">{description}</p>
    </div>
    <div className="mt-4">{children}</div>
  </section>
)

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  helper,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  helper?: string
}) => (
  <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.18em] text-white/50 sm:tracking-[0.2em]">
    {label}
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode="decimal"
      className="rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-emerald-400/60 focus:outline-none"
    />
    {helper && <span className="text-[10px] normal-case tracking-normal text-white/40">{helper}</span>}
  </label>
)

const Output = ({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "good" | "warn"
}) => (
  <div
    className={cn(
      "rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm",
      tone === "good" && "border-emerald-400/40 text-emerald-200",
      tone === "warn" && "border-amber-400/40 text-amber-200"
    )}
  >
    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">{label}</div>
    <div className="mt-1 text-lg font-semibold text-white">{value}</div>
  </div>
)

export default function CalculatorsClient() {
  const [kellyProb, setKellyProb] = useState("55")
  const [kellyOdds, setKellyOdds] = useState("-110")

  const [arbOddsA, setArbOddsA] = useState("-110")
  const [arbOddsB, setArbOddsB] = useState("+120")
  const [arbStake, setArbStake] = useState("100")

  const [parlayStake, setParlayStake] = useState("50")
  const [parlayLegs, setParlayLegs] = useState<OddsInput[]>([
    { id: "leg-1", value: "-110" },
    { id: "leg-2", value: "+120" },
  ])

  const [roundRobinStake, setRoundRobinStake] = useState("20")
  const [roundRobinSize, setRoundRobinSize] = useState("2")
  const [roundRobinLegs, setRoundRobinLegs] = useState<OddsInput[]>([
    { id: "rr-1", value: "-110" },
    { id: "rr-2", value: "+120" },
    { id: "rr-3", value: "+150" },
  ])

  const [evOdds, setEvOdds] = useState("-110")
  const [evProb, setEvProb] = useState("55")
  const [evStake, setEvStake] = useState("100")

  const [devigOddsA, setDevigOddsA] = useState("-110")
  const [devigOddsB, setDevigOddsB] = useState("-110")

  const [promoAmount, setPromoAmount] = useState("50")
  const [promoOdds, setPromoOdds] = useState("+200")
  const [promoProb, setPromoProb] = useState("")

  const [oddsInputType, setOddsInputType] = useState<"american" | "decimal">("american")
  const [oddsInputValue, setOddsInputValue] = useState("-110")

  const [impliedInputType, setImpliedInputType] = useState<"american" | "decimal">("american")
  const [impliedInputValue, setImpliedInputValue] = useState("-110")

  const kellyResult = useMemo(() => {
    const prob = parseNumber(kellyProb)
    const odds = parseNumber(kellyOdds)
    if (prob == null || odds == null) return null
    const decimalOdds = americanToDecimal(odds)
    if (decimalOdds == null) return null
    const fraction = calculateKellyFraction(prob / 100, decimalOdds)
    return fraction
  }, [kellyProb, kellyOdds])

  const arbResult = useMemo(() => {
    const oddsA = parseNumber(arbOddsA)
    const oddsB = parseNumber(arbOddsB)
    const totalStake = parseNumber(arbStake) ?? 0
    if (oddsA == null || oddsB == null) return null
    const decA = americanToDecimal(oddsA)
    const decB = americanToDecimal(oddsB)
    if (decA == null || decB == null) return null
    const implied = 1 / decA + 1 / decB
    const hasArb = implied < 1
    const payout = totalStake > 0 ? totalStake / implied : 0
    const stakeA = totalStake > 0 ? payout / decA : 0
    const stakeB = totalStake > 0 ? payout / decB : 0
    const profit = payout - totalStake
    return { implied, hasArb, stakeA, stakeB, profit, payout }
  }, [arbOddsA, arbOddsB, arbStake])

  const parlayResult = useMemo(() => {
    const decimals = parlayLegs
      .map((leg) => parseNumber(leg.value))
      .map((odds) => (odds == null ? null : americanToDecimal(odds)))
      .filter((odds): odds is number => odds != null)
    if (decimals.length < 2) return null
    const decimalOdds = decimals.reduce((acc, value) => acc * value, 1)
    const americanOdds = decimalToAmerican(decimalOdds)
    const implied = decimalToImpliedProbability(decimalOdds)
    const stake = parseNumber(parlayStake) ?? 0
    const payout = stake > 0 ? stake * decimalOdds : 0
    const profit = payout - stake
    return { decimalOdds, americanOdds, implied, payout, profit }
  }, [parlayLegs, parlayStake])

  const roundRobinResult = useMemo(() => {
    const size = parseNumber(roundRobinSize)
    if (size == null) return null
    const decimals = roundRobinLegs
      .map((leg) => parseNumber(leg.value))
      .map((odds) => (odds == null ? null : americanToDecimal(odds)))
      .filter((odds): odds is number => odds != null)
    if (decimals.length < 2 || size < 2 || size > decimals.length) return null
    const combos = combinations(decimals, size)
    const stakePer = parseNumber(roundRobinStake) ?? 0
    const totalStake = stakePer * combos.length
    const totalReturn = combos.reduce((sum, combo) => {
      const parlayDecimal = combo.reduce((acc, value) => acc * value, 1)
      return sum + parlayDecimal * stakePer
    }, 0)
    const profit = totalReturn - totalStake
    return { combos: combos.length, totalStake, totalReturn, profit }
  }, [roundRobinLegs, roundRobinSize, roundRobinStake])

  const evResult = useMemo(() => {
    const odds = parseNumber(evOdds)
    const prob = parseNumber(evProb)
    const stake = parseNumber(evStake)
    if (odds == null || prob == null || stake == null) return null
    const decimalOdds = americanToDecimal(odds)
    if (decimalOdds == null) return null
    const winProb = clampNumber(prob / 100, 0, 1)
    const profit = stake * (decimalOdds - 1)
    const ev = winProb * profit - (1 - winProb) * stake
    const roi = stake > 0 ? ev / stake : 0
    return { ev, roi }
  }, [evOdds, evProb, evStake])

  const devigResult = useMemo(() => {
    const oddsA = parseNumber(devigOddsA)
    const oddsB = parseNumber(devigOddsB)
    if (oddsA == null || oddsB == null) return null
    const probA = americanToImpliedProbability(oddsA)
    const probB = americanToImpliedProbability(oddsB)
    if (probA == null || probB == null) return null
    const sum = probA + probB
    if (sum <= 0) return null
    const noVigA = probA / sum
    const noVigB = probB / sum
    return {
      noVigA,
      noVigB,
      fairOddsA: decimalToAmerican(1 / noVigA),
      fairOddsB: decimalToAmerican(1 / noVigB),
    }
  }, [devigOddsA, devigOddsB])

  const promoResult = useMemo(() => {
    const amount = parseNumber(promoAmount)
    const odds = parseNumber(promoOdds)
    if (amount == null || odds == null) return null
    const decimalOdds = americanToDecimal(odds)
    if (decimalOdds == null) return null
    const implied = americanToImpliedProbability(odds)
    const prob = parseNumber(promoProb)
    const winProb = clampNumber((prob ?? (implied != null ? implied * 100 : 0)) / 100, 0, 1)
    const profit = amount * (decimalOdds - 1)
    const ev = winProb * profit
    const conversion = amount > 0 ? ev / amount : 0
    return { ev, conversion }
  }, [promoAmount, promoOdds, promoProb])

  const oddsConverter = useMemo(() => {
    const value = parseNumber(oddsInputValue)
    if (value == null) return null
    if (oddsInputType === "american") {
      const decimal = americanToDecimal(value)
      const implied = americanToImpliedProbability(value)
      return { american: value, decimal, implied }
    }
    const american = decimalToAmerican(value)
    const implied = decimalToImpliedProbability(value)
    return { american, decimal: value, implied }
  }, [oddsInputType, oddsInputValue])

  const impliedResult = useMemo(() => {
    const value = parseNumber(impliedInputValue)
    if (value == null) return null
    if (impliedInputType === "american") {
      return americanToImpliedProbability(value)
    }
    return decimalToImpliedProbability(value)
  }, [impliedInputType, impliedInputValue])

  const updateLeg = (setter: React.Dispatch<React.SetStateAction<OddsInput[]>>, id: string, next: string) => {
    setter((prev) => prev.map((leg) => (leg.id === id ? { ...leg, value: next } : leg)))
  }

  const addLeg = (setter: React.Dispatch<React.SetStateAction<OddsInput[]>>, prefix: string) => {
    setter((prev) => {
      if (prev.length >= 6) return prev
      return [...prev, { id: `${prefix}-${prev.length + 1}`, value: "" }]
    })
  }

  const removeLeg = (setter: React.Dispatch<React.SetStateAction<OddsInput[]>>, id: string) => {
    setter((prev) => prev.filter((leg) => leg.id !== id))
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Kelly Calculator"
        description="Size a bankroll bet based on your edge and line price."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Win Probability %" value={kellyProb} onChange={setKellyProb} placeholder="55" />
          <Field label="American Odds" value={kellyOdds} onChange={setKellyOdds} placeholder="-110" />
          <Output
            label="Kelly Stake"
            value={kellyResult == null ? "--" : `${(kellyResult * 100).toFixed(1)}% bankroll`}
            tone={kellyResult != null && kellyResult > 0 ? "good" : "warn"}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Arbitrage Calculator"
        description="Check if two lines create a guaranteed profit and size the hedge."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Side A Odds" value={arbOddsA} onChange={setArbOddsA} placeholder="-110" />
          <Field label="Side B Odds" value={arbOddsB} onChange={setArbOddsB} placeholder="+120" />
          <Field label="Total Stake" value={arbStake} onChange={setArbStake} placeholder="100" />
          <Output
            label="Arb Edge"
            value={
              arbResult == null
                ? "--"
                : arbResult.hasArb
                ? `${((1 - arbResult.implied) * 100).toFixed(2)}%`
                : "No arb"
            }
            tone={arbResult?.hasArb ? "good" : "warn"}
          />
        </div>
        {arbResult && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Output label="Stake A" value={`$${arbResult.stakeA.toFixed(2)}`} />
            <Output label="Stake B" value={`$${arbResult.stakeB.toFixed(2)}`} />
            <Output label="Profit" value={`$${arbResult.profit.toFixed(2)}`} tone="good" />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Parlay Calculator"
        description="Combine legs to see total odds, implied probability, and payout."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          {parlayLegs.map((leg) => (
            <div key={leg.id} className="flex items-end gap-2">
              <Field label="Leg Odds" value={leg.value} onChange={(next) => updateLeg(setParlayLegs, leg.id, next)} placeholder="-110" />
              {parlayLegs.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeLeg(setParlayLegs, leg.id)}
                  className="mb-1 rounded-full border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => addLeg(setParlayLegs, "leg")}
              className="rounded-full border border-emerald-400/40 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-400 hover:text-white"
            >
              Add Leg
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Stake" value={parlayStake} onChange={setParlayStake} placeholder="50" />
          <Output label="Parlay Odds" value={parlayResult ? formatOdds(parlayResult.americanOdds) : "--"} />
          <Output label="Decimal" value={parlayResult ? formatDecimal(parlayResult.decimalOdds) : "--"} />
          <Output label="Implied Prob" value={parlayResult ? formatPercent(parlayResult.implied) : "--"} />
        </div>
        {parlayResult && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Output label="Total Payout" value={`$${parlayResult.payout.toFixed(2)}`} />
            <Output label="Profit" value={`$${parlayResult.profit.toFixed(2)}`} tone="good" />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Round Robin Calculator"
        description="Estimate combinations, total stake, and max payout if all legs win."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          {roundRobinLegs.map((leg) => (
            <div key={leg.id} className="flex items-end gap-2">
              <Field label="Leg Odds" value={leg.value} onChange={(next) => updateLeg(setRoundRobinLegs, leg.id, next)} placeholder="-110" />
              {roundRobinLegs.length > 3 && (
                <button
                  type="button"
                  onClick={() => removeLeg(setRoundRobinLegs, leg.id)}
                  className="mb-1 rounded-full border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => addLeg(setRoundRobinLegs, "rr")}
              className="rounded-full border border-emerald-400/40 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-400 hover:text-white"
            >
              Add Leg
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Stake / Parlay" value={roundRobinStake} onChange={setRoundRobinStake} placeholder="20" />
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-white/50">
            Parlay Size
            <select
              value={roundRobinSize}
              onChange={(event) => setRoundRobinSize(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white/90 focus:border-emerald-400/60 focus:outline-none"
            >
              {Array.from({ length: Math.max(2, roundRobinLegs.length) }, (_, index) => index + 2).map((value) => (
                <option key={value} value={value}>
                  {value} legs
                </option>
              ))}
            </select>
          </label>
          <Output label="Combinations" value={roundRobinResult ? String(roundRobinResult.combos) : "--"} />
          <Output label="Total Stake" value={roundRobinResult ? `$${roundRobinResult.totalStake.toFixed(2)}` : "--"} />
        </div>
        {roundRobinResult && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Output label="Max Return" value={`$${roundRobinResult.totalReturn.toFixed(2)}`} />
            <Output label="Max Profit" value={`$${roundRobinResult.profit.toFixed(2)}`} tone="good" />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Expected Value"
        description="Calculate EV using your win probability and stake."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="American Odds" value={evOdds} onChange={setEvOdds} placeholder="-110" />
          <Field label="Win Probability %" value={evProb} onChange={setEvProb} placeholder="55" />
          <Field label="Stake" value={evStake} onChange={setEvStake} placeholder="100" />
          <Output
            label="EV"
            value={evResult ? `$${evResult.ev.toFixed(2)}` : "--"}
            tone={evResult != null && evResult.ev > 0 ? "good" : "warn"}
          />
        </div>
        {evResult && (
          <div className="mt-4">
            <Output label="EV % of Stake" value={`${(evResult.roi * 100).toFixed(1)}%`} />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="De-vig Odds"
        description="Remove the vig from a two-way market and show fair odds."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Side A Odds" value={devigOddsA} onChange={setDevigOddsA} placeholder="-110" />
          <Field label="Side B Odds" value={devigOddsB} onChange={setDevigOddsB} placeholder="-110" />
          <Output label="No-vig A" value={devigResult ? formatPercent(devigResult.noVigA, 2) : "--"} />
          <Output label="No-vig B" value={devigResult ? formatPercent(devigResult.noVigB, 2) : "--"} />
        </div>
        {devigResult && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Output label="Fair Odds A" value={formatOdds(devigResult.fairOddsA)} />
            <Output label="Fair Odds B" value={formatOdds(devigResult.fairOddsB)} />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Promo Converter"
        description="Estimate the cash value of a bonus bet using win probability."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Bonus Amount" value={promoAmount} onChange={setPromoAmount} placeholder="50" />
          <Field label="Odds" value={promoOdds} onChange={setPromoOdds} placeholder="+200" />
          <Field label="Win Probability %" value={promoProb} onChange={setPromoProb} placeholder="(optional)" helper="Blank uses implied odds." />
          <Output
            label="Promo EV"
            value={promoResult ? `$${promoResult.ev.toFixed(2)}` : "--"}
            tone={promoResult != null && promoResult.ev > 0 ? "good" : "warn"}
          />
        </div>
        {promoResult && (
          <div className="mt-4">
            <Output label="Conversion Rate" value={`${(promoResult.conversion * 100).toFixed(1)}%`} />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Odds Converter"
        description="Convert American odds to decimal and implied probability."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-white/50">
            Input Type
            <select
              value={oddsInputType}
              onChange={(event) => setOddsInputType(event.target.value as "american" | "decimal")}
              className="rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white/90 focus:border-emerald-400/60 focus:outline-none"
            >
              <option value="american">American</option>
              <option value="decimal">Decimal</option>
            </select>
          </label>
          <Field label="Input Odds" value={oddsInputValue} onChange={setOddsInputValue} placeholder="-110" />
          <Output label="American" value={oddsConverter ? formatOdds(oddsConverter.american) : "--"} />
          <Output label="Decimal" value={oddsConverter ? formatDecimal(oddsConverter.decimal) : "--"} />
        </div>
        <div className="mt-4">
          <Output label="Implied Probability" value={oddsConverter ? formatPercent(oddsConverter.implied, 2) : "--"} />
        </div>
      </SectionCard>

      <SectionCard
        title="Implied Probability"
        description="Calculate the implied win rate from any line."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-white/50">
            Input Type
            <select
              value={impliedInputType}
              onChange={(event) => setImpliedInputType(event.target.value as "american" | "decimal")}
              className="rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white/90 focus:border-emerald-400/60 focus:outline-none"
            >
              <option value="american">American</option>
              <option value="decimal">Decimal</option>
            </select>
          </label>
          <Field label="Input Odds" value={impliedInputValue} onChange={setImpliedInputValue} placeholder="-110" />
          <Output label="Implied Probability" value={impliedResult ? formatPercent(impliedResult, 2) : "--"} />
        </div>
      </SectionCard>
    </div>
  )
}
