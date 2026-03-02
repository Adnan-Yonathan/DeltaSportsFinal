'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Calculator,
  ChevronDown,
  ExternalLink,
  FlaskConical,
  MoreHorizontal,
  Percent,
  Radar,
  Waves,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getBookmakerLink } from '@/lib/config/bookmaker-links'
import { getMembershipStatus, type MembershipInfo } from '@/lib/utils/membership'
import { cn } from '@/lib/utils'

type MobileToolNavItem = {
  key: string
  label: string
  shortLabel: string
  href: string
  icon: LucideIcon
  match?: (pathname: string) => boolean
}

type MoreLink = {
  key: string
  label: string
  href: string
  external?: boolean
}

const MOBILE_TOOL_NAV_ITEMS: MobileToolNavItem[] = [
  {
    key: 'sharp-projections',
    label: 'Games',
    shortLabel: 'Games',
    href: '/market-projections',
  icon: Radar,
  },
  {
    key: 'sharp-props',
    label: 'Sharp Props',
    shortLabel: 'Props',
    href: '/sharp-props',
    icon: Percent,
  },
  {
    key: 'whale-feed',
    label: 'Whale Feed',
    shortLabel: 'Whales',
    href: '/sharp-detector',
    icon: Waves,
  },
  {
    key: 'research-mode',
    label: 'Research Mode',
    shortLabel: 'Research',
    href: '/research/sharp-action',
    icon: FlaskConical,
    match: (pathname) => pathname.startsWith('/research'),
  },
]

const MORE_SOCIAL_LINKS: MoreLink[] = [
  { key: 'social-twitter', label: 'Twitter / X', href: 'https://x.com/DeltaSportsAI', external: true },
  {
    key: 'social-instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/deltasportsai?igsh=dXcweHRiNGt5eXQ2',
    external: true,
  },
  { key: 'social-discord', label: 'Discord', href: 'https://discord.gg/NgCgk47N', external: true },
]

const MORE_GUIDE_LINKS: MoreLink[] = [
  { key: 'guide-sharp-projections', label: 'Sharp Projections', href: '/tools/sharp-projections' },
  { key: 'guide-sharp-props', label: 'Sharp Props', href: '/tools/sharp-props' },
  { key: 'guide-whale-feed', label: 'Whale Feed', href: '/tools/whale-feed' },
  { key: 'guide-research-mode', label: 'Research Mode', href: '/tools/research-mode' },
]

const KALSHI_AFFILIATE_URL =
  getBookmakerLink('kalshi') ||
  'https://kalshi.com/sign-up/?referral=4807d3a2-7c7c-40bb-986c-608115b5a2c5'

