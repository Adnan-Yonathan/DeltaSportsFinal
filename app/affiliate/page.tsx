import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AffiliateDashboard from '@/components/affiliate-dashboard'

export const dynamic = 'force-dynamic'

export default async function AffiliatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/affiliate')
  }

  return <AffiliateDashboard />
}
