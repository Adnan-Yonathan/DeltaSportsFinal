import Link from 'next/link'
import ResearchNav from './research-nav'
import MobileToolsNav from '@/components/mobile-tools-nav'

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-black/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/chat"
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/50 transition-colors hover:border-emerald-500/40 hover:text-emerald-200"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-white">Research Mode</h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">
                  Deep dive into betting analytics
                </p>
              </div>
            </div>

            {/* Research Nav - Client Component */}
            <div className="hidden md:block">
              <ResearchNav />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-24 pb-[96px] sm:pb-8">
        <div className="mx-auto max-w-6xl">
          {children}
        </div>
      </div>
      <MobileToolsNav />
    </div>
  )
}
