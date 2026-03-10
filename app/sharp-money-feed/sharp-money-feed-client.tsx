"use client"

import { Lock } from "lucide-react"
import { SimpleHeader } from "@/components/ui/simple-header"
import MobileToolsNav from "@/components/mobile-tools-nav"

export default function SharpMoneyFeedClient() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SimpleHeader />
      <div className="mx-auto max-w-4xl px-4 pb-[108px] pt-20 sm:pb-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/5">
            <Lock className="h-6 w-6 text-white/80" />
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Locked</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Sharp Money Feed</h2>
          <p className="mt-2 text-sm text-white/60">Coming soon.</p>
        </div>
      </div>
      <MobileToolsNav />
    </div>
  )
}
