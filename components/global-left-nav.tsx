"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Calculator,
  ChevronDown,
  FlaskConical,
  LogOut,
  Newspaper,
  Percent,
  Radar,
  Share2,
  Waves,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatus, type MembershipInfo } from "@/lib/utils/membership"
import { getBookmakerLink } from "@/lib/config/bookmaker-links"
import {
  LAST_TOOL_COOKIE,
  LAST_TOOL_LOCAL_STORAGE_KEY,
  isToolRoute,
  sanitizeToolRoute,
} from "@/lib/navigation/tool-routes"

type NavItem = {
  key: string
  label: string
  icon: LucideIcon
  href?: string
  children?: Array<{
    key: string
    label: string
    href: string
    external?: boolean
  }>
}

const NAV_ITEMS: NavItem[] = [
  { key: "sharp-projections", label: "Sharp Projections", href: "/market-projections", icon: Radar },
  { key: "sharp-props", label: "Sharp Props", href: "/sharp-props", icon: Percent },
  { key: "whale-detector", label: "Whale Detector", href: "/sharp-detector", icon: Waves },
  { key: "research", label: "Research", href: "/research/sharp-action", icon: FlaskConical },
  { key: "calculators", label: "Calculators", href: "/calculators", icon: Calculator },
  {
    key: "guides",
    label: "Guides",
    icon: BookOpen,
    children: [
      { key: "guide-sharp-projections", label: "Sharp Projections", href: "/tools/sharp-projections" },
      { key: "guide-sharp-props", label: "Sharp Props", href: "/tools/sharp-props" },
      { key: "guide-whale-feed", label: "Whale Feed", href: "/tools/whale-feed" },
      { key: "guide-research-mode", label: "Research Mode", href: "/tools/research-mode" },
    ],
  },
  {
    key: "socials",
    label: "Socials",
    icon: Share2,
    children: [
      { key: "social-twitter", label: "Twitter / X", href: "https://x.com/DeltaSportsAI", external: true },
      {
        key: "social-instagram",
        label: "Instagram",
        href: "https://www.instagram.com/deltasportsai?igsh=dXcweHRiNGt5eXQ2",
        external: true,
      },
      { key: "social-discord", label: "Discord", href: "https://discord.gg/NgCgk47N", external: true },
    ],
  },
  { key: "blog", label: "Blog", href: "/blog", icon: Newspaper },
]

const KALSHI_AFFILIATE_URL =
  getBookmakerLink("kalshi") ||
  "https://kalshi.com/sign-up/?referral=4807d3a2-7c7c-40bb-986c-608115b5a2c5"

export default function GlobalLeftNav() {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<any>(null)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ guides: false, socials: false })

  useEffect(() => {
    let active = true
    const load = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!active) return
      setUser(authUser)
      setMembership(authUser ? getMembershipStatus(authUser.user_metadata) : null)
    }
    load()
    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isToolRoute(pathname)) return

    const safePath = sanitizeToolRoute(pathname)
    try {
      window.localStorage.setItem(LAST_TOOL_LOCAL_STORAGE_KEY, safePath)
    } catch (error) {
      console.warn("Failed to persist last tool in local storage:", error)
    }

    document.cookie = `${LAST_TOOL_COOKIE}=${encodeURIComponent(
      safePath
    )}; path=/; max-age=31536000; samesite=lax`
  }, [pathname])

  useEffect(() => {
    const guidesItem = NAV_ITEMS.find((item) => item.key === "guides")
    const guideRouteActive = Boolean(
      guidesItem?.children?.some(
        (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
      )
    )
    if (guideRouteActive) {
      setOpenGroups((prev) => ({ ...prev, guides: true }))
    }
  }, [pathname])

  const membershipLabel = membership?.tier
    ? ({ free: "Free", sharp: "Sharp", syndicate: "Syndicate" } as const)[membership.tier] || "Free"
    : "Guest"
  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.display_name ||
    user?.email ||
    "Guest"
  const initials = String(displayName)
    .split(" ")
    .map((part: string) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "D"

  const openSubscription = async () => {
    if (!user || !membership?.isActive) {
      router.push("/checkout")
      return
    }
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error("Failed to open billing portal:", err)
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error("Sign out failed:", err)
    } finally {
      router.push("/auth/login")
    }
  }

  const useNonStickyLayout =
    pathname === "/welcome" ||
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/signup")

  return (
    <aside
      className={`left-0 z-40 hidden w-72 border-r border-white/10 bg-black md:flex md:flex-col ${
        useNonStickyLayout ? "absolute top-0 h-screen" : "fixed inset-y-0"
      }`}
    >
      <div className="flex h-16 items-center border-b border-white/10 px-4">
        <Link href="/" className="flex items-center gap-2.5 text-white">
          <div className="relative h-8 w-8">
            <Image
              src="/delta-logo.png"
              alt="Delta Sports logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-xl font-semibold tracking-tight">Delta Sports</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const hasChildren = Boolean(item.children?.length)
          const active = Boolean(
            item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))
          )
          const childActive = Boolean(
            item.children?.some(
              (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
            )
          )

          if (!hasChildren) {
            return (
              <div key={item.key} className="space-y-1">
                <Link
                  href={item.href ?? "/"}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-200"
                      : "border-transparent text-white/75 hover:border-white/20 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
                {item.key === "blog" ? (
                  <Link
                    href={KALSHI_AFFILIATE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-7 inline-flex items-center rounded-lg border border-emerald-400/45 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/60 hover:bg-emerald-500/25"
                    aria-label="Open Kalshi affiliate link"
                  >
                    $25
                  </Link>
                ) : null}
              </div>
            )
          }

          const isOpen = Boolean(openGroups[item.key])

          return (
            <div key={item.key}>
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({
                    ...prev,
                    [item.key]: !prev[item.key],
                  }))
                }
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                  childActive || isOpen
                    ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-200"
                    : "border-transparent text-white/75 hover:border-white/20 hover:bg-white/5 hover:text-white"
                }`}
                aria-expanded={isOpen}
                aria-controls={`nav-group-${item.key}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <div id={`nav-group-${item.key}`} className="mt-1 space-y-1 pl-3">
                  {item.children?.map((child) => {
                    const isChildActive =
                      pathname === child.href || pathname.startsWith(`${child.href}/`)
                    const childClass = `flex items-center rounded-lg border px-3 py-2 text-sm transition-colors ${
                      isChildActive
                        ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-200"
                        : "border-transparent text-white/70 hover:border-white/20 hover:bg-white/5 hover:text-white"
                    }`
                    if (child.external) {
                      return (
                        <a
                          key={child.key}
                          href={child.href}
                          target="_blank"
                          rel="noreferrer"
                          className={childClass}
                        >
                          {child.label}
                        </a>
                      )
                    }
                    return (
                      <Link key={child.key} href={child.href} className={childClass}>
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={openSubscription}
          className="block w-full rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/12 via-black to-black p-3 text-left transition hover:border-emerald-300/40 hover:from-emerald-400/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/25 font-semibold text-emerald-100">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-100/70">{membershipLabel}</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85">
            Manage Subscription
          </div>
        </button>
        {user && (
          <button
            type="button"
            onClick={signOut}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/70 transition hover:border-red-300/35 hover:text-red-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        )}
      </div>
    </aside>
  )
}
