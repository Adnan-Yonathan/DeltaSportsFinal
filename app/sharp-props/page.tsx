import type { Metadata } from 'next'
import MobileToolsNav from "@/components/mobile-tools-nav"
import PropOrderbooksPanel from "@/components/prop-orderbooks-panel"
import { buildPropOrderbooksInitialData } from "@/lib/services/prop-orderbooks-snapshot"

export const metadata: Metadata = {
  title: 'Sharp Props | Exchange Orderbook Prop Tracker | Delta Sports',
  description:
    'See where sharp money is positioned in prop markets. Exchange orderbook liquidity, sharp side pressure, and best available prices in one view - before lines move.',
  alternates: {
    canonical: 'https://deltasports.app/sharp-props',
  },
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function SharpPropsPage() {
  const sport = "all"
  const initialData = await buildPropOrderbooksInitialData({
    sport,
    limit: 200,
    depth: 8,
    minSharpNotional: 100,
    dateWindow: "upcoming",
  })

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-2 pb-[96px] pt-4 sm:px-4 sm:pb-0 sm:pt-5">
        <div className="mx-auto w-full max-w-none">
          <PropOrderbooksPanel sport={sport} initialData={initialData} />
        </div>
      </div>
      <MobileToolsNav />
    </div>
  )
}
