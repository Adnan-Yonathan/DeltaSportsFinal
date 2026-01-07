import Link from "next/link"

export default function ParlayPredictorPage() {
  return (
    <div className="relative min-h-screen bg-black text-white px-4 py-16">
      <Link
        href="/chat"
        className="absolute left-4 top-4 inline-flex items-center rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
      >
        Back to chat
      </Link>
      <h1 className="text-2xl font-semibold">Parlay Predictor</h1>
      <div className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">
          Coming soon
        </p>
        <p className="mt-3 text-sm text-white/70">
          Parlay prediction tools are next on the roadmap.
        </p>
      </div>
    </div>
  )
}
