import ParlayPredictor from './parlay-predictor'
import ToolsNav from "@/components/tools-nav"

export default function ParlayPredictorPage() {
  return (
    <div className="relative min-h-screen bg-black text-white px-4 py-6">
      <div className="mb-6">
        <ToolsNav />
      </div>
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold">Parlay Predictor</h1>
        <p className="mt-2 text-sm text-white/60">
          Build a parlay from today&apos;s matchups, then compare the model probability to the best book odds.
        </p>
        <ParlayPredictor />
      </div>
    </div>
  )
}
