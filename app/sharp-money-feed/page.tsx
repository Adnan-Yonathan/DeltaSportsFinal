import type { Metadata } from 'next'
import SharpMoneyFeedClient from './sharp-money-feed-client'

export const metadata: Metadata = {
  title: 'Sharp Money Feed | Profitable Polymarket Bettors | Delta Sports',
  description:
    'Follow qualified profitable Polymarket sports and esports bettors with sport-specific ROI, live fills, and position context.',
  alternates: {
    canonical: 'https://deltasports.app/sharp-money-feed',
  },
}

export default function SharpMoneyFeedPage() {
  return <SharpMoneyFeedClient />
}
