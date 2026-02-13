'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { FlaskConical, House, Percent, Radar, Waves, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type MobileToolNavItem = {
  key: string
  label: string
  shortLabel: string
  href: string
  icon: LucideIcon
  match?: (pathname: string) => boolean
}

const MOBILE_TOOL_NAV_ITEMS: MobileToolNavItem[] = [
  {
    key: 'home',
    label: 'Home',
    shortLabel: 'Home',
    href: '/chat',
    icon: House,
    match: (pathname) => pathname === '/chat' || pathname.startsWith('/chat/'),
  },
  {
    key: 'sharp-projections',
    label: 'Sharp Projections',
    shortLabel: 'Proj',
    href: '/market-projections',
    icon: Radar,
  },
  {
    key: 'sharp-props',
    label: 'Sharp Props',
    shortLabel: 'Props',
    href: '/crossed-ev',
    icon: Percent,
  },
  {
    key: 'sharp-traders',
    label: 'Sharp Traders',
    shortLabel: 'Traders',
    href: '/sharp-traders',
    icon: Zap,
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

export default function MobileToolsNav() {
  const pathname = usePathname() ?? ''

  return (
    <div className="fixed inset-x-0 bottom-0 z-[45] border-t border-white/10 bg-black/95 backdrop-blur-xl md:hidden">
      <nav
        className="grid grid-cols-6 gap-0.5 px-1 pt-1"
        style={{ paddingBottom: 'calc(0.35rem + env(safe-area-inset-bottom))' }}
      >
        {MOBILE_TOOL_NAV_ITEMS.map((item) => {
          const active = item.match
            ? item.match(pathname)
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
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
      </nav>
    </div>
  )
}
