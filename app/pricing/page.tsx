import Link from "next/link"
import { PricingSectionDemo } from "@/components/ui/pricing-section-demo"

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-black text-white animate-fade-in">
      <div className="mx-auto flex w-full max-w-5xl items-center px-4 pt-8">
        <Link
          href="/chat"
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
        >
          Back to Home
        </Link>
      </div>
      <PricingSectionDemo />
    </main>
  )
}
