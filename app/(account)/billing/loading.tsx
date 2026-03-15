export default function BillingLoading() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6 animate-pulse">
        <div className="rounded-[36px] border border-white/10 bg-white/[0.03] p-8">
          <div className="h-4 w-24 rounded-full bg-white/10" />
          <div className="mt-5 h-12 w-2/3 rounded-2xl bg-white/10" />
          <div className="mt-4 h-5 w-full max-w-3xl rounded-2xl bg-white/10" />
          <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="h-44 rounded-[28px] bg-white/10" />
            <div className="h-44 rounded-[28px] bg-white/10" />
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-64 rounded-[30px] bg-white/10" />
          <div className="h-64 rounded-[30px] bg-white/10" />
        </div>
      </div>
    </main>
  )
}
