import { createClient } from '@/lib/supabase/server'
import { getMembershipStatusFromMetadata } from '@/lib/utils/membership'
import ToolsNav from '@/components/tools-nav'
import LineShoppingClient from './line-shopping-client'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LineShoppingPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const hasPaidAccess = membership.hasPaidAccess
  if (!hasPaidAccess) {
    redirect('/sharp-detector')
  }
  const previewMode = false

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-black/95 backdrop-blur-sm">
        <div className="px-2 py-4 sm:px-4">
          <ToolsNav />
        </div>
      </div>

      <div className="px-2 pt-20 sm:px-4 sm:pt-24">
        <div className="mx-auto max-w-7xl space-y-6 py-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Line Shopping</h1>
            <p className="mt-2 text-sm text-white/60">
              Compare odds across sportsbooks to find the best lines
            </p>
          </div>

        <LineShoppingClient previewMode={previewMode} />
        </div>
      </div>
    </div>
  )
}
