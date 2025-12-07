import type { Metadata } from 'next'
import './globals.css'
import StagewiseToolbar from '@/components/StagewiseToolbar'
import { SupabaseAuthListener } from '@/components/SupabaseAuthListener'
import { AppFooter } from '@/components/AppFooter'

export const metadata: Metadata = {
  title: 'Delta AI - Intelligent Sports Betting Assistant',
  description: 'AI-powered sports betting analytics, odds tracking, and bankroll management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-bg-primary text-text-primary">
        <StagewiseToolbar />
        <SupabaseAuthListener />
        <main className="flex-1">{children}</main>
        <AppFooter />
      </body>
    </html>
  )
}
