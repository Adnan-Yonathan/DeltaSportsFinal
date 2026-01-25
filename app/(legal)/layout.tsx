import type { ReactNode } from "react"
import Link from "next/link"
import { DottedSurface } from "@/components/ui/dotted-surface"

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <DottedSurface className="z-0" />
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">Legal</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            Back to Home
          </Link>
        </div>
        <main className="space-y-10">{children}</main>
      </div>
    </div>
  )
}
