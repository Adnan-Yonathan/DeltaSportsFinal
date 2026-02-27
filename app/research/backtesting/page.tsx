import BacktestingClient from './backtesting-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BacktestingPage() {
  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Backtesting</h1>
        <p className="mt-2 text-sm text-white/60">
          Simulate betting strategies with historical odds data
        </p>
      </div>

      <BacktestingClient previewMode={false} />
    </div>
  )
}
