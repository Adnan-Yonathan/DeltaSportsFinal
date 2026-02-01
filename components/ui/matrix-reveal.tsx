"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const MATRIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%*+?"

function buildMatrixText(rows: number, cols: number) {
  let output = ""
  for (let r = 0; r < rows; r += 1) {
    let line = ""
    for (let c = 0; c < cols; c += 1) {
      line += MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
    }
    output += r === rows - 1 ? line : `${line}\n`
  }
  return output
}

type MatrixRevealProps = {
  children: React.ReactNode
  className?: string
  rows?: number
  cols?: number
}

export function MatrixReveal({
  children,
  className = "",
  rows = 8,
  cols = 48,
}: MatrixRevealProps) {
  const [scramble, setScramble] = React.useState("")

  React.useEffect(() => {
    let frame = 0
    const totalFrames = 12
    const interval = setInterval(() => {
      frame += 1
      setScramble(buildMatrixText(rows, cols))
      if (frame >= totalFrames) clearInterval(interval)
    }, 60)

    return () => clearInterval(interval)
  }, [rows, cols])

  return (
    <div className={cn("matrix-reveal", className)}>
      <div className="matrix-reveal__overlay" aria-hidden="true">
        {scramble}
      </div>
      <div className="matrix-reveal__content">{children}</div>
    </div>
  )
}
