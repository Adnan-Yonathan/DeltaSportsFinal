import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
