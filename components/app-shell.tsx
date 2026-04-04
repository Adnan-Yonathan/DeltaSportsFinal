'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import GlobalLeftNav from '@/components/global-left-nav'
import ConditionalAppFooter from '@/components/conditional-app-footer'
import MobileMoreButton from '@/components/mobile-more-button'
import AttributionVisitorTracker from '@/components/attribution/visitor-tracker'

function shouldHideLeftNav(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/trial-onboarding') ||
    pathname.startsWith('/welcome') ||
    pathname.startsWith('/auth/')
  )
}

function shouldHideMobileMore(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/trial-onboarding') ||
    pathname.startsWith('/welcome') ||
    pathname.startsWith('/auth/')
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const hideLeftNav = shouldHideLeftNav(pathname)
  const hideMobileMore = shouldHideMobileMore(pathname)

  return (
    <div className="flex min-h-screen w-full">
      <AttributionVisitorTracker />
      {!hideLeftNav ? <GlobalLeftNav /> : null}
      <div
        className={`flex min-h-screen min-w-0 flex-1 flex-col ${
          hideLeftNav ? '' : 'md:pl-72'
        }`}
      >
        {/* Mobile top-right More button */}
        {!hideMobileMore && (
          <div className="fixed right-3 top-3 z-[50] md:hidden">
            <MobileMoreButton />
          </div>
        )}
        <main className="min-w-0 flex-1">{children}</main>
        <ConditionalAppFooter />
      </div>
    </div>
  )
}
