"use client"

import React, { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+?<>[]{}"

const randomChar = () => CHARS[Math.floor(Math.random() * CHARS.length)]

const buildFrame = (rows: number, cols: number) => {
  const lines: string[] = []
  for (let r = 0; r < rows; r += 1) {
    let line = ""
    for (let c = 0; c < cols; c += 1) {
      line += randomChar()
    }
    lines.push(line)
  }
  return lines.join("\n")
}

interface MatrixTransitionProps {
  active: boolean
  label?: string
}

export function MatrixTransition({ active, label = "DECRYPTING…" }: MatrixTransitionProps) {
  const [frame, setFrame] = useState("")
  const dims = useMemo(() => ({ rows: 18, cols: 34 }), [])

  useEffect(() => {
    if (!active) return
    setFrame(buildFrame(dims.rows, dims.cols))
    const interval = setInterval(() => {
      setFrame(buildFrame(dims.rows, dims.cols))
    }, 55)
    return () => clearInterval(interval)
  }, [active, dims.cols, dims.rows])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.10),transparent_60%)]" />
          <div className="absolute left-1/2 top-4 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200/70">
            {label}
          </div>
          <div className="w-full px-4">
            <pre className="mx-auto select-none overflow-hidden whitespace-pre text-center font-mono leading-[1.05] text-[11px] text-emerald-300/35 mix-blend-screen sm:max-w-[520px] sm:text-[12px]">
              {frame}
            </pre>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
