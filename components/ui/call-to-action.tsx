"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function StatsSection() {
  const slides = [
    "/Screenshot 2026-01-27 131625.png",
    "/Screenshot 2026-01-27 131653.png",
    "/Screenshot 2026-01-27 131803.png",
    "/Screenshot 2026-01-27 131856.png",
  ]
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [slides.length])

  return (
    <section className="w-full -mt-2 lg:-mt-4">
      <div className="py-0">
        <div className="mx-auto max-w-3xl px-6">
          <div className="space-y-6 text-center">
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:justify-center sm:gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 w-full justify-center text-sm bg-[#34d399] text-black hover:bg-[#16a34a] sm:w-60 sm:text-base"
              >
                <Link
                  href="https://x.com/DeltaSportsAI"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] leading-tight sm:text-base"
                >
                  follow us on twitter
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="h-12 w-full justify-center text-sm bg-[#34d399] text-black hover:bg-[#16a34a] sm:w-60 sm:text-base"
              >
                <Link href="/auth/login">Start Winning</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-4xl px-6">
          <div className="relative aspect-[5/3] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-[0_22px_60px_rgba(0,0,0,0.4)]">
            <motion.div
              className="flex h-full"
              style={{ width: `${slides.length * 100}%` }}
              animate={{ x: `-${activeSlide * (100 / slides.length)}%` }}
              transition={{ type: "tween", duration: 0.7, ease: "easeInOut" }}
            >
              {slides.map((src, index) => (
                <div
                  key={src}
                  className="relative h-full shrink-0"
                  style={{ width: `${100 / slides.length}%` }}
                >
                  <Image
                    src={src}
                    alt={`Delta Sports screenshot ${index + 1}`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 960px"
                    priority={index === 0}
                  />
                </div>
              ))}
            </motion.div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            {slides.map((_, index) => (
              <span
                key={`dot-${index}`}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index === activeSlide ? "bg-[#34d399]" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
