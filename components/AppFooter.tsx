"use client"

import Link from "next/link"

export function AppFooter() {
  return (
    <footer className="bg-black text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 px-4 py-6 text-xs sm:flex-row sm:gap-6">
        <p className="text-[11px] tracking-wide">
          Delta Sports Beta — AI-powered insights for serious bettors.
        </p>
        <p className="text-[11px] text-white/60">
          © {new Date().getFullYear()} Delta AI. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
