"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"

interface AnimatedHeroProps {
  staticText?: string
  rotatingTerms?: string[]
  interval?: number
}

function AnimatedHero({
  staticText = "AI-powered betting",
  rotatingTerms = ["analytics", "models", "action", "edges", "lines", "tracking"],
  interval = 2000,
}: AnimatedHeroProps) {
  const [termIndex, setTermIndex] = useState(0)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (termIndex === rotatingTerms.length - 1) {
        setTermIndex(0)
      } else {
        setTermIndex(termIndex + 1)
      }
    }, interval)
    return () => clearTimeout(timeoutId)
  }, [termIndex, rotatingTerms, interval])

  return (
    <h1 className="text-5xl md:text-6xl font-semibold leading-[1.3] tracking-tight text-white">
      {staticText}
      <br />
      <span className="relative block min-h-[1.6em] w-full pt-1 pb-3">
        {/* Invisible placeholder to maintain height and proper spacing */}
        <span className="invisible font-semibold">analytics.</span>
        {rotatingTerms.map((term, index) => (
          <motion.span
            key={index}
            className="absolute left-0 inset-y-0 font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent whitespace-nowrap flex items-center"
            initial={{ opacity: 0, y: -50 }}
            transition={{ type: "spring", stiffness: 50 }}
            animate={
              termIndex === index
                ? {
                    y: 0,
                    opacity: 1,
                  }
                : {
                    y: termIndex > index ? -100 : 100,
                    opacity: 0,
                  }
            }
          >
            {term}.
          </motion.span>
        ))}
      </span>
    </h1>
  )
}

export { AnimatedHero }
