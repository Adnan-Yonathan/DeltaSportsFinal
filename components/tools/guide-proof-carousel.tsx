"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"

type GuideProofSlide = {
  id: string
  src?: string
  alt?: string
}

type GuideProofCarouselProps = {
  slides: GuideProofSlide[]
  autoPlayMs?: number
  className?: string
}

export function GuideProofCarousel({
  slides,
  autoPlayMs = 4500,
  className = "",
}: GuideProofCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length)
    }, autoPlayMs)
    return () => clearInterval(timer)
  }, [autoPlayMs, slides.length])

  if (!slides.length) return null

  const activeSlide = slides[activeIndex]

  const goToNext = () => setActiveIndex((prev) => (prev + 1) % slides.length)
  const goToPrev = () => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length)

  return (
    <div className={`w-full ${className}`}>
      <div className="mx-auto max-w-[340px]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/15 bg-black/65">
          {activeSlide.src ? (
            <Image
              src={activeSlide.src}
              alt={activeSlide.alt ?? `Proof slide ${activeIndex + 1}`}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
              <div className="rounded-xl border border-dashed border-white/25 bg-black/35 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">9:16 Proof Slot</p>
                <p className="mt-2 text-lg font-semibold text-white/70">{activeIndex + 1} / {slides.length}</p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">
              Screenshot {activeIndex + 1}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={goToPrev}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/25 hover:text-white"
            aria-label="Previous proof slide"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>

          <div className="flex items-center gap-1.5">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2 w-2 rounded-full transition ${
                  index === activeIndex ? "bg-emerald-300" : "bg-white/30 hover:bg-white/45"
                }`}
                aria-label={`Go to proof slide ${index + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={goToNext}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/25 hover:text-white"
            aria-label="Next proof slide"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
