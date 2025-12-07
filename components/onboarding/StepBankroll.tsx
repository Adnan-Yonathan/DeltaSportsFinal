"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { DollarSign, TrendingUp } from "lucide-react"

interface StepBankrollProps {
  bankroll: number
  unitSize: number
  onChange: (bankroll: number, unitSize: number) => void
  onValidation: (isValid: boolean) => void
}

export function StepBankroll({ bankroll, unitSize, onChange, onValidation }: StepBankrollProps) {
  const [bankrollInput, setBankrollInput] = useState<string>(bankroll > 0 ? String(bankroll) : "")
  const [unitInput, setUnitInput] = useState<string>(unitSize > 0 ? String(unitSize) : "")
  const [error, setError] = useState<string>("")

  useEffect(() => {
    // Validate inputs
    setError("")

    if (!bankrollInput || !unitInput) {
      onValidation(false)
      return
    }

    const bankrollNum = parseFloat(bankrollInput)
    const unitNum = parseFloat(unitInput)

    if (isNaN(bankrollNum) || bankrollNum <= 0) {
      setError("Bankroll must be a positive number")
      onValidation(false)
      return
    }

    if (isNaN(unitNum) || unitNum <= 0) {
      setError("Unit size must be a positive number")
      onValidation(false)
      return
    }

    if (unitNum > bankrollNum) {
      setError("Unit size cannot be larger than your bankroll")
      onValidation(false)
      return
    }

    if (unitNum > bankrollNum * 0.1) {
      setError("Warning: Your unit size is quite large (>10% of bankroll). Consider a smaller unit for better bankroll management.")
      onValidation(true) // Still allow, but warn
    }

    // All good
    onChange(bankrollNum, unitNum)
    onValidation(true)
  }, [bankrollInput, unitInput, onChange, onValidation])

  const suggestedUnit = bankrollInput ? (parseFloat(bankrollInput) * 0.02).toFixed(2) : "0"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold text-white">Set Your Bankroll</h2>
        <p className="text-white/60">Tell us your starting bankroll and unit size for tracking</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {/* Bankroll Input */}
        <div className="space-y-2">
          <label className="text-white/80 text-sm font-medium">Starting Bankroll</label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="number"
              value={bankrollInput}
              onChange={(e) => setBankrollInput(e.target.value)}
              placeholder="1000"
              min="0"
              step="0.01"
              className="w-full bg-zinc-900/80 backdrop-blur-sm text-white placeholder:text-white/40 border border-white/10 rounded-xl py-4 pl-12 pr-6 focus:outline-none focus:border-emerald-500 text-lg"
            />
          </div>
          <p className="text-white/40 text-xs">
            This is the total amount you&apos;re starting with for sports betting
          </p>
        </div>

        {/* Unit Size Input */}
        <div className="space-y-2">
          <label className="text-white/80 text-sm font-medium">Unit Size</label>
          <div className="relative">
            <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="number"
              value={unitInput}
              onChange={(e) => setUnitInput(e.target.value)}
              placeholder={suggestedUnit}
              min="0"
              step="0.01"
              className="w-full bg-zinc-900/80 backdrop-blur-sm text-white placeholder:text-white/40 border border-white/10 rounded-xl py-4 pl-12 pr-6 focus:outline-none focus:border-emerald-500 text-lg"
            />
          </div>
          <p className="text-white/40 text-xs">
            Standard bet size (recommended: 1-2% of bankroll = ${suggestedUnit})
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-4 rounded-lg border ${
              error.startsWith("Warning")
                ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            } text-sm`}
          >
            {error}
          </motion.div>
        )}

        {/* Info Box */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-2">
          <h3 className="text-white font-semibold text-sm">Why track units?</h3>
          <p className="text-white/60 text-xs">
            Units help you manage risk and track performance consistently, regardless of bankroll changes.
            Most professional bettors risk 1-3% of their bankroll per bet (1 unit).
          </p>
        </div>
      </div>
    </motion.div>
  )
}
