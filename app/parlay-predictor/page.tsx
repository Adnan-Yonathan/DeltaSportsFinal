import ParlayPredictor from './parlay-predictor'
import ToolsNav from "@/components/tools-nav"

export default function ParlayPredictorPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Fixed navigation header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/5">
        <div className="px-2 sm:px-4 py-4">
          <ToolsNav />
        </div>
      </div>
      {/* Content with top padding to account for fixed header */}
      <div className="pt-[72px] px-2 sm:px-4">
        <div className="mx-auto w-full max-w-5xl py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-semibold">Parlay Predictor</h1>
        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-white/60">
          Build a parlay and compare model probability to book odds.
        </p>
        <ParlayPredictor />
        </div>
      </div>
    </div>
  )
}
