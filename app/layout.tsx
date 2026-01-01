import type { Metadata } from 'next'
import './globals.css'
import { SupabaseAuthListener } from '@/components/SupabaseAuthListener'
import { AppFooter } from '@/components/AppFooter'
import { Saira_Condensed } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata: Metadata = {
  title: 'Delta AI - Intelligent Sports Betting Assistant',
  description: 'AI-powered sports betting analytics, odds tracking, and bankroll management',
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
        <main className="flex-1">{children}</main>
        <AppFooter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
