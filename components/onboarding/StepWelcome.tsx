"use client"

import React, { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Lock, Unlock } from "lucide-react"
import { AnonymousMark } from "./AnonymousMark"

interface StepWelcomeProps {
  onValidation: (isValid: boolean) => void
  unlocking?: boolean
}

export function StepWelcome({ onValidation, unlocking = false }: StepWelcomeProps) {
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
          WELCOME//DELTA
        </div>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-white">
          Welcome to Delta Sports
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          You&apos;re entering the sharp layer. Answer a few questions and we&apos;ll
          tailor your feed like an insider.
        </p>
      </div>

      <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
          Status
        </div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="text-lg font-semibold text-white">
            <AnimatePresence mode="wait" initial={false}>
              {unlocking ? (
                <motion.span
                  key="unlocking"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                >
                  Unlocking…
                </motion.span>
              ) : (
                <motion.span
                  key="granted"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                >
                  Access granted
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/25 bg-black/30">
            <AnimatePresence mode="wait" initial={false}>
              {unlocking ? (
                <motion.div
                  key="unlock"
                  initial={{ opacity: 0, scale: 0.9, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.9, rotate: 8 }}
                  transition={{ duration: 0.16 }}
                  className="text-emerald-200"
                >
                  <Unlock className="h-5 w-5" />
                </motion.div>
              ) : (
                <motion.div
                  key="lock"
                  initial={{ opacity: 0, scale: 0.9, rotate: 8 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.9, rotate: -8 }}
                  transition={{ duration: 0.16 }}
                  className="text-emerald-200/90"
                >
                  <Lock className="h-5 w-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-3 text-sm text-white/65">
          <AnimatePresence mode="wait" initial={false}>
            {unlocking ? (
              <motion.span
                key="unlocking-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                Initializing secure briefing…
              </motion.span>
            ) : (
              <motion.span
                key="default-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                Tap next to initialize the briefing.
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 h-[2px] overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent"
            initial={{ x: "-60%" }}
            animate={{ x: unlocking ? "160%" : "120%" }}
            transition={{
              duration: unlocking ? 0.6 : 1.4,
              repeat: unlocking ? 0 : Infinity,
              ease: "linear",
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}