export default function MobileToolsNav() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const pushedHistoryRef = useRef(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState({ socials: false, guides: false })
  const [user, setUser] = useState<any>(null)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)

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
    setIsMoreOpen(false)
    pushedHistoryRef.current = false
  }, [pathname])

  useEffect(() => {
    if (!isMoreOpen || typeof window === 'undefined') return

    window.history.pushState({ mobileMoreMenu: true }, '')
    pushedHistoryRef.current = true
  }, [isMoreOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      if (!isMoreOpen) return
      setIsMoreOpen(false)
      pushedHistoryRef.current = false
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isMoreOpen])

  useEffect(() => {
    if (!isMoreOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreOpen(false)
        if (typeof window !== 'undefined' && pushedHistoryRef.current) {
          pushedHistoryRef.current = false
          window.history.back()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMoreOpen])

  const isRouteActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(`${href}/`),
    [pathname]
  )

  const dismissMoreMenu = useCallback(() => {
    setIsMoreOpen(false)
    if (typeof window !== 'undefined' && pushedHistoryRef.current) {
      pushedHistoryRef.current = false
      window.history.back()
    }
  }, [])

  const handleInternalNavigation = useCallback(
    (href: string) => {
      dismissMoreMenu()
      router.push(href)
    },
    [dismissMoreMenu, router]
  )

  const handleExternalNavigation = useCallback(
    (href: string) => {
      dismissMoreMenu()
      window.open(href, '_blank', 'noopener,noreferrer')
    },
    [dismissMoreMenu]
  )

  const handleOpenSubscription = useCallback(async () => {
    dismissMoreMenu()
    if (!user || !membership?.isActive) {
      router.push('/pricing')
      return
    }
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url
        return
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error)
    }
    router.push('/pricing')
  }, [dismissMoreMenu, membership?.isActive, router, user])

  return (
    <>
      {isMoreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={dismissMoreMenu}
            aria-label="Close more menu overlay"
          />
          <section
            id="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            className="absolute inset-x-3 max-h-[68vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl"
            style={{ bottom: 'calc(4.6rem + env(safe-area-inset-bottom))' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">More</h2>
              <button
                type="button"
                onClick={dismissMoreMenu}
                className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:border-white/30 hover:text-white"
                aria-label="Close more menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({
                    ...prev,
                    socials: !prev.socials,
                  }))
                }
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-left text-sm text-white/90 transition hover:border-white/20 hover:bg-white/5"
              >
                <span>Socials</span>
                <ChevronDown
                  className={cn('h-4 w-4 text-white/70 transition-transform', openGroups.socials && 'rotate-180')}
                />
              </button>
              {openGroups.socials && (
                <div className="space-y-1 pl-1">
                  {MORE_SOCIAL_LINKS.map((link) => (
                    <button
                      key={link.key}
                      type="button"
                      onClick={() => handleExternalNavigation(link.href)}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-white/80 transition hover:border-emerald-300/35 hover:bg-emerald-500/10 hover:text-emerald-100"
                    >
                      <span>{link.label}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({
                    ...prev,
                    guides: !prev.guides,
                  }))
                }
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-left text-sm text-white/90 transition hover:border-white/20 hover:bg-white/5"
              >
                <span>Guides</span>
                <ChevronDown
                  className={cn('h-4 w-4 text-white/70 transition-transform', openGroups.guides && 'rotate-180')}
                />
              </button>
              {openGroups.guides && (
                <div className="space-y-1 pl-1">
                  {MORE_GUIDE_LINKS.map((link) => (
                    <button
                      key={link.key}
                      type="button"
                      onClick={() => handleInternalNavigation(link.href)}
                      className={cn(
                        'flex w-full items-center rounded-lg border px-3 py-2 text-left text-sm transition',
                        isRouteActive(link.href)
                          ? 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100'
                          : 'border-white/10 text-white/80 hover:border-emerald-300/35 hover:bg-emerald-500/10 hover:text-emerald-100'
                      )}
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleExternalNavigation(KALSHI_AFFILIATE_URL)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-left text-sm text-white/85 transition hover:border-emerald-300/35 hover:bg-emerald-500/10 hover:text-emerald-100"
              >
                <span>Kalshi Affiliate</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleInternalNavigation('/blog')}
                className={cn(
                  'flex w-full items-center rounded-xl border px-3 py-2 text-left text-sm transition',
                  isRouteActive('/blog')
                    ? 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/10 bg-black/40 text-white/85 hover:border-emerald-300/35 hover:bg-emerald-500/10 hover:text-emerald-100'
                )}
              >
                Blog
              </button>

              <button
                type="button"
                onClick={() => handleInternalNavigation('/calculators')}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition',
                  isRouteActive('/calculators')
                    ? 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/10 bg-black/40 text-white/85 hover:border-emerald-300/35 hover:bg-emerald-500/10 hover:text-emerald-100'
                )}
              >
                <span>Calculators</span>
                <Calculator className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={handleOpenSubscription}
                className="flex w-full items-center justify-between rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-left text-sm font-medium text-emerald-100 transition hover:border-emerald-300/50 hover:bg-emerald-500/20"
              >
                <span>Manage Subscription</span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/80">
                  {membership?.isActive ? 'Portal' : 'Pricing'}
                </span>
              </button>
            </div>
          </section>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-[45] border-t border-white/10 bg-black/95 backdrop-blur-xl md:hidden">
        <nav
          className="grid grid-cols-5 gap-0.5 px-1 pt-1"
          style={{ paddingBottom: 'calc(0.35rem + env(safe-area-inset-bottom))' }}
        >
          {MOBILE_TOOL_NAV_ITEMS.map((item) => {
            const active = item.match ? item.match(pathname) : isRouteActive(item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.key}
                href={item.href}
                aria-label={item.label}
                className={cn(
                  'flex min-w-0 flex-col items-center justify-center rounded-lg px-1 py-2 text-[10px] uppercase tracking-[0.12em] transition-colors',
                  active
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="mt-1 truncate">{item.shortLabel}</span>
              </Link>
            )
          })}

          <button
            type="button"
            aria-label="More navigation"
            aria-expanded={isMoreOpen}
            aria-controls="mobile-more-sheet"
            onClick={() => {
              if (isMoreOpen) {
                dismissMoreMenu()
                return
              }
              setIsMoreOpen(true)
            }}
            className={cn(
              'flex min-w-0 flex-col items-center justify-center rounded-lg px-1 py-2 text-[10px] uppercase tracking-[0.12em] transition-colors',
              isMoreOpen
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'text-white/55 hover:bg-white/5 hover:text-white'
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="mt-1 truncate">More</span>
          </button>
        </nav>
      </div>
    </>
  )
}
