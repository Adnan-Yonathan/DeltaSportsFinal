'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp } from 'lucide-react'

const RESEARCH_NAV_ITEMS = [
  { href: '/research/sharp-action', label: 'Sharp Action', icon: TrendingUp },
]

export default function ResearchNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
      {RESEARCH_NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] transition-colors ${
              isActive
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
