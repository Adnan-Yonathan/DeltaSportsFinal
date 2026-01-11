import ToolsNav from "@/components/tools-nav"
import StatsCenterClient from "./stats-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function StatsCenterPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/5">
        <div className="px-2 sm:px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ToolsNav />
          </div>
        </div>
      </div>
      <div className="pt-[72px] px-2 sm:px-4">
        <div className="mx-auto w-full max-w-none space-y-6 py-6">
          <header className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Stats Center
            </p>
            <h1 className="text-3xl font-semibold">
              Team and player stats
            </h1>
            <p className="max-w-2xl text-sm text-white/60">
              Pull ESPN-backed stats across NBA, NFL, MLB, NCAAB, and CFB. Search teams,
              players, and injuries from one place.
            </p>
          </header>
          <StatsCenterClient />
        </div>
      </div>
    </div>
  )
}
