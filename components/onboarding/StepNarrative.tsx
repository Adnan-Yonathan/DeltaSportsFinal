"use client"

import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { AnonymousMark } from "./AnonymousMark"

interface StepNarrativeProps {
  message: string
  prompt?: string
  onValidation: (isValid: boolean) => void
}

export function StepNarrative({ message, prompt, onValidation }: StepNarrativeProps) {
  useEffect(() => {
    onValidation(true)
  }, [onValidation])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.28 }}
      className="mx-auto w-full max-w-sm space-y-6 px-1"
    >
      <div className="mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
          <AnonymousMark className="h-4 w-4 text-white/80" />
          DELTA//SECURE
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-transparent p-6">
        <div className="absolute inset-0 opacity-[0.22] [background-image:repeating-linear-gradient(180deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_2px,transparent_6px)]" />
        <div className="absolute -right-10 -top-12 opacity-[0.06]">
          <AnonymousMark className="h-44 w-44 text-white" />
        </div>

        <div className="relative flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-black/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-emerald-200/85">
            Incoming transmission
            <span className="h-1 w-1 rounded-full bg-emerald-300/75" />
            Live
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/35">
            Secure
          </div>
        </div>

        <div className="relative mt-5 text-[22px] font-semibold leading-snug text-white">
          {message}
        </div>
        {prompt && (
          <div className="relative mt-4 text-sm font-medium text-white/70">
            {prompt}
          </div>
        )}

        <div className="relative mt-5 h-[2px] overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full w-1/2 bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent"
            initial={{ x: "-60%" }}
            animate={{ x: "160%" }}
            transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>

      <div className="text-center text-[11px] uppercase tracking-[0.22em] text-white/35">
        No skips. No noise. Just signal.
      </div>
    </motion.div>
  )
}
