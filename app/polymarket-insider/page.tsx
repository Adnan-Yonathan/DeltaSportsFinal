import type { Metadata } from 'next'
import { Suspense } from 'react'
import InsiderClient from './insider-client'

export const metadata: Metadata = {
  title: 'Insider Feed | Delta Sports',
  description:
    'Track the sharpest prediction market bets. We surface open positions from the most profitable long-term Polymarket wallets, scored by conviction and ROI.',
  alternates: { canonical: 'https://deltasports.app/polymarket-insider' },
}

export default function PolymarketInsiderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <InsiderClient />
    </Suspense>
  )
}
