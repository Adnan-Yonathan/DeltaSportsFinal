"use client"

import { ServerManagementTable, type SharpTraderRow } from "@/components/ui/server-management-table"

const rows: SharpTraderRow[] = [
  {
    id: "wallet-a",
    rank: 1,
    wallet: "0x8fe3a9b27c9a1d0f2b4a12c7f98a3b9d8f20a9c1",
    walletShort: "0x8fe3…a9c1",
    totalPnl: 187420,
    pnl30d: 38210,
    openTrades: [],
  },
]

export default function DemoOne() {
  return (
    <div className="min-h-screen bg-black p-8">
      <ServerManagementTable wallets={rows} />
    </div>
  )
}
