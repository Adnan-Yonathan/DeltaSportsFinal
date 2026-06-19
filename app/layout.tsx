import type { Metadata } from 'next'
import './globals.css'
import SharpMoneyAlertHub from '@/components/SharpMoneyAlertHub'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ThemeProvider } from '@/components/theme-provider'
import Script from 'next/script'
import AppShell from '@/components/app-shell'

const GA_MEASUREMENT_ID = 'G-Y78D13G4NJ'

export const metadata: Metadata = {
  title: 'Delta Sports | Sharp Money Tracking & Betting Analytics',
  description:
    'Delta Sports tracks sharp money in real time — exchange orderbooks, whale bets, line movement, and AI market projections. The sharp betting tool serious bettors use.',
  metadataBase: new URL('https://deltasports.app'),
  applicationName: 'Delta Sports',
  keywords: [
    'Delta Sports',
    'sharp money tracking',
    'sharp betting tools',
    'sharp sports betting',
    'exchange orderbook betting',
    'betting analytics',
    'sports betting edge',
    'line shopping',
    'reverse line movement',
    'positive EV betting',
  ],
  openGraph: {
    title: 'Delta Sports | Sharp Money Tracking & Betting Analytics',
    description:
      'Delta Sports tracks sharp money in real time — exchange orderbooks, whale bets, line movement, and AI market projections. The sharp betting tool serious bettors use.',
    siteName: 'Delta Sports',
    images: [{ url: '/newimage.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Delta Sports | Sharp Money Tracking & Betting Analytics',
    description:
      'Delta Sports tracks sharp money in real time — exchange orderbooks, whale bets, line movement, and AI market projections. The sharp betting tool serious bettors use.',
    images: ['/newimage.png'],
  },
  icons: {
    icon: '/delta-logo.png',
    shortcut: '/delta-logo.png',
    apple: '/delta-logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <Script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="beforeInteractive"
        />
        <Script id="google-analytics" strategy="beforeInteractive">
          {`
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </head>
      <body
        className="flex min-h-screen flex-col bg-bg-primary text-text-primary"
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <SharpMoneyAlertHub />
          <AppShell>{children}</AppShell>
          <Analytics />
          <SpeedInsights />
          <Script
            src="https://datafa.st/js/script.js"
            strategy="afterInteractive"
            data-website-id="dfid_qwoyZutB3jpH2mat1d9Ox"
            data-domain="deltasports.app"
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
