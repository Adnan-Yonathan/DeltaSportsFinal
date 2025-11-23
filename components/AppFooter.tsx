"use client"

import Link from "next/link"

export function AppFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/90 text-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] tracking-wide text-white/40">
          © {new Date().getFullYear()} Delta AI. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] text-white/40">Legal</span>
          <Link
            href="#"
            className="text-[11px] text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            MSA
          </Link>
          <Link
            href="#"
            className="text-[11px] text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            Product Terms
          </Link>
          <Link
            href="#"
            className="text-[11px] text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            Policies
          </Link>
          <Link
            href="#"
            className="text-[11px] text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            Privacy Notice
          </Link>
          <Link
            href="#"
            className="text-[11px] text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            Cookie Notice
          </Link>
        </div>
      </div>
    </footer>
  )
}

