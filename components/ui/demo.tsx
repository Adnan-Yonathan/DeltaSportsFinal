"use client"

import { ServerManagementTable, type SharpTraderRow } from "@/components/ui/server-management-table"

const rows: SharpTraderRow[] = [
  {
    id: "wallet-a",
    rank: 1,
    wallet: "0x8fe3a9b27c9a1d0f2b4a12c7f98a3b9d8f20a9c1",
    walletShort: "0x8fe3...a9c1",
    totalPnl: 187420,
    pnl30d: 38210,
    pnlPrevDay: 1450,
    topSports: [
      { sport: "nba", pnl: 8420, trades: 12 },
      { sport: "nfl", pnl: 3210, trades: 5 },
    ],
    arbScore7d: 82,
    arbLabel7d: "likely_arb",
    arbReasons7d: ["High trade count (7d)", "Very high win rate", "Low P/L volatility"],
    tradeCount7d: 32,
    winRate7d: 0.91,
    avgPnl7d: 18.4,
    pnlStddev7d: 28.7,
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
