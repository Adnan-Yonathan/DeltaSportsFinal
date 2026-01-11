"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TOOLS_NAV_ITEMS = [
  { href: "/market-projections", label: "Markets" },
  { href: "/player-projections", label: "Players" },
  { href: "/parlay-predictor", label: "Parlay" },
  { href: "/ev-bets", label: "EV Bets" },
  { href: "/live-projections", label: "Live" },
  { href: "/sharp-detector", label: "Sharps" },
  { href: "/stats", label: "Stats" },
]

export default function ToolsNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 sm:gap-2">
      <Link
        href="/chat"
        className="mr-2 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/50 hover:border-emerald-500/40 hover:text-emerald-200 transition-colors"
      >
        <svg
          className="mr-1.5 h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Chat
      </Link>
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
        {TOOLS_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] transition-colors ${
                isActive
                  ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
