import ResearchNav from './research-nav'
import MobileToolsNav from '@/components/mobile-tools-nav'

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-4 pb-[96px] pt-5 sm:pb-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 hidden md:block">
            <ResearchNav />
          </div>
          {children}
        </div>
      </div>
      <MobileToolsNav />
    </div>
  )
}
