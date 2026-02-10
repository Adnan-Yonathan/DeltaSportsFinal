"use client"

import { useState } from "react"

import CrossedEvClient from "./crossed-ev-client"
import { cn } from "@/lib/utils"
import PropOrderbooksPanel from "@/components/prop-orderbooks-panel"

type HubTab = "orderbooks" | "crossed_ev"

export default function SharpPropsHub({
  sport,
  previewMode = false,
}: {
  sport: string
  previewMode?: boolean
}) {
  const [activeTab, setActiveTab] = useState<HubTab>("orderbooks")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Sharp Props</h1>
        <div className="flex items-center gap-2 bg-white/5 rounded-2xl p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("orderbooks")}
            className={cn(
              "px-6 py-2.5 text-sm font-semibold rounded-xl transition-all min-w-[160px]",
              activeTab === "orderbooks"
                ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
                : "text-white/50 hover:text-white/70 hover:bg-white/5"
            )}
          >
            Order Books
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("crossed_ev")}
            className={cn(
              "px-6 py-2.5 text-sm font-semibold rounded-xl transition-all min-w-[160px]",
              activeTab === "crossed_ev"
                ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
                : "text-white/50 hover:text-white/70 hover:bg-white/5"
            )}
          >
            Crossed EV
          </button>
        </div>
        <div className="w-[120px]" />
      </div>

      {activeTab === "orderbooks" ? (
        <PropOrderbooksPanel sport={sport} />
      ) : (
        <CrossedEvClient sport={sport} previewMode={previewMode} />
      )}
    </div>
  )
}

