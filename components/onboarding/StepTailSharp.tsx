"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { GlareCard } from "@/components/ui/glare-card"

interface StepTailSharpProps {
  value: string
  onChange: (value: string) => void
  onValidation: (isValid: boolean) => void
}

const OPTIONS = [
  {
    id: "no",
    title: "No",
    description: "I haven’t tried to tail a sharp yet.",
  },
  {
    id: "own-picks",
    title: "I make my own picks",
    description: "I focus on my own research and decisions.",
  },
  {
    id: "capper",
    title: "I've tailed a Twitter capper before",
    description: "I’ve followed picks from social cappers.",
  },
  {
    id: "market-moves",
    title: "Yes, I track market movement and splits",
    description: "I follow sharp action and betting splits.",
  },
]

export function StepTailSharp({ value, onChange, onValidation }: StepTailSharpProps) {
  useEffect(() => {
    onValidation(!!value)
  }, [value, onValidation])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">
          Sharp Tracking
        </p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Have you ever tried to tail a sharp?
        </h1>
        <p className="text-sm text-white/80 sm:text-base">
          We use this to personalize your tooling.
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-4 place-items-center">
          {OPTIONS.map((option) => {
            const isSelected = value === option.id
            return (
              <motion.button
                key={option.id}
                onClick={() => onChange(option.id)}
                className="relative w-full max-w-none sm:max-w-[240px]"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="relative scale-100 sm:scale-95">
                  <GlareCard className="flex h-full w-full flex-row items-center justify-between gap-4 p-4 sm:flex-col sm:items-start sm:gap-0 sm:p-5">
                    <div className="flex items-start gap-3 sm:w-full sm:items-start sm:justify-between">
                      <div className="text-base font-semibold text-white sm:text-lg">
                        {option.title}
                      </div>
                      {isSelected && (
                        <div className="rounded-full bg-emerald-500 p-1 sm:ml-auto">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-left text-xs text-white/60 sm:mt-6 sm:text-sm">
                      {option.description}
                    </div>
                  </GlareCard>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {!value && (
        <p className="text-center text-red-400 text-sm">
          Please select an option
        </p>
      )}
    </motion.div>
  )
}
