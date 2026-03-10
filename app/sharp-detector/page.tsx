import type { Metadata } from 'next'
import SharpDetectorClient from './sharp-detector-client'

export const metadata: Metadata = {
  title: 'Whale Detector | Live Whale Trade Tape | Delta Sports',
  description:
    'Track live whale tickets, resting liquidity walls, and hot-game clustering across supported sports markets.',
  alternates: {
    canonical: 'https://deltasports.app/sharp-detector',
  },
}

export default function SharpDetectorPage() {
  return <SharpDetectorClient />
}
