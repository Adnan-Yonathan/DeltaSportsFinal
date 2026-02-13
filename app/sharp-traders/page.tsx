import { createClient } from '@/lib/supabase/server'
import { getMembershipStatusFromMetadata } from '@/lib/utils/membership'
import ToolsNav from '@/components/tools-nav'
import MobileToolsNav from '@/components/mobile-tools-nav'
import SharpTradersClient from '../ev-bets/sharp-traders-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SharpTradersPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const hasProjectionAccess = membership.hasProjectionAccess
  const previewMode = !hasProjectionAccess

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-black/95 backdrop-blur-sm">
        <div className="px-2 py-4 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="md:hidden">
              <h1 className="text-base font-semibold text-white">Sharp Traders</h1>
              <p className="text-[11px] text-white/60">
                Track profitable wallets and open positions.
              </p>
            </div>
            <div className="hidden md:block">
              <ToolsNav />
            </div>
          </div>
        </div>
      </div>

      <div className="px-2 pt-[96px] pb-[96px] sm:px-4 sm:pt-24 sm:pb-0">
        <div className="mx-auto max-w-5xl space-y-6 py-6">
          <div className="hidden text-center md:block">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Sharp Traders</h1>
            <p className="mt-2 text-sm text-white/60">
              Track top profit Polymarket wallets and their open sports trades
            </p>
          </div>

          <SharpTradersClient previewMode={previewMode} />
        </div>
      </div>
      <MobileToolsNav />
    </div>
  )
}
