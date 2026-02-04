"use client"

import React, { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { DollarSign } from "lucide-react"
import { AnonymousMark } from "./AnonymousMark"

interface StepUnitSizeProps {
  unitSize: number
  betsPerDay: number
  onChange: (unitSize: number, betsPerDay: number) => void
  onValidation: (isValid: boolean) => void
}

const BETS_PER_DAY_PRESETS = [1, 2, 3, 5, 10, 20]

export function StepUnitSize({
  unitSize,
  betsPerDay,
  onChange,
  onValidation,
}: StepUnitSizeProps) {
  const [unitInput, setUnitInput] = useState(unitSize > 0 ? String(unitSize) : "")
  const [betsInput, setBetsInput] = useState(betsPerDay > 0 ? String(betsPerDay) : "")

  const unitNum = useMemo(() => Number(unitInput) || 0, [unitInput])
  const betsNum = useMemo(() => Number(betsInput) || 0, [betsInput])

  useEffect(() => {
    const isValid = unitNum > 0 && betsNum > 0
    onValidation(isValid)
    if (isValid) onChange(unitNum, betsNum)
  }, [unitNum, betsNum, onValidation, onChange])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.28 }}
      className="mx-auto w-full max-w-sm space-y-6 px-1"
    >
      <div className="text-center space-y-2">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
          <AnonymousMark className="h-4 w-4 text-white/80" />
          Unit sizing
        </div>
        <h1 className="text-2xl font-semibold leading-snug text-white">
          What&apos;s your unit size and bets/day?
        </h1>
        <p className="text-sm text-white/65">
          This powers your monthly edge estimate.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.25em] text-white/55">
            Unit size
          </label>
          <div className="relative">
            <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/35" />
            <input
              type="number"
              inputMode="numeric"
              value={unitInput}
              onChange={(e) => setUnitInput(e.target.value)}
              placeholder="50"
              min="1"
              step="1"
              className="w-full rounded-2xl border border-white/10 bg-zinc-900/70 py-3 pl-12 pr-5 text-base font-semibold text-white placeholder:text-white/30 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.25em] text-white/55">
            Bets per day
          </label>
          <div className="flex flex-wrap gap-2">
            {BETS_PER_DAY_PRESETS.map((preset) => {
              const isSelected = betsNum === preset
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBetsInput(String(preset))}
                  className={[
                    "rounded-full border px-4 py-2 text-xs font-semibold",
                    isSelected
                      ? "border-emerald-400/60 bg-emerald-500/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-white/75 hover:bg-white/[0.05]",
                  ].join(" ")}
                >
                  {preset === 20 ? "20+" : preset}
                </button>
              )
            })}
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={betsInput}
            onChange={(e) => setBetsInput(e.target.value)}
            placeholder="10"
            min="1"
            step="1"
            className="w-full rounded-2xl border border-white/10 bg-zinc-900/70 py-3 px-5 text-base font-semibold text-white placeholder:text-white/30 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
          />
        </div>
      </div>
    </motion.div>
  )
}

