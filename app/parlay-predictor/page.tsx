import Link from "next/link"
import ParlayPredictor from './parlay-predictor'

export default function ParlayPredictorPage() {
  return (
    <div className="relative min-h-screen bg-black text-white px-4 py-16">
      <Link
        href="/chat"
        className="absolute left-4 top-4 inline-flex items-center rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
      >
        Back to chat
      </Link>
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
