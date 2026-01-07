import Link from "next/link"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function PlayerProjectionsPage() {
  return (
    <div className="relative min-h-screen bg-black text-white px-2 py-10 sm:px-4">
      <Link
        href="/chat"
        className="absolute left-4 top-4 inline-flex items-center rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
      >
        Back to chat
      </Link>
      <div className="mx-auto w-full max-w-none space-y-6">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            NBA Player Projections
          </p>
          <h1 className="text-3xl font-semibold">Points, rebounds, assists</h1>
          <p className="max-w-2xl text-sm text-white/60">
            Delta projections for today&apos;s slate. Shows the market line,
            Delta projection, and edge percentage.
          </p>
        </header>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Coming soon
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Player projections are being finalized.
          </h2>
          <p className="mt-3 text-sm text-white/60">
            We&apos;ll unlock this once the model is fully calibrated.
          </p>
        </div>
      </div>
    </div>
  )
}
