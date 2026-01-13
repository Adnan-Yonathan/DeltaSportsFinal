import type { Metadata } from 'next'
import './globals.css'
import { SupabaseAuthListener } from '@/components/SupabaseAuthListener'
import { AppFooter } from '@/components/AppFooter'
import AffiliateTracker from '@/components/AffiliateTracker'
import { Saira_Condensed } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata: Metadata = {
  title: 'Delta Sports - AI Sports Betting Assistant',
  description: 'Delta Sports AI is an AI sports betting assistant for live odds, matchup insights, and betting analytics.',
  applicationName: 'Delta Sports',
  keywords: [
    'Delta Sports',
    'Delta Sports AI',
    'AI sports betting assistant',
    'sports betting analytics',
    'live odds',
    'matchup insights',
    'line shopping',
  ],
  openGraph: {
    title: 'Delta Sports - AI Sports Betting Assistant',
    description:
      'Delta Sports AI is an AI sports betting assistant for live odds, matchup insights, and betting analytics.',
    siteName: 'Delta Sports',
  },
  twitter: {
    title: 'Delta Sports - AI Sports Betting Assistant',
    description:
      'Delta Sports AI is an AI sports betting assistant for live odds, matchup insights, and betting analytics.',
  },
  icons: {
    icon: '/delta-logo.png',
    shortcut: '/delta-logo.png',
    apple: '/delta-logo.png',
  },
}

const saira = Saira_Condensed({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${saira.variable} flex min-h-screen flex-col bg-bg-primary text-text-primary`}
      >
        <SupabaseAuthListener />
        <AffiliateTracker />
        <main className="flex-1">{children}</main>
        <AppFooter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
