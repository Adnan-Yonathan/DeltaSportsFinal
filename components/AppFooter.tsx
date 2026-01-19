"use client"

import Link from "next/link"
import { Twitter } from "lucide-react"

export function AppFooter() {
  return (
    <footer className="bg-black text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 px-4 py-6 text-xs sm:flex-row sm:gap-6">
        <p className="text-[11px] tracking-wide">
          Delta Sports Beta (NBA) - AI-powered insights for serious bettors.
        </p>
        <p className="text-[11px] text-white/60">
          (c) {new Date().getFullYear()} Delta Sports. All rights reserved.
        </p>
        <Link
          href="https://x.com/DeltaSportsAI"
          target="_blank"
          rel="noreferrer"
          aria-label="Delta Sports on X"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:border-emerald-400/60 hover:text-emerald-200"
        >
          <Twitter className="h-4 w-4" />
        </Link>
      </div>
    </footer>
  )
}

