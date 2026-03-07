import type { Metadata } from 'next'
import SharpDetectorClient from './sharp-detector-client'

export const metadata: Metadata = {
  title: 'Whale Feed | Live Sharp Money Detector | Delta Sports',
  description:
    'Track large bets hitting the tape in real time. Filter by sport, source, and game to spot sharp clustering and whale activity before lines move.',
  alternates: {
    canonical: 'https://deltasports.app/sharp-detector',
  },
}

export default function SharpDetectorPage() {
  return <SharpDetectorClient />
}
