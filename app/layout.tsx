import type { Metadata } from 'next'
import './globals.css'
import StagewiseToolbar from '@/components/StagewiseToolbar'
import { SupabaseAuthListener } from '@/components/SupabaseAuthListener'

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
      <body>
        <StagewiseToolbar />
        <SupabaseAuthListener />
        {children}
      </body>
    </html>
  )
}
