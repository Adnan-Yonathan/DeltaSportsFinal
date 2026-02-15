import type { Metadata } from 'next'
import './globals.css'
import { SupabaseAuthListener } from '@/components/SupabaseAuthListener'
import { AppFooter } from '@/components/AppFooter'
import AffiliateTracker from '@/components/AffiliateTracker'
import SharpMoneyAlertHub from '@/components/SharpMoneyAlertHub'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ThemeProvider } from '@/components/theme-provider'
import Script from 'next/script'

const GA_MEASUREMENT_ID = 'G-Y78D13G4NJ'

export const metadata: Metadata = {
  title: 'Delta Sports - The Sharp Money Tool for Sports',
  description:
    'Delta Sports AI is an AI sports betting assistant for sharp betting, sharp action research, sharp money tracking, live odds, and betting analytics.',
  metadataBase: new URL('https://deltasports.app'),
  applicationName: 'Delta Sports',
  keywords: [
    'Delta Sports',
    'Delta Sports AI',
    'AI sports betting assistant',
    'sharp betting',
    'sharp betting tools',
    'sharp sports betting',
    'sharp money',
    'betting software',
    'sports betting analytics',
    'live odds',
    'matchup insights',
    'line shopping',
  ],
  openGraph: {
    title: 'Delta Sports - The Sharp Money Tool for Sports',
    description:
      'Delta Sports AI is an AI sports betting assistant for sharp betting, sharp action research, sharp money tracking, live odds, and betting analytics.',
    siteName: 'Delta Sports',
  },
  twitter: {
    title: 'Delta Sports - The Sharp Money Tool for Sports',
    description:
      'Delta Sports AI is an AI sports betting assistant for sharp betting, sharp action research, sharp money tracking, live odds, and betting analytics.',
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
          <SupabaseAuthListener />
          <AffiliateTracker />
          <SharpMoneyAlertHub />
          <main className="flex-1">{children}</main>
          <AppFooter />
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

