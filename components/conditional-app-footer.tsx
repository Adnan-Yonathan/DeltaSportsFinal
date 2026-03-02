'use client'

import { usePathname } from 'next/navigation'
import { AppFooter } from '@/components/AppFooter'
import { isToolRoute } from '@/lib/navigation/tool-routes'

export default function ConditionalAppFooter() {
  const pathname = usePathname() ?? ''

  if (isToolRoute(pathname)) {
    return null
  }

  return <AppFooter />
}

