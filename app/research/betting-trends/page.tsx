import BettingTrendsClient from './betting-trends-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BettingTrendsPage() {
  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="text-center">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Betting Trends</h1>
          <p className="mt-2 text-sm text-white/60">
          30-day line movement and closing line value trends by market
          </p>
      </div>

      <BettingTrendsClient previewMode={false} />
    </div>
  )
}
