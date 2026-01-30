import ParlayPredictor from './parlay-predictor'
import { createClient } from "@/lib/supabase/server"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"
import ToolsNav from "@/components/tools-nav"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ParlayPredictorPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const hasPaidAccess = membership.hasPaidAccess
  if (!hasPaidAccess) {
    redirect("/sharp-detector")
  }
  const previewMode = false
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Fixed navigation header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/5">
        <div className="px-2 sm:px-4 py-4">
          <ToolsNav />
        </div>
      </div>
      {/* Content with top padding to account for fixed header */}
      <div className="pt-[72px] px-2 sm:px-4">
        <div className="mx-auto w-full max-w-5xl py-4 sm:py-6">
          <ParlayPredictor previewMode={previewMode} />
        </div>
      </div>
    </div>
  )
}
