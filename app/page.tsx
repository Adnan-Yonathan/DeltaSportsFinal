import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { LAST_TOOL_COOKIE, sanitizeToolRoute } from '@/lib/navigation/tool-routes'
import WelcomeClient from './welcome/welcome-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Delta Sports | Sharp Money Tracking & Betting Analytics',
  description:
    'Follow sharp money in real time. Delta reads exchange orderbooks, tracks whale bets, and surfaces sharp money signals across NBA, NFL, NHL, and MLB. Start free for 7 days.',
  alternates: {
    canonical: 'https://deltasports.app',
  },
}

export default async function Home() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const cookieStore = cookies()
    const rawLastTool = cookieStore.get(LAST_TOOL_COOKIE)?.value
    let decodedLastTool: string | null = null
    if (rawLastTool) {
      try {
        decodedLastTool = decodeURIComponent(rawLastTool)
      } catch {
        decodedLastTool = rawLastTool
      }
    }
    redirect(sanitizeToolRoute(decodedLastTool))
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <WelcomeClient />
    </Suspense>
  )
}
