"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { GuestHero } from "@/components/ui/guest-hero"
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
      <GuestHero
        eyebrow="Sharp Tracking"
        title="Have you ever tried to tail a sharp?"
        subtitle="We use this to personalize your tooling."
        compact
        useCommitsGrid
      />

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 gap-4 place-items-center sm:grid-cols-4">
          {OPTIONS.map((option) => {
            const isSelected = value === option.id
            return (
              <motion.button
                key={option.id}
                onClick={() => onChange(option.id)}
                className="relative w-full max-w-[240px]"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="relative scale-[0.9] sm:scale-95">
                  <GlareCard className="flex h-full w-full flex-col justify-between p-5">
                    <div className="flex items-start justify-between">
                      <div className="text-lg font-semibold text-white">
                        {option.title}
                      </div>
                      {isSelected && (
                        <div className="rounded-full bg-emerald-500 p-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="mt-6 text-sm text-white/60">
                      {option.description}
                    </div>
                  </GlareCard>
                  {isSelected && (
                    <span className="pointer-events-none absolute inset-0 rounded-[48px] ring-2 ring-emerald-400/60" />
                  )}
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
