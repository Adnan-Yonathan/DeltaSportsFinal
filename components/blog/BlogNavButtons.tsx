"use client"

import { useRouter } from "next/navigation"

export function BlogNavButtons() {
  const router = useRouter()

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
      <button
        type="button"
        onClick={() => router.back()}
        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 uppercase tracking-[0.2em] text-white/70 hover:border-emerald-500/40 hover:text-emerald-200 transition-colors"
      >
        Back
      </button>
      <button
        type="button"
        onClick={() => router.forward()}
        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 uppercase tracking-[0.2em] text-white/70 hover:border-emerald-500/40 hover:text-emerald-200 transition-colors"
      >
        Forward
      </button>
    </div>
  )
}
