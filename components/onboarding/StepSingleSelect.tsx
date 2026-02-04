"use client"

import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { AnonymousMark } from "./AnonymousMark"

export type SingleSelectOption = {
  id: string
  label: string
  description?: string
}

interface StepSingleSelectProps {
  eyebrow?: string
  question: string
  value: string
  options: SingleSelectOption[]
  onChange: (value: string) => void
  onValidation: (isValid: boolean) => void
}

export function StepSingleSelect({
  eyebrow = "Quick profile",
  question,
  value,
  options,
  onChange,
  onValidation,
}: StepSingleSelectProps) {
  useEffect(() => {
    onValidation(Boolean(value))
  }, [value, onValidation])

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
          {eyebrow}
        </div>
        <h1 className="text-2xl font-semibold leading-snug text-white">
          {question}
        </h1>
        <p className="text-sm text-white/65">Select one.</p>
      </div>

      <div className="space-y-3">
        {options.map((option) => {
          const isSelected = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={[
                "w-full rounded-full border px-5 py-4 text-left transition-colors",
                "bg-white/[0.02] hover:bg-white/[0.05]",
                isSelected
                  ? "border-emerald-400/60 bg-emerald-500/10 text-white"
                  : "border-white/10 text-white/85",
              ].join(" ")}
            >
              <div className="text-sm font-semibold">{option.label}</div>
              {option.description && (
                <div className="mt-1 text-xs text-white/55">
                  {option.description}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

