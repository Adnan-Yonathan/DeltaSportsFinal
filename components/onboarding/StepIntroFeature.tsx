"use client"

import React, { useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"
import { AnonymousMark } from "./AnonymousMark"

type StepMetric = {
  label: string
  value: string
}

interface StepIntroFeatureProps {
  heading?: string
  title: string
  description: string
  howToUse?: string
  whyItValuable?: string
  bullets?: string[]
  metrics?: StepMetric[]
  previewSrc?: string
  previewAlt?: string
  previewHref?: string
  onValidation: (isValid: boolean) => void
}

export function StepIntroFeature({
  heading,
  title,
  description,
  howToUse,
  whyItValuable,
  bullets = [],
  metrics = [],
  previewSrc,
  previewAlt,
  previewHref,
  onValidation,
}: StepIntroFeatureProps) {
  useEffect(() => {
    onValidation(true)
  }, [onValidation])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="mx-auto w-full max-w-5xl space-y-6 px-1"
    >
      <div className="mx-auto flex w-full flex-col items-center text-center">
        {heading ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
            <AnonymousMark className="h-4 w-4 text-emerald-200/90" />
            {heading}
          </div>
        ) : null}
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-white">
          {title}
        </h1>
        <p className="mt-3 text-base font-semibold leading-relaxed text-white/90">
          {description}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5 sm:p-6">
        <div className="absolute inset-0 opacity-[0.22] [background-image:repeating-linear-gradient(90deg,transparent_0px,transparent_10px,rgba(255,255,255,0.08)_11px,transparent_12px)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-emerald-200/90">
              Clearance
              <span className="h-1 w-1 rounded-full bg-emerald-300/80" />
              L1 Verified
            </div>
            <div className="mt-3 text-lg font-semibold text-white">
              Insider Briefing
            </div>
            <div className="mt-1 text-sm text-white/70">
              Decrypting next module...
            </div>
          </div>
          <div className="shrink-0 rounded-2xl border border-emerald-400/25 bg-black/30 px-3 py-2 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/45">
              Status
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-200/90">
              CLEARED
            </div>
          </div>
        </div>
        <div className="relative mt-4 h-[2px] overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full w-1/2 bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent"
            initial={{ x: "-60%" }}
            animate={{ x: "160%" }}
            transition={{ duration: 1.35, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>

      {(howToUse || whyItValuable || bullets.length > 0 || metrics.length > 0 || previewSrc) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.08 }}
          className="rounded-3xl border border-white/10 bg-black/45 p-5 backdrop-blur sm:p-6"
        >
          {(howToUse || whyItValuable) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {howToUse && (
                <div className="rounded-2xl border border-white/10 bg-black/45 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
                    How To Use It
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/75">{howToUse}</p>
                </div>
              )}
              {whyItValuable && (
                <div className="rounded-2xl border border-white/10 bg-black/45 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
                    Why It Matters
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/75">{whyItValuable}</p>
                </div>
              )}
            </div>
          )}

          {bullets.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-white/75">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/90" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          {metrics.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={`${metric.label}-${metric.value}`}
                  className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3"
                >
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">{metric.label}</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-200">{metric.value}</p>
                </div>
              ))}
            </div>
          )}

          {previewSrc && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/60">
              <img
                src={previewSrc}
                alt={previewAlt ?? `${title} preview`}
                className="h-full w-full object-cover"
              />
              {previewHref && (
                <div className="border-t border-white/10 bg-black/60 px-4 py-3">
                  <Link
                    href={previewHref}
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/90 hover:text-emerald-100"
                  >
                    Open Live Tool
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
