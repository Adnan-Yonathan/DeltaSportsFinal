"use client"

import CrossedEvClient from "./crossed-ev-client"
import PropOrderbooksPanel from "@/components/prop-orderbooks-panel"

export type HubTab = "orderbooks" | "crossed_ev"

export default function SharpPropsHub({
  sport,
  activeTab,
  previewMode = false,
}: {
  sport: string
  activeTab: HubTab
  previewMode?: boolean
}) {
  return activeTab === "orderbooks" ? (
    <PropOrderbooksPanel sport={sport} />
  ) : (
    <CrossedEvClient sport={sport} previewMode={previewMode} />
  )
}
