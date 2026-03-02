import ParlayPredictor from './parlay-predictor'
import { createClient } from "@/lib/supabase/server"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"

export const dynamic = "force-dynamic"

export default async function ParlayPredictorPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const hasProjectionAccess = membership.hasProjectionAccess
  const previewMode = !hasProjectionAccess
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-2 pt-4 sm:px-4 sm:pt-5">
        <div className="mx-auto w-full max-w-5xl py-4 sm:py-6">
          <ParlayPredictor previewMode={previewMode} />
        </div>
      </div>
    </div>
  )
}
