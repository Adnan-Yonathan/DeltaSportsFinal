import Link from "next/link"
import { PricingSectionDemo } from "@/components/ui/pricing-section-demo"

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-black text-white animate-fade-in pt-6 sm:pt-8">
      <div className="absolute left-4 top-10 sm:top-12 z-10">
        <Link
          href="/chat"
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
        >
          Back to Home
        </Link>
      </div>
      <div className="-mt-5 md:-mt-10 origin-top scale-[0.68] sm:scale-[0.74] lg:scale-[0.8] flex flex-col items-center">
        <PricingSectionDemo />
        <Link
          href="/chat"
          className="mt-0 text-sm uppercase tracking-[0.3em] text-white/70 hover:text-white transition-colors leading-tight"
        >
          Continue free
        </Link>
      </div>
    </main>
  )
}
