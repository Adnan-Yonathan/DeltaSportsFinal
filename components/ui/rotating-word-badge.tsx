"use client"

import * as React from "react"
import { CommitsGrid } from "./commits-grid"

const HERO_WORDS = ["sharp", "insider", "syndicate", "winner"]
const MAX_WORD_LENGTH = Math.max(...HERO_WORDS.map((word) => word.length))
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

type RotatingWordBadgeProps = {
  prefix?: string
  suffix?: string
  className?: string
}

export const RotatingWordBadge = ({
  prefix = "",
  suffix = "",
  className = "",
}: RotatingWordBadgeProps) => {
  const [index, setIndex] = React.useState(0)
  const [displayedWord, setDisplayedWord] = React.useState("")

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % HERO_WORDS.length)
    }, 2600)

    return () => clearInterval(interval)
  }, [])

  const word = HERO_WORDS[index]
  const padding = MAX_WORD_LENGTH - word.length
  const wordLeftPad = Math.floor(padding / 2)
  const wordRightPad = padding - wordLeftPad
  const paddedWord = `${" ".repeat(wordLeftPad)}${word}${" ".repeat(wordRightPad)}`

  React.useEffect(() => {
    const steps = 8
    const intervalMs = 70
    let step = 0

    const interval = setInterval(() => {
      step += 1
      const revealCount = Math.floor((step / steps) * paddedWord.length)
      let next = ""

      for (let i = 0; i < paddedWord.length; i += 1) {
        if (i < revealCount) {
          next += paddedWord[i]
        } else if (paddedWord[i] === " ") {
          next += " "
        } else {
          next += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
        }
      }

      setDisplayedWord(next)

      if (step >= steps) {
        clearInterval(interval)
        setDisplayedWord(paddedWord)
      }
    }, intervalMs)

    return () => clearInterval(interval)
  }, [paddedWord])

  const combinedText = `${prefix}${displayedWord || paddedWord}${suffix}`

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="w-full max-w-4xl">
        <CommitsGrid text={combinedText} />
      </div>
      <span className="sr-only">Current focus word: {word}</span>
    </div>
  )
}
