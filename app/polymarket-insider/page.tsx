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
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6">🚧</div>
        <h1 className="text-2xl font-bold text-white mb-3">Under Construction</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          The Insider Feed is being upgraded. Check back soon.
        </p>
      </div>
    </div>
  )
}
