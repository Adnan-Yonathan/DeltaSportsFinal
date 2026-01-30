"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { BarChart3, Eye, Layers3, Zap, Target, Users, TrendingUp, BookOpenCheck, LineChart } from "lucide-react"

const TOOLS_NAV_ITEMS = [
  { href: "/sharp-detector", label: "Sharps", icon: Eye },
  { href: "/market-projections", label: "Markets", icon: BarChart3 },
  { href: "/player-prop-odds", label: "Props", icon: Users },
  { href: "/line-shopping", label: "Lines", icon: Target },
  { href: "/parlay-predictor", label: "Parlay", icon: Layers3 },
  { href: "/ev-bets", label: "EV Bets", icon: Zap },
]

const MOBILE_NAV_ITEMS = [
  { href: "/market-projections", label: "Markets", icon: BarChart3 },
  { href: "/player-prop-odds", label: "Props", icon: Users },
  { href: "/line-shopping", label: "Lines", icon: Target },
  { href: "/parlay-predictor", label: "Parlay", icon: Layers3 },
  { href: "/ev-bets", label: "EV", icon: Zap },
]
const MOBILE_RESEARCH_ITEMS = [
  { href: "/research/sharp-action", label: "Action", icon: BookOpenCheck },
  { href: "/research/betting-trends", label: "Trends", icon: TrendingUp },
  { href: "/research/backtesting", label: "Backtest", icon: LineChart },
]

const DELTA_MODE_STORAGE_KEY = "delta-mode"

type ToolsNavProps = {
  hideMobileTop?: boolean
  showMobileChatBack?: boolean
}

export default function ToolsNav({
  hideMobileTop = true,
  showMobileChatBack = true,
}: ToolsNavProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [mobileMode, setMobileMode] = useState<"projections" | "research">("projections")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const resolveMode = () => {
      const stored = window.localStorage.getItem(DELTA_MODE_STORAGE_KEY)
      const attr = document.documentElement.getAttribute("data-delta-mode")
      const value = stored || attr
      setMobileMode(value === "research" ? "research" : "projections")
    }
    resolveMode()
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== DELTA_MODE_STORAGE_KEY) return
      resolveMode()
    }
    const handleCustom = () => resolveMode()
    window.addEventListener("storage", handleStorage)
    window.addEventListener("delta-mode-change", handleCustom)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("delta-mode-change", handleCustom)
    }
  }, [])

  const mobileNavItems = useMemo(() => {
    if (pathname?.startsWith("/research")) return MOBILE_RESEARCH_ITEMS
    return mobileMode === "research" ? MOBILE_RESEARCH_ITEMS : MOBILE_NAV_ITEMS
  }, [pathname, mobileMode])

  return (
    <>
      <nav className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/chat"
          className={`mr-2 ${showMobileChatBack ? "inline-flex" : "hidden"} sm:inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/50 hover:border-emerald-500/40 hover:text-emerald-200 transition-colors`}
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
        <Link
          href="/pricing"
          className={`mr-2 ${showMobileChatBack ? "inline-flex sm:hidden" : "hidden"} items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/50 hover:border-emerald-500/40 hover:text-emerald-200 transition-colors`}
        >
          Pricing
        </Link>
        <div className="hidden sm:flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {TOOLS_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] transition-colors ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
        </div>
        {!hideMobileTop && (
          <div className="flex sm:hidden items-center rounded-full border border-white/10 bg-white/5 p-1">
            {(() => {
              const item = TOOLS_NAV_ITEMS[0]
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
            })()}
          </div>
        )}
      </nav>
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/95 backdrop-blur-sm sm:hidden">
            <div className="flex items-center justify-between gap-3 px-3 py-5">
              {mobileNavItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex-1 rounded-2xl px-2 py-4 text-center text-[12px] uppercase tracking-[0.2em] transition-colors ${
                      isActive
                        ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
                        : "text-white/50 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span className="flex flex-col items-center gap-1">
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </nav>,
          document.body
        )}
    </>
  )
}
