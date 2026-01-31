"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Twitter } from "lucide-react"

export default function StatsSection() {
  const slides = [
    "/Screenshot 2026-01-27 131625.png",
    "/Screenshot 2026-01-27 131653.png",
    "/Screenshot 2026-01-27 131803.png",
    "/Screenshot 2026-01-27 131856.png",
    "/IMG_8141.jpg",
    "/IMG_8159.jpg",
    "/Screenshot 2026-01-31 010115.png",
  ]
  const slideTrack = useMemo(() => [...slides, ...slides], [slides])

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
                  aria-label="Delta Sports on X"
                  className="flex items-center justify-center"
                >
                  <Twitter className="h-5 w-5" />
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
        <div className="mx-auto mt-6 max-w-5xl px-6">
          <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-[0_22px_60px_rgba(0,0,0,0.4)]">
            <div className="flex w-max animate-slide-track gap-4 py-4">
              {slideTrack.map((src, index) => (
                <div
                  key={`${src}-${index}`}
                  className="relative h-[220px] w-[300px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/80 sm:h-[240px] sm:w-[360px] md:h-[260px] md:w-[420px] lg:h-[280px] lg:w-[520px]"
                >
                  <img
                    src={src}
                    alt={`Delta Sports screenshot ${index + 1}`}
                    className="h-full w-full object-contain"
                    loading={index < slides.length ? "eager" : "lazy"}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
