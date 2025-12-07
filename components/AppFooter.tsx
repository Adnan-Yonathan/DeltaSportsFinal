"use client"

import Link from "next/link"

export function AppFooter() {
  return (
    <footer className="border-t border-[#2f343c] bg-bg-primary text-text-secondary">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] tracking-wide text-text-secondary">
          Ac {new Date().getFullYear()} Delta AI. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] text-text-secondary">Legal</span>
          <Link
            href="#"
            className="text-[11px] text-text-secondary underline-offset-4 hover:text-accent-green hover:underline"
          >
            MSA
          </Link>
          <Link
            href="#"
            className="text-[11px] text-text-secondary underline-offset-4 hover:text-accent-green hover:underline"
          >
            Product Terms
          </Link>
          <Link
            href="#"
            className="text-[11px] text-text-secondary underline-offset-4 hover:text-accent-green hover:underline"
          >
            Policies
          </Link>
          <Link
            href="#"
            className="text-[11px] text-text-secondary underline-offset-4 hover:text-accent-green hover:underline"
          >
            Privacy Notice
          </Link>
          <Link
            href="#"
            className="text-[11px] text-text-secondary underline-offset-4 hover:text-accent-green hover:underline"
          >
            Cookie Notice
          </Link>
        </div>
      </div>
    </footer>
  )
}
