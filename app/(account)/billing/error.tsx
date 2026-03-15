'use client'

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-2xl rounded-[30px] border border-red-400/20 bg-[#170b0b] p-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-100/55">
          Billing Error
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-white">We could not load subscription details.</h1>
        <p className="mt-3 text-sm leading-6 text-white/62">
          This can happen if Stripe is temporarily unavailable or the account is missing billing metadata. Try again first. If the issue persists, support should check the linked Stripe customer and subscription records.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-white/15 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Retry
          </button>
        </div>
        {error.digest ? (
          <div className="mt-4 text-xs text-white/35">Digest: {error.digest}</div>
        ) : null}
      </div>
    </main>
  )
}
