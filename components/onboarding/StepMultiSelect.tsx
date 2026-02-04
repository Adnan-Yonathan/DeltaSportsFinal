"use client"

import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { AnonymousMark } from "./AnonymousMark"

export type MultiSelectOption = {
  id: string
  label: string
  description?: string
}

interface StepMultiSelectProps {
  eyebrow?: string
  question: string
  hint?: string
  maxSelections?: number
  value: string[]
  options: MultiSelectOption[]
  onChange: (value: string[]) => void
  onValidation: (isValid: boolean) => void
}

export function StepMultiSelect({
  eyebrow = "Operator goals",
  question,
  hint = "Select up to three.",
  maxSelections = 3,
  value,
  options,
  onChange,
  onValidation,
}: StepMultiSelectProps) {
  useEffect(() => {
    onValidation(value.length > 0)
  }, [value, onValidation])

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id))
      return
    }
    if (value.length >= maxSelections) return
    onChange([...value, id])
  }

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
        <p className="text-sm text-white/65">{hint}</p>
      </div>

      <div className="space-y-3">
        {options.map((option) => {
          const isSelected = value.includes(option.id)
          const isDisabled = !isSelected && value.length >= maxSelections
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              disabled={isDisabled}
              className={[
                "w-full rounded-full border px-5 py-4 text-left transition-colors",
                "bg-white/[0.02] hover:bg-white/[0.05] disabled:opacity-45 disabled:cursor-not-allowed",
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

      <div className="text-center text-xs text-white/45">
        {value.length}/{maxSelections} selected
      </div>
    </motion.div>
  )
}

