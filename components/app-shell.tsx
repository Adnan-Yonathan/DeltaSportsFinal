'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import GlobalLeftNav from '@/components/global-left-nav'
import ConditionalAppFooter from '@/components/conditional-app-footer'

function shouldHideLeftNav(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/welcome') ||
    pathname.startsWith('/auth/')
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const hideLeftNav = shouldHideLeftNav(pathname)

  return (
    <div className="flex min-h-screen w-full">
      {!hideLeftNav ? <GlobalLeftNav /> : null}
      <div
        className={`flex min-h-screen min-w-0 flex-1 flex-col ${
          hideLeftNav ? '' : 'md:pl-72'
        }`}
      >
        <main className="min-w-0 flex-1">{children}</main>
        <ConditionalAppFooter />
      </div>
    </div>
  )
}
