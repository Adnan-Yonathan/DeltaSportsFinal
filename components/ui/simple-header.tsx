"use client"

import React from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { TOOLS_CONTENT } from "@/lib/tools-content"
import {
  Activity,
  Clock,
  Eye,
  Layers3,
  LineChart,
  MessageSquare,
  Percent,
  Target,
  Users,
  Zap,
} from "lucide-react"

const navLinks = [
  { label: "Calculators", href: "/calculators" },
  { label: "Blog", href: "/blog" },
  { label: "Pricing", href: "/pricing" },
]

const TOOL_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "line-chart": LineChart,
  target: Target,
  layers: Layers3,
  percent: Percent,
  activity: Activity,
  eye: Eye,
  "message-square": MessageSquare,
  clock: Clock,
  users: Users,
  zap: Zap,
}

export function SimpleHeader({
  rightSlot,
  mobileLeftSlot,
  onLogoClick,
  widthClass = "max-w-5xl",
}: {
  rightSlot?: React.ReactNode
  mobileLeftSlot?: React.ReactNode
  onLogoClick?: () => void
  widthClass?: string
} = {}) {
  const [showAuthButtons, setShowAuthButtons] = React.useState(false)
  const [toolsOpen, setToolsOpen] = React.useState(false)
  const toolsRef = React.useRef<HTMLDivElement | null>(null)
  const supabase = React.useMemo(() => createClient(), [])
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    let isMounted = true

    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (isMounted) {
        setShowAuthButtons(!user)
      }
    }

    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setShowAuthButtons(!session?.user)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  React.useEffect(() => {
    setToolsOpen(false)
  }, [pathname])

  React.useEffect(() => {
    if (!toolsOpen) return

    const handleOutside = (event: MouseEvent) => {
      if (!toolsRef.current) return
      if (toolsRef.current.contains(event.target as Node)) return
      setToolsOpen(false)
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setToolsOpen(false)
    }

    document.addEventListener("mousedown", handleOutside)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleOutside)
      document.removeEventListener("keydown", handleKey)
    }
  }, [toolsOpen])

  const handleLogoClick = () => {
    onLogoClick ? onLogoClick() : router.push("/")
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-black/95 backdrop-blur border-b border-white/10">
      <div className={`mx-auto flex w-full ${widthClass} items-center gap-2 sm:gap-3`}>
        <nav className="flex h-12 sm:h-16 min-w-0 flex-1 items-center justify-between rounded-full border border-white/15 bg-black px-2 sm:px-4 backdrop-blur supports-[backdrop-filter]:bg-black/90 text-white">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="flex items-center gap-1.5 sm:gap-2 text-white"
              onClick={handleLogoClick}
            >
                <div className="relative h-6 w-6 sm:h-8 sm:w-8">
                  <Image
                    src="/delta-logo.png"
                    alt="Delta Sports Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <p className="text-sm sm:text-lg font-semibold">Delta Sports</p>
              </div>
            </button>
            {mobileLeftSlot && (
              <div className="sm:hidden">
                {mobileLeftSlot}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="sm:hidden">
                <select
                  defaultValue="/tools"
                  onChange={(event) => router.push(event.target.value)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/70"
                >
                  <option value="/tools">Tools</option>
                  {TOOLS_CONTENT.map((tool) => (
                    <option key={tool.id} value={`/tools#${tool.id}`}>
                      {tool.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative hidden sm:block" ref={toolsRef}>
                <button
                  type="button"
                  onClick={() => setToolsOpen((prev) => !prev)}
                  aria-haspopup="true"
                  aria-expanded={toolsOpen}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/70 hover:border-emerald-500/40 hover:text-emerald-200 transition-colors"
                >
                  Tools
                  <span className="text-white/50">{toolsOpen ? "-" : "+"}</span>
                </button>
                {toolsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-[min(92vw,520px)] rounded-3xl border border-white/10 bg-black/95 p-4 shadow-2xl backdrop-blur">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/70">
                          Tools Overview
                        </p>
                        <p className="text-sm text-white/70">
                          Click any tool to read the full guide.
                        </p>
                      </div>
                      <Link
                        href="/tools"
                        className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60 hover:border-emerald-400/60 hover:text-emerald-200 transition-colors"
                      >
                        View all
                      </Link>
                    </div>
                    <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                      {TOOLS_CONTENT.map((tool) => {
                        const Icon = TOOL_ICON_MAP[tool.icon] ?? LineChart
                        return (
                          <Link
                            key={tool.id}
                            href={`/tools#${tool.id}`}
                            className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 transition hover:border-emerald-400/50"
                          >
                            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-emerald-200">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span>
                              <span className="block text-[10px] uppercase tracking-[0.3em] text-white/50">
                                {tool.label}
                              </span>
                              <span className="mt-1 block text-xs text-white/70">
                                {tool.summary}
                              </span>
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/70 hover:border-emerald-500/40 hover:text-emerald-200 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {rightSlot}

                      </div>
        </nav>
        {showAuthButtons && (
          <div className="hidden items-center gap-2 lg:flex">
            <Button asChild className="bg-[#34d399] text-[#0f1f15] border border-[#34d399] hover:bg-[#16a34a]">
              <Link href="/auth/login">Log In</Link>
            </Button>
            <Button asChild className="bg-[#34d399] text-[#0f1f15] border border-[#34d399] hover:bg-[#16a34a]">
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
